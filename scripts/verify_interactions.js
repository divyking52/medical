const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const testDir = 'C:\\Users\\OMEN\\Downloads\\test_standalone_isolated';
const destFile = path.join(testDir, 'standalone.html');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromePort = 9235;

const chromeProc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${chromePort}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1440,900',
  `file:///${destFile.replace(/\\/g, '/')}`
]);

async function runTest() {
  await new Promise(r => setTimeout(r, 2000));

  const tabs = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${chromePort}/json`, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  function sendCdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', onMsg);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(resolve => ws.onopen = resolve);

  // 1. Test Registration Modal
  const modalTest = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const trigger = document.querySelector('.btn-register-trigger');
        const modal = document.getElementById('registerModal');
        trigger.click();
        const isOpenAfterClick = modal.classList.contains('open');
        const closeBtn = document.getElementById('modalCloseBtn');
        closeBtn.click();
        const isOpenAfterClose = modal.classList.contains('open');
        return { isOpenAfterClick, isOpenAfterClose };
      })()
    `,
    returnByValue: true
  });
  console.log('Registration Modal Test:', modalTest.result.value);

  // 2. Test Floorplan Lightbox
  const lightboxTest = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const trigger = document.getElementById('floorplanTrigger');
        const lightbox = document.getElementById('floorplanLightbox');
        trigger.click();
        const isOpenAfterClick = lightbox.classList.contains('open');
        const closeBtn = document.getElementById('floorplanLightboxClose');
        closeBtn.click();
        const isOpenAfterClose = lightbox.classList.contains('open');
        return { isOpenAfterClick, isOpenAfterClose };
      })()
    `,
    returnByValue: true
  });
  console.log('Floorplan Lightbox Test:', lightboxTest.result.value);

  // 3. Test Chapter Rail Links
  const railTest = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const links = Array.from(document.querySelectorAll('.index-rail li'));
        return {
          totalChapterLinks: links.length,
          labels: links.map(l => l.innerText.trim())
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Chapter Rail Test:', railTest.result.value);

  chromeProc.kill();
}

runTest().catch(err => {
  console.error(err);
  chromeProc.kill();
});
