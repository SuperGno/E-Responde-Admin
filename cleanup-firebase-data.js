// Firebase Data Cleanup Script
// This script helps clean up residual data from deleted users

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove } = require('firebase/database');

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCT7NToZVd_Su3fbLqegTX6vhO-QLWMfug",
  authDomain: "e-responde.firebaseapp.com",
  databaseURL: "https://e-responde-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e-responde",
  storageBucket: "e-responde.firebasestorage.app",
  messagingSenderId: "343953743058",
  appId: "1:343953743058:web:489c46e1439e7e9fe7e10b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function cleanupUserData(userEmail) {
  try {
    console.log(`🔍 Checking for residual data for email: ${userEmail}`);
    
    // Check civilian accounts
    const civilianRef = ref(db, 'civilian/civilian account');
    const civilianSnapshot = await get(civilianRef);
    
    if (civilianSnapshot.exists()) {
      const civilianData = civilianSnapshot.val();
      let foundInCivilian = false;
      
      Object.keys(civilianData).forEach(userId => {
        const userData = civilianData[userId];
        if (userData.email === userEmail) {
          console.log(`❌ Found residual civilian data for ${userEmail} with ID: ${userId}`);
          foundInCivilian = true;
        }
      });
      
      if (!foundInCivilian) {
        console.log(`✅ No residual civilian data found for ${userEmail}`);
      }
    }
    
    // Check police accounts
    const policeRef = ref(db, 'police/police account');
    const policeSnapshot = await get(policeRef);
    
    if (policeSnapshot.exists()) {
      const policeData = policeSnapshot.val();
      let foundInPolice = false;
      
      Object.keys(policeData).forEach(userId => {
        const userData = policeData[userId];
        if (userData.email === userEmail) {
          console.log(`❌ Found residual police data for ${userEmail} with ID: ${userId}`);
          console.log(`   Police data:`, userData);
          foundInPolice = true;
        }
      });
      
      if (!foundInPolice) {
        console.log(`✅ No residual police data found for ${userEmail}`);
      }
    }
    
    console.log(`\n📋 Summary for ${userEmail}:`);
    console.log(`   - Check Firebase Authentication for any remaining auth records`);
    console.log(`   - If found, delete the residual data manually`);
    console.log(`   - User should be able to sign up again after cleanup`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Usage: Replace with the actual email address
const userEmail = 'user@example.com'; // Replace with the affected user's email

cleanupUserData(userEmail);
