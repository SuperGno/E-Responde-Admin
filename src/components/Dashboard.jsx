import { useState, useEffect, useRef } from 'react'
import { getDatabase, ref, onValue, off, update, get } from 'firebase/database'
import { app } from '../firebase'
import './Dashboard.css'

function Dashboard({ onNavigateToReport }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    receivedReports: 0,
    pendingReports: 0,
    resolvedReports: 0,
    inProgressReports: 0
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const itemsPerPage = 5;
  
  // WebRTC Call State
  const [callState, setCallState] = useState({
    isCalling: false,
    isInCall: false,
    callType: null, // 'civilian' or 'police'
    targetUser: null,
    callId: null
  });
  const [showCallModal, setShowCallModal] = useState(false);
  const [callError, setCallError] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [lastReportCount, setLastReportCount] = useState(0);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [newReportNotification, setNewReportNotification] = useState(null);
  const [lastReportIds, setLastReportIds] = useState(new Set());
  
  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  
  // Audio refs for sound effects
  const ringingAudioRef = useRef(null);
  const ringingIntervalRef = useRef(null);
  const callConnectedAudioRef = useRef(null);
  const callEndedAudioRef = useRef(null);
  const alarmAudioRef = useRef(null);
  

  // Filter reports by severity levels
  const immediateSeverityReports = recentSubmissions.filter(submission => 
    submission.severity?.toLowerCase() === 'immediate' || 
    submission.type.toLowerCase() === 'emergency sos' // Emergency SOS is always immediate severity
  );

  const highSeverityReports = recentSubmissions.filter(submission => 
    submission.severity?.toLowerCase() === 'high'
  );

  const moderateSeverityReports = recentSubmissions.filter(submission => 
    submission.severity?.toLowerCase() === 'moderate'
  );

  const lowSeverityReports = recentSubmissions.filter(submission => 
    submission.severity?.toLowerCase() === 'low'
  );

  // Filter severity reports based on active filter
  const filteredImmediateSeverity = activeFilter 
    ? immediateSeverityReports.filter(submission => {
        const status = submission.status.toLowerCase();
        switch (activeFilter) {
          case 'pending':
            return status === 'pending' || status === 'under review';
          case 'received':
            return status === 'received';
          case 'in-progress':
            return status === 'in progress';
          case 'resolved':
            return status === 'resolved';
          default:
            return true;
        }
      })
    : immediateSeverityReports;

  const filteredHighSeverity = activeFilter 
    ? highSeverityReports.filter(submission => {
        const status = submission.status.toLowerCase();
        switch (activeFilter) {
          case 'pending':
            return status === 'pending' || status === 'under review';
          case 'received':
            return status === 'received';
          case 'in-progress':
            return status === 'in progress';
          case 'resolved':
            return status === 'resolved';
          default:
            return true;
        }
      })
    : highSeverityReports;

  const filteredModerateSeverity = activeFilter 
    ? moderateSeverityReports.filter(submission => {
        const status = submission.status.toLowerCase();
        switch (activeFilter) {
          case 'pending':
            return status === 'pending' || status === 'under review';
          case 'received':
            return status === 'received';
          case 'in-progress':
            return status === 'in progress';
          case 'resolved':
            return status === 'resolved';
          default:
            return true;
        }
      })
    : moderateSeverityReports;

  const filteredLowSeverity = activeFilter 
    ? lowSeverityReports.filter(submission => {
        const status = submission.status.toLowerCase();
        switch (activeFilter) {
          case 'pending':
            return status === 'pending' || status === 'under review';
          case 'received':
            return status === 'received';
          case 'in-progress':
            return status === 'in progress';
          case 'resolved':
            return status === 'resolved';
          default:
            return true;
        }
      })
    : lowSeverityReports;
  

  // Pagination for severity-based reports
  const totalImmediatePages = Math.max(1, Math.ceil(filteredImmediateSeverity.length / itemsPerPage));
  const startImmediateIndex = (currentPage - 1) * itemsPerPage;
  const endImmediateIndex = startImmediateIndex + itemsPerPage;
  const currentImmediateSubmissions = filteredImmediateSeverity.slice(startImmediateIndex, endImmediateIndex);

  const totalHighPages = Math.max(1, Math.ceil(filteredHighSeverity.length / itemsPerPage));
  const startHighIndex = (currentPage - 1) * itemsPerPage;
  const endHighIndex = startHighIndex + itemsPerPage;
  const currentHighSubmissions = filteredHighSeverity.slice(startHighIndex, endHighIndex);

  const totalModeratePages = Math.max(1, Math.ceil(filteredModerateSeverity.length / itemsPerPage));
  const startModerateIndex = (currentPage - 1) * itemsPerPage;
  const endModerateIndex = startModerateIndex + itemsPerPage;
  const currentModerateSubmissions = filteredModerateSeverity.slice(startModerateIndex, endModerateIndex);

  const totalLowPages = Math.max(1, Math.ceil(filteredLowSeverity.length / itemsPerPage));
  const startLowIndex = (currentPage - 1) * itemsPerPage;
  const endLowIndex = startLowIndex + itemsPerPage;
  const currentLowSubmissions = filteredLowSeverity.slice(startLowIndex, endLowIndex);

  const getStatusColor = (status) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === "resolved") {
      return "status-resolved";
    } else if (normalizedStatus === "in progress") {
      return "status-in-progress";
    } else if (normalizedStatus === "received") {
      return "status-received";
    } else {
      return "status-pending";
    }
  };

  const formatStatus = (status) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case "in progress":
        return "In Progress";
      case "received":
        return "Received";
      case "resolved":
        return "Resolved";
      case "pending":
        return "Pending";
      default:
        return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Set up real-time listener for crime reports and statistics
  useEffect(() => {
    const db = getDatabase(app);
    const reportsRef = ref(db, 'civilian/civilian crime reports');
    
    console.log('Setting up real-time listener for reports...');
    
    const unsubscribe = onValue(reportsRef, (snapshot) => {
      try {
        setLoading(true);
        console.log('Real-time update received:', snapshot.exists());
        
        let reportsArray = [];
        
        if (snapshot.exists()) {
          const reportsData = snapshot.val();
          reportsArray = Object.keys(reportsData).map(key => {
            const report = reportsData[key];
            let locationText = 'Location not available';
            
            // Try different possible location field structures
            if (report.location?.address) {
              locationText = report.location.address;
            } else if (report.location?.formatted_address) {
              locationText = report.location.formatted_address;
            } else if (report.location?.fullAddress) {
              locationText = report.location.fullAddress;
            } else if (report.location?.streetAddress) {
              locationText = report.location.streetAddress;
            } else if (typeof report.location === 'string') {
              locationText = report.location;
            } else if (report.address) {
              locationText = report.address;
            } else if (report.locationText) {
              locationText = report.locationText;
            }
            
            return {
              id: key,
              type: report.crimeType || 'Unknown',
              description: report.description || 'No description',
              location: locationText,
              date: report.dateTime || report.createdAt,
              status: report.status || 'pending',
              severity: report.severity || 'moderate', // Default to moderate if no severity specified
              reportId: report.reportId || key,
              reporterUid: report.reporterUid || report.userId || report.uid // Include reporter UID for calling
            };
          });
          
          // Sort by date (newest first)
          reportsArray.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        // Calculate statistics
        const receivedCount = reportsArray.filter(report => 
          report.status.toLowerCase() === 'received'
        ).length;
        
        const pendingCount = reportsArray.filter(report => 
          report.status.toLowerCase() === 'pending' || 
          report.status.toLowerCase() === 'under review'
        ).length;
        
        const inProgressCount = reportsArray.filter(report => 
          report.status.toLowerCase() === 'in progress'
        ).length;
        
        const resolvedCount = reportsArray.filter(report => 
          report.status.toLowerCase() === 'resolved'
        ).length;
        
        setStats({
          receivedReports: receivedCount,
          pendingReports: pendingCount,
          resolvedReports: resolvedCount,
          inProgressReports: inProgressCount
        });
        
        // Check for new reports and trigger alarm
        
        // Get current report IDs
        const currentReportIds = new Set(reportsArray.map(report => report.id));
        
        // Find new reports by comparing IDs
        const newReportIds = new Set([...currentReportIds].filter(id => !lastReportIds.has(id)));
        
        if (newReportIds.size > 0 && lastReportIds.size > 0) {
          console.log('NEW REPORTS DETECTED:', newReportIds.size, 'new reports');
          
          // Get the most recent new report
          const newReportId = Array.from(newReportIds)[0];
          const latestReport = reportsArray.find(report => report.id === newReportId);
          
          if (latestReport) {
            // Play alarm sound for new reports
            playAlarmSound();
            
            // Fetch reporter information for the notification
            const fetchReporterInfo = async () => {
              try {
                let reporterName = 'Anonymous Reporter';
                
                if (latestReport.reporterUid) {
                  const reporterRef = ref(db, `civilian/civilian account/${latestReport.reporterUid}`);
                  const reporterSnapshot = await get(reporterRef);
                  
                  if (reporterSnapshot.exists()) {
                    const reporterData = reporterSnapshot.val();
                    reporterName = `${reporterData.firstName || ''} ${reporterData.lastName || ''}`.trim() || 'Anonymous Reporter';
                  }
                }
                
                // Show notification for new report with reporter info
                setNewReportNotification({
                  id: latestReport.id,
                  type: latestReport.type,
                  severity: latestReport.severity,
                  reporterName: reporterName,
                  timestamp: Date.now()
                });
                
                console.log('NEW REPORT ALERT:', latestReport.type, 'from', reporterName);
              } catch (error) {
                console.error('Error fetching reporter info:', error);
                // Show notification without reporter name if fetch fails
                setNewReportNotification({
                  id: latestReport.id,
                  type: latestReport.type,
                  severity: latestReport.severity,
                  reporterName: 'Anonymous Reporter',
                  timestamp: Date.now()
                });
              }
            };
            
            fetchReporterInfo();
            
            // Auto-hide notification after 8 seconds (longer to read reporter name)
            setTimeout(() => {
              setNewReportNotification(null);
            }, 8000);
          }
        } else if (lastReportIds.size === 0 && reportsArray.length > 0) {
          console.log('Initial load - setting report IDs');
        }
        
        setLastReportCount(reportsArray.length);
        setLastReportIds(currentReportIds);
        setRecentSubmissions(reportsArray);
        setError(null); // Clear any previous errors
        console.log('Reports updated in real-time:', reportsArray.length, 'reports');
      } catch (err) {
        console.error('Error processing real-time data:', err);
        setError(`Failed to process data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Real-time listener error:', error);
      setError(`Real-time connection failed: ${error.message}`);
      setLoading(false);
    });

    // Cleanup function to remove the listener when component unmounts
    return () => {
      console.log('Cleaning up real-time listener...');
      off(reportsRef, 'value', unsubscribe);
    };
  }, []);

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      stopRingingSound();
    };
  }, []);

  // Cleanup ringing when call state changes
  useEffect(() => {
    if (!callState.isCalling || callState.isInCall) {
      stopRingingSound();
    }
  }, [callState.isCalling, callState.isInCall]);

  const handleFilterClick = (filterType) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleUpdateStatus = (report) => {
    setSelectedReport(report);
    setShowUpdateModal(true);
  };

  // Audio Functions
  const createRingingSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a ringing pattern: 800Hz for 0.4s, silence for 0.2s, 1000Hz for 0.4s, silence for 0.2s
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.6);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 1.0);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + 0.4);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.45);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.6);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.65);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + 1.0);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1.2);
      
      return { audioContext, oscillator, gainNode };
    } catch (error) {
      console.log('Could not create ringing sound:', error);
      return null;
    }
  };

  const playRingingSound = () => {
    try {
      // Clear any existing ringing interval
      if (ringingIntervalRef.current) {
        clearInterval(ringingIntervalRef.current);
      }
      
      // Start ringing immediately
      const playRing = () => {
        if (callState.isCalling && !callState.isInCall) {
          createRingingSound();
        }
      };
      
      // Play first ring immediately
      playRing();
      
      // Set up interval to repeat every 1.2 seconds (duration of one ring cycle)
      ringingIntervalRef.current = setInterval(playRing, 1200);
      
    } catch (error) {
      console.log('Could not play ringing sound:', error);
    }
  };

  const playCallConnectedSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant connected tone
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play connected sound:', error);
    }
  };

  const playCallEndedSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Call ended tone
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play ended sound:', error);
    }
  };

  const stopRingingSound = () => {
    try {
      // Clear the ringing interval
      if (ringingIntervalRef.current) {
        clearInterval(ringingIntervalRef.current);
        ringingIntervalRef.current = null;
      }
      
      // Clear any existing ringing audio
      if (ringingAudioRef.current) {
        ringingAudioRef.current.oscillator.stop();
        ringingAudioRef.current.audioContext.close();
        ringingAudioRef.current = null;
      }
    } catch (error) {
      console.log('Could not stop ringing sound:', error);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  // Alarm Functions
  const playAlarmSound = () => {
    if (!alarmEnabled) {
      return;
    }
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect both oscillators to the same gain node
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create an urgent alarm sound with two frequencies
      oscillator1.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator1.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
      oscillator1.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      oscillator1.frequency.setValueAtTime(1200, audioContext.currentTime + 0.3);
      
      oscillator2.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator2.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
      oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3);
      
      // Create a pulsing volume effect
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.25);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.3);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.35);
      
      oscillator1.start(audioContext.currentTime);
      oscillator2.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.4);
      oscillator2.stop(audioContext.currentTime + 0.4);
      
      alarmAudioRef.current = { audioContext, oscillator1, oscillator2, gainNode };
      
      // Auto cleanup after sound finishes
      setTimeout(() => {
        if (alarmAudioRef.current) {
          try {
            alarmAudioRef.current.audioContext.close();
            alarmAudioRef.current = null;
          } catch (error) {
            console.log('Could not cleanup alarm audio:', error);
          }
        }
      }, 500);
      
    } catch (error) {
      console.log('Could not play alarm sound:', error);
    }
  };

  const toggleAlarm = () => {
    setAlarmEnabled(!alarmEnabled);
  };

  // WebRTC Call Functions
  const handleCallClick = async (report) => {
    try {
      setCallLoading(true);
      setCallError('');
      
      // Get reporter information from the report data
      const db = getDatabase(app);
      let targetUser = null;
      
      if (report.reporterUid) {
        // Get civilian reporter info from their account
        const civilianRef = ref(db, `civilian/civilian account/${report.reporterUid}`);
        const civilianSnapshot = await get(civilianRef);
        
        if (civilianSnapshot.exists()) {
          const civilianData = civilianSnapshot.val();
          targetUser = {
            id: report.reporterUid,
            name: `${civilianData.firstName || ''} ${civilianData.lastName || ''}`.trim() || 'Anonymous Reporter',
            email: civilianData.email || 'Not available',
            type: 'civilian',
            isOnline: civilianData.isOnline || false,
            lastSeen: civilianData.lastSeen || null
          };
        }
      }
      
      // If no reporter UID or civilian account found, show error
      if (!targetUser) {
        setCallError('No reporter information available for this report. Cannot initiate internet call.');
        return;
      }
      
      setCallState({
        isCalling: true,
        isInCall: false,
        callType: 'civilian',
        targetUser,
        callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
      
      setShowCallModal(true);
      
      // Start ringing sound
      playRingingSound();
      
      // Initialize WebRTC call through internet
      await initializeInternetCall(targetUser, report);
      
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallError('Failed to initiate internet call. Please try again.');
    } finally {
      setCallLoading(false);
    }
  };

  const initializeInternetCall = async (targetUser, report) => {
    try {
      // Get user media (audio only)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      
      localStreamRef.current = stream;
      
      // Create peer connection for internet calling
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      };
      
      peerConnectionRef.current = new RTCPeerConnection(configuration);
      
      // Add local audio stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });
      
      // Handle remote audio stream from mobile app
      peerConnectionRef.current.ontrack = (event) => {
        const remoteStream = event.streams[0];
        // Play remote audio from mobile app
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play();
        
        // Stop ringing and play connected sound
        stopRingingSound();
        playCallConnectedSound();
        
        setCallState(prev => ({ ...prev, isInCall: true, isCalling: false }));
      };
      
      // Handle ICE candidates for internet connection
      peerConnectionRef.current.onicecandidate = async (event) => {
        if (event.candidate) {
          // Send ICE candidate to mobile app via Firebase
          const db = getDatabase(app);
          const candidateRef = ref(db, `voip_signaling/${targetUser.id}/candidates/${callState.callId}`);
          await update(candidateRef, {
            candidate: event.candidate,
            timestamp: Date.now()
          });
        }
      };
      
      // Create and set local description
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send call offer to mobile app via Firebase
      const db = getDatabase(app);
      const callOfferRef = ref(db, `voip_calls/${targetUser.id}/incoming`);
      await update(callOfferRef, {
        callId: callState.callId,
        offer: offer,
        from: 'admin_dashboard',
        reportId: report.id,
        reportType: report.type,
        timestamp: Date.now(),
        status: 'ringing'
      });
      
      // Listen for answer from mobile app
      const answerRef = ref(db, `voip_calls/${targetUser.id}/answer/${callState.callId}`);
      const answerUnsubscribe = onValue(answerRef, async (snapshot) => {
        if (snapshot.exists()) {
          const answerData = snapshot.val();
          if (answerData.answer) {
            await peerConnectionRef.current.setRemoteDescription(answerData.answer);
            
            // Stop ringing and play connected sound
            stopRingingSound();
            playCallConnectedSound();
            
            setCallState(prev => ({ ...prev, isInCall: true, isCalling: false }));
          }
        }
      });
      
      // Cleanup listener after call ends
      setTimeout(() => {
        off(answerRef, 'value', answerUnsubscribe);
      }, 30000); // 30 second timeout
      
    } catch (error) {
      console.error('Error initializing internet call:', error);
      setCallError('Failed to access microphone or establish internet connection. Please check permissions.');
    }
  };

  const endCall = () => {
    // Stop ringing sound
    stopRingingSound();
    
    // Play call ended sound
    playCallEndedSound();
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Reset call state
    setCallState({
      isCalling: false,
      isInCall: false,
      callType: null,
      targetUser: null,
      callId: null
    });
    
    setShowCallModal(false);
    setCallError('');
  };

  const updateReportStatus = async (newStatus) => {
    if (!selectedReport) return;
    
    try {
      setUpdating(true);
      const db = getDatabase(app);
      const reportRef = ref(db, `civilian/civilian crime reports/${selectedReport.id}`);
      
      await update(reportRef, {
        status: newStatus
      });
      
      // No need to manually refresh data - real-time listener will handle updates automatically
      console.log('Report status updated, real-time listener will handle data refresh');
      
      setShowUpdateModal(false);
      setSelectedReport(null);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="page-content">
      <div className="dashboard-header">
        <h1>E-Responde Dashboard</h1>
      </div>
      
      {/* New Report Notification */}
      {newReportNotification && (
        <div className="new-report-notification">
          <div className="notification-content">
            <div className="notification-icon">🚨</div>
            <div className="notification-text">
              <h3>NEW CRIME REPORT</h3>
              <div className="notification-details">
                <div className="crime-type">
                  <span className="label">Crime Type:</span>
                  <span className="value">{newReportNotification.type}</span>
                </div>
                <div className="reporter-name">
                  <span className="label">Reported by:</span>
                  <span className="value">{newReportNotification.reporterName}</span>
                </div>
                <div className="severity">
                  <span className="label">Severity:</span>
                  <span className={`severity-value ${newReportNotification.severity?.toLowerCase()}`}>
                    {newReportNotification.severity?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
              </div>
            </div>
            <button 
              className="notification-close"
              onClick={() => setNewReportNotification(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section className="dashboard-section">
        <h2>Report Overview</h2>
        <div className="dashboard-grid">
          <div 
            className={`card filter-card ${activeFilter === 'pending' ? 'active' : ''}`}
            onClick={() => handleFilterClick('pending')}
          >
            <h3>Pending Reports</h3>
            <p className="stat">{stats.pendingReports}</p>
          </div>
          <div 
            className={`card filter-card ${activeFilter === 'received' ? 'active' : ''}`}
            onClick={() => handleFilterClick('received')}
          >
            <h3>Received Reports</h3>
            <p className="stat">{stats.receivedReports}</p>
          </div>
          <div 
            className={`card filter-card ${activeFilter === 'in-progress' ? 'active' : ''}`}
            onClick={() => handleFilterClick('in-progress')}
          >
            <h3>In Progress Reports</h3>
            <p className="stat">{stats.inProgressReports}</p>
          </div>
          <div 
            className={`card filter-card ${activeFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => handleFilterClick('resolved')}
          >
            <h3>Resolved Reports</h3>
            <p className="stat">{stats.resolvedReports}</p>
          </div>
        </div>
      </section>

      {/* Immediate Severity Reports Section */}
      {filteredImmediateSeverity.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Immediate Severity Reports</h2>
            <span className="severity-badge immediate-severity">IMMEDIATE</span>
          </div>
          <div className="table-container">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentImmediateSubmissions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                      No immediate severity reports found
                    </td>
                  </tr>
                ) : (
                  currentImmediateSubmissions.map((submission) => (
                    <tr key={submission.id} className={submission.type.toLowerCase() === 'emergency sos' ? 'sos-row' : ''}>
                      <td>{submission.type}</td>
                      <td>{submission.description}</td>
                      <td>{submission.location}</td>
                      <td>{formatDate(submission.date)}</td>
                      <td>
                        <span className={`status-badge ${getStatusColor(submission.status)}`}>
                          {formatStatus(submission.status)}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn-view" 
                            onClick={() => onNavigateToReport(submission.id)}
                          >
                            View
                          </button>
                          <button 
                            className="btn-update"
                            onClick={() => handleUpdateStatus(submission)}
                          >
                            Update
                          </button>
                          <button 
                            className="btn-call"
                            onClick={() => handleCallClick(submission)}
                            disabled={callLoading}
                          >
                            {callLoading ? 'Calling...' : 'Call'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredImmediateSeverity.length > itemsPerPage && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalImmediatePages}
              </span>
              <button 
                className="pagination-btn"
                disabled={currentPage === totalImmediatePages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {/* High Severity Reports Section */}
      {filteredHighSeverity.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>High Severity Reports</h2>
            <span className="severity-badge high-severity">HIGH</span>
          </div>
          <div className="table-container">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentHighSubmissions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                      No high severity reports found
                    </td>
                  </tr>
                ) : (
                  currentHighSubmissions.map((submission) => (
                    <tr key={submission.id} className={submission.type.toLowerCase() === 'emergency sos' ? 'sos-row' : ''}>
                      <td>{submission.type}</td>
                      <td>{submission.description}</td>
                      <td>{submission.location}</td>
                      <td>{formatDate(submission.date)}</td>
                      <td>
                        <span className={`status-badge ${getStatusColor(submission.status)}`}>
                          {formatStatus(submission.status)}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn-view" 
                            onClick={() => onNavigateToReport(submission.id)}
                          >
                            View
                          </button>
                          <button 
                            className="btn-update"
                            onClick={() => handleUpdateStatus(submission)}
                          >
                            Update
                          </button>
                          <button 
                            className="btn-call"
                            onClick={() => handleCallClick(submission)}
                            disabled={callLoading}
                          >
                            {callLoading ? 'Calling...' : 'Call'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredHighSeverity.length > itemsPerPage && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalHighPages}
              </span>
              <button 
                className="pagination-btn"
                disabled={currentPage === totalHighPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {/* Moderate Severity Reports Section */}
      {filteredModerateSeverity.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Moderate Severity Reports</h2>
            <span className="severity-badge moderate-severity">MODERATE</span>
          </div>
          <div className="table-container">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentModerateSubmissions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                      No moderate severity reports found
                    </td>
                  </tr>
                ) : (
                  currentModerateSubmissions.map((submission) => (
                    <tr key={submission.id} className={submission.type.toLowerCase() === 'emergency sos' ? 'sos-row' : ''}>
                      <td>{submission.type}</td>
                      <td>{submission.description}</td>
                      <td>{submission.location}</td>
                      <td>{formatDate(submission.date)}</td>
                      <td>
                        <span className={`status-badge ${getStatusColor(submission.status)}`}>
                          {formatStatus(submission.status)}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn-view" 
                            onClick={() => onNavigateToReport(submission.id)}
                          >
                            View
                          </button>
                          <button 
                            className="btn-update"
                            onClick={() => handleUpdateStatus(submission)}
                          >
                            Update
                          </button>
                          <button 
                            className="btn-call"
                            onClick={() => handleCallClick(submission)}
                            disabled={callLoading}
                          >
                            {callLoading ? 'Calling...' : 'Call'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredModerateSeverity.length > itemsPerPage && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalModeratePages}
              </span>
              <button 
                className="pagination-btn"
                disabled={currentPage === totalModeratePages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {/* Low Severity Reports Section */}
      {filteredLowSeverity.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Low Severity Reports</h2>
            <span className="severity-badge low-severity">LOW</span>
          </div>
          <div className="table-container">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentLowSubmissions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                      No low severity reports found
                    </td>
                  </tr>
                ) : (
                  currentLowSubmissions.map((submission) => (
                    <tr key={submission.id} className={submission.type.toLowerCase() === 'emergency sos' ? 'sos-row' : ''}>
                      <td>{submission.type}</td>
                      <td>{submission.description}</td>
                      <td>{submission.location}</td>
                      <td>{formatDate(submission.date)}</td>
                      <td>
                        <span className={`status-badge ${getStatusColor(submission.status)}`}>
                          {formatStatus(submission.status)}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn-view" 
                            onClick={() => onNavigateToReport(submission.id)}
                          >
                            View
                          </button>
                          <button 
                            className="btn-update"
                            onClick={() => handleUpdateStatus(submission)}
                          >
                            Update
                          </button>
                          <button 
                            className="btn-call"
                            onClick={() => handleCallClick(submission)}
                            disabled={callLoading}
                          >
                            {callLoading ? 'Calling...' : 'Call'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredLowSeverity.length > itemsPerPage && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalLowPages}
              </span>
              <button 
                className="pagination-btn"
                disabled={currentPage === totalLowPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Update Report Status</h3>
            <p><strong>Report ID:</strong> {selectedReport?.reportId}</p>
            <p><strong>Current Status:</strong> {selectedReport?.status}</p>
            
            <div className="status-options">
              <button 
                className={`status-btn ${selectedReport?.status === 'Received' ? 'active' : ''}`}
                onClick={() => updateReportStatus('Received')}
                disabled={updating}
              >
                Received
              </button>
              <button 
                className={`status-btn ${selectedReport?.status === 'In Progress' ? 'active' : ''}`}
                onClick={() => updateReportStatus('In Progress')}
                disabled={updating}
              >
                In Progress
              </button>
              <button 
                className={`status-btn ${selectedReport?.status === 'Resolved' ? 'active' : ''}`}
                onClick={() => updateReportStatus('Resolved')}
                disabled={updating}
              >
                Resolved
              </button>
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowUpdateModal(false);
                  setSelectedReport(null);
                }}
                disabled={updating}
              >
                Cancel
              </button>
            </div>
            
            {updating && <p className="updating-text">Updating status...</p>}
          </div>
        </div>
      )}

      {/* WebRTC Call Modal */}
      {showCallModal && (
        <div className="modal-overlay">
          <div className="modal-content call-modal">
            <div className="call-header">
              <h3>VoIP Call</h3>
              <button className="close-btn" onClick={endCall}>×</button>
            </div>
            
            {callError && (
              <div className="call-error">
                <p>{callError}</p>
              </div>
            )}
            
            {callState.targetUser && (
              <div className="call-info">
                <div className="call-target">
                  <h4>Internet Call to Mobile App</h4>
                  <p className="target-name">{callState.targetUser.name}</p>
                  <p className="target-status">
                    {callState.targetUser.isOnline ? 
                      <span className="online-status">🟢 Online</span> : 
                      <span className="offline-status">🔴 Offline</span>
                    }
                  </p>
                  <p className="target-method">📱 Calling via E-Responde Mobile App</p>
                </div>
              </div>
            )}
            
            <div className="call-container">
              <div className="call-wrapper">
                {callState.isCalling && !callState.isInCall && (
                  <div className="calling-status">
                    <div className="calling-spinner"></div>
                    <p>Connecting...</p>
                  </div>
                )}
                
                {callState.isInCall && (
                  <div className="call-status">
                    <div className="call-icon">📞</div>
                    <p>Call Connected</p>
                    <div className="call-controls">
                      <button 
                        className={`call-btn mute-btn ${isMuted ? 'muted' : ''}`} 
                        onClick={toggleMute}
                      >
                        {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                      </button>
                      <button className="call-btn end-call" onClick={endCall}>
                        📞 End Call
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="call-actions">
              {!callState.isInCall && !callState.isCalling && (
                <button className="call-btn start-call" onClick={() => initializeInternetCall(callState.targetUser, { id: callState.callId })}>
                  📞 Start Internet Call
                </button>
              )}
              <button className="call-btn cancel-call" onClick={endCall}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard




