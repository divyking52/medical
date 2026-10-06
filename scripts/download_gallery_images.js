const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const galleryDir = path.join(__dirname, '..', 'assets', 'gallery');
if (!fs.existsSync(galleryDir)) {
  fs.mkdirSync(galleryDir, { recursive: true });
}

const imagesToDownload = [
  // 2019
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2019/06/inauguración-del-congreso-de-turismo-medico.jpg', name: 'galeria_2019_inauguracion.jpg', title: 'Inauguración Oficial Cozumel 2019', year: '2019' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2019/06/congreso-de-turismo-medico-cozumel.jpg', name: 'galeria_2019_recinto.jpg', title: 'Recinto Plenario Cozumel 2019', year: '2019' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2019/06/coferencias-turismo-medico.jpg', name: 'galeria_2019_conferencias.jpg', title: 'Conferencias Magistrales 2019', year: '2019' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2019/06/stands-cozumel.jpg', name: 'galeria_2019_stands.jpg', title: 'Pabellón de Stands Cozumel 2019', year: '2019' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2019/06/citas-de-negocios-en-turismo-medico.jpg', name: 'galeria_2019_b2b.jpg', title: 'Citas de Negocios B2B 2019', year: '2019' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2019/06/turismo-medico-cozumel.jpg', name: 'galeria_2019_networking.jpg', title: 'Networking y Vinculación 2019', year: '2019' },

  // 2018 Aguascalientes
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/CONGRESO-DE-TURISMO-MEDICO-2018.jpg', name: 'galeria_2018_inauguracion.jpg', title: '9° Congreso Aguascalientes 2018', year: '2018' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/CONGRESO-MEDICO.jpg', name: 'galeria_2018_auditorio.jpg', title: 'Auditorio Plenario 2018', year: '2018' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/TURISMO-DE-SALUD.jpg', name: 'galeria_2018_turismo_salud.jpg', title: 'Delegaciones Internacionales 2018', year: '2018' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/TURISMO-MEDICO.jpg', name: 'galeria_2018_stands.jpg', title: 'Expo Comercial 2018', year: '2018' },

  // 2017 Ciudad Juárez
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/2017.jpg', name: 'galeria_2017_juarez.jpg', title: 'VIII Congreso Ciudad Juárez 2017', year: '2017' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/SDF.jpg', name: 'galeria_2017_panel.jpg', title: 'Panel de Expertos 2017', year: '2017' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/DFGDFV.jpg', name: 'galeria_2017_b2b.jpg', title: 'Mesas de Negocios Bilaterales 2017', year: '2017' },

  // 2016 & 2015
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/2016.jpg', name: 'galeria_2016_plenario.jpg', title: 'VII Congreso de Turismo Médico 2016', year: '2016' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/personalidades.jpg', name: 'galeria_2015_personalidades.jpg', title: 'Personalidades & Directivos 2015', year: '2015' },
  { url: 'https://www.congresodeturismomedico.com/es/wp-content/uploads/2018/07/encuentros-de-negocios.jpg', name: 'galeria_2015_b2b.jpg', title: 'Encuentros de Negocios 2015', year: '2015' }
];

function downloadImage(item) {
  return new Promise((resolve) => {
    const dest = path.join(galleryDir, item.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`✓ Already exists: ${item.name}`);
      return resolve(true);
    }
    const file = fs.createWriteStream(dest);
    // Encode URL properly for non-ascii characters
    const parsed = new URL(item.url);
    const client = parsed.protocol === 'https:' ? https : http;
    
    client.get(parsed, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Handle redirect
        client.get(response.headers.location, (redirRes) => {
          redirRes.pipe(file);
          file.on('finish', () => { file.close(); resolve(true); });
        }).on('error', () => { fs.unlink(dest, () => {}); resolve(false); });
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      } else {
        console.warn(`Failed ${response.statusCode}: ${item.url}`);
        fs.unlink(dest, () => {});
        resolve(false);
      }
    }).on('error', (err) => {
      console.warn(`Error downloading ${item.name}: ${err.message}`);
      fs.unlink(dest, () => {});
      resolve(false);
    });
  });
}

(async () => {
  console.log(`Downloading ${imagesToDownload.length} official gallery photos...`);
  for (const item of imagesToDownload) {
    const ok = await downloadImage(item);
    if (ok) console.log(`✓ Downloaded ${item.name}`);
  }
  console.log('Finished downloading gallery images.');
})();
