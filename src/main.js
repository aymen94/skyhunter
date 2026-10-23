import * as THREE from 'wamr3d/compat';
import { GLTFLoader } from 'wamr3d/addons/loaders/GLTFLoader.js';
import wasmUrl from 'wamr3d/wamr3d_wasm_bg.wasm?url';
import './style.css';
import { createTargets, createDefenseMission, createChargingStations, createScenarioEnvironment } from './world.js';
import { createDrone } from './drone.js';
import { createGameplay } from './gameplay.js';
import { createFlightController } from './flight.js';
import { createBatterySystem } from './battery.js';
import { createMissionCatalog } from './missions.js';
import { createFlightEffects } from './flightEffects.js';

// Vite serves this package asset as a real Wasm file in dev and production,
// instead of letting the generated glue resolve it to the SPA HTML fallback.
await THREE.init(wasmUrl);

const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const mount = $('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8299aa);
scene.fog = new THREE.FogExp2(0x8299aa, 0.0075);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 700);
const qualityScales = { low: .7, medium: 1, high: 1.5 };
const savedGraphics = JSON.parse(localStorage.getItem('skyhunter-graphics') || '{}');
const startupWebGPU = Boolean(navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null));
const startupWebGL = Boolean(document.createElement('canvas').getContext('webgl2'));
const startupBackend = ['webgpu', 'webgl'].includes(savedGraphics.backend) && (savedGraphics.backend === 'webgpu' ? startupWebGPU : startupWebGL)
  ? savedGraphics.backend : startupWebGPU ? 'webgpu' : 'webgl';
const graphics = { backend: startupBackend, quality: ['low', 'medium', 'high'].includes(savedGraphics.quality) ? savedGraphics.quality : 'high' };
let renderer;
async function createRenderer() {
  const next = new THREE.WebGPURenderer({ backend: graphics.backend, antialias: true, powerPreference: 'high-performance' });
  next.setPixelRatio(Math.min(devicePixelRatio * qualityScales[graphics.quality], 2));
  next.setSize(innerWidth, innerHeight);
  // WAMR3D 0.9.3's WebGPU shadow pass can build a bind group with an
  // uninitialized GPU buffer for this scene. Keep direct lighting enabled while
  // skipping that broken pass until the renderer-side buffer setup is fixed.
  next.shadowMap.enabled = false;
  next.toneMapping = THREE.ACESFilmicToneMapping;
  next.toneMappingExposure = 1.12;
  await next.init();
  return next;
}
renderer = await createRenderer();
mount.appendChild(renderer.domElement);

const skyGeometry = new THREE.SphereGeometry(620, 48, 24);
const skyPositions = skyGeometry.attributes.position.array;
const skyColors = new Float32Array(skyPositions.length);
const horizonSky = new THREE.Color(0xb8c3c4);
const middleSky = new THREE.Color(0x6885a0);
const upperSky = new THREE.Color(0x172b49);
for (let i = 0; i < skyPositions.length; i += 3) {
  const elevation = THREE.MathUtils.clamp((skyPositions[i + 1] / 620 + .05) / .9, 0, 1);
  const color = elevation < .48
    ? horizonSky.clone().lerp(middleSky, elevation / .48)
    : middleSky.clone().lerp(upperSky, (elevation - .48) / .52);
  skyColors[i] = color.r;
  skyColors[i + 1] = color.g;
  skyColors[i + 2] = color.b;
}
skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
const skyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false });
scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

scene.add(new THREE.AmbientLight(0xc9e4f2, 1.45));
const sun = new THREE.DirectionalLight(0xffe3c4, 3.1);
sun.position.set(-35, 65, 25);
sun.castShadow = false;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const fillLight = new THREE.PointLight(0xf0444d, 100, 65, 2);
fillLight.position.set(-8, 12, 4);
scene.add(fillLight);

