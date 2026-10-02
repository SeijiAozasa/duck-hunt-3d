/**
 * game.js
 * Engine principal do Arcade Shooter 3D em Three.js
 * Sistema de Ciclo Dia & Noite (Inicia no Modo Diurno; Alterna para Noturno com Lanterna a cada 10 Ondas: Onda 10, 20, 30...),
 * HUD Customizada (Botões da direita deslocados 100px para cima/esquerda, Reload -50px mais para baixo),
 * Radar Mini-mapa 2D, Contador FPS, Gatilho Secundário, Joystick Analógico Virtual 360°,
 * Barra de Vida, Waves, Web Audio API e Firebase Leaderboard.
 */

import * as THREE from 'three';
import { 
  saveHighScore, 
  subscribeTop10Scores, 
  renderLeaderboardUI 
} from './leaderboard.js';

// ==========================================================================
// ESTADO GLOBAL E VARIÁVEIS DE JOGO
// ==========================================================================

let scene, camera, renderer, clock;
let shotgunGroup, muzzleFlash;
let raycaster;

// Iluminação e Ciclo Dia / Noite
let ambientLight, dirLight, flashlightSpotlight;
let isNightMode = false;
const targetBgColor = new THREE.Color(0x78c7f7);
const targetFogColor = new THREE.Color(0x78c7f7);
let targetAmbientIntensity = 0.75;
let targetDirIntensity = 1.4;
let targetSpotlightIntensity = 0.0;

// Cão Bob (Dog State Machine & Animações)
let dogGroup, dogState = 'IDLE', dogTargetPos = null, retrievedDuckData = null;
let legFrontLeft, legFrontRight, legBackLeft, legBackRight, tailMesh, mouthJoint;
let dogRunSpeed = 8;

// Posição da Mira e Vetor de Movimento Analógico 360°
const crosshairPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const mousePos = new THREE.Vector2(0, 0);

// Vetor do Joystick Analógico Virtual 360° [-1.0, 1.0]
const joystickVector = { x: 0, y: 0 };
let joystickTouchId = null;

// FPS Counter
let frameCount = 0;
let lastFpsTime = performance.now();

// Estado de Controles PC
let controlMode = 'PC'; // 'PC' ou 'MOBILE'
const keyState = {
  up: false, down: false, left: false, right: false,
  w: false, a: false, s: false, d: false
};

// Estado da Partida e Vida
let score = 0;
let playerHealth = 100;
const maxHealth = 100;
let ammo = 4;
const maxAmmo = 4;
let timeLeft = 60;
let gameActive = false;
let isPaused = false;
let timerInterval = null;

// Sistema de Ondas (Waves)
let currentWave = 1;
let ducksInWaveTotal = 5;
let ducksSpawnedInWave = 0;
let ducksKilledInWave = 0;
let waveSpeedMultiplier = 1.0;

const ducks = [];
const particles = [];

// Configuração dos Inimigos (Patos)
const DUCK_TYPES = {
  COMMON: {
    id: 'COMMON', name: 'Comum', score: 10, speedMult: 1.0, damage: 10,
    bodyColor: 0x6d4c41, headColor: 0x008751, beakColor: 0xffa000,
    scale: 1.0, chance: 0.60
  },
  FAST: {
    id: 'FAST', name: 'Veloz', score: 25, speedMult: 1.8, damage: 15,
    bodyColor: 0x1e88e5, headColor: 0x00bcd4, beakColor: 0xff5722,
    scale: 0.85, chance: 0.30
  },
  GOLDEN: {
    id: 'GOLDEN', name: 'Dourado', score: 50, speedMult: 2.4, damage: 20,
    bodyColor: 0xffd700, headColor: 0xffb300, beakColor: 0xff6f00,
    scale: 0.75, metallic: true, chance: 0.10
  },
  SUPER_GOLDEN: {
    id: 'SUPER_GOLDEN', name: 'Super Dourado', score: 100, speedMult: 2.8, damage: 25,
    bodyColor: 0xff007f, headColor: 0xffd700, beakColor: 0x00ffff,
    scale: 0.8, metallic: true, chance: 0.25
  }
};

// ==========================================================================
// SINTETIZADOR WEB AUDIO API PROCEDURAL (RETRO SOUND FX)
// ==========================================================================

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
  } else if (type === 'damage') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
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
  }
}

