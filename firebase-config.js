/**
 * firebase-config.js
 * Configuração e inicialização do Firebase JavaScript SDK v10 (Cloud Firestore)
 * com suporte a exportação ES6 Modules e fallback resiliente.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Insira aqui as credenciais do seu projeto no Firebase Console (https://console.firebase.google.com/)
const firebaseConfig = {
  apiKey: "AIzaSyYOUR_API_KEY_HERE",
  authDomain: "duck-hunt-3d.firebaseapp.com",
  projectId: "duck-hunt-3d",
  storageBucket: "duck-hunt-3d.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def4567890"
};

let app = null;
let db = null;
let isFirebaseAvailable = false;

try {
  // Verifica se a API Key foi configurada antes de inicializar
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_API_KEY")) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseAvailable = true;
    console.log("🔥 Firebase v10 SDK inicializado com sucesso!");
  } else {
    console.warn("⚠️ Firebase não configurado (chave demonstrativa detectada). O placar usará modo de armazenamento local (LocalStorage).");
  }
} catch (error) {
  console.error("❌ Erro ao inicializar o Firebase:", error);
  isFirebaseAvailable = false;
}

export { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  isFirebaseAvailable 
};
