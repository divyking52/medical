const { spawn } = require('child_process');
const fs = require('fs');

async function findCenter() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9482',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9482/json/list');
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
        img.src = 'data:image/png;base64,${fs.readFileSync('scripts/video_frame_2.5s.png').toString('base64')}';
        await new Promise(r => img.onload = r);
        const c = document.createElement('canvas');
        c.width = 280;
        c.height = 270;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Overlay crosshairs and grid lines every 10px on the star
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 1;
        for (let x = 120; x <= 200; x += 10) {
          ctx.beginPath();
          ctx.moveTo(x, 100);
          ctx.lineTo(x, 200);
          ctx.stroke();
        }
        for (let y = 100; y <= 200; y += 10) {
          ctx.beginPath();
          ctx.moveTo(120, y);
          ctx.lineTo(200, y);
          ctx.stroke();
        }

        return c.toDataURL('image/png');
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    const base64 = result.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('scripts/star_measured_grid.png', Buffer.from(base64, 'base64'));
    console.log('Saved star_measured_grid.png');

  } finally {
    proc.kill();
  }
}
findCenter().catch(console.error);
