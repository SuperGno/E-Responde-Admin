import { useState } from 'react'
import { dispatchUnit, predictSeverity } from '../services/aiDispatch'

function ViewReport() {
  const reportData = {
    reportId: "RPT-2024-001",
    type: "Theft",
    dateReported: "2024-01-15",
    location: "123 Main St, Downtown, City",
    reportedBy: {
      name: "John Smith",
      phone: "+1 (555) 123-4567",
      email: "john.smith@email.com"
    },
    description: "Vehicle break-in reported in downtown area. The suspect broke into a parked car and stole personal belongings including a laptop and wallet. The incident occurred between 2:00 AM and 4:00 AM. Security camera footage shows a male suspect wearing dark clothing.",
    status: "Under Review"
  };

  const [dispatchResult, setDispatchResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDispatch = async () => {
    setIsLoading(true)
    setError('')
    setDispatchResult(null)
    try {
      const inferred = await predictSeverity(reportData.type)
      // sample coordinates for demo; replace with actual report coords
      const latitude = 14.5995
      const longitude = 120.9842
      const res = await dispatchUnit({
        crimeType: reportData.type,
        latitude,
        longitude,
        severity: inferred?.severity
      })
      setDispatchResult(res)
    } catch (e) {
      setError(e.message || 'Dispatch failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="report-header">
        <h1>View Report</h1>
        <div className="report-id">Report ID: {reportData.reportId}</div>
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
            <div className="map-placeholder">
              <div className="map-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <p>Map showing report location</p>
                <small>123 Main St, Downtown, City</small>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h2>Evidence Photos</h2>
            <div className="evidence-grid">
              <div className="evidence-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21,15 16,10 5,21"></polyline>
                </svg>
                <span>Photo 1</span>
              </div>
              <div className="evidence-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21,15 16,10 5,21"></polyline>
                </svg>
                <span>Photo 2</span>
              </div>
              <div className="evidence-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21,15 16,10 5,21"></polyline>
                </svg>
                <span>Photo 3</span>
              </div>
            </div>
          </div>

          <div className="report-actions">
            <button className="btn-cancel">Cancel</button>
            <button className="btn-update-report" onClick={handleDispatch} disabled={isLoading}>
              {isLoading ? 'Dispatching…' : 'AI Dispatch Unit'}
            </button>
          </div>
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
          <div className="recommendations-list">
            <div className="recommendation-card">
              <div className="recommendation-header">
                <span className="recommendation-type">Priority</span>
                <span className="recommendation-score">95%</span>
              </div>
              <h3>Immediate Response Required</h3>
              <p>This theft incident involves personal property and should be prioritized for immediate investigation. Recommend dispatching patrol unit within 30 minutes.</p>
            </div>
            
            <div className="recommendation-card">
              <div className="recommendation-header">
                <span className="recommendation-type">Investigation</span>
                <span className="recommendation-score">87%</span>
              </div>
              <h3>Evidence Collection Strategy</h3>
              <p>Security camera footage mentioned in description. Recommend collecting and analyzing CCTV recordings from nearby businesses for suspect identification.</p>
            </div>
            
            <div className="recommendation-card">
              <div className="recommendation-header">
                <span className="recommendation-type">Follow-up</span>
                <span className="recommendation-score">78%</span>
              </div>
              <h3>Witness Interview Protocol</h3>
              <p>Contact the reporting individual for additional details about the stolen items and any suspicious activity noticed before the incident.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewReport



