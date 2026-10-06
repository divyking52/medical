const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8135;
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const fp = path.join(__dirname, '..', 'medical-tourism-congress-export', reqPath);
  if (fs.existsSync(fp)) {
    const ext = path.extname(fp);
    const ct = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(fs.readFileSync(fp));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, async () => {
  console.log('Verifying exported index.html at http://localhost:' + PORT);
  const proc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_export_test',
    'about:blank'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);

  try {
    const list = await (await fetch('http://127.0.0.1:9235/json/list')).json();
    const ws = new WebSocket(list[0].webSocketDebuggerUrl);
    let msgId = 100;
    const send = (method, params = {}) => new Promise(res => {
      const id = ++msgId;
      const h = e => {
        const d = JSON.parse(e.data);
        if (d.id === id) { ws.removeEventListener('message', h); res(d.result); }
      };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });

    const errors = [];
    ws.addEventListener('message', e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text);
    });

    await new Promise(r => { ws.onopen = r; });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:' + PORT + '/index.html' });

    let pageState = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const evalRes = await send('Runtime.evaluate', {
        expression: `(() => {
          return {
            ready: document.readyState === 'complete',
            hasGsap: typeof window.gsap !== 'undefined',
            hasScrollTrigger: typeof window.ScrollTrigger !== 'undefined',
            views: document.querySelectorAll('.spa-view').length,
            scenes: document.querySelectorAll('.scene-block').length
          };
        })()`,
        returnByValue: true
      });
      if (evalRes && evalRes.result && evalRes.result.value && evalRes.result.value.views >= 5 && evalRes.result.value.hasGsap) {
        pageState = evalRes.result.value;
        break;
      }
    }
    console.log('Export check result:', pageState);
    console.log('Total errors:', errors.length);
    if (errors.length) console.log(errors);
    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    proc.kill();
    server.close();
    process.exit(0);
  }
});
