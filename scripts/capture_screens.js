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

async function capture() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const outDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9444',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    '--user-data-dir=' + path.join(process.env.TEMP, 'chrome-cap-' + Date.now()),
    'http://127.0.0.1:8118/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const tabs = await getJson('http://127.0.0.1:9444/json/list');
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

    // Listen to console logs
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[Browser Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', msg.params.exceptionDetails);
      }
    });

    // Wait for video ready
    console.log('Waiting for video and canvas to render...');
    await new Promise(r => setTimeout(r, 3000));

    async function takeScreenshot(name) {
      const res = await cdpSend(ws, msgId++, 'Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, `${name}.png`);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`Saved: ${filePath}`);
    }

    async function evaluate(expression) {
      const res = await cdpSend(ws, msgId++, 'Runtime.evaluate', { expression, returnByValue: true });
      return res.result.value;
    }

    // Capture 01: Hero Scene (0%)
    await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' });`);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('01_hero_scene');

    // Scroll to 25% (Business)
    await evaluate(`
      const stage = document.getElementById('cinemaStage');
      const maxScroll = stage.offsetHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.25, behavior: 'instant' });
    `);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('02_business_scene');

    // Scroll to 48% (Agenda scene)
    await evaluate(`
      const stage = document.getElementById('cinemaStage');
      const maxScroll = stage.offsetHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.48, behavior: 'instant' });
    `);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('03_agenda_scene');

    // Scroll to 68% (Expo scene)
    await evaluate(`
      const stage = document.getElementById('cinemaStage');
      const maxScroll = stage.offsetHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.68, behavior: 'instant' });
    `);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('04_expo_scene');

    // Scroll to 88% (Final CTA scene)
    await evaluate(`
      const stage = document.getElementById('cinemaStage');
      const maxScroll = stage.offsetHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.88, behavior: 'instant' });
    `);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('05_final_cta_scene');

    // Scroll to Section 01 (The Event)
    await evaluate(`document.getElementById('event').scrollIntoView();`);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('06_section_event');

    // Scroll to Section 02 (Business Matchmaking)
    await evaluate(`document.getElementById('business').scrollIntoView();`);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('07_section_business');

    // Scroll to Section 03 (Agenda)
    await evaluate(`document.getElementById('agenda').scrollIntoView();`);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('08_section_agenda');

    // Scroll to Section 04 (Expo)
    await evaluate(`document.getElementById('expo').scrollIntoView();`);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('09_section_expo');

    // Scroll to Section 05 (Sponsorships)
    await evaluate(`document.getElementById('sponsors').scrollIntoView();`);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('10_section_sponsors');

    // Scroll to Final Section & Footer
    await evaluate(`document.getElementById('register').scrollIntoView();`);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('11_section_final_footer');

    // Open Modal and capture
    await evaluate(`document.querySelector('.btn-register-trigger').click();`);
    await new Promise(r => setTimeout(r, 600));
    await takeScreenshot('12_registration_modal');

    ws.close();
  } catch (err) {
    console.error('Error in capture:', err);
  } finally {
    proc.kill();
  }
}

capture();
