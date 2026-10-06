const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Match sections
const sectionRegex = /<section[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/gi;
let match;
while ((match = sectionRegex.exec(html)) !== null) {
  const id = match[1];
  const content = match[2];
  console.log(`\n============================`);
  console.log(`SECTION ID: ${id}`);
  
  // Extract all text inside headers, paragraphs, and list items
  const texts = [...content.matchAll(/<(h[1-6]|p|li|span class=["'][^"']*eyebrow[^"']*["'])[^>]*>(.*?)<\/\1>/gis)]
    .map(m => m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 0 && !t.includes('{') && !t.includes('}'));
  
  console.log('Sample texts:', texts.slice(0, 8));
}
