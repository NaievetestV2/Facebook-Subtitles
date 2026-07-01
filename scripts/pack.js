import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const DIST = 'dist';
const NAME = 'facebook-video-subtitles';

function zip() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(path.join('packages', `${NAME}.zip`));
    const archive = archiver('zip');
    output.on('close', () => { console.log(`[pack] ZIP: ${archive.pointer()} bytes -> packages/${NAME}.zip`); resolve(); });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(DIST, false);
    archive.finalize();
  });
}

async function xpi() {
  const outDir = 'packages';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const output = fs.createWriteStream(path.join(outDir, `${NAME}.xpi`));
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => { console.log(`[pack] XPI: ${archive.pointer()} bytes -> packages/${NAME}.xpi`); resolve(); });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(DIST, false);
    archive.finalize();
  });
}

const target = process.argv[2] || 'zip';

(async () => {
  if (target === 'xpi') {
    await xpi();
  } else {
    await zip();
  }
})();
