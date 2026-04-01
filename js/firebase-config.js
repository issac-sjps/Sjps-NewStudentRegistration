// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB_OAMj0OVvBHTZR_An2q4eMvArR1QpIVI",
  authDomain: "sjps-registrarsection.firebaseapp.com",
  projectId: "sjps-registrarsection",
  storageBucket: "sjps-registrarsection.firebasestorage.app",
  messagingSenderId: "787332003654",
  appId: "1:787332003654:web:52b95eca778cd1b5001747",
  measurementId: "G-X1DEFTZKK4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