const material = (color, roughness = .7, metalness = .08) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const groundY = -1.1;
const textureLoader = new THREE.TextureLoader();
const groundColor = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/ground037_Color.jpg`);
const groundRoughness = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/ground037_Roughness.jpg`);
const paintedMetalColor = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/paintedMetal012_Color.jpg`);
const paintedMetalRoughness = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/paintedMetal012_Roughness.jpg`);
const paintedMetalNormal = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/paintedMetal012_NormalGL.jpg`);
const paintedMetalMaps = { color: paintedMetalColor, roughness: paintedMetalRoughness, normal: paintedMetalNormal };
const solarPanelColor = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/solarPanel002_Color.jpg`);
const solarPanelRoughness = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/solarPanel002_Roughness.jpg`);
const solarPanelNormal = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/solarPanel002_NormalGL.jpg`);
const solarPanelMaps = { color: solarPanelColor, roughness: solarPanelRoughness, normal: solarPanelNormal };
const explosionTexture = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}textures/explosion-tileset-8x8.png`);
explosionTexture.wrapS = THREE.RepeatWrapping;
explosionTexture.wrapT = THREE.RepeatWrapping;
explosionTexture.repeat.set(1 / 8, 1 / 8);
for (const texture of [groundColor, groundRoughness]) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(110, 110);
}
const terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0x526365,
  roughness: .94,
  map: groundColor,
  roughnessMap: groundRoughness,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), terrainMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = groundY;
ground.receiveShadow = true;
scene.add(ground);

let scorpionTankVariants = [];
try {
  const scorpionScene = (await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/scorpion-ground-vehicle.glb`)).scene;
  const variants = [
    { name: 'Default', minY: -8, maxY: 27 },
    { name: 'Camo', minY: 26, maxY: 62 },
    { name: 'Hannibal', minY: 61, maxY: 100 },
  ];
  for (const variant of variants) {
    const model = scorpionScene.clone(true);
    const removed = [];
    model.traverse((part) => {
      if (!part.isMesh) return;
      const materialName = Array.isArray(part.material) ? part.material[0]?.name : part.material?.name;
      if (materialName !== variant.name && materialName !== 'Treads') {
        removed.push(part);
        return;
      }
      if (materialName === 'Treads') {
        const geometry = part.geometry.clone();
        const position = geometry.attributes.position;
        const indices = geometry.index?.array;
        if (indices) {
          const kept = [];
          for (let i = 0; i < indices.length; i += 3) {
            const y = (position.getY(indices[i]) + position.getY(indices[i + 1]) + position.getY(indices[i + 2])) / 3;
            if (y >= variant.minY && y <= variant.maxY) kept.push(indices[i], indices[i + 1], indices[i + 2]);
          }
          geometry.setIndex(kept);
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
        }
        part.geometry = geometry;
      }
      part.castShadow = true;
      part.receiveShadow = true;
    });
    removed.forEach((part) => part.parent?.remove(part));
    model.name = `Scorpion ${variant.name}`;
    scorpionTankVariants.push(model);
  }
} catch (error) {
  console.warn('The Scorpion model could not be loaded; using the procedural tank:', error);
}

const grid = new THREE.GridHelper(700, 90, 0x75b1ad, 0x77908b);
grid.position.y = groundY + .03;
grid.material.transparent = true;
grid.material.opacity = .17;
scene.add(grid);

// Distant city and ridgeline establish the flight course without external assets.
const city = new THREE.Group();
scene.add(city);
const buildingMats = [material(0x52636b), material(0x64747a), material(0x43565f), material(0x78817e)];
for (let i = 0; i < 90; i++) {
  const x = (Math.random() - .5) * 250;
  const z = -55 - Math.random() * 190;
  const width = 4 + Math.random() * 10;
  const height = 8 + Math.random() * 34;
  const depth = 5 + Math.random() * 11;
  const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMats[i % buildingMats.length]);
  building.position.set(x, height / 2 + groundY, z);
  building.castShadow = i < 24;
  building.receiveShadow = true;
  city.add(building);
  if (i % 3 === 0) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), new THREE.MeshBasicMaterial({ color: 0x37e6cf }));
    beacon.position.set(x, height + groundY, z);
    city.add(beacon);
  }
}
const ridgeline = new THREE.Group();
scene.add(ridgeline);
const ridgeColors = [0x71858b, 0x627888, 0x4b6278];
for (let layer = 0; layer < ridgeColors.length; layer++) {
  for (let i = 0; i < 13; i++) {
    const height = 23 + Math.random() * 22 - layer * 3;
    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(34 + Math.random() * 20, height, 6),
      material(ridgeColors[layer], .98, .01),
    );
    peak.position.set(-330 + i * 55 + (Math.random() - .5) * 15, groundY + height / 2 - 4 - layer * 2, -190 - layer * 48 - Math.random() * 25);
    peak.rotation.y = Math.random() * .5;
    ridgeline.add(peak);
  }
}

