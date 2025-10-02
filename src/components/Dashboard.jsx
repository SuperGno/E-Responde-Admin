import { useState, useEffect } from 'react'
import { getDatabase, ref, get, update } from 'firebase/database'
import { app } from '../firebase'
import './Dashboard.css'

function Dashboard({ onNavigateToReport }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    activeIncidents: 0,
    pendingReports: 0,
    resolvedReports: 0,
    registeredUsers: 0
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [updating, setUpdating] = useState(false);
  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(recentSubmissions.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSubmissions = recentSubmissions.slice(startIndex, endIndex);

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

  // Fetch crime reports and statistics from Firebase Realtime Database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('Fetching data...');
        const db = getDatabase(app);
        
        // Fetch crime reports
        const reportsRef = ref(db, 'civilian/civilian crime reports');
        console.log('Attempting to fetch reports from:', reportsRef.toString());
        const reportsSnapshot = await get(reportsRef);
        console.log('Reports snapshot result:', reportsSnapshot.exists());
        
        // Fetch registered users
        const usersRef = ref(db, 'civilian/civilian account');
        console.log('Attempting to fetch users from:', usersRef.toString());
        const usersSnapshot = await get(usersRef);
        console.log('Users snapshot result:', usersSnapshot.exists());
        
        let reportsArray = [];
        let userCount = 0;
        
        if (reportsSnapshot.exists()) {
          const reportsData = reportsSnapshot.val();
          reportsArray = Object.keys(reportsData).map(key => ({
            id: key,
            type: reportsData[key].crimeType || 'Unknown',
            description: reportsData[key].description || 'No description',
            location: reportsData[key].location?.address || 'No location',
            date: reportsData[key].dateTime || reportsData[key].createdAt,
            status: reportsData[key].status || 'pending',
            reportId: reportsData[key].reportId || key
          }));
          
          // Sort by date (newest first)
          reportsArray.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        if (usersSnapshot.exists()) {
          const usersData = usersSnapshot.val();
          userCount = Object.keys(usersData).length;
        }
        
        // Calculate statistics
        const pendingCount = reportsArray.filter(report => 
          report.status.toLowerCase() === 'pending' || 
          report.status.toLowerCase() === 'under review' ||
          report.status.toLowerCase() === 'received' ||
          report.status.toLowerCase() === 'in progress'
        ).length;
        
        const resolvedCount = reportsArray.filter(report => 
          report.status.toLowerCase() === 'resolved'
        ).length;
        
        setStats({
          activeIncidents: reportsArray.length,
          pendingReports: pendingCount,
          resolvedReports: resolvedCount,
          registeredUsers: userCount
        });
        
        setRecentSubmissions(reportsArray);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(`Failed to load data: ${err.message}`);
        setRecentSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
      
      // Refresh data after update
      const fetchData = async () => {
        try {
          const db = getDatabase(app);
          
          // Fetch crime reports
          const reportsRef = ref(db, 'civilian/civilian crime reports');
          const reportsSnapshot = await get(reportsRef);
          
          // Fetch registered users
          const usersRef = ref(db, 'civilian/civilian account');
          const usersSnapshot = await get(usersRef);
          
          let reportsArray = [];
          let userCount = 0;
          
          if (reportsSnapshot.exists()) {
            const reportsData = reportsSnapshot.val();
            reportsArray = Object.keys(reportsData).map(key => ({
              id: key,
              type: reportsData[key].crimeType || 'Unknown',
              description: reportsData[key].description || 'No description',
              location: reportsData[key].location?.address || 'No location',
              date: reportsData[key].dateTime || reportsData[key].createdAt,
              status: reportsData[key].status || 'pending',
              reportId: reportsData[key].reportId || key
            }));
            
            // Sort by date (newest first)
            reportsArray.sort((a, b) => new Date(b.date) - new Date(a.date));
          }
          
          if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            userCount = Object.keys(usersData).length;
          }
          
          // Calculate statistics
          const pendingCount = reportsArray.filter(report => 
            report.status.toLowerCase() === 'pending' || 
            report.status.toLowerCase() === 'under review' ||
            report.status.toLowerCase() === 'received' ||
            report.status.toLowerCase() === 'in progress'
          ).length;
          
          const resolvedCount = reportsArray.filter(report => 
            report.status.toLowerCase() === 'resolved'
          ).length;
          
          setStats({
            activeIncidents: reportsArray.length,
            pendingReports: pendingCount,
            resolvedReports: resolvedCount,
            registeredUsers: userCount
          });
          
          setRecentSubmissions(reportsArray);
        } catch (err) {
          console.error('Error refreshing data:', err);
        }
      };
      
      await fetchData();
      
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
      <h1>Police Dashboard</h1>
      <section className="dashboard-section">
        <h2>Report Overview</h2>
        <div className="dashboard-grid">
          <div className="card">
            <h3>Active Incidents</h3>
            <p className="stat">{stats.activeIncidents}</p>
          </div>
          <div className="card">
            <h3>Pending Reports</h3>
            <p className="stat">{stats.pendingReports}</p>
          </div>
          <div className="card">
            <h3>Resolved Reports</h3>
            <p className="stat">{stats.resolvedReports}</p>
          </div>
          <div className="card">
            <h3>Registered Users</h3>
            <p className="stat">{stats.registeredUsers}</p>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Recent Submissions</h2>
        {loading && <p>Loading crime reports...</p>}
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
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
              {currentSubmissions.length === 0 && !loading ? (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                    No crime reports found
                  </td>
                </tr>
              ) : (
                currentSubmissions.map((submission) => (
                  <tr key={submission.id}>
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
        <div className="pagination">
          <button 
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </section>

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




