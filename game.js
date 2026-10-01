/**
 * game.js
 * Motor principal do jogo Duck Hunt 3D em Three.js
 * Gerencia o loop de animação, física, 3D Raycasting, Cão Bob, Munição, Sintetizador Web Audio
 * e integração com o Placar de Líderes do Firebase.
 */

import * as THREE from 'three';
import { 
  saveHighScore, 
  subscribeTop10Scores, 
  renderLeaderboardUI 
} from './leaderboard.js';

// Variáveis Principais da Cena 3D
let scene, camera, renderer, clock;
let shotgunGroup, muzzleFlash;
let raycaster;

// Cão Bob (Dog State Machine & Animações)
let dogGroup, dogState = 'IDLE', dogTargetPos = null, retrievedDuckData = null;
let legFrontLeft, legFrontRight, legBackLeft, legBackRight, tailMesh, mouthJoint;
let dogRunSpeed = 8; // Velocidades Padrão x Super Velocidade

const mousePos = new THREE.Vector2(0, 0);

// Estado do Jogo
let score = 0;
let ammo = 4;
const maxAmmo = 4;
let timeLeft = 60;
let gameActive = false;
let timerInterval = null;

const ducks = [];
const particles = [];

// Configuração dos Patos
const DUCK_TYPES = {
  COMMON: {
    id: 'COMMON', name: 'Comum', score: 10, speedMult: 1.0,
    bodyColor: 0x6d4c41, headColor: 0x008751, beakColor: 0xffa000,
    scale: 1.0, chance: 0.60
  },
  FAST: {
    id: 'FAST', name: 'Veloz', score: 25, speedMult: 1.8,
    bodyColor: 0x1e88e5, headColor: 0x00bcd4, beakColor: 0xff5722,
    scale: 0.85, chance: 0.30
  },
  GOLDEN: {
    id: 'GOLDEN', name: 'Dourado', score: 50, speedMult: 2.4,
    bodyColor: 0xffd700, headColor: 0xffb300, beakColor: 0xff6f00,
    scale: 0.75, metallic: true, chance: 0.10
  },
  SUPER_GOLDEN: {
    id: 'SUPER_GOLDEN', name: 'Super Dourado', score: 100, speedMult: 2.8,
    bodyColor: 0xff007f, headColor: 0xffd700, beakColor: 0x00ffff,
    scale: 0.8, metallic: true, chance: 0.25 // Habilitado com score >= 700
  }
};

// Sintetizador Web Audio API Procedural
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const now = audioCtx.currentTime;

  if (type === 'shotgun') {
    const bufferSize = audioCtx.sampleRate * 0.3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.3);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
  } else if (type === 'reload') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(300, now + 0.05);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'quack') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.linearRampToValueAtTime(280, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'bark') {
    for (let b = 0; b < 2; b++) {
      const delay = b * 0.15;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, now + delay);
      osc.frequency.exponentialRampToValueAtTime(100, now + delay + 0.12);
      gain.gain.setValueAtTime(0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.12);
    }
  } else if (type === 'powerup') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'speedup') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.5);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

// Inicialização da Aplicação
function init() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x78c7f7);
  scene.fog = new THREE.FogExp2(0x78c7f7, 0.015);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.7, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  setupLights();
  setupEnvironment();
  createShotgun();
  createHuntingDog();
  setupLeaderboardSubscription();
  setupEventListeners();
}

function setupLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfffaed, 1.4);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);
}

function setupEnvironment() {
  // Terreno
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Lagoa 3D
  const pondGeo = new THREE.CircleGeometry(25, 32);
  const pondMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.1, metalness: 0.8 });
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(0, 0.05, -35);
  scene.add(pond);

  // Árvores procedurais
  for (let i = 0; i < 22; i++) {
    createTree((Math.random() - 0.5) * 85, (Math.random() - 0.5) * 45 - 30);
  }
}