const targetModels = { tanks: scorpionTankVariants };
const outpostTargets = createTargets(THREE, scene, groundY, material, 'outpost', paintedMetalMaps, targetModels);
const harborTargets = createTargets(THREE, scene, groundY, material, 'harbor', paintedMetalMaps, targetModels);
const highlandTargets = createTargets(THREE, scene, groundY, material, 'highlands', paintedMetalMaps, targetModels);
const defenseMission = createDefenseMission(THREE, scene, groundY, material, solarPanelMaps);
const chargingStations = createChargingStations(THREE, scene, groundY, material);
const harborEnvironment = createScenarioEnvironment(THREE, scene, groundY, material, 'harbor');
const highlandsEnvironment = createScenarioEnvironment(THREE, scene, groundY, material, 'highlands');
defenseMission.environment.visible = false;
defenseMission.enemies.forEach((enemy) => { enemy.visible = false; });
harborEnvironment.visible = false;
highlandsEnvironment.visible = false;
const targets = [];

const { drone, generatedFrame, importedFrame, frameMat, edgeMat, noseMat, rotors, payloadModels } = createDrone(THREE, scene, material, paintedMetalMaps);

const droneLoader = new GLTFLoader();
const airframeModels = {};
for (const [id, file] of Object.entries({ mapping: 'survey-drone.glb' })) {
  try {
    const model = (await droneLoader.loadAsync(`${import.meta.env.BASE_URL}models/${file}`)).scene;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fitScale = 1.8 / Math.max(size.x, size.y, size.z, .001);
    model.scale.setScalar(fitScale);
    model.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);
    airframeModels[id] = model;
    importedFrame.add(model);
  } catch (error) {
    console.warn(`Could not load ${file}; its airframe will be unavailable.`, error);
  }
}
const profiles = {
  mapping: { name: 'KAMIKAZE', suffix: 'STRIKE UAV', speed: 30, altitude: 30, ammo: Infinity, weapon: 'STRIKE CAMERA', color: 0x334b50, edge: 0x58d2bd, scale: [.22, .22, .22], hint: 'CAMERA / PULSE TEST', category: 'commercial', model: 'mapping' },
};

const availableAirframeIds = Object.keys(profiles).filter((id) => airframeModels[profiles[id].model]);
for (const card of document.querySelectorAll('.drone-card')) {
  const profile = profiles[card.dataset.drone];
  if (!profile || !airframeModels[profile.model]) { card.hidden = true; continue; }
  const initiallySelected = card.dataset.drone === availableAirframeIds[0];
  card.classList.toggle('selected', initiallySelected);
  card.setAttribute('aria-pressed', String(initiallySelected));
  card.querySelector('.weapon-tag').innerHTML = `<span>⌖</span> ${profile.weapon} <span class="tag-count">LIVE</span>`;
  card.querySelector('.card-stats').innerHTML = `<span>MAX SPEED<b>${Math.round(profile.speed * 3.6)} KM/H</b></span><span>CEILING<b>${profile.altitude} M</b></span>`;
  const note = document.createElement('span');
  note.className = 'airframe-note';
  note.textContent = `CEILING ${profile.altitude} M AGL / TOP SPEED ${Math.round(profile.speed * 3.6)} KM/H`;
  card.querySelector('.card-description')?.after(note);
}
$('#visibleFrameCount').textContent = String([...document.querySelectorAll('.drone-card')].filter((card) => !card.hidden).length).padStart(2, '0');
$('#totalFrameCount').textContent = $('#visibleFrameCount').textContent;

