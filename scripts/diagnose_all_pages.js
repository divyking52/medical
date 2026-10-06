const { spawn } = require('child_process');

const pages = [
  'http://localhost:8118/index.html',
  'http://localhost:8118/agenda.html',
  'http://localhost:8118/expo.html',
  'http://localhost:8118/sede.html',
  'http://localhost:8118/galeria.html',
  'http://localhost:8118/standalone.html'
];

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_all',
  'about:blank'
]);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPage(url, pageTab) {
  return new Promise((resolve) => {
    console.log(`\nTesting: ${url}`);
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let errors = [];

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Network.setCacheDisabled', params: { cacheDisabled: true } }));
      ws.send(JSON.stringify({ id: 3, method: 'Log.enable' }));
      ws.send(JSON.stringify({ id: 4, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 5, method: 'Page.enable' }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 6,
          method: 'Page.navigate',
          params: { url }
        }));
      }, 200);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Network.responseReceived') {
        const resp = msg.params.response;
        if (resp.status >= 400) {
          errors.push(`[HTTP ${resp.status}] ${resp.url}`);
        }
      } else if (msg.method === 'Network.loadingFailed') {
        // Ignore user-aborted or cancelled requests
        if (!msg.params.canceled) {
          errors.push(`[NETWORK FAILED] ${msg.params.errorText}`);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push(`[EXCEPTION] ${d.text}: ${d.exception ? d.exception.description : ''}`);
      } else if (msg.method === 'Log.entryAdded') {
        if (msg.params.entry.level === 'error') {
          errors.push(`[LOG ERROR] ${msg.params.entry.text}`);
        }
      }
    };

    setTimeout(() => {
      ws.close();
      if (errors.length === 0) {
        console.log(`✓ ${url} passed with 0 errors!`);
      } else {
        console.log(`✗ ${url} encountered issues:`);
        errors.forEach(e => console.log('  ' + e));
      }
      resolve(errors.length === 0);
    }, 3500);
  });
}

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const pageTab = tabs[0];

    let allPassed = true;
    for (const url of pages) {
      const ok = await testPage(url, pageTab);
      if (!ok) allPassed = false;
      await sleep(500);
    }

    console.log('\n======================================');
    if (allPassed) {
      console.log('ALL PAGES PASSED 100% HEALTH CHECK!');
    } else {
      console.log('SOME PAGES HAVE ERRORS');
    }
    console.log('======================================');

    proc.kill();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Fatal test error:', err);
    proc.kill();
    process.exit(1);
  }
}, 1500);
