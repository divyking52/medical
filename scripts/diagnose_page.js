const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_diag',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const pageTab = tabs[0];
    if (!pageTab) {
      console.log('No tab found');
      proc.kill();
      process.exit(1);
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 10, method: 'Network.setCacheDisabled', params: { cacheDisabled: true } }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 4, method: 'Page.enable' }));
      // Navigate after enabling
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 5,
          method: 'Page.navigate',
          params: { url: 'http://localhost:8118/galeria.html' }
        }));
      }, 500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Network.responseReceived') {
        const resp = msg.params.response;
        if (resp.status >= 400) {
          console.log(`[HTTP ${resp.status}] ${resp.url}`);
        }
      } else if (msg.method === 'Network.loadingFailed') {
        console.log(`[NETWORK FAILED] ${msg.params.errorText}: ${msg.params.type}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        console.log(`[EXCEPTION] ${d.text} at ${d.url}:${d.lineNumber}:${d.columnNumber}`);
        if (d.exception) {
          console.log(`[EXCEPTION DESC] ${d.exception.description}`);
        }
      } else if (msg.method === 'Log.entryAdded') {
        if (msg.params.entry.level === 'error') {
          console.log(`[LOG ERROR] ${msg.params.entry.text} (${msg.params.entry.url})`);
        }
      } else if (msg.method === 'Page.loadEventFired') {
        console.log('[PAGE LOAD COMPLETE]');
      }
    };

    setTimeout(() => {
      ws.close();
      proc.kill();
      process.exit(0);
    }, 6000);

  } catch (err) {
    console.error('Error:', err);
    proc.kill();
    process.exit(1);
  }
}, 1500);
