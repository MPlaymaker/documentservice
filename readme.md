Document Service

This service runs in kubernetes environment and lists the documents in the mounted directory in the UI.
When clicked to open the document, it opens it in a new browser tab.

The NodeJS DocumentService listens to 3000 port

1. Start Docker Desktop
2. Start Kubernetes Cluster
3. kubectl apply -f storage.yaml
   kubectl apply -f deployment.yaml

4. Start the cross-platform file watcher after the deployment is ready:

   ```sh
   node watch-documents.js "/path/to/your/documents"
   ```

   For macOS, for example:

   ```sh
   node watch-documents.js "/Users/myuser/mydocuments"
   ```

   For Windows PowerShell, for example:

   ```powershell
   node watch-documents.js "C:\Users\myuser\Documents"
   ```

   If no folder argument is supplied, the watcher uses `hostPath.path` from `storage.yaml`. It polls every two seconds, copies new and changed files (including files in subdirectories), and overwrites matching files in `/mnt/documents`. It leaves files in Kubernetes untouched when they are deleted locally. Keep it running while you want changes to sync; press Ctrl+C to stop it.

5. Forward the port so that 3000 inside the kubernetes cluster is reachable:
   kubectl port-forward svc/documentservice 3002:3000
   
6. localhost:3002