const state = {
  selected: availableAirframeIds[0] ?? 'mapping', started: false, startTime: 0, score: 0, sound: true,
  mission: 'outpost', resourceHealth: 100, battery: 100, batteryDepleted: false, flightStopped: false, charging: false,
  gameOver: false, firing: false, shotAt: 0, shotCooldown: 210, toastAt: 0, cameraAimOffset: 0, cameraMode: 'third',
  bombs: [], particles: [], activeMissile: null, respawning: false, respawnAt: 0,
};
const keys = new Set();
const dronePos = new THREE.Vector3(0, 7, 14);
const velocity = new THREE.Vector3();
const forward = new THREE.Vector3(0, 0, -1);
const selectedProfile = () => profiles[state.selected];

const scoreEl = $('#score'), threatEl = $('#threatCount'), threatTotalEl = $('#threatTotal'), timerEl = $('#timer');
const speedEl = $('#speed'), batteryBar = $('#healthBar'), batteryText = $('#healthText'), batteryHint = $('#batteryHint');
const heightEl = $('#heightAgl'), ceilingEl = $('#heightCeiling');
const altitudeGauge = $('#altitudeGauge'), altitudeFill = $('#altitudeFill');
const ammoCount = $('#ammoCount'), piloting = $('#piloting'), targetReadout = $('#targetReadout');
const targetName = $('#targetName'), targetDistance = $('#targetDistance'), crosshair = $('#crosshair');
const message = $('#centerMessage'), toast = $('#toast'), deployScreen = $('#deploymentScreen');
const droneFlightSound = new Audio(`${import.meta.env.BASE_URL}sounds/drone-flight.mp3`);
droneFlightSound.loop = true;
droneFlightSound.preload = 'auto';
const explosionSound = new Audio(`${import.meta.env.BASE_URL}sounds/explosion-2.mp3`);
explosionSound.preload = 'auto';

const missions = createMissionCatalog({ outpostTargets, defenseMission, harborTargets, harborEnvironment, highlandTargets, highlandsEnvironment });
const allMissionTargets = Object.values(missions).flatMap((mission) => mission.targets);

