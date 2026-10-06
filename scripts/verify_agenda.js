const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const agendaPath = path.resolve(__dirname, '..', 'agenda.html');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9245;

const proc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1440,900',
  `file:///${agendaPath.replace(/\\/g, '/')}`
]);

async function testAgenda() {
  await new Promise(r => setTimeout(r, 1500));
  const tabs = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const pageTab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  function sendCdp(method, params = {}) {
    return new Promise((res, rej) => {
      const id = Math.floor(Math.random() * 100000);
      const onMsg = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', onMsg);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);

  const res = await sendCdp('Runtime.evaluate', {
    expression: `
      (() => {
        const imgs = Array.from(document.querySelectorAll('img')).map(i => ({
          alt: i.alt,
          naturalWidth: i.naturalWidth,
          naturalHeight: i.naturalHeight,
          complete: i.complete
        }));
        const speakerCards = Array.from(document.querySelectorAll('.speaker-card-full')).map(c => {
          return {
            name: c.querySelector('h4')?.innerText.trim(),
            topic: c.querySelector('.speaker-topic-title')?.innerText.trim(),
            badge: c.querySelector('.speaker-badge-pill')?.innerText.trim(),
            socialLinks: Array.from(c.querySelectorAll('.speaker-social-btn')).map(a => ({
              text: a.innerText.trim(),
              href: a.href
            }))
          };
        });
        const recommendations = Array.from(document.querySelectorAll('.rec-card')).map(r => r.querySelector('.rec-title')?.innerText.trim());
        const modal = !!document.getElementById('registerModal');
        const modalForm = !!document.getElementById('registrationForm');

        return {
          title: document.title,
          totalImages: imgs.length,
          brokenImages: imgs.filter(i => i.naturalWidth === 0).length,
          speakerCount: speakerCards.length,
          speakers: speakerCards,
          recommendationsCount: recommendations.length,
          recommendations,
          hasModal: modal,
          hasModalForm: modalForm
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Agenda Page Headless Chrome Results:\n', JSON.stringify(res.result.value, null, 2));
  proc.kill();
}

testAgenda().catch(e => {
  console.error('Test Error:', e);
  proc.kill();
});
