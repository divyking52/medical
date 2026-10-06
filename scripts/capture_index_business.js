const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_index_sections',
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

    let msgId = 300;
    function send(method, params = {}) {
      ws.send(JSON.stringify({ id: ++msgId, method, params }));
    }

    ws.onopen = async () => {
      send('Page.enable');
      send('Runtime.enable');
      send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false
      });

      send('Page.navigate', { url: 'http://localhost:8118/index.html' });
      await sleep(2000);

      send('Runtime.evaluate', {
        expression: `(function() {
          const el = document.getElementById('business');
          if (el) {
            if (window.lenis) window.lenis.scrollTo(el, { immediate: true });
            else el.scrollIntoView();
          }
        })()`
      });

      await sleep(1500);

      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === msgId && msg.result && msg.result.data) {
          fs.writeFileSync('scripts/screenshot_index_business.png', Buffer.from(msg.result.data, 'base64'));
          console.log('Saved index business screenshot');
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
