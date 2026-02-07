import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import sharp from 'sharp';

const execFileAsync = promisify(execFile);

function tmpFile(name) {
  return path.join(os.tmpdir(), name);
}

async function main() {
  // Create a tiny 1-second test video (color bars) and extract a frame
  const mp4 = tmpFile('tg-relay-test.mp4');
  const pngFromMp4 = tmpFile('tg-relay-test-from-mp4.png');

  await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=size=320x240:rate=25',
    '-t', '1',
    mp4,
  ]);

  await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', mp4,
    '-frames:v', '1',
    pngFromMp4,
  ]);

  // Create a tiny webp and convert to png
  const webp = tmpFile('tg-relay-test.webp');
  const pngFromWebp = tmpFile('tg-relay-test-from-webp.png');
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#0a0"/><text x="20" y="140" font-size="48" fill="#fff">webp</text></svg>`
  );

  await sharp(svg).webp().toFile(webp);
  await sharp(webp).png().toFile(pngFromWebp);

  console.log('OK conversion outputs:');
  console.log(' ', mp4);
  console.log(' ', pngFromMp4);
  console.log(' ', webp);
  console.log(' ', pngFromWebp);

  // Cleanup? leave files for inspection
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
