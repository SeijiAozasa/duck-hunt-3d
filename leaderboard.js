/**
 * leaderboard.js
 * Gerenciamento do Placar de Líderes Arcade (Top 10)
 * Comunicação em tempo real com o Firebase Cloud Firestore e suporte a LocalStorage Fallback.
 */

import { 
  db, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  isFirebaseAvailable 
} from './firebase-config.js';

const COLLECTION_NAME = "highscores";
const LOCAL_STORAGE_KEY = "duckhunt_arcade_leaderboard";

/**
 * Atualiza a indicação visual de conexão no DOM (Firebase Online vs Modo Local)
 */
function updateStatusIndicator(isOnline) {
  const statusEl = document.getElementById('status-indicator');
  if (!statusEl) return;

  if (isOnline) {
    statusEl.innerHTML = '● FIREBASE ONLINE';
    statusEl.style.color = '#2ecc71';
  } else {
    statusEl.innerHTML = '● MODO LOCAL';
    statusEl.style.color = '#f39c12';
  }
}

/**
 * Salva uma nova pontuação no Firebase Firestore (ou no LocalStorage se offline).
 * @param {string} name - Iniciais ou nome do jogador (ex: "SEI", "BOB", "ALX")
 * @param {number} score - Pontuação final obtida
 * @returns {Promise<boolean>}
 */
export async function saveHighScore(name, score) {
  const cleanName = (name || 'AAA').trim().toUpperCase().substring(0, 8);
  const numericScore = parseInt(score, 10) || 0;

  if (isFirebaseAvailable && db) {
    try {
      await addDoc(collection(db, COLLECTION_NAME), {
        name: cleanName,
        score: numericScore,
        createdAt: serverTimestamp()
      });
      console.log(`🏆 Recorde salvo no Firebase: ${cleanName} - ${numericScore} pts`);
      updateStatusIndicator(true);
      return true;
    } catch (error) {
      console.error("Erro ao salvar no Firebase, salvando localmente:", error);
      updateStatusIndicator(false);
    }
  }

  // Fallback LocalStorage
  saveLocalHighScore(cleanName, numericScore);
  updateStatusIndicator(false);
  return true;
}

/**
 * Escuta atualizações do Placar Top 10 em tempo real.
 * @param {Function} callback - Função chamada com o array do Top 10
 */
export function subscribeTop10Scores(callback) {
  if (isFirebaseAvailable && db) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy("score", "desc"),
        limit(10)
      );

      updateStatusIndicator(true);

      return onSnapshot(q, (snapshot) => {
        const scores = [];
        snapshot.forEach((doc) => {
          scores.push({ id: doc.id, ...doc.data() });
        });
        callback(scores);
      }, (error) => {
        console.warn("Snapshot do Firestore falhou, usando LocalStorage:", error);
        updateStatusIndicator(false);
        callback(getLocalHighScores());
      });
    } catch (err) {
      console.error("Erro ao configurar listener do Firestore:", err);
      updateStatusIndicator(false);
      callback(getLocalHighScores());
    }
  } else {
    // Utiliza LocalStorage
    updateStatusIndicator(false);
    callback(getLocalHighScores());
  }
}

/**
 * Salva um recorde no LocalStorage
 */
function saveLocalHighScore(name, score) {
  let scores = getLocalHighScores();
  scores.push({
    id: 'local_' + Date.now(),
    name: name,
    score: score,
    date: new Date().toLocaleDateString()
  });

  // Ordena do maior para o menor e pega os 10 primeiros
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 10);

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scores));
}

/**
 * Obtém os recordes salvos no LocalStorage
 */
export function getLocalHighScores() {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) {
      return [
        { name: "PATO", score: 850 },
        { name: "BOB", score: 620 },
        { name: "ACE", score: 450 },
        { name: "DUK", score: 300 }
      ];
    }
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

/**
 * Renderiza o ranking Top 10 no elemento HTML container
 * @param {Array} scoresList 
 * @param {HTMLElement} containerElement 
 */
export function renderLeaderboardUI(scoresList, containerElement) {
  if (!containerElement) return;

  if (!scoresList || scoresList.length === 0) {
    containerElement.innerHTML = `
      <div style="text-align: center; color: #888; padding: 10px;">
        Nenhum recorde registrado ainda. Seja o primeiro!
      </div>
    `;
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];

  containerElement.innerHTML = scoresList.map((item, index) => {
    const rankDisplay = medals[index] || `#${index + 1}`;
    const nameDisplay = (item.name || 'ANÔNIMO').toUpperCase();
    const scoreDisplay = (item.score || 0).toLocaleString();
    const isTop3 = index < 3 ? 'top-rank' : '';

    return `
      <div class="leaderboard-row ${isTop3}">
        <span class="rank-col">${rankDisplay}</span>
        <span class="name-col">${nameDisplay}</span>
        <span class="score-col">${scoreDisplay} pts</span>
      </div>
    `;
  }).join('');
}

