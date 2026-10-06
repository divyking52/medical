const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_shots',
  'about:blank'
]);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(url, outPath, ws) {
  return new Promise((resolve) => {
    let msgId = 100;
    
    function send(method, params = {}) {
      ws.send(JSON.stringify({ id: ++msgId, method, params }));
    }

    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === msgId && msg.result && msg.result.data) {
        fs.writeFileSync(outPath, Buffer.from(msg.result.data, 'base64'));
        console.log(`Saved screenshot: ${outPath}`);
        ws.removeEventListener('message', handler);
        resolve();
      }
    };

    ws.addEventListener('message', handler);

    send('Page.navigate', { url });

    setTimeout(() => {
      send('Page.captureScreenshot', { format: 'png' });
    }, 2500);
  });
}

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

    ws.onopen = async () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Emulation.setDeviceMetricsOverride', params: {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      }}));

      await sleep(500);
      await takeScreenshot('http://localhost:8118/galeria.html', 'scripts/screenshot_galeria.png', ws);
      await sleep(500);
      await takeScreenshot('http://localhost:8118/index.html', 'scripts/screenshot_index.png', ws);
      await sleep(500);
      await takeScreenshot('http://localhost:8118/expo.html', 'scripts/screenshot_expo.png', ws);

      ws.close();
      proc.kill();
      process.exit(0);
    };

  } catch (err) {
    console.error('Err:', err);
    proc.kill();
    process.exit(1);
  }
}, 1500);
