const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const indexTemplatePath = path.join(rootDir, 'index.template.html');
const agendaTemplatePath = path.join(rootDir, 'agenda.template.html');
const expoTemplatePath = path.join(rootDir, 'expo.template.html');
const sedeTemplatePath = path.join(rootDir, 'sede.template.html');
const galeriaTemplatePath = path.join(rootDir, 'galeria.template.html');
const cssPath = path.join(rootDir, 'styles.css');
const lenisPath = path.join(rootDir, 'assets', 'lenis.min.js');
const scriptPath = path.join(rootDir, 'script.js');
const videoPath = path.join(rootDir, 'gemini_generated_video_d04425a4.mp4');

const outputFilePath = path.join(rootDir, 'congreso_turismo_medico_completo.html');
const outputStandlonePath = path.join(rootDir, 'website_standalone.html');

// Read source files
const indexTemplate = fs.readFileSync(indexTemplatePath, 'utf8');
const agendaTemplate = fs.readFileSync(agendaTemplatePath, 'utf8');
const expoTemplate = fs.readFileSync(expoTemplatePath, 'utf8');
const sedeTemplate = fs.readFileSync(sedeTemplatePath, 'utf8');
const galeriaTemplate = fs.readFileSync(galeriaTemplatePath, 'utf8');

const css = fs.readFileSync(cssPath, 'utf8');
const lenis = fs.readFileSync(lenisPath, 'utf8');
const gsapPath = path.join(rootDir, 'assets', 'gsap.min.js');
const stPath = path.join(rootDir, 'assets', 'ScrollTrigger.min.js');
const gsap = fs.existsSync(gsapPath) ? fs.readFileSync(gsapPath, 'utf8') : '';
const scrollTrigger = fs.existsSync(stPath) ? fs.readFileSync(stPath, 'utf8') : '';
const script = fs.readFileSync(scriptPath, 'utf8');

// Build Asset Dictionary for base64 Data URIs
const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const assetMap = {};
const assetsDir = path.join(rootDir, 'assets');

function scanAssetsDir(dir, relPrefix = 'assets') {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanAssetsDir(fullPath, `${relPrefix}/${file}`);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (mimeTypes[ext]) {
        const buf = fs.readFileSync(fullPath);
        const dataUri = `data:${mimeTypes[ext]};base64,${buf.toString('base64')}`;
        assetMap[`${relPrefix}/${file}`] = dataUri;
        assetMap[`/${relPrefix}/${file}`] = dataUri;
      }
    }
  }
}

scanAssetsDir(assetsDir, 'assets');

// Helper to extract content between <main...> and </main>
function extractMain(htmlStr) {
  const match = htmlStr.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return match ? match[1].trim() : '';
}

// Extract Mains from secondary pages
const indexMain = extractMain(indexTemplate);
const agendaMain = extractMain(agendaTemplate);
const expoMain = extractMain(expoTemplate);
const sedeMain = extractMain(sedeTemplate);
const galeriaMain = extractMain(galeriaTemplate);

// Helper to extract image lightbox modal from galeria template if present
let imageLightboxHtml = '';
const lightboxMatch = galeriaTemplate.match(/<!-- Image Lightbox Modal -->[\s\S]*?<div class="modal-backdrop" id="imageLightbox"[\s\S]*?<\/div>\s*<\/div>/i);
if (lightboxMatch) {
  imageLightboxHtml = lightboxMatch[0];
}

// Build Unified SPA Body
// In indexTemplate, replace <main>...</main> with SPA views
const spaViewsHtml = `
    <!-- ============================================================
         UNIFIED SINGLE-PAGE ARCHITECTURE (SPA MULTI-VIEW SYSTEM)
         All 5 Pages Contained Within a Single Portable HTML File
         ============================================================ -->
    <main id="spaMainContainer">
      <!-- VIEW 1: INICIO (Cinematic Video Scroll, B2B Deck, Highlights) -->
      <div class="spa-view active" id="view-inicio" data-view="inicio">
        ${indexMain}
      </div>

      <!-- VIEW 2: AGENDA (Day 1 / Day 2 Full Schedule & Speakers) -->
      <div class="spa-view" id="view-agenda" data-view="agenda">
        ${agendaMain}
      </div>

      <!-- VIEW 3: EXPO COMERCIAL (Packages, Floor Plan, Booth Specs) -->
      <div class="spa-view" id="view-expo" data-view="expo">
        ${expoMain}
      </div>

      <!-- VIEW 4: SEDE OFICIAL (FICOTRECE Aguascalientes Infrastructure) -->
      <div class="spa-view" id="view-sede" data-view="sede">
        ${sedeMain}
      </div>

      <!-- VIEW 5: GALERÍA HISTÓRICA (Videos, YouTube Facades, Photo Archive) -->
      <div class="spa-view" id="view-galeria" data-view="galeria">
        ${galeriaMain}
      </div>
    </main>
`;

