# Firebase Cleanup Guide for User Signup Issue

## 🚨 Problem
User deleted from Firebase but still getting "Police account not found" error when trying to sign up.

## 🔍 Root Cause
Residual data in Firebase Realtime Database or Firebase Authentication.

## 🛠️ Solution Steps

### Step 1: Check Firebase Authentication
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `e-responde`
3. Go to **Authentication** > **Users**
4. Search for the user's email address
5. If found, **DELETE** the user account
6. Click **Delete user** and confirm

### Step 2: Check Firebase Realtime Database
1. Go to **Realtime Database** in Firebase Console
2. Navigate to `civilian/civilian account`
3. Look for any entries with the user's email
4. If found, **DELETE** those entries
5. Navigate to `police/police account`
6. Look for any entries with the user's email
7. If found, **DELETE** those entries

### Step 3: Check for Phone Number Mappings
1. In Realtime Database, go to `phone_mappings`
2. Look for any entries with the user's phone number
3. If found, **DELETE** those entries

### Step 4: Check Emergency Contacts
1. In Realtime Database, go to `emergency_contacts`
2. Look for any entries with the user's UID or email
3. If found, **DELETE** those entries

### Step 5: Check VoIP Data
1. In Realtime Database, go to `voip_calls`
2. Look for any calls associated with the user
3. If found, **DELETE** those entries

## 🧪 Testing
After cleanup:
1. Ask the user to try signing up again
2. If still getting errors, check the mobile app logs
3. The error might be coming from the mobile app's validation logic

## 🔧 Alternative Solution
If the issue persists, the mobile app might have cached data. Ask the user to:
1. Clear app data/cache
2. Uninstall and reinstall the app
3. Try signing up again

## 📱 Mobile App Fix
The error "Police account not found" is coming from the mobile app, not the admin dashboard. The mobile app is likely checking for police account validation during signup. You may need to:

1. Check the mobile app's signup logic
2. Remove or modify the police account validation
3. Allow civilian users to sign up without police account checks

## 🚀 Quick Fix
If you need an immediate solution:
1. Create a new police account for the user in the admin dashboard
2. Then delete it immediately
3. This should clear any validation issues
4. The user can then sign up as a civilian

## 📞 Support
If the issue persists, check:
- Firebase Console logs
- Mobile app console logs
- Network requests in browser dev tools
- Firebase Authentication logs