// ==========================================================================
// INICIALIZAÇÃO DA CENA THREE.JS
// ==========================================================================

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
  setupPlatformSelectionUI();
  setupVirtualAnalogJoystick();
}

function setupLights() {
  ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xfffaed, 1.4);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  // Lanterna Noturna (Spotlight acoplado à câmera para o Modo Noturno)
  flashlightSpotlight = new THREE.SpotLight(0xffffff, 0);
  flashlightSpotlight.angle = Math.PI / 6;
  flashlightSpotlight.penumbra = 0.4;
  flashlightSpotlight.decay = 2;
  flashlightSpotlight.distance = 70;
  flashlightSpotlight.position.set(0, 0, 0);
  flashlightSpotlight.target.position.set(0, 0, -10);
  camera.add(flashlightSpotlight);
  camera.add(flashlightSpotlight.target);
}

function setupEnvironment() {
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x1e3a1e });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pondGeo = new THREE.CircleGeometry(25, 32);
  const pondMat = new THREE.MeshStandardMaterial({ color: 0x1a5276, roughness: 0.1, metalness: 0.8 });
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(0, 0.05, -35);
  scene.add(pond);

  for (let i = 0; i < 22; i++) {
    createTree((Math.random() - 0.5) * 85, (Math.random() - 0.5) * 45 - 30);
  }
}

function createTree(x, z) {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2c11 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  group.add(trunk);

  const leavesGeo = new THREE.ConeGeometry(3, 7, 6);
  const leavesMat = new THREE.MeshLambertMaterial({ color: 0x1b5e20 });
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

// ==========================================================================
// CICLO DIA E NOITE (TRANSITION ENGINE A CADA 10 ONDAS)
// ==========================================================================

function updateEnvironmentCycle(waveNum) {
  // A cada 10 ondas (Onda 10, Onda 20, Onda 30...) ativa o Modo Noturno
  isNightMode = (waveNum % 10 === 0);

  const cyclePill = document.getElementById('cycle-pill');

  if (isNightMode) {
    targetBgColor.setHex(0x050814);
    targetFogColor.setHex(0x050814);
    targetAmbientIntensity = 0.15;
    targetDirIntensity = 0.3;
    targetSpotlightIntensity = 4.5;

    if (cyclePill) {
      cyclePill.innerText = `🌙 NOITE (Onda ${waveNum})`;
      cyclePill.classList.add('night-mode');
    }

    triggerNotice(`🌙 MODO NOTURNO ATIVADO! USE A LANTERNA DA ESPINGARDA! 🔦`, '#a855f7');
  } else {
    targetBgColor.setHex(0x78c7f7);
    targetFogColor.setHex(0x78c7f7);
    targetAmbientIntensity = 0.75;
    targetDirIntensity = 1.4;
    targetSpotlightIntensity = 0.0;

    if (cyclePill) {
      cyclePill.innerText = `☀️ DIA`;
      cyclePill.classList.remove('night-mode');
    }
  }
}

function processEnvironmentTransition(delta) {
  if (!scene || !ambientLight || !dirLight) return;

  const lerpSpeed = 2.0 * delta;

  scene.background.lerp(targetBgColor, lerpSpeed);
  scene.fog.color.lerp(targetFogColor, lerpSpeed);

  ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, targetAmbientIntensity, lerpSpeed);
  dirLight.intensity = THREE.MathUtils.lerp(dirLight.intensity, targetDirIntensity, lerpSpeed);

  if (flashlightSpotlight) {
    flashlightSpotlight.intensity = THREE.MathUtils.lerp(flashlightSpotlight.intensity, targetSpotlightIntensity, lerpSpeed);
  }
}

// ==========================================================================
// RADAR MINI-MAPA 2D & FPS COUNTER
// ==========================================================================

