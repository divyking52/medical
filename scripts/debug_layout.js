const { spawn } = require('child_process');

async function debugLayout() {
  const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9492',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://127.0.0.1:8118/'
  ]);
  try {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch('http://127.0.0.1:9492/json/list');
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

    const layout = await send('Runtime.evaluate', {
      expression: `(() => {
        const c = document.getElementById('scrollCanvas');
        const pinned = document.querySelector('.cinema-pinned');
        const stage = document.getElementById('cinemaStage');
        const btn = document.getElementById('blurDropStrip');
        return {
          window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
          canvasRect: c.getBoundingClientRect(),
          pinnedRect: pinned ? pinned.getBoundingClientRect() : null,
          stageRect: stage ? stage.getBoundingClientRect() : null,
          btnOffsetParent: btn ? btn.offsetParent?.className : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Layout:', layout.result.value);

  } finally {
    proc.kill();
  }
}
debugLayout().catch(console.error);
