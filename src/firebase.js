// Firebase initialization for Vite + React app
// Usage:
//   import { db, auth, app } from './firebase'
//   import { collection, getDocs } from 'firebase/firestore'
//   const snap = await getDocs(collection(db, 'your-collection'))

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Your actual Firebase configuration
const fallbackConfig = {
  apiKey: "AIzaSyCT7NToZVd_Su3fbLqegTX6vhO-QLWMfug",
  authDomain: "e-responde.firebaseapp.com",
  databaseURL: "https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e-responde",
  storageBucket: "e-responde.firebasestorage.app",
  messagingSenderId: "343953743058",
  appId: "1:343953743058:web:489c46e1439e7e9fe7e10b",
  measurementId: "G-MDLC7VPELW"
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || fallbackConfig.databaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
}

// Log configuration for debugging
console.log('Firebase configuration:', {
  apiKey: firebaseConfig.apiKey ? 'Set' : 'Missing',
  authDomain: firebaseConfig.authDomain ? 'Set' : 'Missing',
  databaseURL: firebaseConfig.databaseURL ? 'Set' : 'Missing',
  projectId: firebaseConfig.projectId ? 'Set' : 'Missing',
  storageBucket: firebaseConfig.storageBucket ? 'Set' : 'Missing',
  messagingSenderId: firebaseConfig.messagingSenderId ? 'Set' : 'Missing',
  appId: firebaseConfig.appId ? 'Set' : 'Missing',
})

// Initialize Firebase only once in the app lifecycle
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Services
const auth = getAuth(app)
const db = getFirestore(app)
const realtimeDb = getDatabase(app)
const functions = getFunctions(app)
const storage = getStorage(app)

// Export ICE servers for WebRTC (support NAT traversal with TURN)
// Configure via Vite env or fallback to public STUN only
const defaultIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
]

const customTurn = (import.meta.env.VITE_TURN_URL && import.meta.env.VITE_TURN_USERNAME && import.meta.env.VITE_TURN_CREDENTIAL)
  ? [{
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    }]
  : []

const iceServers = [...defaultIceServers, ...customTurn]

export { app, auth, db, realtimeDb, functions, storage, iceServers }
