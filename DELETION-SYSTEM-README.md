# Police Account Deletion System

This system provides complete deletion of police accounts to prevent "email already registered" errors when creating new accounts with the same email.

## How It Works

### 1. Soft Delete Approach (Current Implementation)
- When deleting a police account, the system marks it as `isDeleted: true`
- Changes the email to `deleted_${timestamp}_${originalEmail}` to prevent conflicts
- Preserves audit trail while preventing login
- Filters out deleted accounts from the UI

### 2. Complete Deletion (Server-side)
For complete Firebase Authentication user deletion, you need server-side access with Firebase Admin SDK.

## Files Created

1. **`delete-user-server.js`** - Server-side script for complete deletion
2. **`server.js`** - Express.js API server for deletion endpoints
3. **`manual-delete-user.js`** - Manual script for deleting users by email
4. **`server-package.json`** - Dependencies for the deletion server

## Setup Instructions

### Option 1: Soft Delete (Recommended - No Server Required)
The current implementation uses soft delete which:
- ✅ Prevents "email already registered" errors
- ✅ Preserves audit trail
- ✅ Works entirely client-side
- ✅ No server setup required

### Option 2: Complete Deletion (Requires Server)
If you need complete Firebase Auth user deletion:

1. **Set up Firebase Admin SDK:**
   ```bash
   # Create a service account key in Firebase Console
   # Download the JSON file and save as `service-account-key.json`
   ```

2. **Install server dependencies:**
   ```bash
   npm install express cors firebase-admin
   ```

3. **Run the deletion server:**
   ```bash
   node server.js
   ```

4. **Use the manual deletion script:**
   ```bash
   node manual-delete-user.js user@example.com
   ```

## How to Use

### Soft Delete (Current System)
1. Go to Police Account Management
2. Click "Delete" on any police account
3. Confirm deletion
4. The account is marked as deleted and won't appear in the list
5. The email can now be used for new accounts

### Complete Deletion (Server Required)
1. Set up the deletion server
2. The client will automatically call the server API
3. The server will delete the Firebase Auth user completely
4. All related data is also removed

## Benefits

### Soft Delete Benefits:
- ✅ No server setup required
- ✅ Preserves audit trail
- ✅ Prevents email conflicts
- ✅ Easy to implement
- ✅ Can be undone if needed

### Complete Deletion Benefits:
- ✅ Completely removes user from Firebase Auth
- ✅ Frees up Firebase Auth quota
- ✅ No trace of the user in Firebase Auth
- ✅ More thorough cleanup

## Troubleshooting

### "Email already registered" Error
This error occurs when:
1. The Firebase Auth user still exists
2. The email is still in use in Firebase Auth

**Solutions:**
1. Use the soft delete approach (recommended)
2. Set up the server-side deletion system
3. Use the manual deletion script

### Server Setup Issues
If you can't set up a server:
- Use the soft delete approach
- The email will be changed to prevent conflicts
- The account will be marked as deleted
- New accounts can use the original email

## Security Notes

- The deletion server should be secured and only accessible by admins
- Service account keys should be kept secure
- Consider using environment variables for sensitive data
- The soft delete approach is safer as it preserves audit trails

## Testing

To test the deletion system:

1. **Create a police account** with email `test@example.com`
2. **Delete the account** using the soft delete method
3. **Try to create a new account** with the same email `test@example.com`
4. **Verify** that the new account creation succeeds

The system should now prevent "email already registered" errors while maintaining data integrity and audit trails.
