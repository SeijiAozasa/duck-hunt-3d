// ==========================================================================
// AUTO-GIRO / TELA CHEIA E INÍCIO DIRETO AO SELECIONAR MODO
// ==========================================================================

function requestLandscapeOrientation() {
  // Solicita tela cheia e força orientação horizontal em dispositivos móveis compatíveis
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().then(() => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
          console.log("Bloqueio de orientação automático não suportado pelo navegador.");
        });
      }
    }).catch(() => {});
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
      requestLandscapeOrientation(); // Tenta bloquear a tela na horizontal automaticamente
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