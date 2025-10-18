const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

exports.getUsers = functions.https.onCall(async (data, context) => {
  try {
    // Verify the user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get all users from Firebase Auth
    const listUsersResult = await admin.auth().listUsers();
    const users = [];

    listUsersResult.users.forEach(userRecord => {
      // Extract first name from displayName or email
      const firstName = userRecord.displayName || 
                       (userRecord.email ? userRecord.email.split('@')[0] : 'Unknown');
      
      users.push({
        id: userRecord.uid,
        firstName: firstName,
        email: userRecord.email || 'No email',
        createdAt: userRecord.metadata.creationTime,
        isSuspended: userRecord.disabled || false,
        suspendedAt: userRecord.disabled ? userRecord.metadata.lastSignInTime : null,
        suspendedBy: userRecord.disabled ? 'admin@e-responde.com' : null,
        lastSignIn: userRecord.metadata.lastSignInTime
      });
    });

    return { users };
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch users');
  }
});

exports.updateUserStatus = functions.https.onCall(async (data, context) => {
  try {
    // Verify the user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, disabled } = data;

    if (!userId || typeof disabled !== 'boolean') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters');
    }

    // Update user in Firebase Auth
    await admin.auth().updateUser(userId, {
      disabled: disabled
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating user status:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update user status');
  }
});
