const { spawn } = require('child_process');
const fs = require('fs');

async function testPositioning() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9478',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9478/json/list');
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

    // Calculate position and style the button dynamically
    const evalResult = await send('Runtime.evaluate', {
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

        const starX = dx + 1160 * scale;
        const starY = dy + 610 * scale;

        let btn = document.getElementById('translateBtn');
        if (!btn) {
          btn = document.getElementById('blurDropStrip');
          if (btn) btn.id = 'translateBtn';
        }
        if (btn) {
          btn.innerHTML = '<span class=\"translate-icon\">🌐</span> <span class=\"translate-label\">Translate to English</span>';
          btn.style.position = 'absolute';
          btn.style.left = starX + 'px';
          btn.style.top = starY + 'px';
          btn.style.right = 'auto';
          btn.style.bottom = 'auto';
          btn.style.transform = 'translate(-50%, -50%)';
          btn.style.display = 'inline-flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.gap = '8px';
          btn.style.padding = '12px 24px';
          btn.style.width = 'auto';
          btn.style.height = 'auto';
          btn.style.minHeight = '48px';
          btn.style.borderRadius = '999px';
          btn.style.background = 'rgba(6, 26, 43, 0.82)';
          btn.style.backdropFilter = 'blur(25px) saturate(180%)';
          btn.style.webkitBackdropFilter = 'blur(25px) saturate(180%)';
          btn.style.border = '1px solid rgba(255, 255, 255, 0.16)';
          btn.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.55), 0 0 35px 15px rgba(6, 26, 43, 0.85)';
          btn.style.color = '#ffffff';
          btn.style.fontFamily = 'Montserrat, sans-serif';
          btn.style.fontSize = '11px';
          btn.style.fontWeight = '700';
          btn.style.letterSpacing = '0.08em';
          btn.style.textTransform = 'uppercase';
          btn.style.cursor = 'pointer';
          btn.style.zIndex = '120';
        }

        return { cw, ch, scale, starX, starY };
      })()`,
      returnByValue: true
    });
    console.log('Calculated:', evalResult.result.value);

    // Capture crop around the button (x: 1000..1440, y: 500..850)
    const cropShot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1000, y: 500, width: 440, height: 350, scale: 1 }
    });
    fs.writeFileSync('scripts/star_with_translate_btn.png', Buffer.from(cropShot.data, 'base64'));

    // Capture full desktop view
    const fullShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/full_desktop_with_translate_btn.png', Buffer.from(fullShot.data, 'base64'));

    console.log('Saved screenshots!');
  } finally {
    proc.kill();
  }
}
testPositioning().catch(console.error);
