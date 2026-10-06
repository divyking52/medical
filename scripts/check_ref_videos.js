const https = require('https');

https.get('https://www.congresodeturismomedico.com/es/galeria/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const iframes = data.match(/<iframe[^>]+>/g) || [];
    console.log('Iframes on reference site:');
    iframes.forEach(f => console.log(f));
    const ytLinks = data.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s"\'<>]+/g) || [];
    console.log('YouTube links on reference site:', ytLinks);
  });
}).on('error', e => console.error(e.message));
