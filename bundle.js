const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const htmlPath = path.join(rootDir, 'index.html');
const standaloneHtmlPath = path.join(rootDir, 'standalone.html');
const cssPath = path.join(rootDir, 'styles.css');
const lenisPath = path.join(rootDir, 'assets', 'lenis.min.js');
const gsapPath = path.join(rootDir, 'assets', 'gsap.min.js');
const stPath = path.join(rootDir, 'assets', 'ScrollTrigger.min.js');
const scriptPath = path.join(rootDir, 'script.js');
const templatePath = path.join(rootDir, 'index.template.html');
const expoTemplatePath = path.join(rootDir, 'expo.template.html');
const expoDir = path.join(rootDir, 'expo');
const expoHtmlPath = path.join(rootDir, 'expo.html');
const expoSubHtmlPath = path.join(expoDir, 'index.html');
const videoPath = path.join(rootDir, 'gemini_generated_video_d04425a4.mp4');

// Read source files
const sourceHtml = fs.existsSync(templatePath) 
  ? fs.readFileSync(templatePath, 'utf8') 
  : fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const lenis = fs.readFileSync(lenisPath, 'utf8');
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


// Encode Video Base64 for Standalone Playback
let videoBase64Script = '';
if (fs.existsSync(videoPath)) {
  console.log('Encoding video to Base64 for 100% standalone single-file execution...');
  const videoBuf = fs.readFileSync(videoPath);
  const videoB64 = videoBuf.toString('base64');
  videoBase64Script = `  <!-- Standalone Video Data (Embedded for Zero-Dependency Single File Execution) -->\n  <script>\n    window.__EMBEDDED_VIDEO_BASE64__ = "${videoB64}";\n  </script>\n`;
  console.log(`✓ Video encoded: ${(videoBuf.length / (1024 * 1024)).toFixed(2)} MB binary -> ${(videoB64.length / (1024 * 1024)).toFixed(2)} MB Base64`);
}

function inlineAssets(htmlStr) {
  let res = htmlStr;
  for (const [relPath, dataUri] of Object.entries(assetMap)) {
    res = res.split(relPath).join(dataUri);
  }
  return res;
}

