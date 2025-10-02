# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# E-Responde-Admin

## Firebase / Firestore Setup

Use Firebase Web client SDK config, not service account credentials, in this Vite + React app.

1) Create a `.env` file in the project root with these variables (Vite reads `VITE_` prefixed vars):

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
```

Copy these from Firebase Console → Project Settings → Your apps → Web app SDK config.

2) Use the exported `db` from `src/firebase.js`:

```js
import { db } from './src/firebase'
import { collection, getDocs } from 'firebase/firestore'

async function example() {
  const snap = await getDocs(collection(db, 'your-collection'))
  console.log(snap.docs.map(d => ({ id: d.id, ...d.data() })))
}
```

Security note: Do not put service account JSON in the frontend or commit it to the repo. If a service account key has been exposed, rotate it in Google Cloud Console and remove it from the repo history.
