const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const testDir = 'C:\\Users\\OMEN\\Downloads\\test_standalone_isolated';
const destFile = path.join(testDir, 'standalone.html');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromePort = 9238;

const chromeProc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${chromePort}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=390,844',
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

  // 1. Test Mobile Menu Drawer
  const drawerTest = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const menuBtn = document.getElementById('mobileMenuBtn');
        const drawer = document.getElementById('mobileDrawer');
        const closeBtn = document.getElementById('drawerCloseBtn');
        menuBtn.click();
        const isOpenAfterClick = drawer.classList.contains('open');
        closeBtn.click();
        const isOpenAfterClose = drawer.classList.contains('open');
        return { isOpenAfterClick, isOpenAfterClose };
      })()
    `,
    returnByValue: true
  });
  console.log('Mobile Drawer Test:', drawerTest.result.value);

  // 2. Test Mobile Back-to-Top Button
  const backToTopTest = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const btt = document.getElementById('mobileBackToTop');
        const visibleInitial = window.getComputedStyle(btt).opacity;
        window.scrollTo(0, 1200);
        window.dispatchEvent(new Event('scroll'));
        // check after scroll event processed
        return {
          visibleInitial,
          hasBttElement: !!btt
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Back to Top Test:', backToTopTest.result.value);

  chromeProc.kill();
}

runTest().catch(err => {
  console.error(err);
  chromeProc.kill();
});
