// Firebase initialization for Vite + React app
// Usage:
//   import { db, auth, app } from './firebase'
//   import { collection, getDocs } from 'firebase/firestore'
//   const snap = await getDocs(collection(db, 'your-collection'))

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase only once in the app lifecycle
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Services
const auth = getAuth(app)
const db = getFirestore(app)
const realtimeDb = getDatabase(app)

export { app, auth, db, realtimeDb }
