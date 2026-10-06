const { spawn } = require('child_process');
const fs = require('fs');

async function checkFrames() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9480',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9480/json/list');
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

    // Seek to 3s (scene 02 / 03) and capture the bottom-right corner of the native video
    const times = [0, 2.5, 6.0, 9.0];
    for (const t of times) {
      const data = await send('Runtime.evaluate', {
        expression: `(async () => {
          const v = document.getElementById('sourceVideo');
          v.currentTime = ${t};
          await new Promise(r => {
            const onSeek = () => {
              v.removeEventListener('seeked', onSeek);
              r();
            };
            v.addEventListener('seeked', onSeek);
          });
          const c = document.createElement('canvas');
          c.width = 280;
          c.height = 270;
          const ctx = c.getContext('2d');
          ctx.drawImage(v, 1000, 450, 280, 270, 0, 0, 280, 270);
          return c.toDataURL('image/png');
        })()`,
        awaitPromise: true,
        returnByValue: true
      });
      const base64 = data.result.value.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(`scripts/video_frame_${t}s.png`, Buffer.from(base64, 'base64'));
      console.log(`Saved video_frame_${t}s.png`);
    }

  } finally {
    proc.kill();
  }
}
checkFrames().catch(console.error);
