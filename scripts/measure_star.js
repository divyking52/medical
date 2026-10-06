const { spawn } = require('child_process');
const fs = require('fs');

async function measureStar() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9472',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9472/json/list');
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
    await new Promise(r => setTimeout(r, 1000));

    // Place a grid of test markers or inspect pixel data on the canvas
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        // The canvas is rendered at full screen
        const canvas = document.getElementById('scrollCanvas');
        const ctx = canvas.getContext('2d');
        // Let's sample pixels in the bottom right corner (from x: 1100 to 1440, y: 550 to 800)
        // Or let's draw bounding boxes to see exactly where the star is
        return {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight
        };
      })()`,
      returnByValue: true
    });
    console.log('Canvas info:', result.result.value);

    // Let's capture various sub-clips in the 1000..1440, 550..800 area with grid lines
    await send('Runtime.evaluate', {
      expression: `(() => {
        const testDiv = document.createElement('div');
        testDiv.id = 'gridTest';
        testDiv.style.position = 'fixed';
        testDiv.style.inset = '0';
        testDiv.style.pointerEvents = 'none';
        testDiv.style.zIndex = '9999';
        
        // Add vertical and horizontal grid lines every 50px in the bottom-right
        for (let x = 1100; x <= 1400; x += 50) {
          const l = document.createElement('div');
          l.style.position = 'absolute';
          l.style.left = x + 'px';
          l.style.top = '550px';
          l.style.height = '350px';
          l.style.width = '1px';
          l.style.background = 'rgba(255, 0, 0, 0.5)';
          l.innerText = x;
          l.style.color = 'yellow';
          l.style.fontSize = '10px';
          testDiv.appendChild(l);
        }
        for (let y = 550; y <= 850; y += 50) {
          const l = document.createElement('div');
          l.style.position = 'absolute';
          l.style.left = '1100px';
          l.style.top = y + 'px';
          l.style.width = '340px';
          l.style.height = '1px';
          l.style.background = 'rgba(255, 0, 0, 0.5)';
          l.innerText = y;
          l.style.color = 'yellow';
          l.style.fontSize = '10px';
          testDiv.appendChild(l);
        }
        document.body.appendChild(testDiv);
      })()`
    });

    const shotWithGrid = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1100, y: 550, width: 340, height: 320, scale: 1 }
    });
    fs.writeFileSync('scripts/star_with_grid.png', Buffer.from(shotWithGrid.data, 'base64'));
    console.log('Saved star_with_grid.png');

  } finally {
    proc.kill();
  }
}
measureStar().catch(console.error);
