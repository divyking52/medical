const { spawn } = require('child_process');
const fs = require('fs');

(async () => {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9470',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=375,812',
    'http://127.0.0.1:8118/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9470/json/list');
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

  let id = 1;
  const send = (method, params = {}) => new Promise(resolve => {
    const cur = id++;
    const handler = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id === cur) {
        ws.removeEventListener('message', handler);
        resolve(d.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 1500));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/mobile_hero.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/mobile_hero.png');

  // Open mobile drawer
  await send('Runtime.evaluate', { expression: "document.getElementById('mobileMenuBtn').click()" });
  await new Promise(r => setTimeout(r, 500));
  const drawerShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/mobile_drawer.png', Buffer.from(drawerShot.data, 'base64'));
  console.log('Saved scripts/mobile_drawer.png');

  ws.close();
  proc.kill();
})();
