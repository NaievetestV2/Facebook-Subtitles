const fs = require('fs');
const path = require('path');

const sizes = [48, 96, 128];
const outDir = path.join(__dirname, '..', 'icons');

function createPNG(size) {
  const width = size;
  const height = size;
  const r = Math.floor(size / 10);
  const bg = [0x18, 0x77, 0xf2];
  const fg = [255, 255, 255];
  
  const deflate = (data) => {
    const zlib = require('zlib');
    return zlib.deflateSync(data);
  };
  
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const inCircle = (x - width/2)**2 + (y - height/2)**2 <= (width/2 - r)**2;
      if (inCircle) {
        rawData.push(0, fg[0], fg[1], fg[2]);
      } else {
        rawData.push(0, bg[0], bg[1], bg[2]);
      }
    }
  }
  
  const compressed = deflate(Buffer.from(rawData));
  
  function chunk(type, data) {
    const buf = Buffer.alloc(data.length + 8);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 0);
    return Buffer.concat([buf, crcBuf]);
  }
  
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = makeCRCTable();
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  
  function makeCRCTable() {
    const table = new Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xEDB88320 ^ (c >>> 1);
        else c = c >>> 1;
      }
      table[n] = c;
    }
    return table;
  }
  
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  
  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  
  const filename = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Generated ${filename}`);
}

sizes.forEach(createPNG);
console.log('All icons generated successfully.');
