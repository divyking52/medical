const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const testDir = 'C:\\Users\\OMEN\\Downloads\\test_standalone_isolated';
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Copy ONLY standalone.html into this isolated directory
const srcFile = path.join(__dirname, '..', 'standalone.html');
const destFile = path.join(testDir, 'standalone.html');
fs.copyFileSync(srcFile, destFile);

console.log('Copied standalone.html to isolated directory:', destFile);
console.log('Isolated directory contents:', fs.readdirSync(testDir));

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromePort = 9230;

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
  if (!pageTab) throw new Error('No page tab found');

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
  console.log('Connected to Chrome DevTools Protocol.');

  // Wait 1 second for video blob initialization
  await new Promise(r => setTimeout(r, 1200));

  // Evaluate standalone state
  const testExpr = `
    (() => {
      const video = document.getElementById('sourceVideo');
      const canvas = document.getElementById('scrollCanvas');
      const imgs = Array.from(document.querySelectorAll('img')).map(img => ({
        alt: img.alt || 'no-alt',
        srcLength: img.src.length,
        isData: img.src.startsWith('data:'),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete
      }));

      return {
        videoReadyState: video ? video.readyState : -1,
        videoDuration: video ? video.duration : -1,
        videoSrcIsBlob: video ? video.src.startsWith('blob:') : false,
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        totalImages: imgs.length,
        brokenImages: imgs.filter(i => i.naturalWidth === 0).length,
        allImagesDataUris: imgs.every(i => i.isData),
        bodyHeight: document.body.scrollHeight,
        title: document.title,
        imagesDetail: imgs
      };
    })()
  `;

  const evalRes = await sendCdp('Runtime.evaluate', {
    expression: testExpr,
    returnByValue: true
  });

  console.log('Standalone Isolated Test Results:');
  console.log(JSON.stringify(evalRes.result.value, null, 2));

  // Test video scrubbing to 3.5s
  const seekRes = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const video = document.getElementById('sourceVideo');
        if (video) {
          video.currentTime = 3.5;
          return { currentTime: video.currentTime };
        }
        return { error: 'no video' };
      })()
    `,
    returnByValue: true
  });
  console.log('Video Scrub Test:', JSON.stringify(seekRes.result.value));

  chromeProc.kill();
  console.log('Test completed successfully.');
}

runTest().catch(err => {
  console.error('Test error:', err);
  chromeProc.kill();
});
