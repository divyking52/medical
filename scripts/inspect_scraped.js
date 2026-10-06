const data = require('./scraped_site.json');
for (const [k, v] of Object.entries(data)) {
  console.log('Key:', k, 'Type:', typeof v);
  if (typeof v === 'string') {
    console.log('Length:', v.length, 'Snippet:', v.slice(0, 300));
  } else if (typeof v === 'object') {
    console.log('Keys:', Object.keys(v));
  }
}
