function Analytics() {
  return (
    <div className="page-content">
      <h1>Analytics</h1>
      <div className="analytics-content">
        <div className="chart-placeholder">
          <h3>User Engagement Chart</h3>
          <div className="chart">
            <div className="bar" style={{ height: '60%' }}></div>
            <div className="bar" style={{ height: '80%' }}></div>
            <div className="bar" style={{ height: '45%' }}></div>
            <div className="bar" style={{ height: '90%' }}></div>
            <div className="bar" style={{ height: '70%' }}></div>
            <div className="bar" style={{ height: '85%' }}></div>
            <div className="bar" style={{ height: '55%' }}></div>
          </div>
        </div>
        <div className="metrics">
          <div className="metric-card">
            <h4>Page Views</h4>
            <p>12,345</p>
          </div>
          <div className="metric-card">
            <h4>Bounce Rate</h4>
            <p>23.4%</p>
          </div>
          <div className="metric-card">
            <h4>Session Duration</h4>
            <p>4m 32s</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics




