const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scripts/scraped_site.json', 'utf8'));

for (const [page, html] of Object.entries(data)) {
  console.log(`\n================== PAGE: ${page.toUpperCase()} ==================`);
  
  // Headings
  const headings = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || [];
  console.log('\n--- HEADINGS ---');
  headings.forEach(h => {
    const clean = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean) console.log(clean);
  });

  // Paragraphs
  const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  console.log('\n--- PARAGRAPHS ---');
  paragraphs.forEach(p => {
    const clean = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean && clean.length > 25 && !clean.includes('function(') && !clean.includes('var ')) {
      console.log('•', clean);
    }
  });

  // List items
  const lis = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
  console.log('\n--- LIST ITEMS (Sample) ---');
  lis.slice(0, 15).forEach(li => {
    const clean = li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean && clean.length > 15 && !clean.includes('Inicio') && !clean.includes('Agenda')) {
      console.log('-', clean);
    }
  });

  // Table or pricing content
  const tables = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi) || [];
  if (tables.length) {
    console.log('\n--- TABLES ---');
    tables.forEach(t => console.log(t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
  }

  // Links & images
  const imgs = html.match(/<img[^>]+>/gi) || [];
  console.log('\n--- IMAGES ---');
  imgs.forEach(img => {
    const src = (img.match(/src=["']([^"']+)["']/) || [])[1];
    if (src && !src.includes('dummy') && !src.includes('transparent') && !src.includes('emoji')) {
      console.log('IMG:', src);
    }
  });
}
