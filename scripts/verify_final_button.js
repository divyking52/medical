const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function verifyFinal() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(process.env.TEMP, 'chrome-test-' + Date.now());

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9498',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:8118/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9498/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const id = msgId++;
        const onMsg = ev => {
          const d = JSON.parse(ev.data);
          if (d.id === id) {
            ws.removeEventListener('message', onMsg);
            resolve(d.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const consoleLogs = [];
    const errors = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push(`[${msg.params.type}] ${msg.params.args.map(a => a.value || a.description || '').join(' ')}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 1500));

    // Evaluate button state and position
    const evalData = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('translateBtn');
        const label = document.getElementById('translateBtnLabel');
        const rect = btn?.getBoundingClientRect();
        const initialText = label?.textContent;
        const initialLang = document.documentElement.lang;

        // Click to toggle
        btn?.click();
        const textAfterClick = label?.textContent;
        const langAfterClick = document.documentElement.lang;

        // Click back
        btn?.click();
        const textAfterBack = label?.textContent;
        const langAfterBack = document.documentElement.lang;

        return {
          btnExists: !!btn,
          rect: rect ? {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            rightFromViewport: Math.round(window.innerWidth - rect.right),
            bottomFromViewport: Math.round(window.innerHeight - rect.bottom)
          } : null,
          initialText,
          initialLang,
          textAfterClick,
          langAfterClick,
          textAfterBack,
          langAfterBack
        };
      })()`,
      returnByValue: true
    });

    console.log('--- Evaluation Results ---');
    console.log(JSON.stringify(evalData.result.value, null, 2));

    // Capture crop of the button covering the star mark
    const crop = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1050, y: 480, width: 370, height: 320, scale: 1 }
    });
    fs.writeFileSync('scripts/final_star_crop.png', Buffer.from(crop.data, 'base64'));

    // Capture full desktop hero screenshot
    const heroShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/final_hero_desktop.png', Buffer.from(heroShot.data, 'base64'));

    console.log('\n--- Console Logs ---');
    if (consoleLogs.length === 0) console.log('None.');
    else consoleLogs.forEach(c => console.log(c));

    console.log('\n--- Exceptions / Errors ---');
    if (errors.length === 0) console.log('None.');
    else errors.forEach(e => console.log(e));

  } finally {
    proc.kill();
  }
}

verifyFinal().catch(console.error);
