import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const DIST = 'dist';
const NAME = 'facebook-video-subtitles';

function zip() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(path.join(__dirname, '..', `${NAME}.zip`));
    const archive = archiver('zip');
    output.on('close', () => { console.log(`[zip] Created ${archive.pointer()} bytes`); resolve(); });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(DIST, false);
    archive.finalize();
  });
}

zip().catch(console.error);
