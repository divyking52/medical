const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8130;
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
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
    '--remote-debugging-port=9232',
    '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_gsap_test2',
    'about:blank'
  ]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);

  try {
    const listRes = await fetch('http://127.0.0.1:9232/json/list');
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
        errors.push(`[EXCEPTION] ${d.text} at ${d.url || 'inline'}:${d.lineNumber}:${d.columnNumber}: ${d.exception ? d.exception.description : ''}`);
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

    // Wait until document finishes loading and scenes are ready
    let pageState = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const evalRes = await send('Runtime.evaluate', {
        expression: `(() => {
          return {
            ready: document.readyState === 'complete',
            scenes: document.querySelectorAll('.scene-block').length,
            hasGsap: typeof window.gsap !== 'undefined',
            hasScrollTrigger: typeof window.ScrollTrigger !== 'undefined',
            hasLenis: typeof window.lenis !== 'undefined'
          };
        })()`,
        returnByValue: true
      });
      if (evalRes && evalRes.result && evalRes.result.value && evalRes.result.value.hasGsap && evalRes.result.value.hasScrollTrigger) {
        pageState = evalRes.result.value;
        break;
      }
    }
    console.log('Engine check:', pageState);

    // Initial state screenshot
    const ssInit = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'hero_gsap_scene1.png'), Buffer.from(ssInit.data, 'base64'));
    console.log('✓ Captured hero_gsap_scene1.png');

    // 2. Step through scroll positions
    const scrollSteps = [0, 600, 1400, 2200, 3100, 4000];
    for (const y of scrollSteps) {
      await send('Runtime.evaluate', {
        expression: `(() => {
          if (window.lenis) {
            window.lenis.scrollTo(${y}, { immediate: true });
          } else {
            window.scrollTo({ top: ${y}, behavior: 'instant' });
          }
          if (window.ScrollTrigger) window.ScrollTrigger.update();
        })()`
      });
      await sleep(250);

      const state = await send('Runtime.evaluate', {
        expression: `(() => {
          const blocks = Array.from(document.querySelectorAll('.scene-block')).map((b, i) => ({
            scene: i + 1,
            opacity: parseFloat(window.getComputedStyle(b).opacity).toFixed(2),
            active: b.classList.contains('active')
          }));
          const counter = document.getElementById('sceneCounter')?.textContent;
          const progress = document.getElementById('progressBar')?.style.width;
          return { y: window.scrollY, counter, progress, blocks };
        })()`,
        returnByValue: true
      });
      console.log(`Scroll @ ${y}px:`, JSON.stringify(state.result.value));

      if (y === 1400) {
        const ssMid = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(__dirname, 'hero_gsap_scene2.png'), Buffer.from(ssMid.data, 'base64'));
        console.log('✓ Captured hero_gsap_scene2.png (Scene 02 - Negocios B2B)');
      } else if (y === 2200) {
        const ssMid = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(__dirname, 'hero_gsap_scene3.png'), Buffer.from(ssMid.data, 'base64'));
        console.log('✓ Captured hero_gsap_scene3.png (Scene 03 - Agenda Académica)');
      } else if (y === 3100) {
        const ssMid = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(__dirname, 'hero_gsap_scene4.png'), Buffer.from(ssMid.data, 'base64'));
        console.log('✓ Captured hero_gsap_scene4.png (Scene 04 - Expo Comercial)');
      }
    }

    // Capture screenshot at scroll 4000px (Scene 05)
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'hero_gsap_scene5.png'), Buffer.from(ss1.data, 'base64'));
    console.log('✓ Captured hero_gsap_scene5.png (Scene 05 - Final CTA)');

    // 3. Test unified single file as well
    console.log('\nTesting unified single-file...');
    await send('Page.navigate', { url: `http://localhost:${PORT}/congreso_turismo_medico_completo.html` });

    let unifiedState = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const evalRes = await send('Runtime.evaluate', {
        expression: `(() => {
          return {
            ready: document.readyState === 'complete',
            scenes: document.querySelectorAll('.scene-block').length,
            hasGsap: typeof window.gsap !== 'undefined',
            hasScrollTrigger: typeof window.ScrollTrigger !== 'undefined'
          };
        })()`,
        returnByValue: true
      });
      if (evalRes && evalRes.result && evalRes.result.value && evalRes.result.value.scenes >= 5) {
        unifiedState = evalRes.result.value;
        break;
      }
    }
    console.log('Unified engine check:', unifiedState);

    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'hero_gsap_unified.png'), Buffer.from(ss2.data, 'base64'));
    console.log('✓ Captured hero_gsap_unified.png');

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
    console.log('Test completed successfully.');
    process.exit(0);
  }
});
