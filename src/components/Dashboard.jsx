import { useState } from 'react'

function Dashboard({ onNavigateToReport }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const recentSubmissions = [
    {
      id: 1,
      type: "Theft",
      description: "Vehicle break-in reported in downtown area",
      location: "123 Main St, Downtown",
      date: "2024-01-15",
      status: "Under Review"
    },
    {
      id: 2,
      type: "Assault",
      description: "Physical altercation at local bar",
      location: "456 Oak Ave, Westside",
      date: "2024-01-14",
      status: "Resolved"
    },
    {
      id: 3,
      type: "Vandalism",
      description: "Graffiti found on public property",
      location: "789 Pine Rd, Eastside",
      date: "2024-01-13",
      status: "Under Review"
    },
    {
      id: 4,
      type: "Traffic Violation",
      description: "Speeding and reckless driving",
      location: "321 Elm St, Northside",
      date: "2024-01-12",
      status: "Resolved"
    },
    {
      id: 5,
      type: "Noise Complaint",
      description: "Excessive noise from residential property",
      location: "654 Maple Dr, Southside",
      date: "2024-01-11",
      status: "Under Review"
    },
    {
      id: 6,
      type: "Suspicious Activity",
      description: "Unusual behavior in neighborhood",
      location: "987 Cedar Ln, Central",
      date: "2024-01-10",
      status: "Resolved"
    }
  ];

  const totalPages = Math.ceil(recentSubmissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSubmissions = recentSubmissions.slice(startIndex, endIndex);

  const getStatusColor = (status) => {
    return status === "Resolved" ? "status-resolved" : "status-pending";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="page-content">
      <h1>Police Dashboard</h1>
      <section className="dashboard-section">
        <h2>Report Overview</h2>
        <div className="dashboard-grid">
          <div className="card">
            <h3>Active Incidents</h3>
            <p className="stat">10</p>
          </div>
          <div className="card">
            <h3>Pending Reports</h3>
            <p className="stat">5</p>
          </div>
          <div className="card">
            <h3>Resolved Reports</h3>
            <p className="stat">25</p>
          </div>
          <div className="card">
            <h3>Registered Users</h3>
            <p className="stat">150</p>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Recent Submissions</h2>
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
              {currentSubmissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{submission.type}</td>
                  <td>{submission.description}</td>
                  <td>{submission.location}</td>
                  <td>{formatDate(submission.date)}</td>
                  <td>
                    <span className={`status-badge ${getStatusColor(submission.status)}`}>
                      {submission.status}
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
                      <button className="btn-update">Update</button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  )
}

export default Dashboard



