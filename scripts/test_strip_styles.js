const { spawn } = require('child_process');
const fs = require('fs');

async function testStyles() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9466',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9466/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));
    let id = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const curId = id++;
        const onMsg = ev => {
          const d = JSON.parse(ev.data);
          if (d.id === curId) {
            ws.removeEventListener('message', onMsg);
            resolve(d.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }
    await send('Page.enable');
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 1500));

    // Style A: Soft feathered frosted glass
    await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('blurDropStrip');
        el.style.background = 'rgba(6, 26, 43, 0.45)';
        el.style.backdropFilter = 'blur(40px) saturate(160%)';
        el.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        el.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.35)';
      })()`
    });
    let shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1180, y: 570, width: 250, height: 210, scale: 1 }
    });
    fs.writeFileSync('scripts/strip_style_A.png', Buffer.from(shot.data, 'base64'));

    // Style B: Seamless feathered blur (vignette drop blur)
    await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('blurDropStrip');
        el.style.background = 'radial-gradient(ellipse at center, rgba(6, 26, 43, 0.6) 0%, rgba(6, 26, 43, 0) 80%)';
        el.style.backdropFilter = 'blur(30px)';
        el.style.border = 'none';
        el.style.boxShadow = 'none';
        el.style.borderRadius = '50%';
      })()`
    });
    shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1180, y: 570, width: 250, height: 210, scale: 1 }
    });
    fs.writeFileSync('scripts/strip_style_B.png', Buffer.from(shot.data, 'base64'));

    // Style C: Sleek frosted pill with subtle shine
    await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('blurDropStrip');
        el.style.background = 'rgba(6, 26, 43, 0.55)';
        el.style.backdropFilter = 'blur(35px) saturate(180%)';
        el.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        el.style.borderRadius = '24px';
        el.style.boxShadow = '0 10px 32px rgba(0, 0, 0, 0.4)';
      })()`
    });
    shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1180, y: 570, width: 250, height: 210, scale: 1 }
    });
    fs.writeFileSync('scripts/strip_style_C.png', Buffer.from(shot.data, 'base64'));

    console.log('Saved styles A, B, C');
  } finally {
    proc.kill();
  }
}
testStyles().catch(console.error);
