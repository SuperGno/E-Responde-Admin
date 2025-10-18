# Audio Permissions Guide for VoIP Calls

## Common Audio Permission Issues

### 1. Browser Microphone Permissions

**Chrome/Edge:**
- Click the lock icon in the address bar
- Set "Microphone" to "Allow"
- Refresh the page

**Firefox:**
- Click the shield icon in the address bar
- Click "Permissions" → "Microphone" → "Allow"
- Refresh the page

**Safari:**
- Go to Safari → Preferences → Websites → Microphone
- Set your site to "Allow"

### 2. Browser Audio Autoplay Policy

Modern browsers block audio autoplay without user interaction:

**Solution:**
- Click anywhere on the page after the call connects
- The audio will automatically start playing
- Look for console message: "User interaction required to enable audio"

### 3. System Audio Settings

**Windows:**
- Right-click speaker icon → "Open Sound settings"
- Check "Input" and "Output" devices
- Ensure volume is not muted

**Mac:**
- System Preferences → Sound
- Check "Input" and "Output" tabs
- Ensure volume is not muted

### 4. WebRTC Audio Context Issues

**Problem:** Audio context is suspended
**Solution:** The app automatically resumes audio context when needed

## Testing Audio Setup

### Step 1: Use the Test Audio Button
1. Click "Test Audio" button in dashboard header
2. Allow microphone access when prompted
3. You should hear a test sound

### Step 2: Check Browser Console
Look for these messages:
- ✅ "Microphone access granted"
- ✅ "Audio playback test successful"
- ❌ "Microphone access denied" - Enable microphone permission
- ❌ "Audio not supported" - Try different browser

### Step 3: Test VoIP Call
1. Make a VoIP call
2. Check console for:
   - "Remote audio setup complete"
   - "Remote audio started playing"
3. If audio doesn't work, click anywhere on the page

## Troubleshooting Steps

### If you can't hear the mobile user:

1. **Check Console Logs:**
   ```
   === REMOTE TRACK RECEIVED ===
   Track kind: audio
   Audio tracks: 1
   Remote audio setup complete
   ```

2. **Try User Interaction:**
   - Click anywhere on the page
   - Look for: "User interaction required to enable audio"

3. **Check Browser Permissions:**
   - Ensure microphone is allowed
   - Check if audio is muted in browser/system

4. **Test with Different Browser:**
   - Try Chrome, Firefox, or Edge
   - Some browsers have stricter audio policies

### If mobile user can't hear you:

1. **Check Microphone Access:**
   - Use "Test Audio" button
   - Ensure microphone permission is granted

2. **Check Local Audio Track:**
   - Look for: "Adding local track: audio"
   - Ensure track is enabled and not muted

3. **Check WebRTC Connection:**
   - Look for: "Connection state: connected"
   - Look for: "ICE connection state: connected"

## Browser-Specific Issues

### Chrome/Edge
- Most reliable for WebRTC
- Good audio codec support
- Automatic audio context handling

### Firefox
- Good WebRTC support
- May require manual audio context resume
- Check about:config for media settings

### Safari
- Limited WebRTC support
- May not work with all audio codecs
- Requires HTTPS for getUserMedia

## Mobile App Considerations

The mobile app must:
1. **Send audio tracks** in the WebRTC connection
2. **Use compatible audio codecs** (Opus, G.722, PCMA, PCMU)
3. **Handle ICE candidates** properly
4. **Respond to call offers** from the web dashboard

## Quick Fixes

### Immediate Solutions:
1. **Click "Test Audio"** - Verifies basic audio setup
2. **Click anywhere on page** - Enables audio after call connects
3. **Check browser permissions** - Ensure microphone is allowed
4. **Try different browser** - Chrome/Edge usually work best

### Advanced Solutions:
1. **Check console logs** - Detailed debugging information
2. **Verify WebRTC connection** - Connection state must be "connected"
3. **Test with mobile app** - Ensure mobile app is sending audio
4. **Check network** - WebRTC requires stable internet connection

## Contact Support

If audio still doesn't work:
1. Share browser console logs
2. Specify browser and version
3. Describe what you hear (or don't hear)
4. Include mobile app behavior details
