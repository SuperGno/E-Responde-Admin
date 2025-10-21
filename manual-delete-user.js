// Manual script to delete Firebase Authentication users
// Run this script when you need to completely remove a user from Firebase Auth
// Usage: node manual-delete-user.js <email>

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You need to set up service account credentials
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'your-database-url-here'
});

async function deleteUserByEmail(email) {
  try {
    console.log(`Looking for user with email: ${email}`);
    
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${userRecord.uid}`);
    
    // Delete the user
    await admin.auth().deleteUser(userRecord.uid);
    console.log(`Successfully deleted user: ${email} (${userRecord.uid})`);
    
    return { success: true, uid: userRecord.uid };
    
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`User with email ${email} not found in Firebase Auth`);
      return { success: false, error: 'User not found' };
    } else {
      console.error(`Error deleting user ${email}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// If running this script directly
if (require.main === module) {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Usage: node manual-delete-user.js <email>');
    process.exit(1);
  }
  
  deleteUserByEmail(email)
    .then(result => {
      console.log('Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Script error:', error);
      process.exit(1);
    });
}

module.exports = { deleteUserByEmail };
