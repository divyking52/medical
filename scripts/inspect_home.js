const data = require('./scraped_site.json');
const html = data.home;

// Extract menu links
const navMatches = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)];
console.log('--- Nav Links in original website: ---');
const seen = new Set();
navMatches.forEach(m => {
  const href = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim();
  if (text && !seen.has(text) && !href.startsWith('tel:') && !href.startsWith('mailto:')) {
    seen.add(text);
    console.log(`[${text}] -> ${href}`);
  }
});

// Extract h1, h2, h3, h4
const headings = [...html.matchAll(/<(h[1-4])[^>]*>(.*?)<\/\1>/gis)];
console.log('\n--- Headings in Home Page: ---');
headings.forEach(h => {
  const tag = h[1];
  const text = h[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length > 0) {
    console.log(`${tag.toUpperCase()}: ${text}`);
  }
});
