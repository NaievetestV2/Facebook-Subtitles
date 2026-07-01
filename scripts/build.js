const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const SRC = 'src';
const DIST = 'dist';
const NAME = 'facebook-video-subtitles';

function clean() {
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  fs.mkdirSync(DIST, { recursive: true });
  console.log('[build] Cleaned dist');
}

function copyFiles() {
  const files = fs.readdirSync(SRC);
  files.forEach(f => {
    const srcPath = path.join(SRC, f);
    const destPath = path.join(DIST, f);
    fs.copyFileSync(srcPath, destPath);
  });
  
  ['manifest.json', 'icons', 'assets'].forEach(item => {
    const srcPath = path.join(__dirname, '..', item);
    const destPath = path.join(DIST, path.basename(item));
    if (fs.existsSync(srcPath)) {
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });
  console.log('[build] Files copied');
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(item => {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  });
}

async function zip() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(path.join(__dirname, '..', `${NAME}.zip`));
    const archive = archiver('zip');
    output.on('close', () => { console.log(`[build] Zip created: ${NAME}.zip (${archive.pointer()} bytes)`); resolve(); });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(DIST, false);
    archive.finalize();
  });
}

const command = process.argv[2];
if (command === '--watch') {
  clean();
  copyFiles();
  fs.watch(SRC, { recursive: true }, () => { clean(); copyFiles(); });
} else {
  (async () => {
    clean();
    copyFiles();
    await zip();
  })();
}
