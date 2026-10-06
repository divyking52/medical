const { spawn } = require('child_process');
const fs = require('fs');

async function findStar() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9470',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9470/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
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
    await send('Page.enable');
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 1000));

    // Hide blurDropStrip so we see the raw video background
    await send('Runtime.evaluate', {
      expression: `(() => {
        const strip = document.getElementById('blurDropStrip');
        if (strip) strip.style.display = 'none';
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Capture the entire 1440x900 viewport
    const fullShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/raw_hero_desktop.png', Buffer.from(fullShot.data, 'base64'));

    // Capture bottom-right corner: x: 1000 to 1440, y: 550 to 900
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1000, y: 550, width: 440, height: 350, scale: 1 }
    });
    fs.writeFileSync('scripts/raw_star_search.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved raw_hero_desktop.png and raw_star_search.png');
  } finally {
    proc.kill();
  }
}
findStar().catch(console.error);
