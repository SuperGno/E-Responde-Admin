# VoIP Call Debugging Checklist

## 🚨 **Why Mobile App Can't Receive Calls**

### **Step 1: Verify Call Creation**
1. **Open Firebase Console** → Realtime Database → `voip_calls`
2. **Make a VoIP call** from admin dashboard
3. **Check if call record appears** with proper structure:
   ```json
   {
     "callId": "-Abc123Def456",
     "caller": {
       "userId": "admin_dashboard",
       "userType": "admin",
       "name": "Admin Dashboard"
     },
     "callee": {
       "userId": "USER_FIREBASE_UID",
       "userType": "civilian",
       "name": "User Name"
     },
     "status": "ringing",
     "createdAt": "2025-01-18T...",
     "reportId": "12345",
     "reportType": "Emergency"
   }
   ```

### **Step 2: Check Mobile App Authentication**
1. **Mobile app must be authenticated** with Firebase
2. **User must be logged in** with the same Firebase UID
3. **Check mobile app console** for authentication errors

### **Step 3: Verify Mobile App Listening Path**
The mobile app should be listening to:
```javascript
// Mobile app should have this listener:
const callsRef = ref(database, 'voip_calls');
onValue(callsRef, (snapshot) => {
  snapshot.forEach((childSnapshot) => {
    const callData = childSnapshot.val();
    // Check if this call is for the current user
    if (callData.callee.userId === currentUser.uid) {
      // Show incoming call UI
      showIncomingCall(callData);
    }
  });
});
```

### **Step 4: Check User ID Matching**
1. **Get the mobile user's Firebase UID**:
   - Open Firebase Console → Authentication → Users
   - Copy the UID of the mobile user
2. **Verify in admin dashboard**:
   - The `targetUser.id` should match the mobile user's Firebase UID
   - Check browser console when making call

### **Step 5: Test with Debug Tool**
1. **Open `debug-voip-call.html`** in your browser
2. **Test Firebase connection**
3. **Check recent calls**
4. **Create a test call** with the mobile user's UID
5. **Monitor in real-time**

### **Step 6: Mobile App Debugging**
Check mobile app for:
1. **Firebase connection status**
2. **Authentication status**
3. **Console logs** when call is made
4. **Network connectivity**
5. **App permissions** (microphone, notifications)

## 🔧 **Common Issues & Solutions**

### **Issue 1: User ID Mismatch**
**Problem**: Admin dashboard using wrong user ID
**Solution**: 
```javascript
// In admin dashboard, make sure targetUser.id is correct
console.log('Target User ID:', targetUser.id);
// Should match the mobile user's Firebase UID
```

### **Issue 2: Mobile App Not Listening**
**Problem**: Mobile app not listening to correct Firebase path
**Solution**: Mobile app needs this listener:
```javascript
// Mobile app should listen to all calls and filter by user
const callsRef = ref(database, 'voip_calls');
onValue(callsRef, (snapshot) => {
  // Process all calls and filter for current user
});
```

### **Issue 3: Firebase Rules**
**Problem**: Mobile app can't read call data
**Solution**: Ensure Firebase rules allow reading:
```json
{
  "voip_calls": {
    ".read": true,
    ".write": true
  }
}
```

### **Issue 4: Mobile App Offline**
**Problem**: Mobile app not connected to Firebase
**Solution**: 
- Check internet connection
- Verify Firebase configuration
- Check authentication status

### **Issue 5: Call Filtering**
**Problem**: Mobile app filtering calls incorrectly
**Solution**: Mobile app should check:
```javascript
if (callData.callee.userId === currentUser.uid && 
    callData.status === 'ringing') {
  // Show incoming call
}
```

## 📱 **Mobile App Requirements**

The mobile app must have:

1. **Firebase Authentication** - User must be logged in
2. **Real-time Listener** - Listening to `voip_calls` path
3. **User ID Matching** - Filtering calls by `callee.userId`
4. **CallKeep Integration** - For native call UI
5. **WebRTC Support** - For audio connection
6. **Proper Permissions** - Microphone and notifications

## 🎯 **Quick Test**

1. **Use the debug tool** (`debug-voip-call.html`)
2. **Enter the mobile user's Firebase UID**
3. **Create a test call**
4. **Check if mobile app receives it**

If the test call works but admin dashboard calls don't, the issue is in the admin dashboard's `targetUser.id` value.

## 📞 **Expected Flow**

1. **Admin makes call** → Creates record in `voip_calls/{callId}`
2. **Mobile app detects** → Shows incoming call UI
3. **User accepts** → Updates call status to `answered`
4. **WebRTC connects** → Audio stream established
5. **Call ends** → Status updated to `ended`

---

**Need Help?** Check the browser console and mobile app logs for specific error messages.
