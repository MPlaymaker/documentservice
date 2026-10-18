const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const SCRIPT_DIR = __dirname;
const STORAGE_FILE = path.join(SCRIPT_DIR, "storage.yaml");
const KUBERNETES_MOUNT_PATH = "/mnt/documents";
const POLL_INTERVAL_MS = 2000;

function getStorageSourceDirectory() {
  const storage = fs.readFileSync(STORAGE_FILE, "utf8");
  const match = storage.match(/hostPath:\s*\r?\n\s+path:\s*["']?([^"'\r\n]+?)["']?\s*(?:#.*)?$/m);
  return match?.[1];
}

function runKubectl(args, inputStream) {
  return new Promise((resolve, reject) => {
    const child = spawn("kubectl", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `kubectl exited with code ${code}`));
      }
    });

    if (inputStream) {
      inputStream.on("error", (error) => {
        child.kill();
        reject(error);
      });
      inputStream.pipe(child.stdin);
      child.stdin.on("error", (error) => {
        if (error.code !== "EPIPE") {
          child.kill();
          reject(error);
        }
      });
    } else {
      child.stdin.end();
    }
  });
}

async function listFiles(directory, relativeDirectory = "") {
  const files = new Map();
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      const nestedFiles = await listFiles(absolutePath, relativePath);
      for (const [nestedPath, details] of nestedFiles) files.set(nestedPath, details);
    } else if (entry.isFile()) {
      const stats = await fs.promises.stat(absolutePath);
      files.set(relativePath, {
        absolutePath,
        signature: `${stats.size}:${stats.mtimeMs}`,
      });
    }
  }

  return files;
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function getRunningPod() {
  const podName = await runKubectl([
    "get", "pods",
    "-l", "app=docapp",
    "--field-selector=status.phase=Running",
    "-o", "jsonpath={.items[0].metadata.name}",
  ]);

  if (!podName) throw new Error("No running pod found with label app=docapp");
  return podName;
}

async function uploadFile(podName, relativePath, absolutePath) {
  const remotePath = path.posix.join(
    KUBERNETES_MOUNT_PATH,
    relativePath.split(path.sep).join("/"),
  );
  const remoteDirectory = path.posix.dirname(remotePath);
  const command = `mkdir -p ${shellQuote(remoteDirectory)} && cat > ${shellQuote(remotePath)}`;
  const input = fs.createReadStream(absolutePath);

  await runKubectl(["exec", "-i", podName, "--", "sh", "-c", command], input);
}

async function main() {
  const sourceDirectory = process.argv[2] || process.env.LOCAL_DOCUMENTS_DIR || getStorageSourceDirectory();

  if (!sourceDirectory) {
    throw new Error("Provide a local documents folder as an argument or set LOCAL_DOCUMENTS_DIR.");
  }

  const absoluteSourceDirectory = path.resolve(sourceDirectory);
  const sourceStats = await fs.promises.stat(absoluteSourceDirectory).catch(() => null);
  if (!sourceStats?.isDirectory()) {
    throw new Error(`Local documents directory does not exist: ${absoluteSourceDirectory}`);
  }

  console.log(`Waiting for document-service deployment...`);
  await runKubectl(["rollout", "status", "deployment/docdeployment"]);
  console.log(`Watching ${absoluteSourceDirectory} for files to copy to ${KUBERNETES_MOUNT_PATH}. Press Ctrl+C to stop.`);

  const observations = new Map();
  const uploaded = new Map();

  while (true) {
    const files = await listFiles(absoluteSourceDirectory);

    for (const relativePath of observations.keys()) {
      if (!files.has(relativePath)) {
        observations.delete(relativePath);
        uploaded.delete(relativePath);
      }
    }

    for (const [relativePath, details] of files) {
      const previous = observations.get(relativePath);
      if (!previous || previous.signature !== details.signature) {
        observations.set(relativePath, { signature: details.signature, stableScans: 1 });
        continue;
      }

      previous.stableScans += 1;
      if (previous.stableScans < 2 || uploaded.get(relativePath) === details.signature) continue;

      try {
        const podName = await getRunningPod();
        await uploadFile(podName, relativePath, details.absolutePath);
        const afterUpload = await fs.promises.stat(details.absolutePath);
        const currentSignature = `${afterUpload.size}:${afterUpload.mtimeMs}`;
        if (currentSignature === details.signature) {
          uploaded.set(relativePath, details.signature);
          console.log(`Copied ${relativePath}`);
        }
      } catch (error) {
        console.error(`Could not copy ${relativePath}: ${error.message}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});