import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const outdir = 'dist';
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

async function build() {
  await esbuild.build({
    entryPoints: ['src/content.js', 'src/popup.js', 'src/options.js', 'src/background.js'],
    outdir,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome88',
    sourcemap: true,
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  const copy = (src, dest) => {
    const s = path.resolve(src);
    const d = path.resolve(dest);
    if (fs.statSync(s).isDirectory()) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      fs.readdirSync(s).forEach(f => copy(path.join(s, f), path.join(d, f)));
    } else {
      fs.copyFileSync(s, d);
    }
  };

  copy('manifest.json', 'dist/manifest.json');
  copy('icons', 'dist/icons');
  if (fs.existsSync('assets')) copy('assets', 'dist/assets');
  copy('src/content.css', 'dist/content.css');
  copy('src/content.html', 'dist/content.html');

  console.log('Build complete. Load dist/ as an unpacked extension.');
}

build().catch(() => process.exit(1));
