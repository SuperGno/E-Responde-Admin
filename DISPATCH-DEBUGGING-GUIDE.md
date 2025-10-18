# Dispatch Error Debugging Guide

## Common Issues and Solutions

### 1. Firebase Permission Errors
**Error:** `PERMISSION_DENIED`
**Solution:** Check Firebase Realtime Database security rules

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
      "notifications": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### 2. Network/Connection Issues
**Error:** `UNAVAILABLE` or `NETWORK_ERROR`
**Solutions:**
- Check internet connection
- Verify Firebase project is active
- Check Firebase console for service status

### 3. Invalid Data Structure
**Error:** `INVALID_DATA` or similar
**Solutions:**
- Ensure police units are properly loaded
- Check that report data is valid
- Verify all required fields are present

### 4. Missing Police Units
**Error:** "Selected police unit not found"
**Solutions:**
- Check if police accounts exist in Firebase
- Verify police data structure
- Ensure police accounts are active

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser developer tools (F12)
2. Go to Console tab
3. Try to dispatch a report
4. Look for error messages and logs

### Step 2: Verify Firebase Connection
1. Check if Firebase is properly initialized
2. Look for connection test logs in console
3. Verify Firebase configuration

### Step 3: Check Data Structure
1. Open Firebase Console
2. Navigate to Realtime Database
3. Check if data exists in expected locations:
   - `civilian/civilian crime reports`
   - `police/police account`

### Step 4: Test with Simple Data
Try dispatching with minimal data to isolate the issue.

## Console Logs to Look For

### Successful Dispatch Logs:
```
Starting dispatch process...
Report reference created: https://...
Selected police unit found: {...}
Updating crime report with: {...}
Crime report updated successfully
Creating notification for police officer: {...}
Police notification created successfully
Creating general notification: {...}
General notification created successfully
Dispatch completed successfully: {...}
```

### Error Logs:
```
Error dispatching report: [Error object]
Error details: {
  message: "...",
  code: "...",
  stack: "..."
}
```

## Quick Fixes

### 1. Refresh the Page
Sometimes a simple refresh resolves temporary issues.

### 2. Check Firebase Rules
Ensure your Firebase security rules allow read/write access.

### 3. Verify Environment Variables
Check that all Firebase environment variables are set correctly.

### 4. Clear Browser Cache
Clear browser cache and cookies, then try again.

## Testing the Fix

After implementing fixes:

1. Open browser console
2. Try to dispatch a report
3. Check for success logs
4. Verify data appears in Firebase Console
5. Check that notifications are created

## Contact Support

If issues persist:
1. Collect console logs
2. Note the exact error message
3. Check Firebase Console for any service issues
4. Verify your Firebase project configuration
