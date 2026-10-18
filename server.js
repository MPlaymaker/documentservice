const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DOCS_DIR = process.env.DOCS_DIR || '/mnt/documents';

// 1. List files by index
app.get('/', (req, res) => {
  fs.readdir(DOCS_DIR, (err, files) => {
    if (err) {
      return res.status(500).send(`Error reading storage path (${DOCS_DIR}): ${err.message}`);
    }

    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>MES 2.0 Document Viewer</title></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>MES 2.0 Document Index</h2>
        <p>Documents loaded from mounted storage path: <code>${DOCS_DIR}</code></p>
        <ol>
    `;

    if (pdfFiles.length === 0) {
      html += `<li><em>No PDF documents found in mounted storage. Drop files into ~/mydocuments on your Mac.</em></li>`;
    } else {
      pdfFiles.forEach((file, idx) => {
        html += `
          <li style="margin-bottom: 8px;">
            <strong>${file}</strong> 
            — <a href="/pdf/${encodeURIComponent(file)}" target="_blank">Open in New Tab</a>
          </li>`;
      });
    }

    html += `</ol></body></html>`;
    res.send(html);
  });
});

// 2. Stream individual PDF inline so it opens in the browser tab
app.get('/pdf/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(DOCS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Document not found');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.listen(PORT, () => {
  console.log(`MES Document Service running on port ${PORT}`);
});