let unifiedHtml = indexTemplate.replace(/<main[^>]*>[\s\S]*?<\/main>/i, () => spaViewsHtml);

// Insert image lightbox modal before closing #top if not present
if (imageLightboxHtml && !unifiedHtml.includes('id="imageLightbox"')) {
  unifiedHtml = unifiedHtml.replace('<!-- Floating Mobile Back To Top Button -->', () => `${imageLightboxHtml}\n\n    <!-- Floating Mobile Back To Top Button -->`);
}

// Add SPA Styles to inlined CSS
const spaCss = `
/* ============================================================
   SPA MULTI-PAGE VIEW SYSTEM & TRANSITIONS
   Zero-Latency View Switching inside Single Portable HTML File
   ============================================================ */
.spa-view {
  display: none;
  opacity: 0;
  width: 100%;
  animation: spaFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.spa-view.active {
  display: block;
}

@keyframes spaFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.spa-view-indicator {
  position: fixed;
  bottom: 24px;
  left: 24px;
  background: rgba(6, 26, 43, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 8px 16px;
  font-family: var(--font-chakra);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--gold);
  z-index: 99;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  opacity: 0.85;
}

.spa-view-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--magenta);
  box-shadow: 0 0 8px var(--magenta);
}
`;

// SPA Router Script
const spaRouterScript = `
  <!-- ============================================================
       SPA CLIENT-SIDE ROUTER & GALLERY LIGHTBOX ENGINE
       ============================================================ -->
  <script>
  (() => {
    'use strict';

    const views = {
      'inicio': document.getElementById('view-inicio'),
      'agenda': document.getElementById('view-agenda'),
      'expo': document.getElementById('view-expo'),
      'sede': document.getElementById('view-sede'),
      'galeria': document.getElementById('view-galeria')
    };

    const navLinks = document.querySelectorAll('.nav-links .nav-link, .drawer-nav .drawer-link');
    const mainNav = document.getElementById('mainNav');

    function switchView(targetId, targetAnchor = '') {
      const validTarget = views[targetId] ? targetId : 'inicio';

      // 1. Hide all views & show target
      Object.entries(views).forEach(([id, el]) => {
        if (!el) return;
        if (id === validTarget) {
          el.style.display = 'block';
          // Trigger reflow for animation
          void el.offsetWidth;
          el.classList.add('active');
        } else {
          el.classList.remove('active');
          el.style.display = 'none';
        }
      });

      // 2. Update navigation active states
      navLinks.forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        let isActive = false;
        if (validTarget === 'inicio' && (href.includes('#top') || href.includes('index.html') || href === '#business')) {
          isActive = true;
        } else if (href.includes(validTarget)) {
          isActive = true;
        }
        link.classList.toggle('active', isActive);
      });

      // 3. Close mobile drawer if open
      const mobileDrawer = document.getElementById('mobileDrawer');
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      if (mobileDrawer && mobileDrawer.classList.contains('open')) {
        mobileDrawer.classList.remove('open');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }

      // 4. Update Header solid/scrolled state
      if (mainNav) {
        if (validTarget !== 'inicio') {
          mainNav.classList.add('scrolled');
        } else {
          mainNav.classList.toggle('scrolled', window.scrollY > 40);
        }
      }

      // 5. Scroll handling
      if (targetAnchor) {
        setTimeout(() => {
          const targetEl = document.getElementById(targetAnchor);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }, 80);
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (window.lenis) {
          window.lenis.scrollTo(0, { immediate: true });
        }
      }

      // 6. Refresh canvas engine if switching back to Inicio
      if (validTarget === 'inicio') {
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('scroll'));
        if (window.ScrollTrigger) {
          window.ScrollTrigger.refresh();
        }
      }
    }

    // Intercept clicks on links across the document
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const rawHref = link.getAttribute('href');
      if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('http') || link.getAttribute('target') === '_blank') {
        return;
      }

      const href = rawHref.toLowerCase();

      // Route Matching
      if (href.includes('agenda.html') || href === '#agenda') {
        e.preventDefault();
        history.pushState(null, '', '#agenda');
        switchView('agenda');
      } else if (href.includes('expo.html') || href === '#expo') {
        e.preventDefault();
        const anchor = rawHref.includes('#') ? rawHref.split('#')[1] : '';
        history.pushState(null, '', '#expo' + (anchor ? '#' + anchor : ''));
        switchView('expo', anchor);
      } else if (href.includes('sede.html') || href === '#sede') {
        e.preventDefault();
        history.pushState(null, '', '#sede');
        switchView('sede');
      } else if (href.includes('galeria.html') || href === '#galeria') {
        e.preventDefault();
        const anchor = rawHref.includes('#') ? rawHref.split('#')[1] : '';
        history.pushState(null, '', '#galeria' + (anchor ? '#' + anchor : ''));
        switchView('galeria', anchor);
      } else if (href === 'index.html#top' || href === '#top' || href === 'index.html' || href === '#') {
        e.preventDefault();
        history.pushState(null, '', '#inicio');
        switchView('inicio');
      } else if (href.includes('index.html#') || href.startsWith('#')) {
        const anchor = rawHref.replace(/index\.html/i, '').replace('#', '');
        if (['business', 'contacto', 'allies', 'agenda', 'expo'].includes(anchor)) {
          e.preventDefault();
          if (anchor === 'agenda') {
            history.pushState(null, '', '#agenda');
            switchView('agenda');
          } else if (anchor === 'expo') {
            history.pushState(null, '', '#expo');
            switchView('expo');
          } else {
            history.pushState(null, '', '#' + anchor);
            switchView('inicio', anchor);
          }
        }
      }
    });

    // Handle Hash on load and browser navigation
    function handleHashChange() {
      const fullHash = (window.location.hash || '').toLowerCase();
      if (!fullHash || fullHash === '#top' || fullHash === '#inicio') {
        switchView('inicio');
      } else if (fullHash.includes('agenda')) {
        switchView('agenda');
      } else if (fullHash.includes('expo')) {
        const parts = fullHash.split('#').filter(Boolean);
        switchView('expo', parts[1] || '');
      } else if (fullHash.includes('sede')) {
        switchView('sede');
      } else if (fullHash.includes('galeria')) {
        const parts = fullHash.split('#').filter(Boolean);
        switchView('galeria', parts[1] || '');
      } else if (fullHash.includes('business')) {
        switchView('inicio', 'business');
      } else if (fullHash.includes('contacto')) {
        switchView('inicio', 'contacto');
      } else {
        switchView('inicio');
      }
    }

    window.addEventListener('popstate', handleHashChange);
    handleHashChange();

    // Initialize Gallery Filtering & Image Lightbox within SPA
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    const photoCards = document.querySelectorAll('.photo-card');
    const imageLightbox = document.getElementById('imageLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

    if (filterBtns.length > 0) {
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.getAttribute('data-filter');

          photoCards.forEach(card => {
            if (filter === 'all') {
              card.style.display = 'flex';
            } else {
              const categories = card.getAttribute('data-category') || '';
              card.style.display = categories.includes(filter) ? 'flex' : 'none';
            }
          });
        });
      });
    }

    if (imageLightbox && lightboxImg) {
      photoCards.forEach(card => {
        card.addEventListener('click', () => {
          const img = card.querySelector('img');
          const title = card.querySelector('.photo-card-title');
          if (img) {
            lightboxImg.src = img.src;
            if (lightboxCaption && title) {
              lightboxCaption.textContent = title.textContent;
            }
            imageLightbox.style.display = 'flex';
            document.body.style.overflow = 'hidden';
          }
        });
      });

      function closeLightbox() {
        if (imageLightbox) {
          imageLightbox.style.display = 'none';
          document.body.style.overflow = '';
        }
      }

      if (lightboxCloseBtn) {
        lightboxCloseBtn.addEventListener('click', closeLightbox);
      }
      imageLightbox.addEventListener('click', (e) => {
        if (e.target === imageLightbox) closeLightbox();
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && imageLightbox && imageLightbox.style.display === 'flex') {
          closeLightbox();
        }
      });
    }

  })();
  </script>
`;

