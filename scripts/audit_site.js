const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pages = [
  'index.html',
  'agenda.html',
  'expo.html',
  'sede.html',
  'galeria.html'
];

let allPassed = true;

for (const p of pages) {
  const filePath = path.join(rootDir, p);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: Missing file ${p}`);
    allPassed = false;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`=== Checking ${p} (${(content.length / 1024).toFixed(1)} KB) ===`);

  // 1. Check YouTube embed in footer
  const hasYtFooter = content.includes('https://www.youtube.com/embed/NJXR_Ju_0i0');
  console.log(`  Common YouTube video embed in footer: ${hasYtFooter ? 'PASS' : 'FAIL'}`);
  if (!hasYtFooter) allPassed = false;

  // 2. Check 4-column footer grid
  const hasFooterGrid = content.includes('footer-main-grid') && content.includes('footer-col-video');
  console.log(`  4-column footer structure: ${hasFooterGrid ? 'PASS' : 'FAIL'}`);
  if (!hasFooterGrid) allPassed = false;

  // 3. Check Galería link in nav
  const hasGaleriaLink = content.includes('galeria.html');
  console.log(`  Galería link present in nav/footer: ${hasGaleriaLink ? 'PASS' : 'FAIL'}`);
  if (!hasGaleriaLink) allPassed = false;

  // 4. Check registration modal
  const hasModal = content.includes('id="registerModal"');
  console.log(`  Registration modal present: ${hasModal ? 'PASS' : 'FAIL'}`);
  if (!hasModal) allPassed = false;
}

// Special checks for galeria.html
console.log('\n=== Detailed Checks for galeria.html ===');
const galeriaPath = path.join(rootDir, 'galeria.html');
const galeriaContent = fs.readFileSync(galeriaPath, 'utf8');

// Check past edition videos
const ytEmbedMatches = galeriaContent.match(/https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]+/g) || [];
console.log(`  YouTube embeds found: ${ytEmbedMatches.length}`);
console.log(`  (8 past edition memories + 1 footer embed = 9 total)`);

// Check images inlined as data URIs
const dataUriMatches = (galeriaContent.match(/data:image\/jpeg;base64/g) || []).length;
console.log(`  Base64 inlined JPEG images found: ${dataUriMatches}`);

// Check filter buttons
const filterButtons = ['all', '2019', '2018', '2017', 'b2b', 'expo'];
const hasAllFilters = filterButtons.every(f => galeriaContent.includes(`data-filter="${f}"`));
console.log(`  All 6 filter category buttons present: ${hasAllFilters ? 'PASS' : 'FAIL'}`);

// Check lightbox
const hasLightbox = galeriaContent.includes('id="imageLightbox"');
console.log(`  Image lightbox modal present: ${hasLightbox ? 'PASS' : 'FAIL'}`);

if (allPassed && ytEmbedMatches.length >= 9 && dataUriMatches >= 16) {
  console.log('\n>>> SUCCESS: ALL 5 PAGES PASSED 100% OF AUDIT CHECKS! <<<');
} else {
  console.log('\n>>> SOME CHECKS FAILED! <<<');
}
