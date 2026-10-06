const { spawn } = require('child_process');
const fs = require('fs');

async function testBoxes() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9488',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9488/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(res => ws.addEventListener('open', res));
    let id = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const curId = id++;
        const onMsg = ev => {
          const d = JSON.parse(ev.data);
          if (d.id === curId) {
            ws.removeEventListener('message', onMsg);
            resolve(d.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }
    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.getElementById('scrollCanvas');
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        const vw = 1280;
        const vh = 720;
        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;

        // Try Y = 515, 545, 575 in native video
        const ys = [515, 545, 575];
        const colors = ['red', 'green', 'yellow'];

        ys.forEach((vy, i) => {
          const sx = dx + 1160 * scale;
          const sy = dy + vy * scale;
          const box = document.createElement('div');
          box.style.position = 'fixed';
          box.style.left = sx + 'px';
          box.style.top = sy + 'px';
          box.style.width = '60px';
          box.style.height = '60px';
          box.style.transform = 'translate(-50%, -50%)';
          box.style.border = '2px solid ' + colors[i];
          box.style.zIndex = '9999';
          box.innerText = 'Y=' + vy;
          box.style.color = colors[i];
          box.style.fontSize = '12px';
          box.style.fontWeight = 'bold';
          document.body.appendChild(box);
        });
      })()`
    });

    const crop = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1100, y: 450, width: 340, height: 350, scale: 1 }
    });
    fs.writeFileSync('scripts/star_boxes_comparison.png', Buffer.from(crop.data, 'base64'));
    console.log('Saved star_boxes_comparison.png');

  } finally {
    proc.kill();
  }
}
testBoxes().catch(console.error);