function createTree(x, z) {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  group.add(trunk);

  const leavesGeo = new THREE.ConeGeometry(3, 7, 6);
  const leavesMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const leaves = new THREE.Mesh(leavesGeo, leavesMat);
  leaves.position.y = 5.5;
  leaves.castShadow = true;
  group.add(leaves);

  group.position.set(x, 0, z);
  scene.add(group);
}

function createShotgun() {
  shotgunGroup = new THREE.Group();

  const stockGeo = new THREE.BoxGeometry(0.12, 0.18, 0.6);
  const stockMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
  const stock = new THREE.Mesh(stockGeo, stockMat);
  stock.position.set(0, -0.05, 0);

  const barrelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.85, 12);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.3 });

  const barrelLeft = new THREE.Mesh(barrelGeo, barrelMat);
  barrelLeft.rotation.x = Math.PI / 2;
  barrelLeft.position.set(-0.03, 0.04, -0.5);

  const barrelRight = new THREE.Mesh(barrelGeo, barrelMat);
  barrelRight.rotation.x = Math.PI / 2;
  barrelRight.position.set(0.03, 0.04, -0.5);

  const flashGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0 });
  muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.set(0, 0.04, -0.95);

  shotgunGroup.add(stock, barrelLeft, barrelRight, muzzleFlash);
  shotgunGroup.position.set(0.25, -0.3, -0.6);
  camera.add(shotgunGroup);
  scene.add(camera);
}

function createHuntingDog() {
  dogGroup = new THREE.Group();

  const furMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.6 });
  const patchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 1.4);
  const body = new THREE.Mesh(bodyGeo, furMat);
  body.position.y = 0.7;
  body.castShadow = true;
  dogGroup.add(body);

  const headGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
  const head = new THREE.Mesh(headGeo, furMat);
  head.position.set(0, 1.2, 0.7);
  head.castShadow = true;
  dogGroup.add(head);

  const snoutGeo = new THREE.BoxGeometry(0.35, 0.3, 0.4);
  const snout = new THREE.Mesh(snoutGeo, patchMat);
  snout.position.set(0, 1.1, 1.0);
  dogGroup.add(snout);

  const noseGeo = new THREE.BoxGeometry(0.15, 0.12, 0.1);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 1.2, 1.22);
  dogGroup.add(nose);

  mouthJoint = new THREE.Group();
  mouthJoint.position.set(0, 1.05, 1.2);
  dogGroup.add(mouthJoint);

  const earGeo = new THREE.BoxGeometry(0.15, 0.4, 0.25);
  const earLeft = new THREE.Mesh(earGeo, furMat);
  earLeft.position.set(-0.35, 1.1, 0.65);
  const earRight = new THREE.Mesh(earGeo, furMat);
  earRight.position.set(0.35, 1.1, 0.65);
  dogGroup.add(earLeft, earRight);

  const tailGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.5);
  tailMesh = new THREE.Mesh(tailGeo, furMat);
  tailMesh.position.set(0, 0.9, -0.7);
  tailMesh.rotation.x = -Math.PI / 4;
  dogGroup.add(tailMesh);

  const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
  legFrontLeft = new THREE.Mesh(legGeo, furMat);
  legFrontLeft.position.set(-0.3, 0.3, 0.5);

  legFrontRight = new THREE.Mesh(legGeo, furMat);
  legFrontRight.position.set(0.3, 0.3, 0.5);

  legBackLeft = new THREE.Mesh(legGeo, furMat);
  legBackLeft.position.set(-0.3, 0.3, -0.5);

  legBackRight = new THREE.Mesh(legGeo, furMat);
  legBackRight.position.set(0.3, 0.3, -0.5);

  dogGroup.add(legFrontLeft, legFrontRight, legBackLeft, legBackRight);

  dogGroup.position.set(0, 0, -12);
  scene.add(dogGroup);
}

