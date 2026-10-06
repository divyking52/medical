const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function captureAndCrop() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const outDir = path.join(__dirname, '..', 'screenshots');
  const userDataDir = path.join(process.env.TEMP, 'chrome-star-' + Date.now());

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9777',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:8118/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9777/json/list');
    const tabs = await res.json();
    const pageTab = tabs.find(t => t.url && t.url.includes('8118'));
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    await new Promise(resolve => ws.addEventListener('open', resolve));

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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Wait 3 seconds for video frame 0 to render on canvas
    await new Promise(r => setTimeout(r, 3000));

    // Capture full hero
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(outDir, 'verify_hero_with_translate.png');
    fs.writeFileSync(fullPath, Buffer.from(shot.data, 'base64'));
    console.log('Saved full screenshot:', fullPath);

    // Get exact rect of translate button
    const rectEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('translateBtn');
        const r = btn.getBoundingClientRect();
        return JSON.stringify({ left: r.left, top: r.top, width: r.width, height: r.height });
      })()`,
      returnByValue: true
    });
    console.log('Translate button rect:', JSON.parse(rectEval.result.value));

    ws.close();
    proc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

    // Now run PowerShell System.Drawing to crop the bottom right area
    const psCmd = `
      Add-Type -AssemblyName System.Drawing
      $img = [System.Drawing.Image]::FromFile('${fullPath.replace(/\\/g, '\\\\')}')
      $rect = New-Object System.Drawing.Rectangle(1100, 650, 340, 250)
      $bmp = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.DrawImage($img, 0, 0, $rect, [System.Drawing.GraphicsUnit]::Pixel)
      $cropPath = 'C:\\\\Users\\\\OMEN\\\\Downloads\\\\medical-tourism-congress-scroll-site\\\\screenshots\\\\verify_star_crop.png'
      $bmp.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $g.Dispose()
      $bmp.Dispose()
      $img.Dispose()
      Write-Output "Crop saved to $cropPath"
    `;
    const psProc = spawn('powershell', ['-Command', psCmd]);
    psProc.stdout.on('data', d => console.log(d.toString()));
    psProc.on('close', () => console.log('Crop complete!'));

  } catch (err) {
    console.error('Error:', err);
    proc.kill();
  }
}

captureAndCrop();
