const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Quick local static HTTP server
const PORT = 8122;
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(__dirname, '..', reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_hero_test',
    'about:blank'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  await sleep(1500);

  try {
    const listRes = await fetch('http://127.0.0.1:9223/json/list');
    const tabs = await listRes.json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

    let msgId = 100;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = ++msgId;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const errors = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push(`[EXCEPTION] ${d.text}: ${d.exception ? d.exception.description : ''}`);
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        errors.push(`[LOG ERROR] ${msg.params.entry.text}`);
      }
    });

    await new Promise(r => { ws.onopen = r; });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:' + PORT + '/index.html...');
    await send('Page.navigate', { url: `http://localhost:${PORT}/index.html` });
    await sleep(2500);

    // Check 1: Verify .hero-smoke-wrap is completely gone
    const smokeWrapCheck = await send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('.hero-smoke-wrap'))`
    });
    console.log(`Hero smoke element present?`, smokeWrapCheck.result.value);

    // Check 2: Verify hero canvas exists and has valid dimensions
    const canvasCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const c = document.getElementById('cinemaCanvas');
        return c ? { w: c.width, h: c.height, clientW: c.clientWidth, clientH: c.clientHeight } : null;
      })()`,
      returnByValue: true
    });
    console.log('Canvas metrics:', canvasCheck.result.value);

    // Take screenshot of Initial Hero state (Scroll 0)
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'hero_scroll_0.png'), Buffer.from(ss1.data, 'base64'));
    console.log('✓ Captured hero_scroll_0.png');

    // Check 3: Scroll smoothly and inspect Scene 01, Scene 02 transition & transforms
    const scrollPositions = [400, 800, 1200, 1600];
    for (const y of scrollPositions) {
      await send('Runtime.evaluate', {
        expression: `window.scrollTo({ top: ${y}, behavior: 'instant' });`
      });
      await sleep(150);

      const sceneState = await send('Runtime.evaluate', {
        expression: `(() => {
          const blocks = Array.from(document.querySelectorAll('.scene-block')).map((b, i) => ({
            index: i + 1,
            opacity: b.style.opacity,
            transform: b.style.transform,
            filter: b.style.filter,
            active: b.classList.contains('active')
          }));
          const progress = document.querySelector('.scroll-progress-fill')?.style.width;
          const timecode = document.querySelector('.timecode-hud')?.textContent;
          return { progress, timecode, blocks };
        })()`,
        returnByValue: true
      });
      console.log(`Scroll @ ${y}px:`, JSON.stringify(sceneState.result.value));
    }

    // Capture screenshot at scroll 1200
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'hero_scroll_mid.png'), Buffer.from(ss2.data, 'base64'));
    console.log('✓ Captured hero_scroll_mid.png');

    // Also test congreso_turismo_medico_completo.html
    console.log('\nNavigating to unified standalone single-file...');
    await send('Page.navigate', { url: `http://localhost:${PORT}/congreso_turismo_medico_completo.html` });
    await sleep(2500);

    const unifiedSmokeCheck = await send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('.hero-smoke-wrap'))`
    });
    console.log('Unified file hero smoke element present?', unifiedSmokeCheck.result.value);

    const ss3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'hero_unified_single_file.png'), Buffer.from(ss3.data, 'base64'));
    console.log('✓ Captured hero_unified_single_file.png');

    console.log('\nTotal errors encountered:', errors.length);
    if (errors.length) {
      console.log(errors);
    }

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    proc.kill();
    server.close();
    console.log('All tests finished.');
    process.exit(0);
  }
});
