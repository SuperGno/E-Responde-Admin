# Firebase Setup Guide

## Fix the Database Region Warning

The warning you're seeing is because your Firebase database URL is pointing to the wrong region. Here's how to fix it:

### Step 1: Create .env File

Create a new file called `.env` in your project root (same level as `package.json`) with the following content:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=e-responde.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=e-responde
VITE_FIREBASE_STORAGE_BUCKET=e-responde.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

### Step 2: Get Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **e-responde**
3. Click the gear icon → **Project Settings**
4. Scroll down to **"Your apps"** section
5. Click on the web app icon `</>`
6. Copy the config values and replace the placeholders in your `.env` file

### Step 3: Important - Use Correct Database URL

Make sure your `.env` file has this exact database URL:
```
VITE_FIREBASE_DATABASE_URL=https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app
```

**NOT** the old URL:
```
VITE_FIREBASE_DATABASE_URL=https://e-responde-default-rtdb.firebaseio.com
```

### Step 4: Restart Development Server

After creating the `.env` file:

1. **Stop** your current development server (Ctrl+C)
2. **Restart** it: `npm run dev`
3. The warning should disappear

### Step 5: Test Your App

1. Open `http://localhost:5174/`
2. Try creating an admin account
3. Test the login functionality
4. Check browser console for any remaining errors

## Why This Happens

Firebase databases can be hosted in different regions for better performance. Your database is in the `asia-southeast1` region, but the app was trying to connect to the global endpoint, which causes the warning.

## Troubleshooting

If you still see the warning:
1. Double-check your `.env` file has the correct database URL
2. Make sure you restarted the development server
3. Clear your browser cache
4. Check that the `.env` file is in the correct location (project root)

The app should work fine even with the warning, but fixing it will improve performance and remove the console warning.

