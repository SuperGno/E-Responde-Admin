import React from 'react'
import './StatusTag.css'

const StatusTag = ({ status, className = '' }) => {
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
  }

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
  }

  return (
    <span className={`status-badge ${getStatusColor(status)} ${className}`}>
      {formatStatus(status)}
    </span>
  )
}

export default StatusTag
