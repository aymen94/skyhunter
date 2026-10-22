import * as THREE from 'wamr3d/compat';
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
const renderer = new THREE.WebGPURenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
// WAMR3D 0.9.3's WebGPU shadow pass can build a bind group with an
// uninitialized GPU buffer for this scene. Keep direct lighting enabled while
// skipping that broken pass until the renderer-side buffer setup is fixed.
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
mount.appendChild(renderer.domElement);
await renderer.init();

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
const terrainMaterial = material(0x526365, .94);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), terrainMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = groundY;
ground.receiveShadow = true;
scene.add(ground);
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
for (let i = 0; i < 22; i++) {
  const peak = new THREE.Mesh(new THREE.ConeGeometry(10 + Math.random() * 12, 18 + Math.random() * 25, 5), material(0x647b83));
  peak.position.set(-130 + i * 12, 5, -190 - Math.random() * 25);
  peak.rotation.y = Math.random();
  ridgeline.add(peak);
}

const outpostTargets = createTargets(THREE, scene, groundY, material);
const harborTargets = createTargets(THREE, scene, groundY, material, 'harbor');
const highlandTargets = createTargets(THREE, scene, groundY, material, 'highlands');
const defenseMission = createDefenseMission(THREE, scene, groundY, material);
const chargingStations = createChargingStations(THREE, scene, groundY, material);
const harborEnvironment = createScenarioEnvironment(THREE, scene, groundY, material, 'harbor');
const highlandsEnvironment = createScenarioEnvironment(THREE, scene, groundY, material, 'highlands');
defenseMission.environment.visible = false;
defenseMission.enemies.forEach((enemy) => { enemy.visible = false; });
harborEnvironment.visible = false;
highlandsEnvironment.visible = false;
const targets = [];

const { drone, frameMat, edgeMat, noseMat, rotors, payloadModels } = createDrone(THREE, scene, material);

const profiles = {
  striker: { name: 'KITE', suffix: 'STRIKER', speed: 14, altitude: 24, ammo: Infinity, weapon: 'SINGLE SHOT', color: 0x1c3038, edge: 0xff4652, scale: [1, 1, 1], hint: 'SINGLE SHOT' },
  bomber: { name: 'MANTA', suffix: 'BOMBER', speed: 9.5, altitude: 21, ammo: 3, weapon: 'GRAVITY BOMBS', color: 0x34312c, edge: 0xe3b65c, scale: [1.35, 1.1, 1.25], hint: 'RELEASE BOMB' },
  fiber: { name: 'SILK', suffix: 'FPV', speed: 18, altitude: 25, ammo: 2, weapon: 'FIBER-GUIDED', color: 0x39332a, edge: 0xe8bd6b, scale: [.78, .82, 1.28], hint: 'GUIDED FPV' },
  kamikaze: { name: 'RAZOR', suffix: 'KAMIKAZE', speed: 16, altitude: 20, ammo: Infinity, weapon: 'IMPACT CHARGE', color: 0x422b2b, edge: 0xff7057, scale: [.9, .88, 1.18], hint: 'RAM TARGET' },
};

const state = {
  selected: 'striker', started: false, startTime: 0, score: 0, sound: true,
  mission: 'outpost', resourceHealth: 100, battery: 100, batteryDepleted: false, flightStopped: false, charging: false,
  gameOver: false, firing: false, shotAt: 0, shotCooldown: 210, toastAt: 0,
  bombs: [], particles: [], activeFiber: null, respawning: false, respawnAt: 0,
};
const keys = new Set();
const dronePos = new THREE.Vector3(0, 7, 14);
const velocity = new THREE.Vector3();
const forward = new THREE.Vector3(0, 0, -1);
const selectedProfile = () => profiles[state.selected];

const scoreEl = $('#score'), threatEl = $('#threatCount'), threatTotalEl = $('#threatTotal'), timerEl = $('#timer');
const speedEl = $('#speed'), batteryBar = $('#healthBar'), batteryText = $('#healthText'), batteryHint = $('#batteryHint');
const ammoCount = $('#ammoCount'), piloting = $('#piloting'), targetReadout = $('#targetReadout');
const targetName = $('#targetName'), targetDistance = $('#targetDistance'), crosshair = $('#crosshair');
const message = $('#centerMessage'), toast = $('#toast'), deployScreen = $('#deploymentScreen');

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
  ridgeline.visible = id === 'outpost';
  scene.background.setHex(mission.background);
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
  $('.mission-copy h1').innerHTML = mission.heading;
  $('.mission-copy .subtitle').innerHTML = mission.subtitle;
  $('.mission-copy .objective strong').textContent = mission.objective;
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

