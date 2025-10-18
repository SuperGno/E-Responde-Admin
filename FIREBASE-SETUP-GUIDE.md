# Firebase Setup Guide

## Current Issue
The application is showing "Firebase connection failed. Please check your configuration." This means the Firebase configuration is missing or incorrect.

## Quick Fix Options

### Option 1: Use Your Real Firebase Configuration (Recommended)

1. **Get your Firebase configuration:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project (e-responde)
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps" section
   - Click on your web app or create one if it doesn't exist
   - Copy the configuration object

2. **Create a `.env` file in your project root:**
   ```bash
   # Create .env file
   touch .env
   ```

3. **Add your Firebase configuration to `.env`:**
   ```env
   VITE_FIREBASE_API_KEY=your_actual_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Restart the development server:**
   ```bash
   npm run dev
   ```

### Option 2: Update the Fallback Configuration

If you can't create a `.env` file, update the fallback configuration in `src/firebase.js`:

1. **Open `src/firebase.js`**
2. **Replace the fallback configuration with your actual values:**
   ```javascript
   const fallbackConfig = {
     apiKey: "your_actual_api_key",
     authDomain: "your_project_id.firebaseapp.com",
     databaseURL: "https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "your_project_id",
     storageBucket: "your_project_id.appspot.com",
     messagingSenderId: "your_messaging_sender_id",
     appId: "your_app_id"
   }
   ```

### Option 3: Test with Demo Data (Temporary)

If you want to test the dispatch functionality without setting up Firebase:

1. **Comment out the Firebase connection test in `src/components/Dispatch.jsx`**
2. **Use mock data for testing**

## Firebase Security Rules

Make sure your Firebase Realtime Database has the correct security rules:

```json
{
  "rules": {
    "civilian": {
      "civilian crime reports": {
        ".read": true,
        ".write": true
      }
    },
    "police": {
      "police account": {
        ".read": true,
        ".write": true
      },
      "notifications": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Testing the Connection

After updating the configuration:

1. **Open browser console (F12)**
2. **Refresh the page**
3. **Look for these logs:**
   ```
   Firebase configuration: { apiKey: 'Set', authDomain: 'Set', ... }
   Testing Firebase connection...
   Firebase connection test successful
   ```

4. **If you see errors, check:**
   - API key is correct
   - Project ID matches your Firebase project
   - Database URL is correct
   - Security rules allow read/write access

## Common Issues

### "Invalid API Key"
- Check that your API key is correct
- Make sure there are no extra spaces or characters

### "Permission Denied"
- Check Firebase security rules
- Ensure rules allow read/write access

### "Project Not Found"
- Verify project ID is correct
- Check that the project exists in Firebase Console

### "Database URL Invalid"
- Use the correct database URL from Firebase Console
- Make sure it includes the region (asia-southeast1)

## Next Steps

Once Firebase is connected:
1. The dispatch functionality will work
2. Police notifications will be created
3. You can test the full dispatch workflow

## Need Help?

If you're still having issues:
1. Check the browser console for specific error messages
2. Verify your Firebase project is active
3. Make sure you have the correct permissions
4. Try creating a new Firebase project if needed
