// The only three.js pieces the Hardware pages import. build-three.mjs bundles these into
// assets/js/hardware/lib/three.min.js; add a name here when a page script needs it.
export {
  ACESFilmicToneMapping, Box3, Color, CylinderGeometry, DirectionalLight, Group, MathUtils, Mesh, MeshStandardMaterial,
  Object3D, PerspectiveCamera, PMREMGenerator, Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer,
} from 'three';
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
export { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
