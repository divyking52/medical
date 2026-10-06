const { spawn } = require('child_process');
const fs = require('fs');

async function findExactStar() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9476',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9476/json/list');
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

    const starCoord = await send('Runtime.evaluate', {
      expression: `(() => {
        const v = document.getElementById('sourceVideo');
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 1280;
        offCanvas.height = 720;
        const ctx = offCanvas.getContext('2d');
        ctx.drawImage(v, 0, 0, 1280, 720);

        // Export a cropped image of the bottom-right corner of the native 1280x720 video
        // (x: 1000..1280, y: 450..720)
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 280;
        cropCanvas.height = 270;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(offCanvas, 1000, 450, 280, 270, 0, 0, 280, 270);

        // Draw coordinate marks on cropCanvas every 20px
        cropCtx.fillStyle = 'yellow';
        cropCtx.font = '10px sans-serif';
        for (let x = 0; x <= 280; x += 40) {
          cropCtx.fillRect(x, 0, 1, 270);
          cropCtx.fillText(1000 + x, x + 2, 20);
        }
        for (let y = 0; y <= 270; y += 40) {
          cropCtx.fillRect(0, y, 280, 1);
          cropCtx.fillText(450 + y, 4, y - 2);
        }

        return cropCanvas.toDataURL('image/png');
      })()`,
      returnByValue: true
    });

    const dataUrl = starCoord.result.value;
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('scripts/native_video_star_coords.png', Buffer.from(base64, 'base64'));
    console.log('Saved native_video_star_coords.png');

  } finally {
    proc.kill();
  }
}
findExactStar().catch(console.error);
