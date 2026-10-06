const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function cdpSend(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const handleMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handleMsg);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handleMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function captureAllScenes() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const outDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9555',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    '--user-data-dir=' + path.join(process.env.TEMP, 'chrome-scenes-' + Date.now()),
    'http://127.0.0.1:8118/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const tabs = await getJson('http://127.0.0.1:9555/json/list');
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    if (!pageTab) throw new Error('Page tab not found');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    let msgId = 1;
    await cdpSend(ws, msgId++, 'Page.enable');
    await cdpSend(ws, msgId++, 'Runtime.enable');
    await cdpSend(ws, msgId++, 'Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await new Promise(r => setTimeout(r, 2500));

    async function takeScreenshot(name) {
      const res = await cdpSend(ws, msgId++, 'Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, `${name}.png`);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`Saved: ${filePath}`);
    }

    async function setScrollProgress(p) {
      await cdpSend(ws, msgId++, 'Runtime.evaluate', {
        expression: `
          (() => {
            const stage = document.getElementById('cinemaStage');
            const maxScroll = stage.offsetHeight - window.innerHeight;
            const targetY = maxScroll * ${p};
            if (window.lenis) {
              window.lenis.scrollTo(targetY, { immediate: true });
            } else {
              window.scrollTo(0, targetY);
            }
            window.dispatchEvent(new Event('scroll'));
          })()
        `
      });
      // Allow video to seek and render
      await new Promise(r => setTimeout(r, 1200));
    }

    console.log('Capturing Scene 1 (0%)...');
    await setScrollProgress(0);
    await takeScreenshot('scene_01_hero');

    console.log('Capturing Scene 2 (28%)...');
    await setScrollProgress(0.28);
    await takeScreenshot('scene_02_business');

    console.log('Capturing Scene 3 (48%)...');
    await setScrollProgress(0.48);
    await takeScreenshot('scene_03_agenda');

    console.log('Capturing Scene 4 (68%)...');
    await setScrollProgress(0.68);
    await takeScreenshot('scene_04_expo');

    console.log('Capturing Scene 5 (88%)...');
    await setScrollProgress(0.88);
    await takeScreenshot('scene_05_final_cta');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    proc.kill();
  }
}

captureAllScenes();