function createDuck() {
  const rand = Math.random();
  let typeConfig = DUCK_TYPES.COMMON;

  // SPAWN DO SUPER PATO DOURADO APÓS 700 PONTOS
  if (score >= 700 && rand < DUCK_TYPES.SUPER_GOLDEN.chance) {
    typeConfig = DUCK_TYPES.SUPER_GOLDEN;
  } else if (rand > 1 - DUCK_TYPES.GOLDEN.chance) {
    typeConfig = DUCK_TYPES.GOLDEN;
  } else if (rand > 1 - DUCK_TYPES.GOLDEN.chance - DUCK_TYPES.FAST.chance) {
    typeConfig = DUCK_TYPES.FAST;
  }

  const duck = new THREE.Group();

  const matProps = typeConfig.metallic 
    ? { roughness: 0.1, metalness: 0.9 }
    : { roughness: 0.5, metalness: 0.1 };

  const bodyMat = new THREE.MeshStandardMaterial({ color: typeConfig.bodyColor, ...matProps });
  const headMat = new THREE.MeshStandardMaterial({ color: typeConfig.headColor, ...matProps });
  const beakMat = new THREE.MeshStandardMaterial({ color: typeConfig.beakColor });

  const bodyGeo = new THREE.SphereGeometry(0.6, 12, 12);
  bodyGeo.scale(1, 0.8, 1.4);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  duck.add(body);

  const headGeo = new THREE.SphereGeometry(0.35, 12, 12);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.5, 0.6);
  head.castShadow = true;
  duck.add(head);

  const beakGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.45, 0.9);
  duck.add(beak);

  const wingGeo = new THREE.BoxGeometry(0.8, 0.08, 0.5);
  const wingLeft = new THREE.Mesh(wingGeo, bodyMat);
  wingLeft.position.set(-0.6, 0.1, 0);
  wingLeft.name = "wingLeft";

  const wingRight = new THREE.Mesh(wingGeo, bodyMat);
  wingRight.position.set(0.6, 0.1, 0);
  wingRight.name = "wingRight";

  duck.add(wingLeft, wingRight);
  duck.scale.setScalar(typeConfig.scale);

  const startX = (Math.random() - 0.5) * 40;
  duck.position.set(startX, 1, -20 - Math.random() * 15);

  const baseSpeed = typeConfig.speedMult;
  const duckData = {
    mesh: duck,
    config: typeConfig,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 8 * baseSpeed,
      (3 + Math.random() * 4) * baseSpeed,
      (Math.random() - 0.5) * 4 * baseSpeed
    ),
    isHit: false,
    timeAlive: 0
  };

  ducks.push(duckData);
  scene.add(duck);
  playSound('quack');
}

function shoot(clientX, clientY) {
  if (!gameActive || ammo <= 0) return;

  ammo--;
  updateAmmoUI();
  playSound('shotgun');

  muzzleFlash.material.opacity = 1.0;
  shotgunGroup.position.z += 0.15;
  shotgunGroup.rotation.x += 0.2;

  setTimeout(() => { muzzleFlash.material.opacity = 0; }, 50);

  if (typeof clientX === 'number' && typeof clientY === 'number') {
    mousePos.x = (clientX / window.innerWidth) * 2 - 1;
    mousePos.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  raycaster.setFromCamera(mousePos, camera);
  const duckMeshes = ducks.map(d => d.mesh);
  const intersects = raycaster.intersectObjects(duckMeshes, true);

  if (intersects.length > 0) {
    let hitObject = intersects[0].object;
    while (hitObject.parent && !ducks.some(d => d.mesh === hitObject)) {
      hitObject = hitObject.parent;
    }

    const duckData = ducks.find(d => d.mesh === hitObject);
    if (duckData && !duckData.isHit) {
      duckData.isHit = true;
      duckData.velocity.set(0, -12, 0);
      
      score += duckData.config.score;
      document.getElementById('score-val').innerText = score;
      
      createFeatherExplosion(intersects[0].point, duckData.config.bodyColor);
    }
  }
}

function reload() {
  if (ammo === maxAmmo || !gameActive) return;
  ammo = maxAmmo;
  updateAmmoUI();
  playSound('reload');

  shotgunGroup.rotation.z = -0.4;
  setTimeout(() => { shotgunGroup.rotation.z = 0; }, 300);
}

function createFeatherExplosion(pos, colorHex) {
  for (let i = 0; i < 18; i++) {
    const geo = new THREE.PlaneGeometry(0.15, 0.15);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(pos);

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      Math.random() * 5,
      (Math.random() - 0.5) * 6
    );

    particles.push({ mesh: p, vel: vel, life: 1.0 });
    scene.add(p);
  }
}

