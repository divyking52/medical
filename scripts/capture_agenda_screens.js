const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const agendaPath = path.resolve(__dirname, '..', 'agenda.html');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9250;

const proc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1440,1080',
  `file:///${agendaPath.replace(/\\/g, '/')}`
]);

async function capture() {
  await new Promise(r => setTimeout(r, 2000));
  const tabs = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  function sendCdp(method, params = {}) {
    return new Promise((res, rej) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', onMsg);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);

  // Capture hero viewport
  const heroShot = await sendCdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'agenda_hero.png'), Buffer.from(heroShot.data, 'base64'));
  console.log('✓ Captured agenda_hero.png');

  // Scroll to speakers
  await sendCdp('Runtime.evaluate', { expression: `window.scrollTo(0, 600);` });
  await new Promise(r => setTimeout(r, 600));
  const speakersShot = await sendCdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'agenda_speakers.png'), Buffer.from(speakersShot.data, 'base64'));
  console.log('✓ Captured agenda_speakers.png');

  // Scroll to recommendations
  await sendCdp('Runtime.evaluate', { expression: `window.scrollTo(0, 2400);` });
  await new Promise(r => setTimeout(r, 600));
  const recShot = await sendCdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'agenda_recommendations.png'), Buffer.from(recShot.data, 'base64'));
  console.log('✓ Captured agenda_recommendations.png');

  proc.kill();
}

capture().catch(e => {
  console.error(e);
  proc.kill();
});
