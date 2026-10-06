const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testPage() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(process.env.TEMP, 'chrome-test-' + Date.now());

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9455',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:8118/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9455/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    if (!pageTab) throw new Error('Page tab not found in Chrome debugging endpoint');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const onMsg = (ev) => {
          const data = JSON.parse(ev.data);
          if (data.id === id) {
            ws.removeEventListener('message', onMsg);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const consoleMessages = [];
    const errors = [];

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        consoleMessages.push(`[CONSOLE ${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const text = msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || '');
        errors.push(`[EXCEPTION] ${text}`);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    await new Promise(r => setTimeout(r, 2000));

    // Evaluate tests
    const testResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const topInfoBar = document.querySelector('.top-info-bar');
        const mainNav = document.getElementById('mainNav');
        const navRect = mainNav?.getBoundingClientRect();
        const translateBtn = document.getElementById('translateBtn');
        const btnRect = translateBtn?.getBoundingClientRect();
        const mask = document.querySelector('.star-watermark-mask');

        const initialLang = document.documentElement.lang;
        const initialHeroText = document.querySelector('.scene-hero .hero-title')?.innerText;

        // Trigger translation click
        translateBtn?.click();
        const translatedLang = document.documentElement.lang;
        const translatedHeroText = document.querySelector('.scene-hero .hero-title')?.innerText;
        const translatedBtnLabel = translateBtn?.innerText;

        // Toggle back
        translateBtn?.click();
        const toggledBackLang = document.documentElement.lang;

        return JSON.stringify({
          topInfoBarExists: !!topInfoBar,
          navTopPosition: navRect ? navRect.top : null,
          translateBtnExists: !!translateBtn,
          translateBtnPosition: btnRect ? {
            left: Math.round(btnRect.left),
            top: Math.round(btnRect.top),
            right: Math.round(window.innerWidth - btnRect.right),
            bottom: Math.round(window.innerHeight - btnRect.bottom),
            width: Math.round(btnRect.width),
            height: Math.round(btnRect.height)
          } : null,
          starWatermarkMaskExists: !!mask,
          initialLang,
          initialHeroText,
          translatedLang,
          translatedHeroText,
          translatedBtnLabel,
          toggledBackLang
        });
      })()`,
      returnByValue: true
    });

    console.log('--- Verification Results ---');
    console.log(JSON.parse(testResult.result.value));

    console.log('\n--- Console Logs ---');
    if (consoleMessages.length === 0) console.log('None.');
    else consoleMessages.forEach(m => console.log(m));

    console.log('\n--- Exceptions / Errors ---');
    if (errors.length === 0) console.log('None! Zero exceptions.');
    else errors.forEach(e => console.error(e));

    ws.close();
    proc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  } catch (err) {
    console.error('Test failed:', err);
    proc.kill();
    process.exit(1);
  }
}

testPage();
