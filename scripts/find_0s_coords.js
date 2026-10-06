const { spawn } = require('child_process');
const fs = require('fs');

async function findExact0s() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9486',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9486/json/list');
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

    const result = await send('Runtime.evaluate', {
      expression: `(async () => {
        const img = new Image();
        img.src = 'data:image/png;base64,${fs.readFileSync('scripts/video_frame_0s.png').toString('base64')}';
        await new Promise(r => img.onload = r);
        const c = document.createElement('canvas');
        c.width = 280;
        c.height = 270;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        ctx.fillStyle = 'red';
        ctx.font = '10px monospace';
        for (let x = 0; x <= 280; x += 20) {
          ctx.fillRect(x, 0, 1, 270);
          ctx.fillText(x, x + 2, 10);
        }
        for (let y = 0; y <= 270; y += 20) {
          ctx.fillRect(0, y, 280, 1);
          ctx.fillText(y, 2, y + 10);
        }

        return c.toDataURL('image/png');
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    const base64 = result.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('scripts/frame_0s_ruler.png', Buffer.from(base64, 'base64'));
    console.log('Saved frame_0s_ruler.png');

  } finally {
    proc.kill();
  }
}
findExact0s().catch(console.error);
