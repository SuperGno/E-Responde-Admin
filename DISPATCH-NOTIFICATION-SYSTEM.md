# Dispatch Notification System

## Overview
The dispatch notification system automatically notifies police accounts when they are assigned to respond to crime reports by an admin. This system uses Firebase Realtime Database to store and manage notifications in real-time.

## How It Works

### 1. Admin Dispatches a Unit
When an admin dispatches a police unit to a crime report through the Dispatch component:

1. The crime report status is updated to "Dispatched"
2. Dispatch information is stored in the report
3. A notification is created for the assigned police officer
4. A general notification is also created for tracking purposes

### 2. Notification Structure
Notifications are stored in Firebase Realtime Database under:
```
police/notifications/{policeId}/{notificationId}
```

Each notification contains:
- `id`: Unique notification identifier
- `type`: "dispatch_assignment"
- `title`: "New Dispatch Assignment"
- `message`: Brief description of the assignment
- `reportId`: ID of the crime report
- `reportDetails`: Complete report information
- `dispatchInfo`: Dispatch-specific information
- `createdAt`: Timestamp when notification was created
- `isRead`: Boolean indicating if notification has been read
- `isActive`: Boolean indicating if notification is still active

### 3. Police Officer Receives Notification
Police officers can:
- View all their notifications using the `PoliceNotifications` component
- See real-time updates when new assignments are received
- Mark notifications as read
- View detailed assignment information

## Database Structure

### Crime Reports
```
civilian/civilian crime reports/{reportId}
├── status: "Dispatched"
└── dispatchInfo:
    ├── unit: policeId
    ├── unitName: "Rank FirstName LastName"
    ├── unitEmail: "email@example.com"
    ├── priority: "high|medium|low"
    ├── notes: "Additional instructions"
    ├── estimatedTime: "15 minutes"
    ├── dispatchedAt: "2024-01-01T12:00:00.000Z"
    └── dispatchedBy: "admin@e-responde.com"
```

### Police Notifications
```
police/notifications/{policeId}/{notificationId}
├── id: "dispatch_reportId_timestamp"
├── type: "dispatch_assignment"
├── title: "New Dispatch Assignment"
├── message: "You have been assigned to respond to a [crimeType] report."
├── reportId: "reportId"
├── reportDetails:
│   ├── crimeType: "Emergency"
│   ├── location: "Address"
│   ├── reporterName: "Reporter Name"
│   ├── description: "Report description"
│   ├── priority: "high|medium|low"
│   ├── estimatedTime: "15 minutes"
│   └── notes: "Dispatch notes"
├── dispatchInfo: { ... }
├── createdAt: "2024-01-01T12:00:00.000Z"
├── isRead: false
└── isActive: true
```

### General Notifications (for tracking)
```
police/notifications/general/{notificationId}
├── [same structure as above]
└── assignedOfficer:
    ├── id: "policeId"
    ├── name: "Rank FirstName LastName"
    └── email: "email@example.com"
```

## Usage Examples

### For Police Officers
```javascript
import { getPoliceNotifications, markNotificationAsRead } from '../utils/notificationUtils'

// Get all notifications for a police officer
const notifications = await getPoliceNotifications('policeId123')

// Mark a notification as read
await markNotificationAsRead('policeId123', 'notificationId456')

// Listen for real-time notifications
const unsubscribe = listenForNotifications('policeId123', (notifications) => {
  console.log('New notifications:', notifications)
})
```

### For Admins
The dispatch system automatically creates notifications when dispatching units. No additional code is needed.

## Components

### Dispatch.jsx
- Main dispatch interface for admins
- Automatically creates notifications when dispatching units
- Shows proximity-based unit recommendations

### PoliceNotifications.jsx
- Displays notifications for police officers
- Real-time updates
- Mark as read functionality
- Detailed assignment information

### notificationUtils.js
- Utility functions for managing notifications
- Real-time listeners
- CRUD operations for notifications

## Testing

To test the notification system:

1. Open the Dispatch component as an admin
2. Select a crime report and dispatch a police unit
3. Check the browser console for notification creation logs
4. View the Firebase Realtime Database to see the notification data
5. Use the PoliceNotifications component to view notifications as a police officer

## Security Considerations

- Notifications are stored in Firebase Realtime Database
- Access should be controlled through Firebase Security Rules
- Police officers should only access their own notifications
- Admins should have access to general notifications for tracking

## Future Enhancements

- Push notifications for mobile apps
- Email notifications
- SMS notifications for critical assignments
- Notification preferences for police officers
- Assignment status updates (accepted, in progress, completed)
- Integration with police mobile app
