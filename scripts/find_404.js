const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp',
  'http://localhost:8118/galeria.html'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const pageTab = tabs.find(t => t.url.includes('galeria.html')) || tabs[0];
    if (!pageTab) return;

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Network.responseReceived') {
        const resp = msg.params.response;
        if (resp.status >= 400) {
          console.log('[HTTP ' + resp.status + ']', resp.url);
        }
      }
    };

    setTimeout(() => {
      ws.close();
      proc.kill();
      process.exit(0);
    }, 6000);

  } catch (err) {
    console.error('Error:', err.message);
    proc.kill();
    process.exit(1);
  }
}, 2000);
