import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCd1O9w-mZLaz5J1mslvpHghyKCMUs3bcg",
  authDomain: "duck-hunt-3d.firebaseapp.com",
  projectId: "duck-hunt-3d",
  storageBucket: "duck-hunt-3d.firebasestorage.app",
  messagingSenderId: "585568046208",
  appId: "1:585568046208:web:f6493100e3d2a46d93ea65",
  measurementId: "G-50JR6JG0HR"
};

let app, db, analytics;
let isFirebaseAvailable = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  analytics = getAnalytics(app);
  isFirebaseAvailable = true;
} catch (e) {
  console.warn("Firebase offline ou indisponível. Operando em modo local.", e);
  isFirebaseAvailable = false;
}

export {
  app,
  db,
  analytics,
  isFirebaseAvailable,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
};