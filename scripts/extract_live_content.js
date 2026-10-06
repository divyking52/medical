const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\OMEN\\.gemini\\antigravity\\brain\\479b8f66-0632-4944-be24-b7ff11f0b17a\\.system_generated\\steps\\169\\content.md', 'utf8');

// Logos & images
const imgMatches = content.match(/<img[^>]+>/g) || [];
console.log('--- ALL IMAGES ---');
imgMatches.forEach(img => {
  const src = (img.match(/src=["']([^"']+)["']/) || [])[1];
  const alt = (img.match(/alt=["']([^"']+)["']/) || [])[1];
  const dataSrc = (img.match(/data-src=["']([^"']+)["']/) || [])[1];
  const finalSrc = src || dataSrc;
  if (finalSrc && !finalSrc.includes('dummy') && !finalSrc.includes('transparent')) {
    console.log(finalSrc, alt ? '(alt: ' + alt + ')' : '');
  }
});

// Hex Colors
const hexColors = [...new Set(content.match(/#[0-9a-fA-F]{3,6}\b/g) || [])];
console.log('\n--- HEX COLORS ---');
console.log(hexColors);

// RGBA Colors
const rgbaColors = [...new Set(content.match(/rgba?\([^)]+\)/g) || [])];
console.log('\n--- RGBA COLORS ---');
console.log(rgbaColors.slice(0, 20));

// Text sections & paragraphs
console.log('\n--- HEADINGS ---');
const hMatches = content.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || [];
hMatches.forEach(h => {
  const clean = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean) console.log(clean);
});

// Extract all visible text paragraphs
console.log('\n--- PARAGRAPHS & HIGHLIGHTS ---');
const pMatches = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
pMatches.forEach(p => {
  const clean = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean && clean.length > 20) {
    console.log('-', clean);
  }
});

// Extract Revolution slider layers
console.log('\n--- REV SLIDER LAYERS ---');
const rsMatches = content.match(/<rs-layer[^>]*>([\s\S]*?)<\/rs-layer>/gi) || [];
rsMatches.forEach(rs => {
  const clean = rs.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean) console.log('RS:', clean);
});
