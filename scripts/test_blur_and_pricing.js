const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testBlurAndPricing() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(process.env.TEMP, 'chrome-test-' + Date.now());

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9462',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:8118/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9462/json/list');
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

        const hasSponsorsSection = !!document.getElementById('sponsors');
        const hasPricingTable = !!document.querySelector('.sponsor-cards-grid, .luxury-sponsor-card');
        const blurDropStrip = document.getElementById('blurDropStrip');
        const stripRect = blurDropStrip ? blurDropStrip.getBoundingClientRect() : null;
        const stripComputed = blurDropStrip ? window.getComputedStyle(blurDropStrip) : null;

        // Test translation click via blurDropStrip
        let langAfterClick = null;
        let navAfterClick = null;
        let contactoHeadlineEn = null;
        let alliesHeadlineEn = null;
        let langAfterToggleBack = null;

        if (blurDropStrip) {
          blurDropStrip.click();
          langAfterClick = document.documentElement.lang;
          navAfterClick = [...document.querySelectorAll('.nav-links .nav-link')].map(l => l.innerText);
          alliesHeadlineEn = document.querySelector('.section-allies .editorial-headline')?.innerText?.replace(/\\s+/g, ' ');
          contactoHeadlineEn = document.querySelector('.section-contacto .editorial-headline')?.innerText?.replace(/\\s+/g, ' ');

          // Toggle back to ES via langNavToggle
          const langNav = document.getElementById('langNavToggle');
          if (langNav) langNav.click();
          langAfterToggleBack = document.documentElement.lang;
        }

        return JSON.stringify({
          sections,
          navLinks,
          drawerLinks,
          hasSponsorsSection,
          hasPricingTable,
          blurDropStrip: stripRect ? {
            x: Math.round(stripRect.x),
            y: Math.round(stripRect.y),
            width: Math.round(stripRect.width),
            height: Math.round(stripRect.height),
            bottomFromViewport: Math.round(window.innerHeight - stripRect.bottom),
            rightFromViewport: Math.round(window.innerWidth - stripRect.right),
            backdropFilter: stripComputed ? stripComputed.backdropFilter || stripComputed.webkitBackdropFilter : null,
            background: stripComputed ? stripComputed.backgroundColor : null,
            position: stripComputed ? stripComputed.position : null,
            zIndex: stripComputed ? stripComputed.zIndex : null
          } : null,
          translationTest: {
            langAfterClick,
            navAfterClick,
            alliesHeadlineEn,
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

    // Full viewport Hero screenshot
    const heroShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/hero_with_blur_strip.png', Buffer.from(heroShot.data, 'base64'));
    console.log('Saved scripts/hero_with_blur_strip.png');

    // Cropped screenshot of bottom-right area (where star watermark was located)
    // 1440x900 viewport: bottom-right corner around x: 1200..1440, y: 700..900
    const cropShot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: 1200,
        y: 680,
        width: 240,
        height: 220,
        scale: 1
      }
    });
    fs.writeFileSync('scripts/star_area_crop.png', Buffer.from(cropShot.data, 'base64'));
    console.log('Saved scripts/star_area_crop.png');

    console.log('\n--- Console Logs ---');
    if (consoleMessages.length === 0) console.log('None.');
    else consoleMessages.forEach(m => console.log(m));

    console.log('\n--- Exceptions / Errors ---');
    if (errors.length === 0) console.log('None.');
    else errors.forEach(e => console.log(e));

  } finally {
    proc.kill();
  }
}

testBlurAndPricing().catch(err => {
  console.error(err);
  process.exit(1);
});
