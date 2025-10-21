// Express.js server for handling Firebase user deletion
// This server should be deployed separately and secured

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
// You need to set up service account credentials
let serviceAccount;
try {
  serviceAccount = require('./service-account-key.json');
} catch (error) {
  console.error('Service account key not found. Please add service-account-key.json');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'your-database-url-here'
});

// API endpoint to delete Firebase Authentication users
app.post('/api/delete-user', async (req, res) => {
  try {
    const { uid, email, accountType } = req.body;
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'UID is required' 
      });
    }
    
    console.log(`Deleting ${accountType} user: ${email} (${uid})`);
    
    // Delete from Firebase Authentication
    try {
      await admin.auth().deleteUser(uid);
      console.log(`Successfully deleted Firebase Auth user: ${uid}`);
    } catch (authError) {
      console.error(`Error deleting Firebase Auth user:`, authError);
      // Continue with database cleanup even if auth deletion fails
    }
    
    // Delete from Realtime Database based on account type
    const db = admin.database();
    
    if (accountType === 'police') {
      // Delete police account data
      await db.ref(`police/police account/${uid}`).remove();
      await db.ref(`police/police location/${uid}`).remove();
      await db.ref(`police/notifications/${uid}`).remove();
      await db.ref(`emergency_contacts/${uid}`).remove();
    } else if (accountType === 'civilian') {
      // Delete civilian account data
      await db.ref(`civilian/civilian account/${uid}`).remove();
      await db.ref(`civilian/civilian crime reports/${uid}`).remove();
      await db.ref(`emergency_contacts/${uid}`).remove();
    } else if (accountType === 'admin') {
      // Delete admin account data
      await db.ref(`admin_dashboard_account`).remove();
    }
    
    console.log(`Complete deletion successful for ${accountType} account: ${email}`);
    
    res.json({ 
      success: true, 
      message: 'User deleted successfully',
      deletedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in delete-user API:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Deletion server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