function renderMinimap() {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const center = w / 2;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = isNightMode ? 'rgba(5, 8, 20, 0.95)' : 'rgba(0, 20, 40, 0.85)';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = isNightMode ? 'rgba(168, 85, 247, 0.4)' : 'rgba(0, 210, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(center, center, center * 0.7, 0, Math.PI * 2);
  ctx.arc(center, center, center * 0.4, 0, Math.PI * 2);
  ctx.moveTo(center, 0); ctx.lineTo(center, h);
  ctx.moveTo(0, center); ctx.lineTo(w, center);
  ctx.stroke();

  // Caçador
  ctx.fillStyle = '#2ecc71';
  ctx.shadowColor = '#2ecc71';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(center, center, 4, 0, Math.PI * 2);
  ctx.fill();

  // Cão Bob
  if (dogGroup) {
    const mapScale = 1.8;
    const dx = center + (dogGroup.position.x * mapScale);
    const dz = center + (dogGroup.position.z * mapScale);

    if (dx >= 0 && dx <= w && dz >= 0 && dz <= h) {
      ctx.fillStyle = '#00d2ff';
      ctx.shadowColor = '#00d2ff';
      ctx.beginPath();
      ctx.arc(dx, dz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Inimigos / Patos Flying
  ctx.fillStyle = '#e74c3c';
  ctx.shadowColor = '#e74c3c';
  const mapScale = 1.8;
  for (const d of ducks) {
    if (!d.isHit && d.mesh) {
      const ex = center + (d.mesh.position.x * mapScale);
      const ez = center + (d.mesh.position.z * mapScale);

      if (ex >= 0 && ex <= w && ez >= 0 && ez <= h) {
        ctx.beginPath();
        ctx.arc(ex, ez, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.shadowBlur = 0;
}

function updateFpsCounter() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 500) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    const fpsPill = document.getElementById('fps-counter');
    if (fpsPill) fpsPill.innerText = `${fps} FPS`;
    frameCount = 0;
    lastFpsTime = now;
  }
}

// ==========================================================================
// MATEMÁTICA DO JOYSTICK ANALÓGICO VIRTUAL 360° (TOUCH ANALOG ENGINE)
// ==========================================================================

function setupVirtualAnalogJoystick() {
  const joystickBase = document.getElementById('joystick-base');
  const joystickKnob = document.getElementById('joystick-knob');
  if (!joystickBase || !joystickKnob) return;

  const maxRadius = 45;

  const getJoystickCenter = () => {
    const rect = joystickBase.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  };

  const handleTouchStart = (e) => {
    if (joystickTouchId !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    updateJoystickPosition(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId) {
        updateJoystickPosition(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        joystickTouchId = null;
        joystickVector.x = 0;
        joystickVector.y = 0;
        joystickKnob.style.transform = `translate(0px, 0px)`;
        break;
      }
    }
  };

  const updateJoystickPosition = (clientX, clientY) => {
    const center = getJoystickCenter();
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const clampedRadius = Math.min(distance, maxRadius);
    const knobX = Math.cos(angle) * clampedRadius;
    const knobY = Math.sin(angle) * clampedRadius;

    joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    joystickVector.x = (clampedRadius / maxRadius) * Math.cos(angle);
    joystickVector.y = (clampedRadius / maxRadius) * Math.sin(angle);
  };

  joystickBase.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchcancel', handleTouchEnd);
}

// ==========================================================================
// SELEÇÃO DE PLATAFORMA (PC / CELULAR LANDSCAPE)
// ==========================================================================

function setupPlatformSelectionUI() {
  const btnPC = document.getElementById('btn-mode-pc');
  const btnMobile = document.getElementById('btn-mode-mobile');
  const startBtn = document.getElementById('start-btn');
  const touchControls = document.getElementById('touch-controls');

  if (btnPC) {
    btnPC.addEventListener('click', () => {
      controlMode = 'PC';
      btnPC.classList.add('active');
      if (btnMobile) btnMobile.classList.remove('active');
      if (touchControls) touchControls.style.display = 'none';
      if (startBtn) {
        startBtn.style.display = 'inline-block';
        startBtn.innerText = '💻 INICIAR MODO COMPUTADOR';
      }
    });
  }

  if (btnMobile) {
    btnMobile.addEventListener('click', () => {
      controlMode = 'MOBILE';
      btnMobile.classList.add('active');
      if (btnPC) btnPC.classList.remove('active');
      if (touchControls) touchControls.style.display = 'flex';
      if (startBtn) {
        startBtn.style.display = 'inline-block';
        startBtn.innerText = '📱 INICIAR MODO CELULAR (LANDSCAPE)';
      }
    });
  }

  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}

// ==========================================================================
// SISTEMA DE ONDAS (WAVES) E INIMIGOS
// ==========================================================================

function startWave(waveNum) {
  currentWave = waveNum;
  ducksInWaveTotal = 4 + waveNum * 2;
  ducksSpawnedInWave = 0;
  ducksKilledInWave = 0;
  waveSpeedMultiplier = 1.0 + (waveNum - 1) * 0.2;

  const waveVal = document.getElementById('wave-val');
  if (waveVal) waveVal.innerText = currentWave;

  // Atualiza Ciclo Dia / Noite para a nova onda
  updateEnvironmentCycle(currentWave);

  playSound('wave');
  if (!isNightMode) {
    triggerNotice(`🌊 ONDA ${currentWave} INICIADA!`, '#00d2ff');
  }

  setTimeout(() => {
    if (gameActive && !isPaused) createDuck();
  }, 1000);
}

function createDuck() {
  if (!gameActive || isPaused || ducksSpawnedInWave >= ducksInWaveTotal) return;

  const rand = Math.random();
  let typeConfig = DUCK_TYPES.COMMON;

  if (score >= 600 && rand < DUCK_TYPES.SUPER_GOLDEN.chance) {
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

  const baseSpeed = typeConfig.speedMult * waveSpeedMultiplier;
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
  ducksSpawnedInWave++;
  scene.add(duck);
  playSound('quack');
}

// ==========================================================================
// TIRO, RECARGA E COLISÃO (RAYCASTING)
// ==========================================================================

function shoot(targetX, targetY) {
  if (!gameActive || isPaused || ammo <= 0) return;

  ammo--;
  updateAmmoUI();
  playSound('shotgun');

  muzzleFlash.material.opacity = 1.0;
  shotgunGroup.position.z += 0.15;
  shotgunGroup.rotation.x += 0.2;

  setTimeout(() => { muzzleFlash.material.opacity = 0; }, 50);

  let px = crosshairPos.x;
  let py = crosshairPos.y;

  if (typeof targetX === 'number' && typeof targetY === 'number') {
    px = targetX;
    py = targetY;
    crosshairPos.x = px;
    crosshairPos.y = py;
    updateCrosshairDOM();
  }

  mousePos.x = (px / window.innerWidth) * 2 - 1;
  mousePos.y = -(py / window.innerHeight) * 2 + 1;

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
      
      score += duckData.config.score * currentWave;
      ducksKilledInWave++;
      document.getElementById('score-val').innerText = score;
      
      createFeatherExplosion(intersects[0].point, duckData.config.bodyColor);
    }
  }
}

function reload() {
  if (ammo === maxAmmo || !gameActive || isPaused) return;
  ammo = maxAmmo;
  updateAmmoUI();
  playSound('reload');

  shotgunGroup.rotation.z = -0.4;
  setTimeout(() => { shotgunGroup.rotation.z = 0; }, 300);
}

function applyPlayerDamage(amount) {
  if (!gameActive || isPaused) return;
  playerHealth = Math.max(0, playerHealth - amount);
  updateHealthUI();
  playSound('damage');

  if (playerHealth <= 0) {
    endGame();
  }
}

function updateHealthUI() {
  const healthFill = document.getElementById('health-fill');
  if (healthFill) {
    const pct = Math.max(0, Math.min(100, (playerHealth / maxHealth) * 100));
    healthFill.style.width = pct + '%';

    if (pct < 30) {
      healthFill.style.background = 'linear-gradient(to right, #e74c3c, #c0392b)';
    } else if (pct < 60) {
      healthFill.style.background = 'linear-gradient(to right, #f39c12, #e67e22)';
    } else {
      healthFill.style.background = 'linear-gradient(to right, #2ecc71, #27ae60)';
    }
  }
}

function updateAmmoUI() {
  const box = document.getElementById('ammo-box');
  const ammoText = document.getElementById('ammo-text');
  if (ammoText) ammoText.innerText = `${ammo} / ${maxAmmo}`;
  if (!box) return;

  box.innerHTML = '';
  for (let i = 0; i < maxAmmo; i++) {
    const shell = document.createElement('div');
    shell.className = 'shell' + (i >= ammo ? ' spent' : '');
    box.appendChild(shell);
  }
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
    }, 1600);
  }
}

function triggerTimeBonus(seconds) {
  timeLeft += seconds;
  document.getElementById('timer-val').innerText = timeLeft + 's';
  playSound('powerup');
  triggerNotice(`+${seconds}s BÔNUS DOURADO! 🌟🐕`);
}

function triggerBobSpeedBoost() {
  dogRunSpeed = 16;
  playSound('powerup');
  triggerNotice(`⚡ SUPER VELOCIDADE DO BOB AUMENTADA! 🐕💨`, '#ff007f');
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
      }, 1400);
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

// ==========================================================================
// PROCESSAMENTO DE MOVIMENTO ANALÓGICO 360°
// ==========================================================================

function updateCrosshairDOM() {
  const crosshair = document.getElementById('crosshair');
  if (crosshair) {
    crosshair.style.left = crosshairPos.x + 'px';
    crosshair.style.top = crosshairPos.y + 'px';
  }

  mousePos.x = (crosshairPos.x / window.innerWidth) * 2 - 1;
  mousePos.y = -(crosshairPos.y / window.innerHeight) * 2 + 1;

  camera.rotation.y = -mousePos.x * 1.3;
  camera.rotation.x = mousePos.y * 1.3;
}

function processInputMovement(delta) {
  if (!gameActive || isPaused) return;

  const moveSpeed = 650 * delta;
  let moveX = 0;
  let moveY = 0;

  if (Math.abs(joystickVector.x) > 0.05 || Math.abs(joystickVector.y) > 0.05) {
    moveX = joystickVector.x * moveSpeed;
    moveY = joystickVector.y * moveSpeed;
  } else {
    if (keyState.w || keyState.up) moveY -= moveSpeed;
    if (keyState.s || keyState.down) moveY += moveSpeed;
    if (keyState.a || keyState.left) moveX -= moveSpeed;
    if (keyState.d || keyState.right) moveX += moveSpeed;
  }

  if (moveX !== 0 || moveY !== 0) {
    crosshairPos.x = Math.max(20, Math.min(window.innerWidth - 20, crosshairPos.x + moveX));
    crosshairPos.y = Math.max(20, Math.min(window.innerHeight - 20, crosshairPos.y + moveY));
    updateCrosshairDOM();
  }
}

