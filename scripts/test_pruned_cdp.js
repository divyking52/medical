const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testPrunedSite() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(process.env.TEMP, 'chrome-test-' + Date.now());

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9460',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:8118/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9460/json/list');
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
        const sections = [...document.querySelectorAll('section')].map(s => ({
          id: s.id,
          class: s.className,
          number: s.querySelector('.section-number')?.innerText || null,
          tag: s.querySelector('.section-tag')?.innerText || null,
          headline: s.querySelector('.editorial-headline')?.innerText?.replace(/\\s+/g, ' ') || null
        }));

        const navLinks = [...document.querySelectorAll('.nav-links .nav-link')].map(l => ({
          text: l.innerText,
          href: l.getAttribute('href')
        }));

        const drawerLinks = [...document.querySelectorAll('.drawer-nav .drawer-link')].map(l => ({
          text: l.innerText.replace(/\\s+/g, ' '),
          href: l.getAttribute('href')
        }));

        const hasEventSection = !!document.getElementById('event');
        const hasContactoSection = !!document.getElementById('contacto');
        const translateBtn = document.getElementById('translateBtn');
        const btnRect = translateBtn?.getBoundingClientRect();

        // Test translation click
        translateBtn?.click();
        const langAfterClick = document.documentElement.lang;
        const navAfterClick = [...document.querySelectorAll('.nav-links .nav-link')].map(l => l.innerText);
        const contactoHeadlineEn = document.querySelector('.section-contacto .editorial-headline')?.innerText?.replace(/\\s+/g, ' ');

        // Toggle back to ES
        translateBtn?.click();
        const langAfterToggleBack = document.documentElement.lang;

        return JSON.stringify({
          sections,
          navLinks,
          drawerLinks,
          hasEventSection,
          hasContactoSection,
          translateBtn: btnRect ? {
            width: Math.round(btnRect.width),
            height: Math.round(btnRect.height),
            bottom: Math.round(window.innerHeight - btnRect.bottom),
            right: Math.round(window.innerWidth - btnRect.right)
          } : null,
          translationTest: {
            langAfterClick,
            navAfterClick,
            contactoHeadlineEn,
            langAfterToggleBack
          }
        });
      })()`,
      returnByValue: true
    });

    console.log('--- Verification Results ---');
    const parsed = JSON.parse(testResult.result.value);
    console.log(JSON.stringify(parsed, null, 2));

    // Capture screenshots: Hero and Contacto
    const heroShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/hero_pruned.png', Buffer.from(heroShot.data, 'base64'));
    console.log('Saved scripts/hero_pruned.png');

    // Scroll to #contacto
    await send('Runtime.evaluate', {
      expression: `(() => {
        document.getElementById('contacto')?.scrollIntoView();
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));
    const contactoShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/contacto_pruned.png', Buffer.from(contactoShot.data, 'base64'));
    console.log('Saved scripts/contacto_pruned.png');

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

testPrunedSite();
