// Server-side script to delete Firebase Authentication users
// This script requires Firebase Admin SDK and should be run on a server
// with proper authentication credentials

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You need to set up service account credentials
const serviceAccount = require('./path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'your-database-url-here'
});

/**
 * Delete a Firebase Authentication user by UID
 * @param {string} uid - The Firebase Auth UID to delete
 */
async function deleteFirebaseAuthUser(uid) {
  try {
    console.log(`Attempting to delete Firebase Auth user: ${uid}`);
    
    // Delete the user from Firebase Authentication
    await admin.auth().deleteUser(uid);
    
    console.log(`Successfully deleted Firebase Auth user: ${uid}`);
    return { success: true, message: 'User deleted successfully' };
    
  } catch (error) {
    console.error(`Error deleting Firebase Auth user ${uid}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete police account deletion including Firebase Auth
 * @param {string} uid - The Firebase Auth UID
 * @param {string} email - The email address (for logging)
 */
async function completePoliceAccountDeletion(uid, email) {
  try {
    console.log(`Starting complete deletion for police account: ${email} (${uid})`);
    
    // Step 1: Delete from Firebase Authentication
    const authResult = await deleteFirebaseAuthUser(uid);
    
    if (!authResult.success) {
      console.warn('Failed to delete Firebase Auth user, but continuing with database cleanup');
    }
    
    // Step 2: Delete from Realtime Database
    const db = admin.database();
    
    // Delete police account data
    await db.ref(`police/police account/${uid}`).remove();
    console.log('Deleted police account data');
    
    // Delete police location data
    await db.ref(`police/police location/${uid}`).remove();
    console.log('Deleted police location data');
    
    // Delete police notifications
    await db.ref(`police/notifications/${uid}`).remove();
    console.log('Deleted police notifications');
    
    // Delete emergency contacts
    await db.ref(`emergency_contacts/${uid}`).remove();
    console.log('Deleted emergency contacts');
    
    console.log(`Complete deletion successful for police account: ${email}`);
    return { success: true, message: 'Complete deletion successful' };
    
  } catch (error) {
    console.error(`Error in complete police account deletion:`, error);
    return { success: false, error: error.message };
  }
}

// Export functions for use in other scripts
module.exports = {
  deleteFirebaseAuthUser,
  completePoliceAccountDeletion
};

// If running this script directly
if (require.main === module) {
  const uid = process.argv[2];
  const email = process.argv[3];
  
  if (!uid) {
    console.error('Usage: node delete-user-server.js <uid> [email]');
    process.exit(1);
  }
  
  completePoliceAccountDeletion(uid, email || 'unknown')
    .then(result => {
      console.log('Deletion result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Script error:', error);
      process.exit(1);
    });
}
