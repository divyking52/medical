const { spawn } = require('child_process');
const fs = require('fs');

async function testPerfectStarOverlay() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9496',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9496/json/list');
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

        const starX = dx + 1164 * scale;
        const starY = dy + 590 * scale;

        let btn = document.getElementById('blurDropStrip') || document.getElementById('translateBtn');
        if (btn) {
          btn.id = 'translateBtn';
          btn.className = 'translate-star-btn';
          btn.innerHTML = '<span class="trans-globe" aria-hidden="true">🌐</span><span class="trans-label" id="translateBtnLabel">Translate to English</span>';
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
          btn.style.padding = '14px 26px';
          btn.style.minWidth = '220px';
          btn.style.borderRadius = '999px';
          btn.style.background = 'rgba(6, 26, 43, 0.88)';
          btn.style.backdropFilter = 'blur(35px) saturate(180%)';
          btn.style.webkitBackdropFilter = 'blur(35px) saturate(180%)';
          btn.style.border = '1px solid rgba(255, 255, 255, 0.22)';
          btn.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px 8px rgba(6, 26, 43, 0.9)';
          btn.style.color = '#ffffff';
          btn.style.fontFamily = 'Montserrat, sans-serif';
          btn.style.fontSize = '11px';
          btn.style.fontWeight = '700';
          btn.style.letterSpacing = '0.1em';
          btn.style.textTransform = 'uppercase';
          btn.style.whiteSpace = 'nowrap';
          btn.style.cursor = 'pointer';
          btn.style.zIndex = '120';
        }

        return { starX, starY };
      })()`,
      returnByValue: true
    });

    const crop = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1100, y: 500, width: 330, height: 300, scale: 1 }
    });
    fs.writeFileSync('scripts/star_perfect_overlay_crop.png', Buffer.from(crop.data, 'base64'));

    const full = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/hero_perfect_overlay.png', Buffer.from(full.data, 'base64'));

    console.log('Saved perfect overlay screenshots!');
  } finally {
    proc.kill();
  }
}
testPerfectStarOverlay().catch(console.error);
