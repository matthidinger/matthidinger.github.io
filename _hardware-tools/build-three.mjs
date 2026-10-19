// Builds assets/js/hardware/lib/three.min.js: a tree-shaken, minified ES module of just the three.js pieces in
// three-entry.mjs, with three's MIT licence copied alongside. The output is deterministic for a given version.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HERE, '..', 'assets', 'js', 'hardware', 'lib');
const THREE = path.join(HERE, 'node_modules', 'three');
const { version } = JSON.parse(fs.readFileSync(path.join(THREE, 'package.json'), 'utf8'));
const entry = fs.readFileSync(path.join(HERE, 'three-entry.mjs'), 'utf8');
const names = [...entry.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(m => m[1].split(',')).map(s => s.trim()).filter(Boolean);

const { outputFiles } = await esbuild.build({
  entryPoints: [path.join(HERE, 'three-entry.mjs')],
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'none',
  write: false,
});
const header = `/* three.js (three@${version}), MIT licence: see LICENSE-three.txt. https://threejs.org
   Tree-shaken ES module bundle of: ${names.join(', ')}.
   Rebuild: _hardware-tools, npm run three */\n`;
fs.mkdirSync(LIB, { recursive: true });
fs.writeFileSync(path.join(LIB, 'three.min.js'), header + outputFiles[0].text);
fs.copyFileSync(path.join(THREE, 'LICENSE'), path.join(LIB, 'LICENSE-three.txt'));
console.log(`three@${version}: ${(fs.statSync(path.join(LIB, 'three.min.js')).size / 1024).toFixed(0)} KB, ${names.length} exports`);
