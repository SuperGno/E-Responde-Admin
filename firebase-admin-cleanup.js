// Firebase Admin Cleanup Script
// Run this with: node firebase-admin-cleanup.js

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  // You'll need to add your service account key here
  // Download from Firebase Console > Project Settings > Service Accounts
  type: "service_account",
  project_id: "e-responde",
  // ... other service account fields
};

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

async function cleanupUserData(userEmail) {
  try {
    console.log(`🔍 Starting cleanup for email: ${userEmail}`);
    
    // Check and clean civilian accounts
    const civilianRef = db.ref('civilian/civilian account');
    const civilianSnapshot = await civilianRef.once('value');
    
    if (civilianSnapshot.exists()) {
      const civilianData = civilianSnapshot.val();
      let cleanedCivilian = false;
      
      for (const [userId, userData] of Object.entries(civilianData)) {
        if (userData.email === userEmail) {
          console.log(`🗑️ Removing civilian data for ${userEmail} (ID: ${userId})`);
          await db.ref(`civilian/civilian account/${userId}`).remove();
          cleanedCivilian = true;
        }
      }
      
      if (!cleanedCivilian) {
        console.log(`✅ No civilian data found for ${userEmail}`);
      }
    }
    
    // Check and clean police accounts
    const policeRef = db.ref('police/police account');
    const policeSnapshot = await policeRef.once('value');
    
    if (policeSnapshot.exists()) {
      const policeData = policeSnapshot.val();
      let cleanedPolice = false;
      
      for (const [userId, userData] of Object.entries(policeData)) {
        if (userData.email === userEmail) {
          console.log(`🗑️ Removing police data for ${userEmail} (ID: ${userId})`);
          await db.ref(`police/police account/${userId}`).remove();
          cleanedPolice = true;
        }
      }
      
      if (!cleanedPolice) {
        console.log(`✅ No police data found for ${userEmail}`);
      }
    }
    
    // Check Firebase Authentication
    try {
      const userRecord = await admin.auth().getUserByEmail(userEmail);
      console.log(`❌ User still exists in Firebase Auth with UID: ${userRecord.uid}`);
      console.log(`   You need to delete this user from Firebase Console > Authentication`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`✅ User not found in Firebase Auth (already deleted)`);
      } else {
        console.log(`⚠️ Error checking Firebase Auth: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Cleanup completed for ${userEmail}`);
    console.log(`   The user should now be able to sign up again`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Usage: Replace with the actual email address
const userEmail = process.argv[2] || 'user@example.com';

if (userEmail === 'user@example.com') {
  console.log('❌ Please provide the user email as an argument:');
  console.log('   node firebase-admin-cleanup.js user@example.com');
  process.exit(1);
}

cleanupUserData(userEmail);
