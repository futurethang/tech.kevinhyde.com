import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'

// ============================================================
// REPLACE THESE WITH YOUR FIREBASE CONFIG VALUES
// Get them from: Firebase Console → Project Settings → Your App
// ============================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const DATA_DOC = doc(db, 'appData', 'main')

export async function loadData() {
  const snap = await getDoc(DATA_DOC)
  return snap.exists() ? snap.data() : null
}

export async function saveData(data) {
  await setDoc(DATA_DOC, { ...data, updatedAt: new Date().toISOString() })
}

export function subscribeToData(callback) {
  return onSnapshot(DATA_DOC, (snap) => {
    if (snap.exists()) {
      callback(snap.data())
    }
  })
}

export { db }
