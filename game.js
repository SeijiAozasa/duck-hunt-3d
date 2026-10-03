// Importar as funções de pontuação e leaderboard
import { saveHighScore, subscribeTop10Scores, renderLeaderboardUI } from './leaderboard.js';

// Variáveis de estado do jogo
let score = 0;
let wave = 1;
let gameTimer = 60;
let controlMode = 'PC'; // 'PC' ou 'MOBILE'
let isGameRunning = false;
let gameInterval = null;

// ==========================================================================
// AUTO-GIRO / TELA CHEIA E INÍCIO DIRETO AO SELECIONAR MODO
// ==========================================================================

function requestLandscapeOrientation() {
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().then(() => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
          console.log("Bloqueio de orientação automático não suportado pelo navegador.");
        });
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

// ==========================================================================
// INICIALIZAÇÃO E LOOP DO JOGO
// ==========================================================================

export function startGame() {
  // 1. Ocultar o menu/overlay
  const screenOverlay = document.getElementById('screen-overlay');
  if (screenOverlay) {
    screenOverlay.style.display = 'none';
  }

  // 2. Resetar variáveis de jogo
  score = 0;
  wave = 1;
  gameTimer = 60;
  isGameRunning = true;

  // 3. Atualizar elementos no HUD
  const scoreEl = document.getElementById('score-val');
  const waveEl = document.getElementById('wave-val');
  const timerEl = document.getElementById('timer-val');

  if (scoreEl) scoreEl.textContent = score;
  if (waveEl) waveEl.textContent = wave;
  if (timerEl) timerEl.textContent = `${gameTimer}s`;

  // 4. Iniciar temporizador da partida
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

// Inicializar ouvintes ao carregar o DOM
window.addEventListener('DOMContentLoaded', () => {
  setupPlatformSelectionUI();

  // Subscrever ao leaderboard para renderizar pontuações
  const leaderboardContainer = document.getElementById('leaderboard-container');
  subscribeTop10Scores((scores) => {
    renderLeaderboardUI(scores, leaderboardContainer);
  });
});