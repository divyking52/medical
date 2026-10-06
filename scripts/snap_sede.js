const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8125;
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/sede.html';
  const filePath = path.join(__dirname, '..', reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, async () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_sede_snap',
    'about:blank'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);

  try {
    const listRes = await fetch('http://127.0.0.1:9225/json/list');
    const tabs = await listRes.json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

    let msgId = 100;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = ++msgId;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(r => { ws.onopen = r; });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Testing dedicated sede.html...');
    await send('Page.navigate', { url: `http://localhost:${PORT}/sede.html` });
    await sleep(2000);

    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'sede_hero_after.png'), Buffer.from(ss.data, 'base64'));
    console.log('✓ Captured sede_hero_after.png');

    console.log('Testing unified single-file #sede view...');
    await send('Page.navigate', { url: `http://localhost:${PORT}/congreso_turismo_medico_completo.html#sede` });
    await sleep(2500);

    // Ensure sede view is activated if SPA router needs click or hash
    await send('Runtime.evaluate', {
      expression: `(() => {
        if (window.__switchView) {
          window.__switchView('sede');
        } else {
          const link = document.querySelector('a[href*="sede"]');
          if (link) link.click();
        }
      })()`
    });
    await sleep(1000);

    const ssUnified = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'sede_unified_after.png'), Buffer.from(ssUnified.data, 'base64'));
    console.log('✓ Captured sede_unified_after.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    proc.kill();
    server.close();
    process.exit(0);
  }
});
