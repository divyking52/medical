const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_hero_hover',
  'about:blank'
]);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

    let msgId = 700;
    function send(method, params = {}) {
      ws.send(JSON.stringify({ id: ++msgId, method, params }));
    }

    ws.onopen = async () => {
      send('Page.enable');
      send('Runtime.enable');
      send('Input.enable');
      send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      send('Page.navigate', { url: 'http://localhost:8118/index.html' });
      await sleep(2500);

      // Dispatch mouse move over hero center
      send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: 720,
        y: 450
      });

      await sleep(800);

      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === msgId && msg.result && msg.result.data) {
          fs.writeFileSync('scripts/screenshot_hero_smoke_hover.png', Buffer.from(msg.result.data, 'base64'));
          console.log('Saved hero smoke hover screenshot');
          ws.close();
          proc.kill();
          process.exit(0);
        }
      };

      ws.addEventListener('message', handler);
      send('Page.captureScreenshot', { format: 'png' });
    };

  } catch (err) {
    console.error(err);
    proc.kill();
    process.exit(1);
  }
}, 1500);