function triggerNotice(text, color = '#ffd700') {
  const notice = document.getElementById('powerup-notice');
  if (notice) {
    notice.innerText = text;
    notice.style.color = color;
    notice.style.textShadow = `0 0 15px ${color}, 0 4px 10px rgba(0,0,0,0.9)`;
    notice.style.opacity = '1';
    notice.style.transform = 'translate(-50%, -80%)';
    setTimeout(() => {
      notice.style.opacity = '0';
      notice.style.transform = 'translate(-50%, -50%)';
    }, 1400);
  }
}

function triggerTimeBonus(seconds) {
  timeLeft += seconds;
  document.getElementById('timer-val').innerText = timeLeft + 's';
  playSound('powerup');
  triggerNotice(`+${seconds}s BÔNUS DOURADO! 🌟🐕`);
}

function triggerBobSpeedBoost() {
  dogRunSpeed = 16; // Super velocidade do Bob
  playSound('speedup');
  triggerNotice(`⚡ SUPER VELOCIDADE DO BOB AUMENTADA! 🐕💨`, '#ff007f');
}

function updateAmmoUI() {
  const box = document.getElementById('ammo-box');
  if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < maxAmmo; i++) {
    const shell = document.createElement('div');
    shell.className = 'shell' + (i >= ammo ? ' spent' : '');
    box.appendChild(shell);
  }
}

function triggerDogFetch(duckData) {
  if (dogState !== 'IDLE') return;
  dogTargetPos = duckData.mesh.position.clone();
  dogTargetPos.y = 0;
  retrievedDuckData = duckData;
  dogState = 'RUNNING';
}

function updateDogBehavior(delta, time) {
  if (!dogGroup) return;

  if (dogState === 'RUNNING') {
    const dir = dogTargetPos.clone().sub(dogGroup.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist > 0.5) {
      dir.normalize();
      dogGroup.position.addScaledVector(dir, delta * dogRunSpeed);
      dogGroup.lookAt(dogTargetPos.x, 0, dogTargetPos.z);

      const legAnimSpeed = dogRunSpeed * 2.5;
      legFrontLeft.rotation.x = Math.sin(time * legAnimSpeed) * 0.6;
      legFrontRight.rotation.x = -Math.sin(time * legAnimSpeed) * 0.6;
      legBackLeft.rotation.x = -Math.sin(time * legAnimSpeed) * 0.6;
      legBackRight.rotation.x = Math.sin(time * legAnimSpeed) * 0.6;
      tailMesh.rotation.z = Math.sin(time * (legAnimSpeed + 5)) * 0.4;
    } else {
      dogState = 'CELEBRATING';
      playSound('bark');

      if (retrievedDuckData) {
        if (retrievedDuckData.config.id === 'SUPER_GOLDEN') {
          triggerBobSpeedBoost();
        } else if (retrievedDuckData.config.id === 'GOLDEN') {
          triggerTimeBonus(5);
        }
      }

      if (retrievedDuckData && retrievedDuckData.mesh) {
        const duckMesh = retrievedDuckData.mesh;
        scene.remove(duckMesh);
        mouthJoint.add(duckMesh);
        duckMesh.position.set(0, 0, 0);
        duckMesh.rotation.set(0, 0, Math.PI / 2);
      }

      setTimeout(() => {
        dogState = 'RETURNING';
      }, 1500);
    }
  } else if (dogState === 'CELEBRATING') {
    dogGroup.position.y = Math.abs(Math.sin(time * 10)) * 0.3;
    tailMesh.rotation.z = Math.sin(time * 30) * 0.6;
  } else if (dogState === 'RETURNING') {
    const startPos = new THREE.Vector3(0, 0, -12);
    const dir = startPos.clone().sub(dogGroup.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist > 0.5) {
      dir.normalize();
      dogGroup.position.addScaledVector(dir, delta * (dogRunSpeed * 0.8));
      dogGroup.lookAt(startPos.x, 0, startPos.z);

      const legAnimSpeed = dogRunSpeed * 2;
      legFrontLeft.rotation.x = Math.sin(time * legAnimSpeed) * 0.5;
      legFrontRight.rotation.x = -Math.sin(time * legAnimSpeed) * 0.5;
      legBackLeft.rotation.x = -Math.sin(time * legAnimSpeed) * 0.5;
      legBackRight.rotation.x = Math.sin(time * legAnimSpeed) * 0.5;
    } else {
      dogState = 'IDLE';
      dogGroup.position.y = 0;
      if (retrievedDuckData && retrievedDuckData.mesh) {
        mouthJoint.remove(retrievedDuckData.mesh);
        retrievedDuckData = null;
      }
    }
  } else {
    tailMesh.rotation.z = Math.sin(time * 5) * 0.2;
    legFrontLeft.rotation.x = 0;
    legFrontRight.rotation.x = 0;
    legBackLeft.rotation.x = 0;
    legBackRight.rotation.x = 0;
  }
}

// Configuração dos Event Listeners (Teclado, Mouse & Touch)
function setupEventListeners() {
  window.addEventListener('resize', onWindowResize);

  // Controles de Mira (Mouse / Touch)
  document.addEventListener('mousemove', (e) => {
    if (!gameActive) return;
    updatePointerPosition(e.clientX, e.clientY);
  });

  document.addEventListener('mousedown', (e) => {
    if (!gameActive) return;
    // Evita disparar se clicar nos botões do modal ou HUD
    if (e.target.closest('#screen-overlay') || e.target.closest('#touch-controls')) return;
    shoot(e.clientX, e.clientY);
  });

  // Suporte a Telas Sensíveis ao Toque (Mobile)
  document.addEventListener('touchstart', (e) => {
    if (!gameActive) return;
    if (e.target.closest('#screen-overlay') || e.target.closest('#touch-controls')) return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      updatePointerPosition(touch.clientX, touch.clientY);
      shoot(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!gameActive || e.touches.length === 0) return;
    const touch = e.touches[0];
    updatePointerPosition(touch.clientX, touch.clientY);
  }, { passive: true });

  // Botões Virtuais Touch
  const fireBtn = document.getElementById('touch-fire-btn');
  if (fireBtn) {
    fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameActive) shoot();
    });
  }

  const reloadBtn = document.getElementById('touch-reload-btn');
  if (reloadBtn) {
    reloadBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameActive) reload();
    });
  }

  // Teclado
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') reload();
  });

  // Botão Inicial
  document.getElementById('start-btn').addEventListener('click', onStartButtonClick);
}

function updatePointerPosition(clientX, clientY) {
  mousePos.x = (clientX / window.innerWidth) * 2 - 1;
  mousePos.y = -(clientY / window.innerHeight) * 2 + 1;

  const crosshair = document.getElementById('crosshair');
  if (crosshair) {
    crosshair.style.left = clientX + 'px';
    crosshair.style.top = clientY + 'px';
  }

  camera.rotation.y = -mousePos.x * 1.3;
  camera.rotation.x = mousePos.y * 1.3;
}

