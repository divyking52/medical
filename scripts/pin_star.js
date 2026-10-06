const { spawn } = require('child_process');
const fs = require('fs');

async function pinStar() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9494',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9494/json/list');
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
        img.src = 'data:image/png;base64,${fs.readFileSync('scripts/raw_hero_desktop.png').toString('base64')}';
        await new Promise(r => img.onload = r);
        const c = document.createElement('canvas');
        // raw_hero_desktop is the full screen image
        // Let's crop from x: 1200 to 1400, y: 500 to 700
        c.width = 200;
        c.height = 200;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 1200, 500, 200, 200, 0, 0, 200, 200);

        // Grid lines every 10px
        ctx.fillStyle = 'magenta';
        ctx.font = '8px monospace';
        for (let x = 0; x <= 200; x += 10) {
          ctx.fillRect(x, 0, 1, 200);
          if (x % 20 === 0) ctx.fillText(1200 + x, x + 1, 10);
        }
        for (let y = 0; y <= 200; y += 10) {
          ctx.fillRect(0, y, 200, 1);
          if (y % 20 === 0) ctx.fillText(500 + y, 2, y + 8);
        }

        return c.toDataURL('image/png');
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    const base64 = result.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('scripts/desktop_hero_star_pinpoint.png', Buffer.from(base64, 'base64'));
    console.log('Saved desktop_hero_star_pinpoint.png');

  } finally {
    proc.kill();
  }
}
pinStar().catch(console.error);
