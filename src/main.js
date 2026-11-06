import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GaussianSplatRenderer, SogStreamScheduler } from 'gaussian-splat-lite';
import './style.css';

// Repacked from the supplied Ronda stream with smaller chunks for Quest memory.
const ASSET_URL = '/sog-optimized/lod-meta.json';
const DESKTOP_SPLAT_BUDGET = 850_000;
const QUEST_SPLAT_BUDGET = 450_000;
const FLOOR_Y = 1.2;
const EYE_HEIGHT = 1.6;
const START_X = 2.5;
const START_Z = 24;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#14242b');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, 1, 0.03, 1000);
camera.position.set(START_X, FLOOR_Y + EYE_HEIGHT, START_Z);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(START_X, FLOOR_Y + EYE_HEIGHT, START_Z - 10);
controls.enableDamping = true;
controls.update();

// The capture already provides visible ground. Keep the locomotion floor invisible.
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
floor.name = 'locomotion-floor';
floor.rotation.x = -Math.PI / 2;
floor.position.y = FLOOR_Y;
floor.visible = false;
scene.add(floor);

const vrRig = new THREE.Group();
vrRig.position.set(START_X, FLOOR_Y, START_Z);
const vrCamera = new THREE.PerspectiveCamera(65, 1, 0.03, 1000);
vrRig.add(vrCamera);
scene.add(vrRig);

// The Ronda capture uses the same orientation and entry point as the reference scene.
const modelRoot = new THREE.Group();
modelRoot.rotation.z = Math.PI;
scene.add(modelRoot);
scene.add(new GaussianSplatRenderer({
  renderer,
  maxStdDev: Math.sqrt(4),
}));

const stream = new SogStreamScheduler({
  url: ASSET_URL,
  splatBudget: DESKTOP_SPLAT_BUDGET,
  // Keep nearby regions at the same detail in every direction while turning.
  lodBehindPenalty: 1,
  maxConcurrentLoads: 4,
  onError: (error, url) => console.error(`Failed to stream SOG chunk ${url}`, error),
});
modelRoot.add(stream.group);
stream.setCamera(camera);
stream.initialized.catch((error) => console.error('Failed to load SOG manifest', error));
stream.firstRenderable.catch((error) => console.error('Failed to render SOG scene', error));

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const vrButton = document.getElementById('enter-vr');
const xrCamera = renderer.xr.getCamera();
let enteringVr = false;
vrButton.addEventListener('click', async () => {
  if (enteringVr) return;
  enteringVr = true;
  try {
    const currentSession = renderer.xr.getSession();
    if (currentSession) {
      await currentSession.end();
    } else {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
      });
      await renderer.xr.setSession(session);
    }
  } catch (error) {
    console.error('Could not enter VR', error);
  } finally {
    enteringVr = false;
  }
});
renderer.xr.addEventListener('sessionstart', () => {
  controls.enabled = false;
  stream.deleteCamera(camera);
  stream.setCamera(xrCamera);
  stream.splatBudget = QUEST_SPLAT_BUDGET;
  vrButton.textContent = 'Exit VR';
});
renderer.xr.addEventListener('sessionend', () => {
  controls.enabled = true;
  stream.deleteCamera(xrCamera);
  stream.setCamera(camera);
  stream.splatBudget = DESKTOP_SPLAT_BUDGET;
  vrButton.textContent = 'Enter VR';
});

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
let rightStickLatched = false;
let lastFrameTime = 0;

function stickAxis(input, index) {
  const axes = input?.gamepad?.axes;
  if (!axes) return 0;
  const value = axes.length >= 4 ? axes[index + 2] : axes[index];
  return Math.abs(value || 0) < 0.16 ? 0 : value;
}

function moveInVr(dt) {
  const session = renderer.xr.getSession();
  if (!session) return;
  let leftController;
  let rightController;
  for (const input of session.inputSources) {
    if (input.handedness === 'left') leftController = input;
    if (input.handedness === 'right') rightController = input;
  }

  const x = stickAxis(leftController, 0);
  const y = stickAxis(leftController, 1);
  if (x || y) {
    vrCamera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.set(-forward.z, 0, forward.x);
    vrRig.position.addScaledVector(forward, -y * 2.2 * dt);
    vrRig.position.addScaledVector(right, x * 2.2 * dt);
  }

  const turn = stickAxis(rightController, 0);
  if (Math.abs(turn) > 0.7 && !rightStickLatched) {
    vrRig.rotation.y -= Math.sign(turn) * Math.PI / 6;
    rightStickLatched = true;
  } else if (Math.abs(turn) < 0.25) {
    rightStickLatched = false;
  }
}

renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - lastFrameTime) / 1000 || 0, 0.1);
  lastFrameTime = time;
  if (renderer.xr.isPresenting) moveInVr(dt);
  else controls.update();
  modelRoot.updateMatrixWorld(true);
  stream.update();
  renderer.render(scene, renderer.xr.isPresenting ? vrCamera : camera);
});
