// Compresses the boat model's Blender glTF export for the web and checks nothing the pages rely on was lost.
// It drops the hidden boolean cutters and the unused UVs (the model has no textures), dedups, quantizes and
// meshopt-compresses. Every other node must keep its name and its `part`/`system` extras: the pages and data files
// address parts by those IDs.
// node compress-glb.mjs <export.glb> [out.glb]    (default out: assets/models/hardware/nonsuch30.glb)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, reorder, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [src, out = path.join(HERE, '..', 'assets', 'models', 'hardware', 'nonsuch30.glb')] = process.argv.slice(2);
if (!src) throw new Error('usage: node compress-glb.mjs <export.glb> [out.glb]');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(src);
const before = new Map(doc.getRoot().listNodes().map(n => [n.getName(), n.getExtras()]));
if (doc.getRoot().listTextures().length) throw new Error('the model has textures; this script drops UVs');
for (const node of doc.getRoot().listNodes()) if (node.getExtras().system === 'cutters') node.dispose();
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const sem of prim.listSemantics()) if (sem.startsWith('TEXCOORD_')) prim.setAttribute(sem, null);
  }
}
await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: false, keepExtras: true }),
  reorder({ encoder: MeshoptEncoder }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);

const after = new Map((await io.read(out)).getRoot().listNodes().map(n => [n.getName(), n.getExtras()]));
const problems = [];
for (const [name, extras] of before) {
  if (extras.system === 'cutters') { if (after.has(name)) problems.push(`cutter shipped: ${name}`); continue; }
  if (!extras.part || !extras.system) problems.push(`no part/system extras: ${name}`);
  if (!after.has(name)) problems.push(`node lost: ${name}`);
  else if (JSON.stringify(after.get(name)) !== JSON.stringify(extras)) problems.push(`extras changed: ${name}`);
}
const parts = new Set([...after.values()].map(x => x.part));
console.log(`${path.relative(process.cwd(), out)}: ${after.size} nodes, ${parts.size} parts`);
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