const batterySystem = createBatterySystem({
  state, dronePos, velocity, stations: chargingStations, keys, groundY, toast,
  batteryBar, batteryText, batteryHint, beep,
});
const flightEffects = createFlightEffects({ THREE, scene, app, dronePos, state });

function updateLoadout() {
  const profile = selectedProfile();
  frameMat.color.setHex(profile.color);
  edgeMat.color.setHex(profile.edge);
  noseMat.color.setHex(profile.color);
  drone.scale.set(...profile.scale);
  payloadModels.clear();
  if (state.selected === 'bomber') {
    for (const x of [-.55, .55]) {
      const bomb = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, .68, 8), material(0xe2b457, .45, .34));
      bomb.rotation.x = Math.PI / 2;
      bomb.position.set(x, -.27, .15);
      payloadModels.add(bomb);
    }
  } else if (state.selected === 'fiber') {
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .26, 12), material(0xe2bd71, .55, .2));
    spool.rotation.z = Math.PI / 2;
    spool.position.set(0, -.27, .3);
    payloadModels.add(spool);
  }
  piloting.innerHTML = `${profile.name} <span>${profile.suffix}</span>`;
  $('#weaponHint').textContent = profile.hint;
  $('#selectedLoadout').innerHTML = `${profile.name} ${profile.suffix} <i>—</i> ${profile.weapon}`;
  ammoCount.textContent = state.selected === 'kamikaze' ? 'RAM' : profile.ammo === Infinity ? '∞' : String(profile.ammo).padStart(2, '0');
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
  state.startTime = performance.now();
  app.classList.add('playing');
  deployScreen.setAttribute('aria-hidden', 'true');
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
  profiles.bomber.ammo = 3;
  profiles.fiber.ammo = 2;
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
  if (state.activeFiber?.cable) scene.remove(state.activeFiber.cable);
  state.activeFiber = null;
  dronePos.set(0, 7, 14);
  velocity.set(0, 0, 0);
  drone.position.copy(dronePos);
  drone.visible = true;
  drone.rotation.set(0, 0, 0);
  scoreEl.textContent = '000000';
  threatEl.textContent = String(targets.length).padStart(2, '0');
  ammoCount.textContent = state.selected === 'kamikaze' ? 'RAM' : selectedProfile().ammo === Infinity ? '∞' : String(selectedProfile().ammo).padStart(2, '0');
  timerEl.textContent = '00:00';
  message.classList.remove('visible');
  app.classList.remove('playing');
  deployScreen.removeAttribute('aria-hidden');
});

$('#soundToggle').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#soundText').textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
  $('#soundIcon').textContent = state.sound ? '◖' : '◗';
  if (state.sound) beep(500, .07);
});

const gameplay = createGameplay({ THREE, scene, state, targets, drone, dronePos, velocity, forward, selectedProfile, material, beep, scoreEl, threatEl, toast, message, crosshair, ammoCount, groundY });
const { liveTargets, targetPoint, droneLocalToWorld, acquireTarget, setFire, updateWeapons, updateParticles, checkKamikazeImpact, updateKamikazeRespawn } = gameplay;

function onKey(event, down) {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  down ? keys.add(key) : keys.delete(key);
  if (key === ' ' && down && !event.repeat) setFire(true);
  if (key === ' ' && !down) setFire(false);
}
window.addEventListener('keydown', (event) => onKey(event, true));
window.addEventListener('keyup', (event) => onKey(event, false));
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button === 0) {
    setFire(true);
  }
});
window.addEventListener('pointerup', () => setFire(false));
window.addEventListener('blur', () => { keys.clear(); state.firing = false; });
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
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
  updateKamikazeRespawn();
  checkKamikazeImpact();
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
    const seconds = Math.floor((performance.now() - state.startTime) / 1000);
    timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  renderer.render(scene, camera);
}

updateLoadout();
animate();