function activateMission(id) {
  const mission = missions[id] ?? missions.outpost;
  const defendingRelay = id === 'relay';
  state.mission = id;
  state.missionCompleteTitle = mission.completeTitle;
  state.missionCompleteDetail = mission.completeDetail;
  state.resourceHealth = 100;
  state.gameOver = false;
  targets.splice(0, targets.length, ...mission.targets);
  allMissionTargets.forEach((target) => {
    target.userData.alive = true;
    target.visible = mission.targets.includes(target);
  });
  defenseMission.enemies.forEach((target) => {
    target.userData.alive = true;
    target.userData.progress = target.userData.initialProgress;
    target.position.copy(target.userData.start).lerp(target.userData.destination, target.userData.progress);
    target.visible = defendingRelay;
  });
  mission.environment && (mission.environment.visible = true);
  Object.values(missions).forEach((item) => { if (item.environment && item.environment !== mission.environment) item.environment.visible = false; });
  Object.entries(chargingStations).forEach(([missionId, stations]) => {
    stations.forEach((station) => { station.visible = missionId === id; });
  });
  city.visible = id === 'outpost';
  ridgeline.visible = true;
  scene.background.setHex(mission.background);
  skyMaterial.color.setHex(mission.skyTint);
  scene.fog.color.setHex(mission.background);
  scene.fog.density = mission.fog;
  terrainMaterial.color.setHex(mission.ground);
  grid.material.color.setHex(mission.grid);
  $('#missionLabel').textContent = mission.title;
  const hangarMissionLabel = $('#hangarMissionLabel');
  if (hangarMissionLabel) hangarMissionLabel.textContent = mission.title;
  $('#hangarMissionCopy').textContent = mission.copy;
  $('#hangarMissionObjective').textContent = mission.objective;
  $('#hangarReadiness').textContent = mission.readiness;
  $('#messageTitle').textContent = mission.completeTitle;
  $('#messageDetail').textContent = mission.completeDetail;
  $('#resourceCard').classList.toggle('hidden', !defendingRelay);
  $('#resourceHealthBar').style.width = '100%';
  $('#resourceHealthText').textContent = '100%';
  batterySystem.reset();
  threatEl.textContent = String(targets.length).padStart(2, '0');
  threatTotalEl.textContent = `/ ${String(targets.length).padStart(2, '0')}`;
  document.querySelectorAll('.mission-option').forEach((button) => {
    const selected = button.dataset.mission === id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('.drone-card').forEach((card) => {
    const recommended = mission.recommendedDrones.includes(card.dataset.drone);
    card.classList.toggle('recommended', recommended);
    card.querySelector('.availability').innerHTML = `<i></i>${recommended ? ' MISSION FIT' : ' AVAILABLE'}`;
  });
}

camera.position.set(0, 10, 26);
camera.lookAt(0, 5, -8);
drone.position.copy(dronePos);

let audioContext;
function beep(frequency = 440, duration = .06, type = 'square', gain = .025) {
  if (!state.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const amp = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    amp.gain.value = gain;
    amp.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(amp);
    amp.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional on browsers that block Web Audio. */ }
}

function syncDroneFlightSound() {
  const shouldPlay = state.sound && state.started && !state.gameOver && !state.respawning;
  if (!shouldPlay) {
    droneFlightSound.pause();
    return;
  }
  const speedRatio = THREE.MathUtils.clamp(velocity.length() / selectedProfile().speed, 0, 1);
  droneFlightSound.volume = .12 + speedRatio * .22;
  droneFlightSound.playbackRate = 1 + speedRatio * .24;
  if (droneFlightSound.paused) droneFlightSound.play().catch(() => {});
}

const batterySystem = createBatterySystem({
  state, dronePos, velocity, stations: chargingStations, keys, groundY, toast,
  batteryBar, batteryText, batteryHint, beep,
});
const flightEffects = createFlightEffects({ THREE, scene, app, dronePos, state });

function updateLoadout() {
  const profile = selectedProfile();
  altitudeGauge.setAttribute('aria-valuemax', String(profile.altitude));
  const useImportedModel = Boolean(profile.model && airframeModels[profile.model]);
  generatedFrame.visible = !useImportedModel;
  importedFrame.visible = useImportedModel;
  payloadModels.visible = !useImportedModel;
  Object.entries(airframeModels).forEach(([id, model]) => { model.visible = useImportedModel && id === profile.model; });
  frameMat.color.setHex(profile.color);
  edgeMat.color.setHex(profile.edge);
  noseMat.color.setHex(profile.color);
  drone.scale.set(...profile.scale);
  payloadModels.clear();
  piloting.innerHTML = `${profile.name} <span>${profile.suffix}</span>`;
  ceilingEl.textContent = `${profile.altitude} M`;
  $('#selectedLoadout').innerHTML = `${profile.name} ${profile.suffix} <i>—</i> ${profile.weapon}`;
  ammoCount.textContent = profile.ammo === Infinity ? 'LIVE' : String(profile.ammo).padStart(2, '0');
}

for (const card of document.querySelectorAll('.drone-card')) {
  card.addEventListener('click', () => {
    state.selected = card.dataset.drone;
    document.querySelectorAll('.drone-card').forEach((item) => {
      const selected = item === card;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    updateLoadout();
    beep(520, .045, 'triangle', .018);
  });
}

for (const option of document.querySelectorAll('.mission-option')) {
  option.addEventListener('click', () => activateMission(option.dataset.mission));
}

function deploy() {
  if (state.started) return;
  state.started = true;
  state.cameraAimOffset = 0;
  state.startTime = performance.now();
  app.classList.add('playing');
  deployScreen.setAttribute('aria-hidden', 'true');
  syncDroneFlightSound();
  renderer.domElement.focus?.();
  beep(360, .12, 'triangle', .03);
  setTimeout(() => beep(540, .17, 'triangle', .025), 100);
}
$('#deployButton').addEventListener('click', deploy);
$('#restart').addEventListener('click', () => {
  state.gameOver = false;
  state.respawning = false;
  state.respawnAt = 0;
  state.firing = false;
  state.started = false;
  state.score = 0;
  state.shotAt = 0;
  state.toastAt = 0;
  state.resourceHealth = 100;
  batterySystem.reset();
  defenseMission.enemies.forEach((enemy) => {
    enemy.userData.progress = enemy.userData.initialProgress;
    enemy.position.copy(enemy.userData.start).lerp(enemy.userData.destination, enemy.userData.progress);
  });
  for (const target of targets) {
    target.userData.alive = true;
    target.visible = true;
  }
  state.bombs.forEach(({ mesh, cable }) => { scene.remove(mesh); if (cable) scene.remove(cable); });
  state.bombs.length = 0;
  state.activeMissile = null;
  dronePos.set(0, 7, 14);
  velocity.set(0, 0, 0);
  drone.position.copy(dronePos);
  drone.visible = true;
  drone.rotation.set(0, 0, 0);
  scoreEl.textContent = '000000';
  threatEl.textContent = String(targets.length).padStart(2, '0');
  ammoCount.textContent = selectedProfile().ammo === Infinity ? 'LIVE' : String(selectedProfile().ammo).padStart(2, '0');
  timerEl.textContent = '00:00';
  message.classList.remove('visible');
  app.classList.remove('playing');
  deployScreen.removeAttribute('aria-hidden');
});

$('#soundToggle').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#soundText').textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
  $('#soundIcon').textContent = state.sound ? '◖' : '◗';
  syncDroneFlightSound();
  if (!state.sound) explosionSound.pause();
  if (state.sound) beep(500, .07);
});

$('#viewToggle').addEventListener('click', (event) => {
  state.cameraMode = state.cameraMode === 'first' ? 'third' : 'first';
  $('#viewText').textContent = state.cameraMode === 'first' ? '1ST PERSON' : '3RD PERSON';
  $('#viewIcon').textContent = state.cameraMode === 'first' ? '◉' : '◎';
  event.currentTarget.blur();
});

const graphicsPanel = $('#graphicsPanel');
const graphicsStatus = $('#graphicsStatus');
const graphicsButtons = [...document.querySelectorAll('.graphics-choice')];
async function detectGraphicsSupport() {
  const webgpuAvailable = Boolean(navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null));
  const probe = document.createElement('canvas');
  const webglAvailable = Boolean(probe.getContext('webgl2'));
  graphicsButtons.filter((button) => button.dataset.backend).forEach((button) => {
    const supported = button.dataset.backend === 'webgpu' ? webgpuAvailable : webglAvailable;
    button.disabled = !supported;
    if (!supported) button.title = 'This engine is not available in your browser.';
  });
  if (!webgpuAvailable && !webglAvailable) graphicsStatus.textContent = 'No supported graphics engine was detected.';
  else if (!webgpuAvailable && graphics.backend === 'webgpu') await applyGraphics({ backend: 'webgl' });
}
function syncGraphicsChoices() {
  graphicsButtons.forEach((button) => {
    const selected = button.dataset.backend ? button.dataset.backend === graphics.backend : button.dataset.quality === graphics.quality;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
async function applyGraphics(change) {
  const previous = { ...graphics };
  Object.assign(graphics, change);
  graphicsStatus.textContent = 'Applying graphics settings…';
  try {
    const next = await createRenderer();
    const old = renderer;
    mount.replaceChild(next.domElement, old.domElement);
    renderer = next;
    old.dispose();
    localStorage.setItem('skyhunter-graphics', JSON.stringify(graphics));
    graphicsStatus.textContent = `${graphics.backend.toUpperCase()} · ${graphics.quality.toUpperCase()} QUALITY`;
    syncGraphicsChoices();
  } catch (error) {
    Object.assign(graphics, previous);
    graphicsStatus.textContent = `Could not start ${change.backend?.toUpperCase() || 'the selected'} renderer.`;
    syncGraphicsChoices();
    console.warn('Graphics setting could not be applied:', error);
  }
}
$('#settingsToggle').addEventListener('click', () => {
  graphicsPanel.hidden = !graphicsPanel.hidden;
  $('#settingsToggle').setAttribute('aria-expanded', String(!graphicsPanel.hidden));
  if (!graphicsPanel.hidden) syncGraphicsChoices();
});
$('#settingsClose').addEventListener('click', () => {
  graphicsPanel.hidden = true;
  $('#settingsToggle').setAttribute('aria-expanded', 'false');
});
graphicsButtons.forEach((button) => button.addEventListener('click', () => {
  if (button.disabled) return;
  void applyGraphics(button.dataset.backend ? { backend: button.dataset.backend } : { quality: button.dataset.quality });
}));
void detectGraphicsSupport();

const gameplay = createGameplay({ THREE, scene, camera, state, targets, drone, dronePos, velocity, forward, selectedProfile, material, beep, explosionTexture, explosionSound, scoreEl, threatEl, toast, message, crosshair, ammoCount, groundY });
const { liveTargets, targetPoint, droneLocalToWorld, acquireTarget, updateWeapons, updateParticles, checkDroneImpact, updateDroneRespawn } = gameplay;

function onKey(event, down) {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  down ? keys.add(key) : keys.delete(key);
}
window.addEventListener('keydown', (event) => onKey(event, true));
window.addEventListener('keyup', (event) => onKey(event, false));
window.addEventListener('blur', () => { keys.clear(); state.firing = false; });
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio * qualityScales[graphics.quality], 2));
});

