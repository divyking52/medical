const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const exportDir = path.join(rootDir, 'medical-tourism-congress-export');

console.log('Creating export package in:', exportDir);

// 1. Ensure clean export directory
if (fs.existsSync(exportDir)) {
  fs.rmSync(exportDir, { recursive: true, force: true });
}
fs.mkdirSync(exportDir, { recursive: true });

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy all assets directory (images, gallery, icons, libraries)
console.log('Copying assets folder (all images, gallery photos, icons, libraries)...');
copyDir(path.join(rootDir, 'assets'), path.join(exportDir, 'assets'));

// 3. Copy video files
const videoPath = path.join(rootDir, 'gemini_generated_video_d04425a4.mp4');
if (fs.existsSync(videoPath)) {
  console.log('Copying background video gemini_generated_video_d04425a4.mp4...');
  fs.copyFileSync(videoPath, path.join(exportDir, 'gemini_generated_video_d04425a4.mp4'));
}

// 4. Copy CSS and JS source files
fs.copyFileSync(path.join(rootDir, 'styles.css'), path.join(exportDir, 'styles.css'));
fs.copyFileSync(path.join(rootDir, 'script.js'), path.join(exportDir, 'script.js'));

// 5. Copy the unified single HTML file as index.html and as congreso_turismo_medico_completo.html
const masterSingleHtml = path.join(rootDir, 'congreso_turismo_medico_completo.html');
if (fs.existsSync(masterSingleHtml)) {
  console.log('Copying unified single HTML file as index.html & congreso_turismo_medico_completo.html...');
  fs.copyFileSync(masterSingleHtml, path.join(exportDir, 'index.html'));
  fs.copyFileSync(masterSingleHtml, path.join(exportDir, 'congreso_turismo_medico_completo.html'));
} else {
  // Fallback to index.html if master doesn't exist
  fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(exportDir, 'index.html'));
}

// Also include standalone index hero single file
const standaloneHeroPath = path.join(rootDir, 'standalone.html');
if (fs.existsSync(standaloneHeroPath)) {
  fs.copyFileSync(standaloneHeroPath, path.join(exportDir, 'index_hero_standalone.html'));
}

// 6. Generate a modular version of the SPA that references the external assets directly
console.log('Generating modular HTML version (referencing local assets folder)...');
try {
  // Build modular HTML without Base64 inlining
  const indexTemplate = fs.readFileSync(path.join(rootDir, 'index.template.html'), 'utf8');
  const agendaTemplate = fs.readFileSync(path.join(rootDir, 'agenda.template.html'), 'utf8');
  const expoTemplate = fs.readFileSync(path.join(rootDir, 'expo.template.html'), 'utf8');
  const sedeTemplate = fs.readFileSync(path.join(rootDir, 'sede.template.html'), 'utf8');
  const galeriaTemplate = fs.readFileSync(path.join(rootDir, 'galeria.template.html'), 'utf8');

  function extractMain(html) {
    const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    return match ? match[1].trim() : '';
  }

  const spaViewsHtml = `
    <!-- UNIFIED SPA MULTI-VIEW SYSTEM -->
    <main id="spaMainContainer">
      <div class="spa-view active" id="view-inicio" data-view="inicio">
        ${extractMain(indexTemplate)}
      </div>
      <div class="spa-view" id="view-agenda" data-view="agenda">
        ${extractMain(agendaTemplate)}
      </div>
      <div class="spa-view" id="view-expo" data-view="expo">
        ${extractMain(expoTemplate)}
      </div>
      <div class="spa-view" id="view-sede" data-view="sede">
        ${extractMain(sedeTemplate)}
      </div>
      <div class="spa-view" id="view-galeria" data-view="galeria">
        ${extractMain(galeriaTemplate)}
      </div>
    </main>
`;

  let modularHtml = indexTemplate.replace(/<main[^>]*>[\s\S]*?<\/main>/i, () => spaViewsHtml);

  // Extract gallery lightbox
  const lightboxMatch = galeriaTemplate.match(/<!-- Image Lightbox Modal -->[\s\S]*?<div class="modal-backdrop" id="imageLightbox"[\s\S]*?<\/div>\s*<\/div>/i);
  if (lightboxMatch && !modularHtml.includes('id="imageLightbox"')) {
    modularHtml = modularHtml.replace('<!-- Floating Mobile Back To Top Button -->', () => `${lightboxMatch[0]}\n\n    <!-- Floating Mobile Back To Top Button -->`);
  }

  // SPA Router script
  const spaRouterScript = `
  <!-- SPA Client-Side Router -->
  <script>
  (function() {
    function initSpaRouting() {
      function switchView(viewName) {
        if (!viewName) viewName = 'inicio';
        const views = document.querySelectorAll('.spa-view');
        views.forEach(v => {
          v.classList.remove('active');
          if (v.getAttribute('data-view') === viewName) {
            v.classList.add('active');
          }
        });
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      }

      function handleRoute() {
        const hash = window.location.hash.replace('#', '') || 'inicio';
        const validViews = ['inicio', 'agenda', 'expo', 'sede', 'galeria'];
        if (validViews.includes(hash)) {
          switchView(hash);
        }
      }

      window.addEventListener('hashchange', handleRoute);
      handleRoute();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSpaRouting);
    } else {
      initSpaRouting();
    }
  })();
  </script>
`;

  modularHtml = modularHtml.replace('</body>', `${spaRouterScript}\n</body>`);
  fs.writeFileSync(path.join(exportDir, 'index_modular.html'), modularHtml, 'utf8');
} catch (e) {
  console.warn('Could not build index_modular.html:', e.message);
}

