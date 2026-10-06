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
    if (!pageTab) {
      console.log('No tab found');
      return;
    }

    console.log('Connecting to WS:', pageTab.webSocketDebuggerUrl);
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      console.log('WS opened');
      ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 4, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 5, method: 'Runtime.enable' }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Console.messageAdded') {
        console.log('[CONSOLE]', msg.params.message.level, msg.params.message.text);
      } else if (msg.method === 'Log.entryAdded') {
        console.log('[LOG]', msg.params.entry.level, msg.params.entry.text);
      } else if (msg.method === 'Network.loadingFailed') {
        console.log('[NETWORK FAILED]', msg.params.errorText, msg.params.canceled ? '(canceled)' : '');
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[RUNTIME CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.log('[EXCEPTION]', msg.params.exceptionDetails.text);
      }
    };

    setTimeout(() => {
      ws.close();
      proc.kill();
      process.exit(0);
    }, 5000);

  } catch (err) {
    console.error('Error:', err.message);
    proc.kill();
    process.exit(1);
  }
}, 2000);
