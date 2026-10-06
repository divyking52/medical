const https = require('https');
const fs = require('fs');

const urls = [
  { name: 'home', url: 'https://www.congresodeturismomedico.com/es/' },
  { name: 'negocios', url: 'https://www.congresodeturismomedico.com/es/negocios/' },
  { name: 'agenda', url: 'https://www.congresodeturismomedico.com/es/agenda/' },
  { name: 'expo', url: 'https://www.congresodeturismomedico.com/es/expo/' },
  { name: 'patrocinios', url: 'https://www.congresodeturismomedico.com/es/patrocinios/' }
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const result = {};
  for (const item of urls) {
    try {
      console.log('Fetching', item.name, item.url);
      const html = await fetchUrl(item.url);
      result[item.name] = html;
    } catch (e) {
      console.error('Error fetching', item.name, e.message);
    }
  }
  fs.writeFileSync('scripts/scraped_site.json', JSON.stringify(result, null, 2));
  console.log('Saved to scripts/scraped_site.json');
}

run();
