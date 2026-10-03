// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCd1O9w-mZLaz5J1mslvpHghyKCMUs3bcg",
  authDomain: "duck-hunt-3d.firebaseapp.com",
  projectId: "duck-hunt-3d",
  storageBucket: "duck-hunt-3d.firebasestorage.app",
  messagingSenderId: "585568046208",
  appId: "1:585568046208:web:f6493100e3d2a46d93ea65",
  measurementId: "G-50JR6JG0HR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);