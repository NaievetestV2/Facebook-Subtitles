import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const outdir = 'dist';
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

const watch = process.argv.includes('--watch');

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ['src/content.js', 'src/popup.js', 'src/options.js', 'src/background.js'],
    outdir,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome88',
    sourcemap: true,
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  if (watch) {
    await ctx.watch();
    console.log('[dev] Watching...');
  } else {
    await ctx.rebuild();
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
    copy('src/popup.html', 'dist/popup.html');
    copy('src/popup.css', 'dist/popup.css');
    copy('src/options.html', 'dist/options.html');
    copy('src/options.css', 'dist/options.css');
    console.log('Build complete. Load dist/ as an unpacked extension.');
    await ctx.dispose();
  }
}

build().catch(() => process.exit(1));
