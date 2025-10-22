import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getDatabase, ref, onValue, off, update, get, push, set } from 'firebase/database'
import { app, iceServers } from '../firebase'
import { useAuth } from '../providers/AuthProvider'
import StatusTag from './StatusTag'
import './Dashboard.css'

function Dashboard({ onNavigateToReport }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, claims, loading: authLoading } = useAuth()
  const [currentPageImmediate, setCurrentPageImmediate] = useState(1);
  const [currentPageHigh, setCurrentPageHigh] = useState(1);
  const [currentPageModerate, setCurrentPageModerate] = useState(1);
  const [currentPageLow, setCurrentPageLow] = useState(1);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlightedReportId, setHighlightedReportId] = useState(null);
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
            return status === 'resolved' || status === 'case resolved';
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
            return status === 'resolved' || status === 'case resolved';
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
            return status === 'resolved' || status === 'case resolved';
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
            return status === 'resolved' || status === 'case resolved';
          default:
            return true;
        }
      })
    : lowSeverityReports;
  

  // Pagination for severity-based reports
  const toTimestamp = (value) => {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  // Always sort newest-first within each severity before paginating
  const immediateSorted = [...filteredImmediateSeverity].sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
  const highSorted = [...filteredHighSeverity].sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
  const moderateSorted = [...filteredModerateSeverity].sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
  const lowSorted = [...filteredLowSeverity].sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));

  const totalImmediatePages = Math.max(1, Math.ceil(immediateSorted.length / itemsPerPage));
  const startImmediateIndex = (currentPageImmediate - 1) * itemsPerPage;
  const endImmediateIndex = startImmediateIndex + itemsPerPage;
  const currentImmediateSubmissions = immediateSorted.slice(startImmediateIndex, endImmediateIndex);

  const totalHighPages = Math.max(1, Math.ceil(highSorted.length / itemsPerPage));
  const startHighIndex = (currentPageHigh - 1) * itemsPerPage;
  const endHighIndex = startHighIndex + itemsPerPage;
  const currentHighSubmissions = highSorted.slice(startHighIndex, endHighIndex);

  const totalModeratePages = Math.max(1, Math.ceil(moderateSorted.length / itemsPerPage));
  const startModerateIndex = (currentPageModerate - 1) * itemsPerPage;
  const endModerateIndex = startModerateIndex + itemsPerPage;
  const currentModerateSubmissions = moderateSorted.slice(startModerateIndex, endModerateIndex);

  const totalLowPages = Math.max(1, Math.ceil(lowSorted.length / itemsPerPage));
  const startLowIndex = (currentPageLow - 1) * itemsPerPage;
  const endLowIndex = startLowIndex + itemsPerPage;
  const currentLowSubmissions = lowSorted.slice(startLowIndex, endLowIndex);

  const getStatusColor = (status) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === "resolved" || normalizedStatus === "case resolved") {
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
      case "case resolved":
        return "Case Resolved";
      case "pending":
        return "Pending";
      default:
        return status;
    }
  };

  const isResolved = (status) => {
    const s = (status || '').toLowerCase();
    return s === 'resolved' || s === 'case resolved';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const truncateDescription = (description, maxLength = 100) => {
    if (!description) return 'No description'
    if (description.length <= maxLength) return description
    return description.substring(0, maxLength) + '...'
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
          (report.status || '').toLowerCase() === 'received'
        ).length;
        
        const pendingCount = reportsArray.filter(report => 
          report.status.toLowerCase() === 'pending' || 
          report.status.toLowerCase() === 'under review'
        ).length;
        
        const inProgressCount = reportsArray.filter(report => 
          (report.status || '').toLowerCase() === 'in progress'
        ).length;
        
        const resolvedCount = reportsArray.filter(report => isResolved(report.status)).length;
        
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
    // Reset per-section pages when filter changes
    setCurrentPageImmediate(1);
    setCurrentPageHigh(1);
    setCurrentPageModerate(1);
    setCurrentPageLow(1);
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
      
      // Get admin data and reporter information
      const db = getDatabase(app);
      let targetUser = null;
      let adminData = null;
      
      // Get admin data from Firebase
      const adminRef = ref(db, 'admin_dashboard_account');
      const adminSnapshot = await get(adminRef);
      
      if (adminSnapshot.exists()) {
        adminData = adminSnapshot.val();
        console.log('Admin data retrieved:', adminData);
      } else {
        console.warn('No admin data found in Firebase');
      }
      
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
      
      // Generate a unique call ID similar to mobile app format
      const callId = `-${Math.random().toString(36).substr(2, 9)}${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('Generated new call ID:', callId);
      
      setCallState({
        isCalling: true,
        isInCall: false,
        callType: 'civilian',
        targetUser,
        callId: callId
      });
      
      setShowCallModal(true);
      
      // Start ringing sound
      playRingingSound();
      
      // Initialize WebRTC call through internet
      await initializeInternetCall(targetUser, report, adminData);
      
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallError('Failed to initiate internet call. Please try again.');
    } finally {
      setCallLoading(false);
    }
  };

  const initializeInternetCall = async (targetUser, report, adminData) => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }
      
      // Check if WebRTC is supported
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC is not supported in this browser');
      }
      
      console.log('Requesting microphone access...');
      
      // Get user media (audio only)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Microphone access granted');
      localStreamRef.current = stream;
      
      // Create peer connection for internet calling
      const configuration = {
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'balanced'
      };
      
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      peerConnectionRef.current.oniceconnectionstatechange = () => {
        const state = peerConnectionRef.current?.iceConnectionState
        console.log('ICE state:', state)
        if (state === 'failed' || state === 'disconnected') {
          try {
            peerConnectionRef.current?.restartIce?.()
            console.log('Attempted ICE restart')
          } catch (e) {
            console.log('ICE restart unsupported', e)
          }
        }
      }
      
      
      // Add local audio stream to peer connection
      stream.getTracks().forEach(track => {
        console.log('Adding local track:', track.kind, track.label);
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
      
      // Handle ICE candidates - following mobile app guide structure
      peerConnectionRef.current.onicecandidate = async (event) => {
        if (event.candidate && callState.callId) {
          console.log('Sending ICE candidate:', event.candidate);
          const db = getDatabase(app);
          const candidateRef = push(ref(db, `voip_signaling/${callState.callId}/iceCandidates/caller`));
          await set(candidateRef, {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          });
        }
      };
      
      // Create and set local description
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Create call record in Firebase using push() for proper callId generation
      const db = getDatabase(app);
      const callsRef = ref(db, 'voip_calls');
      const newCallRef = push(callsRef);
      const callId = newCallRef.key;
      
      console.log('Generated call ID:', callId);
      
      // Update call state with new callId
      setCallState(prev => ({ ...prev, callId: callId }));
      
      const callData = {
        callId,
        caller: {
          userId: adminData?.userId || 'admin_dashboard',
          userType: 'admin',
          name: adminData?.email || 'Admin Dashboard',
        },
        callee: {
          userId: targetUser.id,
          userType: targetUser.type || 'civilian',
          name: targetUser.name,
        },
        status: 'ringing',
        createdAt: new Date().toISOString(),
        reportId: report.id,
        reportType: report.type,
      };
      
      await set(newCallRef, callData);
      console.log('Call record created in Firebase');
      
      // Send offer through signaling (following mobile app guide)
      const offerRef = ref(db, `voip_signaling/${callId}/offer`);
      await set(offerRef, {
        sdp: offer.sdp,
        type: offer.type,
      });
      console.log('Offer sent through signaling');
      
      // Listen for answer from mobile app (following mobile app guide)
      const answerRef = ref(db, `voip_signaling/${callId}/answer`);
      const answerUnsubscribe = onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (answer && peerConnectionRef.current) {
          console.log('Received answer from mobile app');
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });
      
      // Listen for ICE candidates from callee
      const calleeCandidatesRef = ref(db, `voip_signaling/${callId}/iceCandidates/callee`);
      const calleeCandidatesUnsubscribe = onValue(calleeCandidatesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          const candidateData = childSnapshot.val();
          if (candidateData && peerConnectionRef.current) {
            const candidate = new RTCIceCandidate({
              candidate: candidateData.candidate,
              sdpMLineIndex: candidateData.sdpMLineIndex,
              sdpMid: candidateData.sdpMid,
            });
            peerConnectionRef.current.addIceCandidate(candidate).catch((error) => {
              console.error('Error adding ICE candidate:', error);
            });
          }
        });
      });
      
      // Listen for call status changes
      const callStatusRef = ref(db, `voip_calls/${callId}`);
      const callStatusUnsubscribe = onValue(callStatusRef, (snapshot) => {
        if (snapshot.exists()) {
          const callData = snapshot.val();
          console.log('Call status update:', callData);
          
          if (callData.status === 'answered') {
            // Call was answered
            stopRingingSound();
            playCallConnectedSound();
            setCallState(prev => ({ ...prev, isInCall: true, isCalling: false }));
          } else if (callData.status === 'rejected') {
            alert('Call was declined');
            endCall();
          } else if (callData.status === 'ended') {
            endCall();
          }
        }
      });

      
      // Cleanup listeners after 30 seconds
      setTimeout(() => {
        off(answerRef, 'value', answerUnsubscribe);
        off(calleeCandidatesRef, 'value', calleeCandidatesUnsubscribe);
        off(callStatusRef, 'value', callStatusUnsubscribe);
      }, 30000);
      
    } catch (error) {
      console.error('Error initializing internet call:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to access microphone or establish internet connection. Please check permissions.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'WebRTC is not supported in this browser. Please use Chrome, Firefox, or Edge.';
      } else if (error.message.includes('getUserMedia is not supported')) {
        errorMessage = 'Microphone access is not supported in this browser. Please use a modern browser.';
      } else if (error.message.includes('WebRTC is not supported')) {
        errorMessage = 'WebRTC is not supported in this browser. Please use Chrome, Firefox, or Edge.';
      }
      
      setCallError(errorMessage);
    }
  };

  const endCall = async () => {
    // Stop ringing sound
    stopRingingSound();
    
    // Play call ended sound
    playCallEndedSound();
    
    // Update call status in Firebase (following mobile app guide)
    if (callState.callId) {
      try {
        const db = getDatabase(app);
        const callRef = ref(db, `voip_calls/${callState.callId}`);
        await update(callRef, {
          status: 'ended',
          endedAt: new Date().toISOString()
        });
        console.log('Call status updated to ended');
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }
    
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

  // Debug authentication info
  useEffect(() => {
    if (user && claims) {
      console.log('Dashboard: User authenticated:', {
        uid: user.uid,
        email: user.email,
        role: claims.role,
        accountType: claims.accountType,
        accountData: claims.accountData
      })
    }
  }, [user, claims])

  return (
    <div className="min-h-full bg-gray-50 p-4 lg:p-6">
      {/* New Report Notification */}
      {newReportNotification && (
        <div className="fixed top-4 right-4 bg-status-danger text-white p-4 rounded-xl shadow-lg z-50 max-w-md mx-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-lg font-bold">
                !
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">NEW CRIME REPORT</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Crime Type:</span>
                    <span>{newReportNotification.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Reported by:</span>
                    <span>{newReportNotification.reporterName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Severity:</span>
                    <span className="font-bold">
                      {newReportNotification.severity?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button 
              className="ml-4 text-white hover:text-gray-200 text-xl font-bold"
              onClick={() => setNewReportNotification(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section className="mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black mb-2" style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            color: '#1e293b', 
            letterSpacing: '-0.025em',
            textTransform: 'uppercase'
          }}>Report Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            className={`card cursor-pointer transition-all duration-200 ${
              activeFilter === 'pending' ? 'ring-2 ring-black bg-gray-50' : ''
            }`}
            onClick={() => handleFilterClick('pending')}
          >
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{stats.pendingReports}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>Pending Reports</div>
          </div>
          <div 
            className={`card cursor-pointer transition-all duration-200 ${
              activeFilter === 'received' ? 'ring-2 ring-black bg-gray-50' : ''
            }`}
            onClick={() => handleFilterClick('received')}
          >
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{stats.receivedReports}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>Received Reports</div>
          </div>
          <div 
            className={`card cursor-pointer transition-all duration-200 ${
              activeFilter === 'in-progress' ? 'ring-2 ring-black bg-gray-50' : ''
            }`}
            onClick={() => handleFilterClick('in-progress')}
          >
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{stats.inProgressReports}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>In Progress Reports</div>
          </div>
          <div 
            className={`card cursor-pointer transition-all duration-200 ${
              activeFilter === 'resolved' ? 'ring-2 ring-black bg-gray-50' : ''
            }`}
            onClick={() => handleFilterClick('resolved')}
          >
            <div className="text-3xl font-bold text-black mb-2" style={{ 
              fontSize: '3rem', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.025em'
            }}>{stats.resolvedReports}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ 
              fontSize: '0.95rem', 
              fontWeight: '700', 
              color: '#64748b', 
              letterSpacing: '0.05em'
            }}>Resolved Reports</div>
          </div>
        </div>
      </section>

      {/* Immediate Severity Reports Section */}
      {filteredImmediateSeverity.length > 0 && (
        <section className="reports-section immediate-severity-section">
          <div className="reports-section-header immediate-header">
            <div>
              <h2 className="reports-section-title">Immediate Severity Reports</h2>
            </div>
          </div>
          <div className="reports-table-container">
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead className="reports-table-header">
                  <tr>
                    <th className="table-header">Type</th>
                    <th className="table-header">Description</th>
                    <th className="table-header">Location</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="reports-table-body">
                  {currentImmediateSubmissions.length === 0 && !loading ? (
                    <tr>
                      <td colSpan="6" className="table-empty-state">
                        No immediate severity reports found
                      </td>
                    </tr>
                  ) : (
                    currentImmediateSubmissions.map((submission) => (
                      <tr key={submission.id} className="report-row">
                        <td className="table-cell table-cell-type">{submission.type}</td>
                        <td className="table-cell table-cell-description">{truncateDescription(submission.description)}</td>
                        <td className="table-cell table-cell-location">{submission.location}</td>
                        <td className="table-cell table-cell-date">{formatDate(submission.date)}</td>
                        <td className="table-cell table-cell-status">
                          <StatusTag status={submission.status} />
                        </td>
                        <td className="table-cell table-cell-actions">
                          <div className="action-buttons">
                            <button 
                              className="action-btn action-btn-view" 
                              onClick={() => navigate(`/report/${submission.id}`)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              View
                            </button>
                            <button 
                              className="action-btn action-btn-update"
                              onClick={() => handleUpdateStatus(submission)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Update
                            </button>
                            <button 
                              className="action-btn action-btn-call"
                              onClick={() => handleCallClick(submission)}
                              disabled={callLoading}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
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
          </div>
          {filteredImmediateSeverity.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button 
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageImmediate === 1}
                onClick={() => setCurrentPageImmediate(currentPageImmediate - 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15,18 9,12 15,6"></polyline>
                </svg>
              </button>
              <span className="text-sm text-gray-600 font-medium">
                Page {currentPageImmediate} of {totalImmediatePages}
              </span>
              <button 
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageImmediate === totalImmediatePages}
                onClick={() => setCurrentPageImmediate(currentPageImmediate + 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
              </button>
            </div>
          )}
        </section>
      )}

      {/* High Severity Reports Section */}
      {filteredHighSeverity.length > 0 && (
        <section className="reports-section high-severity-section">
          <div className="reports-section-header high-header">
            <div>
              <h2 className="reports-section-title">High Severity Reports</h2>
            </div>
          </div>
          <div className="reports-table-container">
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead className="reports-table-header">
                  <tr>
                    <th className="table-header">Type</th>
                    <th className="table-header">Description</th>
                    <th className="table-header">Location</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="reports-table-body">
                  {currentHighSubmissions.length === 0 && !loading ? (
                    <tr>
                      <td colSpan="6" className="table-empty-state">
                        No high severity reports found
                      </td>
                    </tr>
                  ) : (
                    currentHighSubmissions.map((submission) => (
                      <tr key={submission.id} className="report-row">
                        <td className="table-cell table-cell-type">{submission.type}</td>
                        <td className="table-cell table-cell-description">{truncateDescription(submission.description)}</td>
                        <td className="table-cell table-cell-location">{submission.location}</td>
                        <td className="table-cell table-cell-date">{formatDate(submission.date)}</td>
                        <td className="table-cell table-cell-status">
                          <StatusTag status={submission.status} />
                        </td>
                        <td className="table-cell table-cell-actions">
                          <div className="action-buttons">
                            <button 
                              className="action-btn action-btn-view" 
                              onClick={() => navigate(`/report/${submission.id}`)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              View
                            </button>
                            <button 
                              className="action-btn action-btn-update"
                              onClick={() => handleUpdateStatus(submission)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Update
                            </button>
                            <button 
                              className="action-btn action-btn-call"
                              onClick={() => handleCallClick(submission)}
                              disabled={callLoading}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
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
          </div>
          {filteredHighSeverity.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button 
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageHigh === 1}
                onClick={() => setCurrentPageHigh(currentPageHigh - 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15,18 9,12 15,6"></polyline>
                </svg>
              </button>
              <span className="text-sm text-gray-600 font-medium">
                Page {currentPageHigh} of {totalHighPages}
              </span>
              <button 
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageHigh === totalHighPages}
                onClick={() => setCurrentPageHigh(currentPageHigh + 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
              </button>
            </div>
          )}
        </section>
      )}

      {/* Moderate Severity Reports Section */}
      {filteredModerateSeverity.length > 0 && (
        <section className="reports-section moderate-severity-section">
          <div className="reports-section-header moderate-header">
            <div>
              <h2 className="reports-section-title">Moderate Severity Reports</h2>
            </div>
          </div>
          <div className="reports-table-container">
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead className="reports-table-header">
                  <tr>
                    <th className="table-header">Type</th>
                    <th className="table-header">Description</th>
                    <th className="table-header">Location</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="reports-table-body">
                {currentModerateSubmissions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan="6" className="table-empty-state">
                      No moderate severity reports found
                    </td>
                  </tr>
                ) : (
                  currentModerateSubmissions.map((submission) => (
                    <tr key={submission.id} className={`report-row ${submission.type.toLowerCase() === 'emergency sos' ? 'sos-row' : ''}`}>
                      <td className="table-cell table-cell-type">{submission.type}</td>
                      <td className="table-cell table-cell-description">{submission.description}</td>
                      <td className="table-cell table-cell-location">{submission.location}</td>
                      <td className="table-cell table-cell-date">{formatDate(submission.date)}</td>
                      <td className="table-cell table-cell-status">
                        <span className={`status-badge status-${submission.status.toLowerCase().replace(' ', '-')}`}>
                          {formatStatus(submission.status)}
                        </span>
                      </td>
                      <td className="table-cell table-cell-actions">
                        <div className="action-buttons">
                          <button 
                            className="action-btn action-btn-view" 
                            onClick={() => navigate(`/report/${submission.id}`)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                            View
                          </button>
                          <button 
                            className="action-btn action-btn-update"
                            onClick={() => handleUpdateStatus(submission)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Update
                          </button>
                          <button 
                            className="action-btn action-btn-call"
                            onClick={() => handleCallClick(submission)}
                            disabled={callLoading}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
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
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageModerate === 1}
                onClick={() => setCurrentPageModerate(currentPageModerate - 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15,18 9,12 15,6"></polyline>
                </svg>
              </button>
              <span className="pagination-info">
                Page {currentPageModerate} of {totalModeratePages}
              </span>
              <button 
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageModerate === totalModeratePages}
                onClick={() => setCurrentPageModerate(currentPageModerate + 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
              </button>
            </div>
          )}
          </div>
        </section>
      )}

      {/* Low Severity Reports Section */}
      {filteredLowSeverity.length > 0 && (
        <section className="reports-section low-severity-section">
          <div className="reports-section-header low-header">
            <div>
              <h2 className="reports-section-title">Low Severity Reports</h2>
            </div>
          </div>
          <div className="reports-table-container">
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead className="reports-table-header">
                  <tr>
                    <th className="table-header">Type</th>
                    <th className="table-header">Description</th>
                    <th className="table-header">Location</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="reports-table-body">
                {currentLowSubmissions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan="6" className="table-empty-state">
                      No low severity reports found
                    </td>
                  </tr>
                ) : (
                  currentLowSubmissions.map((submission) => (
                    <tr key={submission.id} className={`report-row ${submission.type.toLowerCase() === 'emergency sos' ? 'sos-row' : ''}`}>
                      <td className="table-cell table-cell-type">{submission.type}</td>
                      <td className="table-cell table-cell-description">{submission.description}</td>
                      <td className="table-cell table-cell-location">{submission.location}</td>
                      <td className="table-cell table-cell-date">{formatDate(submission.date)}</td>
                      <td className="table-cell table-cell-status">
                        <span className={`status-badge status-${submission.status.toLowerCase().replace(' ', '-')}`}>
                          {formatStatus(submission.status)}
                        </span>
                      </td>
                      <td className="table-cell table-cell-actions">
                        <div className="action-buttons">
                          <button 
                            className="action-btn action-btn-view" 
                            onClick={() => navigate(`/report/${submission.id}`)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                            View
                          </button>
                          <button 
                            className="action-btn action-btn-update"
                            onClick={() => handleUpdateStatus(submission)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Update
                          </button>
                          <button 
                            className="action-btn action-btn-call"
                            onClick={() => handleCallClick(submission)}
                            disabled={callLoading}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
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
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageLow === 1}
                onClick={() => setCurrentPageLow(currentPageLow - 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15,18 9,12 15,6"></polyline>
                </svg>
              </button>
              <span className="pagination-info">
                Page {currentPageLow} of {totalLowPages}
              </span>
              <button 
                className="pagination-btn-black disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPageLow === totalLowPages}
                onClick={() => setCurrentPageLow(currentPageLow + 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
              </button>
            </div>
          )}
          </div>
        </section>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-lg">
            <h3 className="text-xl font-bold text-black mb-4">Update Report Status</h3>
            <div className="space-y-3 mb-6">
              <p><strong className="text-gray-700">Report ID:</strong> {selectedReport?.reportId}</p>
              <p><strong className="text-gray-700">Current Status:</strong> {selectedReport?.status}</p>
            </div>
            
            <div className="space-y-3 mb-6">
              <button 
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  selectedReport?.status === 'Received' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => updateReportStatus('Received')}
                disabled={updating}
              >
                Received
              </button>
              <button 
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  selectedReport?.status === 'In Progress' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => updateReportStatus('In Progress')}
                disabled={updating}
              >
                In Progress
              </button>
              <button 
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  ['Resolved','Case Resolved'].includes(selectedReport?.status) 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => updateReportStatus('Case Resolved')}
                disabled={updating}
              >
                Case Resolved
              </button>
            </div>
            
            <div className="flex gap-3">
              <button 
                className="btn-secondary flex-1"
                onClick={() => {
                  setShowUpdateModal(false);
                  setSelectedReport(null);
                }}
                disabled={updating}
              >
                Cancel
              </button>
            </div>
            
            {updating && (
              <div className="mt-4 text-center text-gray-600">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  Updating status...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WebRTC Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-black">VoIP Call</h3>
              <button 
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                onClick={endCall}
              >
                ×
              </button>
            </div>
            
            {callError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-sm">{callError}</p>
              </div>
            )}
            
            {callState.targetUser && (
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-black mb-2">Internet Call to Mobile App</h4>
                <p className="text-gray-900 font-medium mb-1">{callState.targetUser.name}</p>
                <p className="text-sm text-gray-600 mb-2">
                  {callState.targetUser.isOnline ? 
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      Online
                    </span> : 
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                      Offline
                    </span>
                  }
                </p>
                <p className="text-xs text-gray-500">Calling via E-Responde Mobile App</p>
              </div>
            )}
            
            <div className="text-center mb-6">
              {callState.isCalling && !callState.isInCall && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600">Connecting...</p>
                </div>
              )}
              
              {callState.isInCall && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium">Call Connected</p>
                  <div className="flex gap-3">
                    <button 
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        isMuted 
                          ? 'bg-gray-200 text-gray-700' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={toggleMute}
                    >
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>
                    <button 
                      className="bg-status-danger text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-all duration-200"
                      onClick={endCall}
                    >
                      End Call
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              {!callState.isInCall && !callState.isCalling && (
                <button 
                  className="btn-primary flex-1"
                  onClick={async () => {
                    const db = getDatabase(app);
                    const adminRef = ref(db, 'admin_dashboard_account');
                    const adminSnapshot = await get(adminRef);
                    const adminData = adminSnapshot.exists() ? adminSnapshot.val() : null;
                    await initializeInternetCall(callState.targetUser, { id: callState.callId, type: 'Emergency' }, adminData);
                  }}
                >
                  Start Internet Call
                </button>
              )}
              <button 
                className="btn-secondary flex-1"
                onClick={endCall}
              >
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