function setupEventListeners() {
  window.addEventListener('resize', onWindowResize);

  document.addEventListener('mousemove', (e) => {
    if (!gameActive || isPaused) return;
    crosshairPos.x = e.clientX;
    crosshairPos.y = e.clientY;
    updateCrosshairDOM();
  });

  document.addEventListener('mousedown', (e) => {
    if (!gameActive || isPaused) return;
    if (e.target.closest('#screen-overlay') || e.target.closest('#pause-overlay') || e.target.closest('#touch-controls') || e.target.closest('#pause-btn') || e.target.closest('#top-left-fire-btn')) return;
    shoot(e.clientX, e.clientY);
  });

  document.addEventListener('touchstart', (e) => {
    if (!gameActive || isPaused) return;
    if (e.target.closest('#screen-overlay') || e.target.closest('#pause-overlay') || e.target.closest('#touch-controls') || e.target.closest('#pause-btn') || e.target.closest('#top-left-fire-btn')) return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      shoot(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  // Botões de Tiro Touch (Principal & Secundário Top-Left)
  const bindFireButton = (btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const handleFire = (e) => {
      e.preventDefault();
      if (gameActive && !isPaused) shoot();
    };
    btn.addEventListener('touchstart', handleFire, { passive: false });
    btn.addEventListener('click', handleFire);
  };

  bindFireButton('touch-fire-btn');
  bindFireButton('top-left-fire-btn');

  // Botão de Recarga Touch
  const reloadBtn = document.getElementById('touch-reload-btn');
  if (reloadBtn) {
    const handleReload = (e) => {
      e.preventDefault();
      if (gameActive && !isPaused) reload();
    };
    reloadBtn.addEventListener('touchstart', handleReload, { passive: false });
    reloadBtn.addEventListener('click', handleReload);
  }

  // Teclado PC
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keyState.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keyState.down = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keyState.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keyState.right = true;

    if (e.code === 'KeyR') reload();
    if (e.code === 'Space') {
      e.preventDefault();
      shoot();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keyState.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keyState.down = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keyState.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keyState.right = false;
  });

  // Pausa
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => {
    hidePauseModal();
    startGame();
  });

  const changeModeBtn = document.getElementById('change-mode-btn');
  if (changeModeBtn) changeModeBtn.addEventListener('click', () => {
    hidePauseModal();
    endGame(true);
  });

  document.getElementById('start-btn').addEventListener('click', onStartButtonClick);
}

function togglePause() {
  if (!gameActive) return;
  isPaused = !isPaused;

  const pauseModal = document.getElementById('pause-overlay');
  if (pauseModal) {
    pauseModal.style.display = isPaused ? 'flex' : 'none';
  }
}

function hidePauseModal() {
  isPaused = false;
  const pauseModal = document.getElementById('pause-overlay');
  if (pauseModal) pauseModal.style.display = 'none';
}

function setupLeaderboardSubscription() {
  const container = document.getElementById('leaderboard-container');
  subscribeTop10Scores((scores) => {
    renderLeaderboardUI(scores, container);
  });
}

function startGame() {
  score = 0;
  playerHealth = maxHealth;
  ammo = 4;
  timeLeft = 60;
  dogRunSpeed = 8;
  gameActive = true;
  isPaused = false;

  for (const d of ducks) {
    if (d.mesh) scene.remove(d.mesh);
  }
  ducks.length = 0;

  for (const p of particles) {
    if (p.mesh) scene.remove(p.mesh);
  }
  particles.length = 0;

  dogState = 'IDLE';
  if (dogGroup) dogGroup.position.set(0, 0, -12);

  document.getElementById('score-val').innerText = '0';
  document.getElementById('timer-val').innerText = '60s';
  document.getElementById('screen-overlay').style.display = 'none';
  document.getElementById('name-input-group').style.display = 'none';
  hidePauseModal();
  updateAmmoUI();
  updateHealthUI();

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameActive || isPaused) return;

    timeLeft--;
    document.getElementById('timer-val').innerText = timeLeft + 's';

    if (ducksSpawnedInWave < ducksInWaveTotal && ducks.length < 4) {
      createDuck();
    }

    if (ducksSpawnedInWave >= ducksInWaveTotal && ducks.length === 0) {
      startWave(currentWave + 1);
    }

    if (timeLeft <= 0) endGame();
  }, 1000);

  startWave(1);
}

