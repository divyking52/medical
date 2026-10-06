const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const sedePath = path.resolve(__dirname, '..', 'sede.html');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9240;

const proc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1440,900',
  `file:///${sedePath.replace(/\\/g, '/')}`
]);

async function testSede() {
  await new Promise(r => setTimeout(r, 1500));
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

  const res = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const imgs = Array.from(document.querySelectorAll('img')).map(i => ({
          alt: i.alt,
          naturalWidth: i.naturalWidth,
          naturalHeight: i.naturalHeight,
          complete: i.complete
        }));
        const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.title);
        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim());

        return {
          title: document.title,
          totalImages: imgs.length,
          brokenImages: imgs.filter(i => i.naturalWidth === 0).length,
          images: imgs,
          iframes,
          headings
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Sede Page Test Results:', JSON.stringify(res.result.value, null, 2));
  proc.kill();
}

testSede().catch(e => {
  console.error(e);
  proc.kill();
});
