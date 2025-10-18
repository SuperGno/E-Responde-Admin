# Web Admin Dashboard - VoIP Integration Guide

This guide explains how to implement VoIP calling from a web admin dashboard to the E-Responde mobile app.

## Overview

The mobile app already supports receiving calls from admins. The web dashboard needs to:
1. Use WebRTC for audio/video communication
2. Use Firebase Realtime Database for signaling
3. Follow the same data structure as the mobile app

## Architecture

```
Web Admin Dashboard          Firebase Realtime DB          Mobile App
─────────────────           ────────────────────          ──────────
1. Initiate Call    ──────>  voip_calls/{callId}   ────>  Receives incoming call
2. Create Offer     ──────>  voip_signaling/offer  ────>  Receives offer
3. Send ICE         ──────>  iceCandidates/caller  ────>  Receives ICE
4. Receive Answer   <──────  voip_signaling/answer <────  Sends answer
5. Receive ICE      <──────  iceCandidates/callee  <────  Sends ICE
6. WebRTC Connected <─────────────────────────────────>  Connected!
```

## Implementation Guide

### Step 1: Firebase Configuration

```javascript
// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  // Your Firebase config from the mobile app's firebaseConfig.ts
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
```

### Step 2: Web VoIP Service

```javascript
// webVoIPService.js
import { ref, set, onValue, off, push, get, update } from 'firebase/database';
import { database, auth } from './firebaseConfig';

class WebVoIPService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallId = null;
    this.signalingListeners = [];
    
    // ICE servers (same as mobile app)
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };
  }

  // Initialize local media stream (audio only for voice calls)
  async initializeLocalStream(videoEnabled = false) {
    try {
      const constraints = {
        audio: true,
        video: videoEnabled ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
          facingMode: 'user',
        } : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Local stream initialized');
      return this.localStream;
    } catch (error) {
      console.error('Error initializing local stream:', error);
      throw new Error('Microphone permission is required for calls');
    }
  }

  // Create peer connection
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.iceServers);

    // Add local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.log('Remote stream received');
        
        // Trigger callback for UI update
        if (this.onRemoteStreamReceived) {
          this.onRemoteStreamReceived(this.remoteStream);
        }
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate && this.currentCallId) {
        console.log('New ICE candidate:', event.candidate);
        await this.sendIceCandidate(this.currentCallId, event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };

    return this.peerConnection;
  }

  // Initiate a call to a mobile app user
  async initiateCall(calleeUserId, calleeUserType, calleeName, reportId = null) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Admin not authenticated');
      }

      // Get admin info
      const adminData = await this.getAdminData(currentUser.uid);

      // Create call record in Firebase
      const callsRef = ref(database, 'voip_calls');
      const newCallRef = push(callsRef);
      const callId = newCallRef.key;

      const callData = {
        callId,
        caller: {
          userId: currentUser.uid,
          userType: 'admin',
          name: adminData.name || 'Admin Dashboard',
        },
        callee: {
          userId: calleeUserId,
          userType: calleeUserType,
          name: calleeName,
        },
        status: 'ringing',
        createdAt: new Date().toISOString(),
        reportId,
      };

      await set(newCallRef, callData);
      this.currentCallId = callId;

      // Initialize local stream
      await this.initializeLocalStream(false); // Audio only

      // Create peer connection and generate offer
      this.createPeerConnection();
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await this.peerConnection.setLocalDescription(offer);

      // Send offer through signaling
      await this.sendOffer(callId, offer);

      // Listen for answer
      this.listenForAnswer(callId);

      // Listen for ICE candidates from callee
      this.listenForIceCandidates(callId, 'callee');

      console.log('Call initiated:', callId);
      return callId;
    } catch (error) {
      console.error('Error initiating call:', error);
      throw error;
    }
  }

  // End the call
  async endCall(callId) {
    try {
      // Update call status
      await this.updateCallStatus(callId, 'ended');

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      // Clear remote stream
      this.remoteStream = null;

      // Remove signaling listeners
      this.signalingListeners.forEach((unsubscribe) => unsubscribe());
      this.signalingListeners = [];

      this.currentCallId = null;

      console.log('Call ended:', callId);
    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  // Signaling functions
  async sendOffer(callId, offer) {
    const offerRef = ref(database, `voip_signaling/${callId}/offer`);
    await set(offerRef, {
      sdp: offer.sdp,
      type: offer.type,
    });
  }

  async sendIceCandidate(callId, candidate) {
    const candidateRef = push(
      ref(database, `voip_signaling/${callId}/iceCandidates/caller`)
    );

    await set(candidateRef, {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
    });
  }

  listenForAnswer(callId) {
    const answerRef = ref(database, `voip_signaling/${callId}/answer`);

    const unsubscribe = onValue(answerRef, async (snapshot) => {
      const answer = snapshot.val();
      if (answer && this.peerConnection) {
        console.log('Received answer');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.signalingListeners.push(() => off(answerRef, 'value', unsubscribe));
  }

  listenForIceCandidates(callId, source) {
    const candidatesRef = ref(database, `voip_signaling/${callId}/iceCandidates/${source}`);

    const unsubscribe = onValue(candidatesRef, (snapshot) => {
      snapshot.forEach((childSnapshot) => {
        const candidateData = childSnapshot.val();
        if (candidateData && this.peerConnection) {
          const candidate = new RTCIceCandidate({
            candidate: candidateData.candidate,
            sdpMLineIndex: candidateData.sdpMLineIndex,
            sdpMid: candidateData.sdpMid,
          });
          this.peerConnection.addIceCandidate(candidate).catch((error) => {
            console.error('Error adding ICE candidate:', error);
          });
        }
      });
    });

    this.signalingListeners.push(() => off(candidatesRef, 'value', unsubscribe));
  }

  // Listen to call status changes
  listenToCallStatus(callId, onStatusChange) {
    const callRef = ref(database, `voip_calls/${callId}`);

    const unsubscribe = onValue(callRef, (snapshot) => {
      if (snapshot.exists()) {
        const callData = snapshot.val();
        console.log('Call status update:', callData);
        onStatusChange(callData);
      }
    });

    return () => off(callRef, 'value', unsubscribe);
  }

  // Update call status
  async updateCallStatus(callId, status) {
    const callRef = ref(database, `voip_calls/${callId}`);
    const updates = { status };

    if (status === 'answered') {
      updates.answeredAt = new Date().toISOString();
    } else if (status === 'ended') {
      updates.endedAt = new Date().toISOString();
    }

    await update(callRef, updates);
  }

  // Helper: Get admin data
  async getAdminData(userId) {
    // You'll need to implement this based on your admin data structure
    // This is a placeholder
    const adminRef = ref(database, `admins/${userId}`);
    const snapshot = await get(adminRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    
    return { name: 'Admin Dashboard' };
  }

  // Getters
  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  getCurrentCallId() {
    return this.currentCallId;
  }

  // Callback setters
  setOnRemoteStreamReceived(callback) {
    this.onRemoteStreamReceived = callback;
  }

  setOnConnectionStateChange(callback) {
    this.onConnectionStateChange = callback;
  }
}

// Create singleton instance
const webVoIPService = new WebVoIPService();
export default webVoIPService;
```

### Step 3: React Component Example (for Web Dashboard)

```jsx
// CallButton.jsx
import React, { useState, useEffect, useRef } from 'react';
import webVoIPService from './webVoIPService';

function CallButton({ userId, userType, userName, reportId = null }) {
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, connected, ended
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallId, setCurrentCallId] = useState(null);
  
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);

  // Setup remote stream when received
  useEffect(() => {
    webVoIPService.setOnRemoteStreamReceived((stream) => {
      console.log('Remote stream received, attaching to audio element');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    });

    webVoIPService.setOnConnectionStateChange((state) => {
      console.log('Connection state changed:', state);
      if (state === 'connected') {
        setCallStatus('connected');
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        handleEndCall();
      }
    });
  }, []);

  // Call duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus]);

  const handleInitiateCall = async () => {
    try {
      setCallStatus('calling');
      setIsInCall(true);
      setCallDuration(0);

      const callId = await webVoIPService.initiateCall(
        userId,
        userType,
        userName,
        reportId
      );
      
      setCurrentCallId(callId);

      // Listen for call status changes
      const unsubscribe = webVoIPService.listenToCallStatus(callId, (callData) => {
        console.log('Call data updated:', callData);
        
        if (callData.status === 'answered') {
          setCallStatus('connected');
        } else if (callData.status === 'rejected') {
          alert('Call was declined');
          handleEndCall();
        } else if (callData.status === 'ended') {
          handleEndCall();
        }
      });

      // Cleanup listener when component unmounts or call ends
      return () => unsubscribe();
    } catch (error) {
      console.error('Error initiating call:', error);
      alert('Failed to initiate call: ' + error.message);
      setIsInCall(false);
      setCallStatus('idle');
    }
  };

  const handleEndCall = async () => {
    try {
      if (currentCallId) {
        await webVoIPService.endCall(currentCallId);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setIsInCall(false);
      setCallStatus('idle');
      setCurrentCallId(null);
      setCallDuration(0);
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay />

      {!isInCall ? (
        <button onClick={handleInitiateCall} style={styles.callButton}>
          📞 Call {userName}
        </button>
      ) : (
        <div style={styles.callInterface}>
          <div style={styles.callInfo}>
            <h2>{userName}</h2>
            <p style={styles.statusText}>
              {callStatus === 'calling' && 'Calling...'}
              {callStatus === 'connected' && `Connected - ${formatDuration(callDuration)}`}
              {callStatus === 'ended' && 'Call Ended'}
            </p>
            {reportId && (
              <p style={styles.reportInfo}>Report #{reportId.substring(0, 8)}</p>
            )}
          </div>
          
          <button onClick={handleEndCall} style={styles.endButton}>
            End Call
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
  },
  callButton: {
    padding: '12px 24px',
    backgroundColor: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  callInterface: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px',
    backgroundColor: '#1F2937',
    borderRadius: '16px',
    color: 'white',
  },
  callInfo: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  statusText: {
    fontSize: '18px',
    color: '#9CA3AF',
    marginTop: '10px',
  },
  reportInfo: {
    fontSize: '14px',
    color: '#10B981',
    marginTop: '8px',
  },
  endButton: {
    padding: '12px 24px',
    backgroundColor: '#EF4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};

export default CallButton;
```

