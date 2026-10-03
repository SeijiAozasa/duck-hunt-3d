import * as THREE from 'three';
import { saveHighScore, subscribeTop10Scores, renderLeaderboardUI } from './leaderboard.js';

// --- VARIÁVEIS DE ESTADO E GAME LOOP ---
let scene, camera, renderer;
let score = 0;
let wave = 1;
let gameTimer = 60;
let controlMode = 'PC';
let isGameRunning = false;
let gameInterval = null;

// --- INICIALIZAÇÃO DO THREE.JS ---
function initThree() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1e);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Iluminação básica
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// --- CONTROLO DE ORIENTAÇÃO E MODO ---
function requestLandscapeOrientation() {
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().then(() => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => { });
      }
    }).catch(() => { });
  }
}

function setupPlatformSelectionUI() {
  const btnPC = document.getElementById('btn-mode-pc');
  const btnMobile = document.getElementById('btn-mode-mobile');
  const touchControls = document.getElementById('touch-controls');

  if (btnPC) {
    btnPC.addEventListener('click', async () => {
      controlMode = 'PC';
      if (touchControls) touchControls.style.display = 'none';
      await onStartGameDirect();
    });
  }

  if (btnMobile) {
    btnMobile.addEventListener('click', async () => {
      controlMode = 'MOBILE';
      if (touchControls) touchControls.style.display = 'flex';
      requestLandscapeOrientation();
      await onStartGameDirect();
    });
  }

  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}

async function onStartGameDirect() {
  const nameGroup = document.getElementById('name-input-group');
  if (nameGroup && nameGroup.style.display === 'flex') {
    const input = document.getElementById('player-name-input');
    const name = input ? input.value : 'BOB';
    await saveHighScore(name, score);
  }

  startGame();
}

// --- FUNÇÃO PRINCIPAL DE INÍCIO DO JOGO ---
export function startGame() {
  const screenOverlay = document.getElementById('screen-overlay');
  if (screenOverlay) {
    screenOverlay.style.display = 'none';
  }

  score = 0;
  wave = 1;
  gameTimer = 60;
  isGameRunning = true;

  const scoreEl = document.getElementById('score-val');
  const waveEl = document.getElementById('wave-val');
  const timerEl = document.getElementById('timer-val');

  if (scoreEl) scoreEl.textContent = score;
  if (waveEl) waveEl.textContent = wave;
  if (timerEl) timerEl.textContent = `${gameTimer}s`;

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (!isGameRunning) return;

    gameTimer--;
    if (timerEl) timerEl.textContent = `${gameTimer}s`;

    if (gameTimer <= 0) {
      endGame();
    }
  }, 1000);

  console.log(`🎮 Jogo iniciado no modo: ${controlMode}`);
}

function endGame() {
  isGameRunning = false;
  if (gameInterval) clearInterval(gameInterval);

  const screenOverlay = document.getElementById('screen-overlay');
  const titleText = document.getElementById('title-text');
  const descText = document.getElementById('desc-text');
  const nameGroup = document.getElementById('name-input-group');

  if (screenOverlay) screenOverlay.style.display = 'flex';
  if (titleText) titleText.textContent = "GAME OVER";
  if (descText) descText.textContent = `Pontuação final: ${score} pontos!`;
  if (nameGroup) nameGroup.style.display = 'flex';
}

// --- CARREGAMENTO INICIAL ---
window.addEventListener('DOMContentLoaded', () => {
  initThree();
  setupPlatformSelectionUI();

  const leaderboardContainer = document.getElementById('leaderboard-container');
  subscribeTop10Scores((scores) => {
    renderLeaderboardUI(scores, leaderboardContainer);
  });
});