// 7. Write clear README.md for the user
const readmeContent = `# 15º Congreso de Turismo Médico - Complete Distribution Package

## Overview
This standalone package contains the complete website for the **15º Congreso de Turismo Médico (2 & 3 de Diciembre 2026, FICOTRECE Aguascalientes)**, all graphic & media assets, and the standalone single-file deliverables.

---

## Files in this Folder

### 1. Single HTML File (Zero Dependencies)
- **\`index.html\`** / **\`congreso_turismo_medico_completo.html\`**
  - **100% self-contained single HTML file.**
  - Contains **all 5 pages** (Inicio, Agenda, Expo Comercial, Sede Oficial, Galería Histórica).
  - Includes full client-side SPA routing, Base64 embedded high-definition video, GSAP 3 + ScrollTrigger + Lenis smooth transitions, all 8 YouTube thumbnail facades, and interactive dialogs.
  - **No web server required** — simply double-click \`index.html\` to open in any web browser (Chrome, Edge, Safari, Firefox).

- **\`index_hero_standalone.html\`**
  - The standalone single-file version of the cinematic Hero Landing Page.

### 2. Modular Files (Linked Assets)
- **\`index_modular.html\`**: Multi-view SPA referencing local files in \`./assets/\`, \`./styles.css\`, and \`./script.js\`.
- **\`styles.css\`**: Master stylesheet with cinematic neomorphism design tokens, dark smoke ambient effects, and responsive breakpoints.
- **\`script.js\`**: Core JavaScript application with GSAP scrub choreography and interactive UI components.
- **\`gemini_generated_video_d04425a4.mp4\`**: High-definition background video.

---

## Assets Directory (\`assets/\`)

### Brand & Interface Graphics
- \`brand_logo_600.png\` - High-resolution Congress identity logo (600px)
- \`brand_logo_300.png\` - Header brand mark (300px)
- \`dark_smoke_bg.jpg\` - Obsidian dark smoke textured ambient backdrop
- \`expo_destination.jpg\` - Mexico medical tourism destination banner
- \`ficotrece.jpg\` - FICOTRECE Aguascalientes official venue photo
- \`plano_stands.jpg\` - High-resolution commercial expo floor plan map

### Speaker Headshots
- \`speaker_juan_carlos.png\` - L.T. Juan Carlos Robles
- \`speaker_osvaldo.png\` - Osvaldo (Promotion Tres60)
- \`speaker_gabriel_parra.png\` - Dr. Gabriel O. Parra Pizarro
- \`speaker_carlos_vigil.png\` - Dr. Carlos Vigil
- \`speaker_jack_waas.png\` - Jack Waas (Well-V-Global)

### Strategic Partner Logos
- \`partner_chihuahua.jpg\` - Chihuahua Medical Tourism
- \`partner_icait.jpg\` - ICAIT Healthcare Quality
- \`partner_juarez.jpg\` - Ciudad Juárez Medical Cluster
- \`partner_medparh.jpg\` - MedParh Healthcare
- \`partner_ronten.jpg\` - Ronten Hospital Group

### Historical Congress Gallery & Video Facades (\`assets/gallery/\`)
- **16 Congress Archive Photos**: 2015 through 2019 B2B networking, plenary lectures, expo halls, and VIP inauguration ceremonies.
- **8 YouTube Thumbnail Posters**: \`yt_*.jpg\` high-resolution facades for zero-cookie embedded video playback.

### Animation & Motion Libraries
- \`gsap.min.js\` - GreenSock GSAP 3 core animation library
- \`ScrollTrigger.min.js\` - ScrollTrigger plugin for synchronized timeline scrubbing
- \`lenis.min.js\` - Lenis smooth scroll engine
`;

fs.writeFileSync(path.join(exportDir, 'README.md'), readmeContent, 'utf8');

// Summary of created files
function getDirSummary(dir, level = 0) {
  let count = 0;
  let totalBytes = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = getDirSummary(full, level + 1);
      count += sub.count;
      totalBytes += sub.totalBytes;
    } else {
      count++;
      totalBytes += fs.statSync(full).size;
    }
  }
  return { count, totalBytes };
}

const summary = getDirSummary(exportDir);
console.log(`\n============================================================`);
console.log(`✓ PACKAGE EXPORT COMPLETED SUCCESSFULLY!`);
console.log(`Directory: ${exportDir}`);
console.log(`Total files: ${summary.count}`);
console.log(`Total package size: ${(summary.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`============================================================\n`);
