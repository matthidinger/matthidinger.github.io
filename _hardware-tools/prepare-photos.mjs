// Prepares photos for a Hardware page from originals (JPEG, PNG, WebP, TIFF or AVIF): turns them upright, converts
// them to sRGB, strips all metadata (camera, GPS, timestamps) and writes the full and small copies into the media
// folder. Then run `npm run sizes` to check them and update _data/hardware/photos.yml.
//
// node prepare-photos.mjs <project> <original>[=<name>] ... [--force] [--out <folder>]
//   <project>  the page's permalink slug, e.g. windlass
//   <name>     defaults to the file name, lowercased and hyphenated ("IMG 1234.jpg" becomes img-1234)
//   --force    replace photos that already exist (published copies are cached for up to a day)
//   --out      the media folder (default .artifacts/hardware-media)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readJpeg } from './check-photos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COPIES = { '': 1400, '-sm': 640 };
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = s => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join('-');

let force = false;
let out = path.join(ROOT, '.artifacts', 'hardware-media');
const rest = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--force') force = true;
  else if (a === '--out') out = path.resolve(process.argv[++i]);
  else rest.push(a);
}
const [project, ...originals] = rest;
if (!project || !NAME.test(project) || !originals.length) {
  console.error('usage: node prepare-photos.mjs <project> <original>[=<name>] ... [--force] [--out <folder>]');
  process.exit(2);
}

for (const spec of originals) {
  const eq = spec.lastIndexOf('=');
  const src = eq > 0 ? spec.slice(0, eq) : spec;
  const name = eq > 0 ? spec.slice(eq + 1) : slug(path.parse(src).name);
  if (!NAME.test(name) || name.endsWith('-sm')) {
    console.error(`${spec}: "${name}" isn't a usable name (lowercase words joined by hyphens, not ending in -sm)`);
    process.exitCode = 1;
    continue;
  }
  const files = Object.keys(COPIES).map(s => path.join(out, project, `${name}${s}.jpg`));
  if (!force && files.some(f => fs.existsSync(f))) {
    console.error(`${project}/${name} already exists; add --force to replace it`);
    process.exitCode = 1;
    continue;
  }
  for (const [suffix, max] of Object.entries(COPIES)) {
    const jpeg = await sharp(src)
      .rotate()
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .toColourspace('srgb')
      .jpeg({ quality: 76, progressive: true, mozjpeg: true })
      .toBuffer();
    const { size, metadata } = readJpeg(jpeg);
    if (metadata.length) throw new Error(`${src}: output still carries ${metadata.join(', ')}`);
    const file = path.join(out, project, `${name}${suffix}.jpg`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, jpeg);
    console.log(`${project}/${name}${suffix}.jpg  ${size.join('x')}  ${Math.round(jpeg.length / 1024)} KB`);
  }
}
