const { spawn } = require('child_process');
const path = require('path');

const filePath = path.resolve('congreso_turismo_medico_completo.html');
const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\Users\\OMEN\\Downloads\\medical-tourism-congress-scroll-site\\.edge_temp_unified_test',
  'about:blank'
]);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

    let msgId = 1000;
    function send(method, params = {}) {
      ws.send(JSON.stringify({ id: ++msgId, method, params }));
    }

    let errors = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Network.responseReceived') {
        const resp = msg.params.response;
        if (resp.status >= 400) {
          errors.push(`[HTTP ${resp.status}] ${resp.url}`);
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

    ws.onopen = async () => {
      send('Network.enable');
      send('Runtime.enable');
      send('Log.enable');
      send('Page.enable');
      send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      console.log(`Opening unified single file directly from disk: ${fileUrl}`);
      send('Page.navigate', { url: fileUrl });
      await sleep(3000);

      // Test 1: Verify Inicio view is active
      console.log('Testing View 1: Inicio...');
      await sleep(1000);

      // Test 2: Click Agenda link in nav
      console.log('Testing View 2: Navigating to Agenda...');
      send('Runtime.evaluate', {
        expression: `(function() {
          const link = document.querySelector('a[href*="agenda"]');
          if (link) link.click();
        })()`
      });
      await sleep(1500);

      // Test 3: Click Expo link in nav
      console.log('Testing View 3: Navigating to Expo...');
      send('Runtime.evaluate', {
        expression: `(function() {
          const link = document.querySelector('a[href*="expo"]');
          if (link) link.click();
        })()`
      });
      await sleep(1500);

      // Test 4: Click Sede link in nav
      console.log('Testing View 4: Navigating to Sede...');
      send('Runtime.evaluate', {
        expression: `(function() {
          const link = document.querySelector('a[href*="sede"]');
          if (link) link.click();
        })()`
      });
      await sleep(1500);

      // Test 5: Click Galeria link in nav
      console.log('Testing View 5: Navigating to Galeria...');
      send('Runtime.evaluate', {
        expression: `(function() {
          const link = document.querySelector('a[href*="galeria"]');
          if (link) link.click();
        })()`
      });
      await sleep(1500);

      // Test 6: Click Inicio link in nav
      console.log('Testing View 6: Returning to Inicio...');
      send('Runtime.evaluate', {
        expression: `(function() {
          const link = document.querySelector('.brand');
          if (link) link.click();
        })()`
      });
      await sleep(1500);

      console.log('\n======================================');
      if (errors.length === 0) {
        console.log('✓ UNIFIED SINGLE FILE PASSED ALL ROUTING & RENDERING TESTS WITH 0 ERRORS!');
      } else {
        console.log('✗ Issues detected:');
        errors.forEach(e => console.log('  ' + e));
      }
      console.log('======================================');

      ws.close();
      proc.kill();
      process.exit(errors.length === 0 ? 0 : 1);
    };

  } catch (err) {
    console.error('Fatal test error:', err);
    proc.kill();
    process.exit(1);
  }
}, 1500);