### Step 4: Usage Example

```jsx
// In your admin dashboard
import CallButton from './CallButton';

function UserProfile({ user }) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>Type: {user.userType}</p>
      
      {/* Add call button */}
      <CallButton
        userId={user.uid}
        userType={user.userType}
        userName={user.name}
        reportId={user.activeReportId} // Optional
      />
    </div>
  );
}
```

## Firebase Database Structure

The system uses these paths in Firebase Realtime Database:

```
firebase-database/
├── voip_calls/
│   └── {callId}/
│       ├── callId: string
│       ├── caller: { userId, userType: 'admin', name }
│       ├── callee: { userId, userType, name }
│       ├── status: 'ringing' | 'answered' | 'ended' | 'rejected' | 'missed'
│       ├── createdAt: ISO timestamp
│       ├── answeredAt: ISO timestamp (optional)
│       ├── endedAt: ISO timestamp (optional)
│       └── reportId: string (optional)
│
└── voip_signaling/
    └── {callId}/
        ├── offer: { sdp, type }
        ├── answer: { sdp, type }
        └── iceCandidates/
            ├── caller/
            │   └── {candidateId}: { candidate, sdpMLineIndex, sdpMid }
            └── callee/
                └── {candidateId}: { candidate, sdpMLineIndex, sdpMid }
```

## Important Notes

1. **Authentication**: Make sure the admin is authenticated with Firebase before initiating calls
2. **Permissions**: The browser will request microphone permissions - handle this gracefully
3. **HTTPS Required**: WebRTC requires HTTPS in production (except localhost)
4. **Firebase Rules**: Ensure your Firebase database rules allow admins to write to `voip_calls` and `voip_signaling`
5. **Browser Support**: Works in Chrome, Firefox, Safari, Edge (modern versions)

## Firebase Security Rules Example

```json
{
  "rules": {
    "voip_calls": {
      ".read": true,
      ".write": true
    },
    "voip_signaling": {
      ".read": true,
      ".write": true
    }
  }
}
```

**Note**: In production, you should restrict these rules based on authentication and user roles.

## Testing

1. Authenticate as an admin in the web dashboard
2. Click the call button for a mobile user
3. The mobile app should show an incoming call modal
4. Accept the call on mobile
5. Audio should connect within a few seconds

## Troubleshooting

### No incoming call on mobile
- Check Firebase console: Is the call record created in `voip_calls`?
- Verify the `calleeUserId` matches the mobile user's Firebase UID
- Check mobile app logs for incoming call detection

### Connection fails
- Check browser console for ICE connection state
- Verify STUN servers are accessible
- Check if both sides are behind symmetric NAT (may need TURN servers)

### No audio
- Verify microphone permissions granted on both sides
- Check if remote stream is properly attached to audio element
- Inspect WebRTC tracks: `stream.getTracks()`

## Advanced: Adding TURN Servers

For better reliability (especially for users behind firewalls), add TURN servers:

```javascript
this.iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ],
};
```

Free TURN server options:
- **Twilio TURN**: Requires account
- **Xirsys**: Free tier available
- **Self-hosted**: Use `coturn` on a VPS

---

## Summary

Your friend needs to:
1. ✅ Use the same Firebase project as your mobile app
2. ✅ Implement WebRTC in the browser (native support)
3. ✅ Follow the same signaling structure via Firebase Realtime Database
4. ✅ Set caller `userType` to `'admin'`
5. ✅ Handle call lifecycle (initiate, end, listen for status)

The mobile app is already prepared to receive calls from admins - no changes needed!