async function onStartButtonClick() {
  const nameGroup = document.getElementById('name-input-group');
  if (nameGroup && nameGroup.style.display === 'flex') {
    const input = document.getElementById('player-name-input');
    const name = input ? input.value : 'PATO';
    await saveHighScore(name, score);
  }

  startGame();
}

function endGame(returnToMenu = false) {
  gameActive = false;
  isPaused = false;
  clearInterval(timerInterval);

  const titleEl = document.getElementById('title-text');
  const descEl = document.getElementById('desc-text');
  const nameGroup = document.getElementById('name-input-group');
  const startBtn = document.getElementById('start-btn');
  const overlay = document.getElementById('screen-overlay');

  if (returnToMenu) {
    if (titleEl) titleEl.innerText = 'ARCADE SHOOTER 3D';
    if (descEl) descEl.innerHTML = 'Escolha a plataforma para continuar jogando!';
    if (nameGroup) nameGroup.style.display = 'none';
    if (startBtn) startBtn.style.display = 'none';
  } else {
    if (titleEl) titleEl.innerText = playerHealth <= 0 ? 'VOCÊ FOI DERROTADO!' : 'FIM DA CAÇADA!';
    if (descEl) descEl.innerHTML = `Pontuação Final: <b style="color: #ffeb3b; font-size: 20px;">${score} PONTOS</b> | Onda Alcançada: <b style="color: #00d2ff; font-size: 20px;">${currentWave}</b>`;
    if (nameGroup) nameGroup.style.display = 'flex';
    if (startBtn) {
      startBtn.style.display = 'inline-block';
      startBtn.innerText = 'SALVAR RECORDES & JOGAR NOVAMENTE';
    }
  }

  if (overlay) overlay.style.display = 'flex';
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================================================
// LOOP PRINCIPAL DE ANIMAÇÃO (60 FPS)
// ==========================================================================

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  if (gameActive && !isPaused) {
    processInputMovement(delta);
    processEnvironmentTransition(delta);
    updateFpsCounter();
    renderMinimap();

    shotgunGroup.position.z = THREE.MathUtils.lerp(shotgunGroup.position.z, -0.6, 0.1);
    shotgunGroup.rotation.x = THREE.MathUtils.lerp(shotgunGroup.rotation.x, 0, 0.1);

    updateDogBehavior(delta, time);

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

        if (d.mesh.position.z > 5) {
          applyPlayerDamage(d.config.damage);
          scene.remove(d.mesh);
          ducks.splice(i, 1);
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
  }

  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
  init();
  animate();
});