// Configura o Placar em Tempo Real via Firebase (Top 10)
function setupLeaderboardSubscription() {
  const container = document.getElementById('leaderboard-container');
  subscribeTop10Scores((scores) => {
    renderLeaderboardUI(scores, container);
  });
}

function startGame() {
  score = 0;
  ammo = 4;
  timeLeft = 60;
  dogRunSpeed = 8;
  gameActive = true;

  // Limpa patos e partículas residuais da partida anterior
  for (const d of ducks) {
    if (d.mesh) scene.remove(d.mesh);
  }
  ducks.length = 0;

  for (const p of particles) {
    if (p.mesh) scene.remove(p.mesh);
  }
  particles.length = 0;

  // Reseta estado do Cão Bob
  dogState = 'IDLE';
  if (dogGroup) dogGroup.position.set(0, 0, -12);

  document.getElementById('score-val').innerText = '0';
  document.getElementById('timer-val').innerText = '60s';
  document.getElementById('screen-overlay').style.display = 'none';
  document.getElementById('name-input-group').style.display = 'none';
  updateAmmoUI();

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timer-val').innerText = timeLeft + 's';

    if (timeLeft % 2 === 0 && ducks.length < 5) {
      createDuck();
    }

    if (timeLeft <= 0) endGame();
  }, 1000);

  createDuck();
}

async function onStartButtonClick() {
  const nameGroup = document.getElementById('name-input-group');
  if (nameGroup && nameGroup.style.display === 'flex') {
    // Se o formulário de nome estava visível (Game Over), salva o recorde primeiro
    const input = document.getElementById('player-name-input');
    const name = input ? input.value : 'PATO';
    await saveHighScore(name, score);
  }

  startGame();
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  document.getElementById('title-text').innerText = 'FIM DA CAÇADA!';
  document.getElementById('desc-text').innerHTML = `Sua Pontuação Total: <b style="color: #ffeb3b; font-size: 20px;">${score} PONTOS</b>`;
  
  // Exibe o input para registrar iniciais
  const nameGroup = document.getElementById('name-input-group');
  if (nameGroup) nameGroup.style.display = 'flex';

  document.getElementById('start-btn').innerText = 'SALVAR RECORDES & JOGAR NOVAMENTE';
  document.getElementById('screen-overlay').style.display = 'flex';
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Loop Principal do Jogo 3D
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  shotgunGroup.position.z = THREE.MathUtils.lerp(shotgunGroup.position.z, -0.6, 0.1);
  shotgunGroup.rotation.x = THREE.MathUtils.lerp(shotgunGroup.rotation.x, 0, 0.1);

  updateDogBehavior(delta, time);

  // Atualização dos Patos
  for (let i = ducks.length - 1; i >= 0; i--) {
    const d = ducks[i];
    d.mesh.position.addScaledVector(d.velocity, delta);
    d.timeAlive += delta;

    if (!d.isHit) {
      const wingL = d.mesh.getObjectByName('wingLeft');
      const wingR = d.mesh.getObjectByName('wingRight');
      const flapSpeed = 15 * d.config.speedMult;
      if (wingL && wingR) {
        wingL.rotation.z = Math.sin(d.timeAlive * flapSpeed) * 0.5;
        wingR.rotation.z = -Math.sin(d.timeAlive * flapSpeed) * 0.5;
      }
    } else if (d.mesh.position.y <= 0.2 && d.mesh.position.y > -2) {
      d.mesh.position.y = 0;
      d.velocity.set(0, 0, 0);
      triggerDogFetch(d);
      ducks.splice(i, 1);
    }

    if (d.mesh.position.y > 45 || Math.abs(d.mesh.position.x) > 55) {
      scene.remove(d.mesh);
      ducks.splice(i, 1);
    }
  }

  // Partículas
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.addScaledVector(p.vel, delta);
    p.life -= delta * 1.5;
    p.mesh.scale.setScalar(p.life);

    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

// Inicializa a cena quando a página carrega
window.addEventListener('DOMContentLoaded', () => {
  init();
  animate();
});
