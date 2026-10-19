# Hardware section tools

Maintenance tools for [/hardware/](https://matthidinger.com/hardware/): Matt's boat and house projects, built around a stylised 3D model of NONSENSE, a Nonsuch 30 Ultra. Jekyll skips this folder, so none of it is published. The site needs none of these tools to build.

## How the section fits together

| Piece | Where |
|---|---|
| Project pages: front matter holds the text, photos, kit list and 3D story | `_pages/hardware/<project>.md` (`permalink: /hardware/<project>/`) |
| Index, guided tour and wiring pages | `_pages/hardware/{index,tour,wiring}.html` |
| Model views, pickable parts, the wiring schematic and photo sizes | `_data/hardware/{boat,parts,wiring,photos}.yml` |
| Where photos are served from | `_data/hardware/media.yml` |
| Layouts and includes | `_layouts/hardware*.html`, `_includes/hardware/` |
| Styles and scripts (pages work without JavaScript; scripts add the 3D model and sliders) | `assets/css/hardware*.css`, `assets/js/hardware/` |
| The model, its Blender source and the vendored three.js bundle | `assets/models/hardware/nonsuch30.glb`, `_hardware-tools/model/`, `assets/js/hardware/lib/` |

**Part IDs.** Every node in the model carries glTF extras `part` (a stable, lowercase-hyphenated ID such as `windlass-gypsy`) and `system` (such as `tackle`). The pages and data files refer to parts only by these IDs, never by mesh name. Coordinates in the data files are Blender metres: +X forward, +Y port, +Z up.

## Setup

```sh
cd _hardware-tools
npm install
```

Versions are pinned exactly in `package.json`, and there's no lockfile. The esbuild output depends only on the esbuild and three versions.

## Photos

Photos aren't in the repository. They're served from `https://matthidingerpreviews.z5.web.core.windows.net/media/hardware/`, so a photo can be removed for good without rewriting git history. The local copy lives in the git-ignored `.artifacts/hardware-media/`, which mirrors that path:

```
banner.jpg                 long edge 2000 px
<project>/<name>.jpg       long edge 1400 px
<project>/<name>-sm.jpg    long edge 640 px (the page's src; the full photo is in its srcset)
```

To add or replace photos:

1. `npm run photos -- <project> <original>[=<name>] ...` turns each original upright, converts it to sRGB, strips all metadata (camera, GPS, timestamps) and writes both copies. Add `--force` to replace an existing photo.
2. Reference the photo from the page's front matter: `cover`, `before`, `after` or a `photo` field. A bare name means the page's own photo. Use `<project>/<name>` to borrow another project's photo, and always in `_data/hardware/*.yml`.
3. `npm run sizes` checks every photo and reference, then regenerates `_data/hardware/photos.yml`. Commit that file.
4. Look over every new photo before publishing it: house numbers, registration numbers, faces, screens and paperwork.
5. `./upload-media.ps1 -DryRun`, then `./upload-media.ps1`. It needs the Azure CLI signed in (`az login`) with blob write access to the storage account. It refuses to run if `npm run check` fails, never deletes anything, and caches photos for up to a day. To change a published photo immediately, give the new one a new name.

To build the site locally against photos you haven't uploaded, serve the folder (for example `npx --yes http-server .artifacts/hardware-media -p 4001`) and add `hardware_media: http://127.0.0.1:4001/` to a local Jekyll config.

## The 3D model

`model/build_nonsuch.py` builds the model in [Blender](https://www.blender.org/) 5.2. The geometry is original and stylised, not to scale. Each object's name and its `part`/`system` custom properties are set there. To change the model:

```sh
blender -b --python model/build_nonsuch.py -- norender   # writes model/out/nonsuch30.glb (git-ignored)
npm run glb -- model/out/nonsuch30.glb                   # writes assets/models/hardware/nonsuch30.glb
```

Leave out `norender` to also render reference images into `model/out/`. `npm run glb` drops the hidden boolean `cutters`, dedups, quantizes and meshopt-compresses the export. It then fails if any part lost its node or its `part`/`system` extras.

Blender doesn't always emit index buffers in the same order, so two builds of the same script can differ by a few bytes while the geometry is identical. Commit a rebuilt model only when the script has changed.

## three.js

`assets/js/hardware/lib/three.min.js` is a tree-shaken bundle of only the pieces listed in `three-entry.mjs`. After changing that list or the `three` version:

```sh
npm run three
```
