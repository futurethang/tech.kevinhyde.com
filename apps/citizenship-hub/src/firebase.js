import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyB5Ja5fzD1e1atMCWxrlVfTJV-V0sC_wZg",
  authDomain: "citizenship-hub.firebaseapp.com",
  projectId: "citizenship-hub",
  storageBucket: "citizenship-hub.firebasestorage.app",
  messagingSenderId: "254076867848",
  appId: "1:254076867848:web:6a85899bff7112485788bd"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

export function initAuth() {
  return new Promise((resolve, reject) => {
    signInAnonymously(auth).catch(reject)
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user) }
    })
  })
}

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
