import { useState, useEffect } from 'react'
import { getDatabase, ref, onValue, off, update } from 'firebase/database'
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
              reportId: report.reportId || key
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

  const handleFilterClick = (filterType) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleUpdateStatus = (report) => {
    setSelectedReport(report);
    setShowUpdateModal(true);
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
      <h1>E-Responde Dashboard</h1>
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
    </div>
  )
}

export default Dashboard




