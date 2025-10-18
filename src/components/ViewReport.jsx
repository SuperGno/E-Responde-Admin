import { useState, useEffect } from 'react'
import { getDatabase, ref, get } from 'firebase/database'
import { ref as storageRef, getDownloadURL } from 'firebase/storage'
import { app, storage } from '../firebase'
import './ViewReport.css'

function ViewReport({ reportId }) {
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dispatchResult] = useState(null)
  const [aiRecommendations, setAiRecommendations] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Generate AI recommendations using Gemini API
  const generateAIRecommendations = async (crimeType, description) => {
    try {
      setAiLoading(true)
      
      // Enhanced prompt that analyzes both crime type and description
      const prompt = `As an emergency response AI assistant, analyze this crime report in detail and provide 3 specific recommendations for the admin:

CRIME TYPE: ${crimeType}
INCIDENT DESCRIPTION: ${description}

Please analyze the description carefully and consider:
- Severity and urgency of the incident
- Specific details mentioned (weapons, injuries, suspects, etc.)
- Location context and potential risks
- Evidence mentioned or available
- Witnesses or victims involved

Provide exactly 3 recommendations in this JSON format:
{
  "recommendations": [
    {
      "type": "Priority",
      "score": 85,
      "title": "Specific Priority Action",
      "description": "Detailed recommendation based on the specific incident details and urgency level"
    },
    {
      "type": "Investigation", 
      "score": 75,
      "title": "Investigation Strategy",
      "description": "Specific investigation steps based on the evidence and details mentioned in the description"
    },
    {
      "type": "Follow-up",
      "score": 65,
      "title": "Follow-up Protocol", 
      "description": "Follow-up actions tailored to the specific incident and parties involved"
    }
  ]
}

Focus on practical admin actions that address the specific details mentioned in the description.`

      console.log('Sending AI request with prompt:', prompt)
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyC9EZicsv9_W5JVVgHisolse3bXIn5OPf4`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      })

      console.log('AI API Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI API Error Response:', errorText)
        throw new Error(`AI API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('AI API Response data:', data)
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiResponse = data.candidates[0].content.parts[0].text
        console.log('AI Response text:', aiResponse)
        
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const recommendations = JSON.parse(jsonMatch[0])
          console.log('Parsed recommendations:', recommendations)
          setAiRecommendations(recommendations.recommendations)
        } else {
          console.error('No JSON found in AI response:', aiResponse)
          throw new Error('Invalid AI response format - no JSON found')
        }
      } else {
        console.error('Invalid AI response structure:', data)
        throw new Error('No valid response from AI - invalid structure')
      }
    } catch (error) {
      console.error('Error generating AI recommendations:', error)
      
      // Enhanced fallback that analyzes description content
      console.log('Using fallback recommendations due to API error')
      
      // Analyze description for key details
      const descriptionLower = description.toLowerCase()
      const hasWeapon = descriptionLower.includes('weapon') || descriptionLower.includes('gun') || descriptionLower.includes('knife') || descriptionLower.includes('bat') || descriptionLower.includes('blade')
      const hasInjury = descriptionLower.includes('injured') || descriptionLower.includes('hurt') || descriptionLower.includes('wound') || descriptionLower.includes('bleeding') || descriptionLower.includes('hospital')
      const hasSuspect = descriptionLower.includes('suspect') || descriptionLower.includes('person') || descriptionLower.includes('man') || descriptionLower.includes('woman') || descriptionLower.includes('individual')
      const hasVictim = descriptionLower.includes('victim') || descriptionLower.includes('child') || descriptionLower.includes('kid') || descriptionLower.includes('person')
      const isUrgent = hasWeapon || hasInjury || descriptionLower.includes('emergency') || descriptionLower.includes('urgent')
      
      // Generate description-aware recommendations
      const priorityScore = isUrgent ? 95 : 85
      const investigationScore = hasSuspect ? 90 : 75
      const followupScore = hasVictim ? 85 : 70
      
      setAiRecommendations([
        {
          type: "Priority",
          score: priorityScore,
          title: isUrgent ? "High Priority Response Required" : "Standard Response Required",
          description: `Based on the ${crimeType} incident${hasWeapon ? ' involving weapons' : ''}${hasInjury ? ' with reported injuries' : ''}, ${isUrgent ? 'dispatch emergency units immediately' : 'dispatch appropriate units'} and secure the scene.`
        },
        {
          type: "Investigation",
          score: investigationScore,
          title: hasSuspect ? "Suspect Investigation Priority" : "Evidence Collection",
          description: `${hasSuspect ? 'Focus on suspect identification and apprehension. ' : ''}Gather evidence related to the ${crimeType} incident${hasVictim ? ' and ensure victim safety' : ''}. Interview witnesses and document all findings.`
        },
        {
          type: "Follow-up",
          score: followupScore,
          title: hasVictim ? "Victim Support & Documentation" : "Administrative Review",
          description: `${hasVictim ? 'Provide victim support services and ensure proper medical attention if needed. ' : ''}Complete comprehensive documentation of the ${crimeType} incident and follow up with the reporting individual.`
        }
      ])
    } finally {
      setAiLoading(false)
    }
  }

  // Fetch report data from Firebase
  useEffect(() => {
    const fetchReportData = async () => {
      if (!reportId) {
        setError('No report ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const db = getDatabase(app)
        const reportRef = ref(db, `civilian/civilian crime reports/${reportId}`)
        const snapshot = await get(reportRef)
        
        if (snapshot.exists()) {
          const data = snapshot.val()
          
          // Fetch reporter information from civilian account
          let reporterInfo = {
            name: 'Anonymous',
            phone: 'Not provided',
            email: 'Not provided'
          }
          
          if (data.reporterUid) {
            try {
              const reporterRef = ref(db, `civilian/civilian account/${data.reporterUid}`)
              const reporterSnapshot = await get(reporterRef)
              
              if (reporterSnapshot.exists()) {
                const reporterData = reporterSnapshot.val()
                reporterInfo = {
                  name: `${reporterData.firstName || ''} ${reporterData.lastName || ''}`.trim() || 'Anonymous',
                  phone: reporterData.contactNumber || 'Not provided',
                  email: reporterData.email || 'Not provided'
                }
              }
            } catch (reporterErr) {
              console.error('Error fetching reporter info:', reporterErr)
              // Keep default values if reporter fetch fails
            }
          }
          
          // Debug multimedia data
          console.log('Raw multimedia data:', data.multimedia)
          console.log('Multimedia type:', typeof data.multimedia)
          console.log('Multimedia length:', data.multimedia ? data.multimedia.length : 'null/undefined')
          if (data.multimedia && data.multimedia.length > 0) {
            data.multimedia.forEach((media, index) => {
              console.log(`Media ${index}:`, {
                value: media,
                type: typeof media,
                startsWithData: media.startsWith('data:image/'),
                includesFirebase: media.includes('firebase'),
                includesHttp: media.includes('http'),
                includesFile: media.includes('file://'),
                includesRnPicker: media.includes('rn_image_picker'),
                isBase64: media.startsWith('data:image/'),
                length: media.length,
                preview: media.substring(0, 100) + '...'
              });
            });
          }
          
          setReportData({
            reportId: data.reportId || reportId,
            type: data.crimeType || 'Unknown',
            dateReported: data.dateTime || data.createdAt,
            location: data.location?.address || 'No location provided',
            coordinates: {
              latitude: data.location?.latitude || null,
              longitude: data.location?.longitude || null
            },
            reportedBy: reporterInfo,
            description: data.description || 'No description provided',
            status: data.status || 'Unknown',
            multimedia: data.multimedia || []
          })

          // Generate AI recommendations based on crime type and description
          const crimeType = data.crimeType || 'Unknown'
          const description = data.description || 'No description provided'
          generateAIRecommendations(crimeType, description)
        } else {
          setError('Report not found')
        }
      } catch (err) {
        console.error('Error fetching report:', err)
        setError('Failed to load report data')
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [reportId])

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to attempt to convert mobile file paths to accessible URLs
  const tryConvertMobileFileToUrl = async (filePath) => {
    try {
      console.log(`Starting Firebase Storage lookup for: ${filePath}`);
      
      // Extract filename from the path
      const filename = filePath.split('/').pop();
      console.log(`Extracted filename: ${filename}`);
      
      // Try to construct a potential Firebase Storage path
      // This assumes the mobile app might have uploaded to a specific path
      const potentialPaths = [
        `civilian crime reports/multimedia/${reportId}/${filename}`,
        `civilian/civilian crime reports/${reportId}/multimedia/${filename}`,
        `crime-reports/${reportId}/${filename}`,
        `multimedia/${reportId}/${filename}`,
        `evidence/${reportId}/${filename}`,
        `images/${reportId}/${filename}`,
        `uploads/${reportId}/${filename}`,
        filename // Just the filename
      ];
      
      console.log(`Will try ${potentialPaths.length} potential paths`);
      
      // Try each potential path with timeout
      for (let i = 0; i < potentialPaths.length; i++) {
        const path = potentialPaths[i];
        try {
          console.log(`[${i + 1}/${potentialPaths.length}] Trying Firebase Storage path: ${path}`);
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );
          
          const imageRef = storageRef(storage, path);
          const urlPromise = getDownloadURL(imageRef);
          
          const url = await Promise.race([urlPromise, timeoutPromise]);
          console.log(`Found image at path: ${path}`);
          return url;
        } catch (err) {
          console.log(`[${i + 1}/${potentialPaths.length}] Failed to find image at path: ${path}`, err.message);
          // Continue to next path
          continue;
        }
      }
      
      console.log(`🚫 No image found in Firebase Storage after trying ${potentialPaths.length} paths`);
      return null; // No accessible URL found
    } catch (error) {
      console.error('💥 Error trying to convert mobile file:', error);
      return null;
    }
  };

  // Component to handle mobile file paths with Firebase Storage lookup
  const MobileFileComponent = ({ media, index, reportId }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      const attemptImageConversion = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Add overall timeout to prevent infinite loading (reduced to 10 seconds)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Image not uploaded to Firebase Storage')), 10000)
          );
          
          const conversionPromise = tryConvertMobileFileToUrl(media);
          const url = await Promise.race([conversionPromise, timeoutPromise]);
          
          if (url) {
            setImageUrl(url);
          } else {
            setError('Image not found in Firebase Storage');
          }
        } catch (err) {
          setError('Mobile app image not uploaded to cloud storage');
          console.error('Mobile file conversion error:', err);
        } finally {
          setIsLoading(false);
        }
      };

      attemptImageConversion();
    }, [media, reportId]);

    if (isLoading) {
      return (
        <div className="evidence-placeholder mobile-file loading">
          <div className="loading-spinner"></div>
          <span>Photo {index + 1}</span>
          <small>Checking Firebase Storage...</small>
        </div>
      );
    }

    if (imageUrl) {
      return (
        <div className="evidence-photo">
          <img 
            src={imageUrl} 
            alt={`Evidence photo ${index + 1}`}
            onError={(e) => {
              console.error('Converted image load error:', e.target.src);
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
            onLoad={() => {
              console.log(`Converted mobile image ${index + 1} loaded successfully`);
            }}
          />
          <div className="evidence-placeholder" style={{ display: 'none' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21,15 16,10 5,21"></polyline>
            </svg>
            <span>Photo {index + 1}</span>
            <small>Failed to load</small>
          </div>
        </div>
      );
    }

    return (
      <div className="evidence-placeholder mobile-file">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21,15 16,10 5,21"></polyline>
        </svg>
        <span>Photo {index + 1}</span>
        <small>Mobile App Image</small>
        <div className="file-info">
          <small>File: {media.split('/').pop()}</small>
          <div className="file-note">
            <small>Mobile: {error || 'This image was captured on a mobile device and is not accessible from the web interface.'}</small>
            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#6b7280' }}>
              <strong>Note:</strong> The mobile app captured this image but didn't upload it to cloud storage. 
              To view the image, check the mobile device or contact the reporter.
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to determine image type and handle display
  const getImageDisplayComponent = (media, index) => {
    console.log(`Processing media ${index}:`, media);
    console.log(`Media length: ${media.length}, starts with data: ${media.startsWith('data:image/')}`);
    
    // Check for base64 data URLs (including those stored in Realtime Database)
    if (media.startsWith('data:image/')) {
      console.log(`Detected base64 image for photo ${index + 1}`);
      return (
        <div className="evidence-photo">
          <img 
            src={media} 
            alt={`Evidence photo ${index + 1}`}
            onError={(e) => {
              console.error('Base64 image load error:', e.target.src.substring(0, 50) + '...');
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
            onLoad={() => {
              console.log(`Base64 image ${index + 1} loaded successfully from Realtime Database`);
            }}
          />
          <div className="evidence-placeholder" style={{ display: 'none' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21,15 16,10 5,21"></polyline>
            </svg>
            <span>Photo {index + 1}</span>
            <small>Failed to load</small>
          </div>
        </div>
      );
    }
    
    // Check for Firebase Storage or HTTP URLs
    if (media.includes('firebase') || media.includes('http://') || media.includes('https://')) {
      return (
        <div className="evidence-photo">
          <img 
            src={media} 
            alt={`Evidence photo ${index + 1}`}
            onError={(e) => {
              console.error('URL image load error:', e.target.src);
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
            onLoad={() => {
              console.log(`URL image ${index + 1} loaded successfully`);
            }}
          />
          <div className="evidence-placeholder" style={{ display: 'none' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21,15 16,10 5,21"></polyline>
            </svg>
            <span>Photo {index + 1}</span>
            <small>Failed to load</small>
          </div>
        </div>
      );
    }
    
    // Check for mobile app file paths
    if (media.includes('file://') || media.includes('rn_image_picker') || media.includes('content://')) {
      return <MobileFileComponent media={media} index={index} reportId={reportId} />;
    }
    
    // Unknown format
    return (
      <div className="evidence-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21,15 16,10 5,21"></polyline>
        </svg>
        <span>Photo {index + 1}</span>
        <small>Unknown format</small>
        <div className="file-info">
          <small>{media.substring(0, 50)}...</small>
        </div>
      </div>
    );
  };

  // AI dispatch removed; no action buttons rendered.

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>Loading report...</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-content">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>Error</h2>
          <p style={{ color: 'red' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="page-content">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>No report data available</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="report-header">
        <h1>View Report</h1>
      </div>
      
      <div className="report-layout">
        <div className="report-main">
          <div className="report-section">
            <h2>Report Details</h2>
            <div className="report-grid">
              <div className="detail-item">
                <label>Type:</label>
                <span>{reportData.type}</span>
              </div>
              <div className="detail-item">
                <label>Date Reported:</label>
                <span>{formatDate(reportData.dateReported)}</span>
              </div>
              <div className="detail-item">
                <label>Location:</label>
                <span>{reportData.location}</span>
              </div>
              <div className="detail-item">
                <label>Status:</label>
                <span className="status-badge status-pending">{reportData.status}</span>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h2>Reported By</h2>
            <div className="reporter-info">
              <div className="detail-item">
                <label>Name:</label>
                <span>{reportData.reportedBy.name}</span>
              </div>
              <div className="detail-item">
                <label>Phone:</label>
                <span>{reportData.reportedBy.phone}</span>
              </div>
              <div className="detail-item">
                <label>Email:</label>
                <span>{reportData.reportedBy.email}</span>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h2>Description</h2>
            <div className="description-content">
              <p>{reportData.description}</p>
            </div>
          </div>

          <div className="report-section">
            <h2>Location Map</h2>
            <div className="map-container">
              {reportData.coordinates.latitude && reportData.coordinates.longitude ? (
                <div className="map-content">
                  <iframe
                    width="100%"
                    height="300"
                    style={{ border: 0, borderRadius: '8px' }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${reportData.coordinates.longitude-0.01},${reportData.coordinates.latitude-0.01},${reportData.coordinates.longitude+0.01},${reportData.coordinates.latitude+0.01}&layer=mapnik&marker=${reportData.coordinates.latitude},${reportData.coordinates.longitude}`}
                    allowFullScreen
                    title="Report Location Map"
                  ></iframe>
                  <div className="map-info">
                    <p><strong>Coordinates:</strong> {reportData.coordinates.latitude}, {reportData.coordinates.longitude}</p>
                    <p><strong>Address:</strong> {reportData.location}</p>
                  </div>
                </div>
              ) : (
                <div className="map-placeholder">
                  <div className="map-content">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <p>Location coordinates not available</p>
                    <small>{reportData.location}</small>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="report-section">
            <h2>Evidence Photos</h2>
            {reportData.multimedia && reportData.multimedia.some(media => 
              media.includes('file://') || media.includes('rn_image_picker') || media.includes('content://')
            ) && (
              <div style={{ 
                background: '#fef3c7', 
                border: '1px solid #f59e0b', 
                borderRadius: '8px', 
                padding: '1rem', 
                marginBottom: '1rem',
                color: '#92400e'
              }}>
                <strong>Mobile App Images:</strong> Some images were captured on mobile devices. The system is checking if they are stored as base64 data in the database or need to be retrieved from cloud storage.
              </div>
            )}
            <div className="evidence-grid">
              {reportData.multimedia && reportData.multimedia.length > 0 ? (
                reportData.multimedia.map((media, index) => (
                  <div key={index} className="evidence-item">
                    {getImageDisplayComponent(media, index)}
                  </div>
                ))
              ) : (
                <div className="no-evidence">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21,15 16,10 5,21"></polyline>
                  </svg>
                  <p>No evidence photos available</p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons removed as requested */}
          {error && (
            <div className="report-section" style={{ marginTop: '1rem', borderLeft: '4px solid #ef4444' }}>
              <p style={{ color: '#b91c1c', margin: 0 }}>Error: {error}</p>
            </div>
          )}
          {dispatchResult && (
            <div className="report-section" style={{ marginTop: '1rem', borderLeft: '4px solid #10b981' }}>
              <p style={{ margin: 0 }}>
                Assigned Patrol: {dispatchResult.patrol_id ?? 'None'} | Severity: {dispatchResult.severity}
              </p>
              {dispatchResult.message && <small>{dispatchResult.message}</small>}
            </div>
          )}
        </div>

        <div className="ai-recommendations">
          <h2>AI Response Recommendations</h2>
          {aiLoading ? (
            <div className="recommendations-list">
              <div className="recommendation-card">
                <div className="recommendation-header">
                  <span className="recommendation-type">Loading...</span>
                  <span className="recommendation-score">--%</span>
                </div>
                <h3>Generating AI Analysis...</h3>
                <p>Please wait while AI analyzes the crime report and generates recommendations.</p>
              </div>
            </div>
          ) : aiRecommendations ? (
            <div className="recommendations-list">
              {aiRecommendations.map((rec, index) => (
                <div key={index} className="recommendation-card">
                  <div className="recommendation-header">
                    <span className="recommendation-type">{rec.type}</span>
                    <span className="recommendation-score">{rec.score}%</span>
                  </div>
                  <h3>{rec.title}</h3>
                  <p>{rec.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="recommendations-list">
              <div className="recommendation-card">
                <div className="recommendation-header">
                  <span className="recommendation-type">Error</span>
                  <span className="recommendation-score">--%</span>
                </div>
                <h3>Unable to Generate Recommendations</h3>
                <p>There was an error generating AI recommendations. Please try refreshing the page.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ViewReport