const clock = new THREE.Clock();
let elapsed = 0;

const { updateFlight, updateTargets } = createFlightController({ THREE, keys, drone, dronePos, velocity, selectedProfile, camera, rotors, targets, liveTargets, groundY, state });

activateMission('outpost');

function updateTargetHud() {
  const target = acquireTarget();
  if (!target) { targetReadout.classList.add('hidden'); return; }
  const projected = targetPoint(target).project(camera);
  const x = (projected.x * .5 + .5) * innerWidth;
  const y = (-projected.y * .5 + .5) * innerHeight;
  targetReadout.style.left = `${THREE.MathUtils.clamp(x + 22, 12, innerWidth - 190)}px`;
  targetReadout.style.top = `${THREE.MathUtils.clamp(y - 12, 90, innerHeight - 100)}px`;
  targetName.textContent = target.userData.label;
  targetDistance.textContent = `${Math.round(dronePos.distanceTo(targetPoint(target)) * 2.2)} M`;
  targetReadout.classList.remove('hidden');
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  elapsed += dt;
  flightEffects.update(dt, elapsed);
  if (state.started && !state.gameOver && !state.respawning) updateFlight(dt);
  else if (!state.started) {
    drone.position.y = dronePos.y + Math.sin(elapsed * 1.4) * .16;
    drone.rotation.y = Math.sin(elapsed * .24) * .12;
    for (const rotor of rotors) rotor.rotation.y += dt * 34;
    camera.position.x = Math.sin(elapsed * .1) * 1.2;
    camera.lookAt(0, 4, -15);
  }
  updateTargets(dt, elapsed);
  if (state.mission === 'relay' && state.resourceHealth <= 0 && !state.gameOver) {
    state.gameOver = true;
    state.firing = false;
    $('#messageTitle').textContent = 'RELAY LOST';
    $('#messageDetail').textContent = 'HOSTILE DRONES DESTROYED THE RESOURCE';
    message.classList.add('visible');
  }
  updateDroneRespawn();
  checkDroneImpact();
  syncDroneFlightSound();
  batterySystem.update(dt);
  updateWeapons(dt);
  updateParticles(dt);
  if (state.started) {
    updateTargetHud();
    if (performance.now() - state.toastAt > 1250) toast.classList.remove('show');
    if (state.mission === 'relay') {
      $('#resourceHealthBar').style.width = `${state.resourceHealth}%`;
      $('#resourceHealthText').textContent = `${Math.ceil(state.resourceHealth)}%`;
    }
    speedEl.textContent = String(Math.round(velocity.length() * 3.6)).padStart(2, '0');
    const heightAgl = Math.max(0, dronePos.y - groundY);
    heightEl.textContent = `${heightAgl.toFixed(1)} M`;
    altitudeGauge.setAttribute('aria-valuenow', heightAgl.toFixed(1));
    altitudeFill.style.height = `${THREE.MathUtils.clamp(heightAgl / selectedProfile().altitude, 0, 1) * 100}%`;
    altitudeGauge.classList.toggle('near-ground', heightAgl <= 3);
    const seconds = Math.floor((performance.now() - state.startTime) / 1000);
    timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  renderer.render(scene, camera);
}

updateLoadout();
animate();