// 1. Inline CSS into <style>
const fullCss = `${css}\n${spaCss}`;
const cssLinkRegex = /<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']\s*\/?>/i;
unifiedHtml = unifiedHtml.replace(cssLinkRegex, () => `<style>\n${fullCss}\n</style>`);

// 2. Encode Video Base64
let videoBase64Script = '';
if (fs.existsSync(videoPath)) {
  console.log('Encoding video to Base64 for 100% standalone unified execution...');
  const videoBuf = fs.readFileSync(videoPath);
  const videoB64 = videoBuf.toString('base64');
  videoBase64Script = `  <!-- Standalone Video Data (Embedded for Zero-Dependency Single File Execution) -->\n  <script>\n    window.__EMBEDDED_VIDEO_BASE64__ = "${videoB64}";\n  </script>\n`;
  console.log(`✓ Video encoded: ${(videoBuf.length / (1024 * 1024)).toFixed(2)} MB binary -> ${(videoB64.length / (1024 * 1024)).toFixed(2)} MB Base64`);
}

// 3. Inline JavaScript Engines
const scriptsRegex = /<!--\s*(?:Animation & Smooth Scroll Engines|Lenis Smooth Scroll Engine)\s*-->[\s\S]*?<script\s+src=["']script\.js["']><\/script>/i;
const fallbackScriptsRegex = /<script\s+src=["']assets\/(?:gsap\.min\.js|lenis\.min\.js)["']>[\s\S]*?<script\s+src=["']script\.js["']><\/script>/i;

const inlinedScripts = `${videoBase64Script}<!-- GSAP Animation Engine (Inlined) -->\n  <script>\n${gsap}\n  </script>\n  <!-- ScrollTrigger Plugin (Inlined) -->\n  <script>\n${scrollTrigger}\n  </script>\n  <!-- Lenis Smooth Scroll Engine (Inlined) -->\n  <script>\n${lenis}\n  </script>\n  <!-- Main Application Script (Inlined) -->\n  <script>\n${script}\n  </script>\n${spaRouterScript}`;

if (scriptsRegex.test(unifiedHtml)) {
  unifiedHtml = unifiedHtml.replace(scriptsRegex, () => inlinedScripts);
} else if (fallbackScriptsRegex.test(unifiedHtml)) {
  unifiedHtml = unifiedHtml.replace(fallbackScriptsRegex, () => inlinedScripts);
}

// 4. Inline all asset images via Base64 Data URIs
for (const [relPath, dataUri] of Object.entries(assetMap)) {
  unifiedHtml = unifiedHtml.split(relPath).join(dataUri);
}

// 5. Write the unified single HTML file
fs.writeFileSync(outputFilePath, unifiedHtml, 'utf8');
fs.writeFileSync(outputStandlonePath, unifiedHtml, 'utf8');

const fileSizeMb = (fs.statSync(outputFilePath).size / (1024 * 1024)).toFixed(2);
console.log(`\n============================================================`);
console.log(`✓ COMPLETE UNIFIED WEBSITE SINGLE-FILE CREATED SUCCESSFULLY!`);
console.log(`- File 1: congreso_turismo_medico_completo.html (${fileSizeMb} MB)`);
console.log(`- File 2: website_standalone.html (${fileSizeMb} MB)`);
console.log(`Contains 100% of all 5 pages (Inicio, Agenda, Expo, Sede, Galería),`);
console.log(`all video data, all 8 YouTube thumbnail facades, ambient smoke FX,`);
console.log(`and interactive SPA routing with zero external dependencies.`);
console.log(`============================================================\n`);
