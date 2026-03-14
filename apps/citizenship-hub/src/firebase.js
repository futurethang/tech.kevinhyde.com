// src/firebase.js
// ─────────────────────────────────────────────────────────────────
// Firebase configuration — REPLACE the placeholder values below
// with your actual Firebase project credentials.
//
// To get these values:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use an existing one)
// 3. Click the gear icon → Project settings
// 4. Scroll to "Your apps" → Click "Add app" → Web (</>)
// 5. Register the app, then copy the firebaseConfig object
// 6. Paste the values below
// ─────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─────────────────────────────────────────────────────────────────
// Storage abstraction — drop-in replacement for window.storage
// Shared data → Firestore document "hub/shared"
// Personal "ME" selection → localStorage (browser-only, per user)
// ─────────────────────────────────────────────────────────────────

const SHARED_DOC = doc(db, "hub", "shared");

export async function loadShared() {
  try {
    const snap = await getDoc(SHARED_DOC);
    return snap.exists() ? snap.data().payload : null;
  } catch (e) {
    console.error("Firestore load failed:", e);
    return null;
  }
}

export async function saveShared(data) {
  try {
    await setDoc(SHARED_DOC, { payload: data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("Firestore save failed:", e);
  }
}

// Real-time listener — call this once, returns an unsubscribe function
export function onSharedChange(callback) {
  return onSnapshot(SHARED_DOC, (snap) => {
    if (snap.exists()) {
      callback(snap.data().payload);
    }
  });
}

// Personal "ME" stays in localStorage — no auth needed, per-browser
export function loadMe() {
  try {
    return localStorage.getItem("citizenship-hub-me");
  } catch {
    return null;
  }
}

export function saveMe(id) {
  try {
    if (id) localStorage.setItem("citizenship-hub-me", id);
    else localStorage.removeItem("citizenship-hub-me");
  } catch (e) {
    console.error("localStorage save failed:", e);
  }
}

export function clearMe() {
  try {
    localStorage.removeItem("citizenship-hub-me");
  } catch {}
}
