// Quick Fix for User Signup Issue
// This script creates a temporary police account and immediately deletes it
// This helps clear any validation issues

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, remove } = require('firebase/database');
const { getAuth, createUserWithEmailAndPassword, deleteUser } = require('firebase/auth');

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
const auth = getAuth(app);

async function quickFixUserSignup(userEmail) {
  try {
    console.log(`🔧 Starting quick fix for: ${userEmail}`);
    
    // Step 1: Create a temporary police account
    const tempPassword = 'TempPass123!';
    const userCredential = await createUserWithEmailAndPassword(auth, userEmail, tempPassword);
    const user = userCredential.user;
    
    console.log(`✅ Created temporary auth user: ${user.uid}`);
    
    // Step 2: Create police account data
    const policeData = {
      firstName: 'Temp',
      lastName: 'User',
      email: userEmail,
      contactNumber: '0000000000',
      policeRank: 'Police Officer',
      authUid: user.uid,
      createdAt: new Date().toISOString(),
      createdBy: 'admin@e-responde.com',
      isActive: true,
      accountType: 'police',
      isTemporary: true
    };
    
    // Step 3: Store in Realtime Database
    const policeRef = ref(db, `police/police account/${user.uid}`);
    await set(policeRef, policeData);
    
    console.log(`✅ Created temporary police account data`);
    
    // Step 4: Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Delete the police account data
    await remove(policeRef);
    console.log(`✅ Deleted temporary police account data`);
    
    // Step 6: Delete the auth user
    await deleteUser(user);
    console.log(`✅ Deleted temporary auth user`);
    
    console.log(`\n🎉 Quick fix completed for ${userEmail}`);
    console.log(`   The user should now be able to sign up normally`);
    
  } catch (error) {
    console.error('❌ Error during quick fix:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log(`⚠️ Email ${userEmail} is already in use`);
      console.log(`   Please delete the existing account first`);
    }
  }
}

// Usage: Replace with the actual email address
const userEmail = process.argv[2] || 'user@example.com';

if (userEmail === 'user@example.com') {
  console.log('❌ Please provide the user email as an argument:');
  console.log('   node quick-fix-user-signup.js user@example.com');
  process.exit(1);
}

quickFixUserSignup(userEmail);