function compileHtml(templateString, includeVideo = false) {
  let output = templateString;

  // 1. Inline CSS into <style>
  const cssLinkRegex = /<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']\s*\/?>/i;
  if (cssLinkRegex.test(output)) {
    output = output.replace(cssLinkRegex, () => `<style>\n${css}\n</style>`);
  }

  // 2. Inline JavaScript engines into <script>
  const scriptsRegex = /<!--\s*(?:Animation & Smooth Scroll Engines|Lenis Smooth Scroll Engine)\s*-->[\s\S]*?<script\s+src=["']script\.js["']><\/script>/i;
  const fallbackScriptsRegex = /<script\s+src=["']assets\/(?:gsap\.min\.js|lenis\.min\.js)["']>[\s\S]*?<script\s+src=["']script\.js["']><\/script>/i;

  const inlinedScripts = `${includeVideo ? videoBase64Script : ''}<!-- GSAP Animation Engine (Inlined) -->\n  <script>\n${gsap}\n  </script>\n  <!-- ScrollTrigger Plugin (Inlined) -->\n  <script>\n${scrollTrigger}\n  </script>\n  <!-- Lenis Smooth Scroll Engine (Inlined) -->\n  <script>\n${lenis}\n  </script>\n  <!-- Main Application Script (Inlined) -->\n  <script>\n${script}\n  </script>`;

  if (scriptsRegex.test(output)) {
    output = output.replace(scriptsRegex, () => inlinedScripts);
  } else if (fallbackScriptsRegex.test(output)) {
    output = output.replace(fallbackScriptsRegex, () => inlinedScripts);
  }

  // 3. Inline all asset images
  output = inlineAssets(output);

  return output;
}

// 1. Compile index.html (Master standalone single-page website)
const bundledIndex = compileHtml(sourceHtml, true);
fs.writeFileSync(htmlPath, bundledIndex, 'utf8');
fs.writeFileSync(standaloneHtmlPath, bundledIndex, 'utf8');
const indexSizeMb = (fs.statSync(htmlPath).size / (1024 * 1024)).toFixed(2);
console.log(`✓ Single-page HTML website compiled successfully to index.html & standalone.html (${indexSizeMb} MB)`);

// 2. Compile expo.html and expo/index.html if template exists
if (fs.existsSync(expoTemplatePath)) {
  const sourceExpo = fs.readFileSync(expoTemplatePath, 'utf8');
  const bundledExpo = compileHtml(sourceExpo, false);

  // Write expo.html
  fs.writeFileSync(expoHtmlPath, bundledExpo, 'utf8');

  // Write expo/index.html
  if (!fs.existsSync(expoDir)) {
    fs.mkdirSync(expoDir, { recursive: true });
  }
  fs.writeFileSync(expoSubHtmlPath, bundledExpo, 'utf8');

  const expoSizeKb = (fs.statSync(expoHtmlPath).size / 1024).toFixed(1);
  console.log(`✓ Dedicated Expo page compiled successfully to expo.html & expo/index.html (${expoSizeKb} KB)`);
}

// 3. Compile sede.html and sede/index.html if template exists
const sedeTemplatePath = path.join(rootDir, 'sede.template.html');
const sedeDir = path.join(rootDir, 'sede');
const sedeHtmlPath = path.join(rootDir, 'sede.html');
const sedeSubHtmlPath = path.join(sedeDir, 'index.html');

if (fs.existsSync(sedeTemplatePath)) {
  const sourceSede = fs.readFileSync(sedeTemplatePath, 'utf8');
  const bundledSede = compileHtml(sourceSede, false);

  // Write sede.html
  fs.writeFileSync(sedeHtmlPath, bundledSede, 'utf8');

  // Write sede/index.html
  if (!fs.existsSync(sedeDir)) {
    fs.mkdirSync(sedeDir, { recursive: true });
  }
  fs.writeFileSync(sedeSubHtmlPath, bundledSede, 'utf8');

  const sedeSizeKb = (fs.statSync(sedeHtmlPath).size / 1024).toFixed(1);
  console.log(`✓ Dedicated Sede Oficial page compiled successfully to sede.html & sede/index.html (${sedeSizeKb} KB)`);
}

// 4. Compile agenda.html and agenda/index.html if template exists
const agendaTemplatePath = path.join(rootDir, 'agenda.template.html');
const agendaDir = path.join(rootDir, 'agenda');
const agendaHtmlPath = path.join(rootDir, 'agenda.html');
const agendaSubHtmlPath = path.join(agendaDir, 'index.html');

if (fs.existsSync(agendaTemplatePath)) {
  const sourceAgenda = fs.readFileSync(agendaTemplatePath, 'utf8');
  const bundledAgenda = compileHtml(sourceAgenda, false);

  // Write agenda.html
  fs.writeFileSync(agendaHtmlPath, bundledAgenda, 'utf8');

  // Write agenda/index.html
  if (!fs.existsSync(agendaDir)) {
    fs.mkdirSync(agendaDir, { recursive: true });
  }
  fs.writeFileSync(agendaSubHtmlPath, bundledAgenda, 'utf8');

  const agendaSizeKb = (fs.statSync(agendaHtmlPath).size / 1024).toFixed(1);
  console.log(`✓ Dedicated Agenda page compiled successfully to agenda.html & agenda/index.html (${agendaSizeKb} KB)`);
}

// 5. Compile galeria.html and galeria/index.html if template exists
const galeriaTemplatePath = path.join(rootDir, 'galeria.template.html');
const galeriaDir = path.join(rootDir, 'galeria');
const galeriaHtmlPath = path.join(rootDir, 'galeria.html');
const galeriaSubHtmlPath = path.join(galeriaDir, 'index.html');

if (fs.existsSync(galeriaTemplatePath)) {
  const sourceGaleria = fs.readFileSync(galeriaTemplatePath, 'utf8');
  const bundledGaleria = compileHtml(sourceGaleria, false);

  // Write galeria.html
  fs.writeFileSync(galeriaHtmlPath, bundledGaleria, 'utf8');

  // Write galeria/index.html
  if (!fs.existsSync(galeriaDir)) {
    fs.mkdirSync(galeriaDir, { recursive: true });
  }
  fs.writeFileSync(galeriaSubHtmlPath, bundledGaleria, 'utf8');

  const galeriaSizeKb = (fs.statSync(galeriaHtmlPath).size / 1024).toFixed(1);
  console.log(`✓ Dedicated Galería page compiled successfully to galeria.html & galeria/index.html (${galeriaSizeKb} KB)`);
}

// 6. Build Complete Unified Standalone Single HTML File (All 5 Pages In One Single File)
try {
  require('./bundle_unified.js');
} catch (err) {
  console.warn('Could not run bundle_unified:', err.message);
}


