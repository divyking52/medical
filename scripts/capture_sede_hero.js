const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('sede.html');
const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9224',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_sede_test',
  'about:blank'
]);

const sleep = ms => new Promise(r => setTimeout(r, ms));

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9224/json/list');
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: fileUrl });
    await sleep(2000);

    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'sede_hero_before.png'), Buffer.from(ss.data, 'base64'));
    console.log('✓ Captured sede_hero_before.png');

    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    proc.kill();
    process.exit(0);
  }
}, 1500);
