const { spawn } = require('child_process');
const fs = require('fs');

async function testTargetPosition() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9490',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9490/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(res => ws.addEventListener('open', res));
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
    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.getElementById('scrollCanvas');
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        const vw = 1280;
        const vh = 720;
        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;

        const starX = dx + 1162 * scale;
        const starY = dy + 560 * scale;

        let btn = document.getElementById('blurDropStrip');
        if (btn) {
          btn.innerHTML = '<span class="trans-globe">🌐</span><span class="trans-text">Translate to English</span>';
          btn.style.position = 'absolute';
          btn.style.left = starX + 'px';
          btn.style.top = starY + 'px';
          btn.style.right = 'auto';
          btn.style.bottom = 'auto';
          btn.style.transform = 'translate(-50%, -50%)';
          btn.style.display = 'inline-flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.gap = '10px';
          btn.style.padding = '14px 28px';
          btn.style.width = 'auto';
          btn.style.height = 'auto';
          btn.style.borderRadius = '999px';
          btn.style.background = 'rgba(6, 26, 43, 0.85)';
          btn.style.backdropFilter = 'blur(25px) saturate(180%)';
          btn.style.webkitBackdropFilter = 'blur(25px) saturate(180%)';
          btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
          btn.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 30px 10px rgba(6, 26, 43, 0.85)';
          btn.style.color = '#ffffff';
          btn.style.fontFamily = 'Montserrat, sans-serif';
          btn.style.fontSize = '12px';
          btn.style.fontWeight = '700';
          btn.style.letterSpacing = '0.08em';
          btn.style.textTransform = 'uppercase';
          btn.style.whiteSpace = 'nowrap';
          btn.style.cursor = 'pointer';
          btn.style.zIndex = '120';
        }
      })()`
    });

    const crop = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1050, y: 450, width: 390, height: 350, scale: 1 }
    });
    fs.writeFileSync('scripts/star_target_crop.png', Buffer.from(crop.data, 'base64'));

    const full = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/hero_target_desktop.png', Buffer.from(full.data, 'base64'));

    console.log('Saved star_target_crop.png and hero_target_desktop.png');

  } finally {
    proc.kill();
  }
}
testTargetPosition().catch(console.error);
