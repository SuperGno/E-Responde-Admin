import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import RequireAuth from './routes/RequireAuth'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import Analytics from './components/Analytics.jsx'
import Heatmap from './components/Heatmap.jsx'
import Dispatch from './components/Dispatch.jsx'
import PoliceAccountManagement from './components/PoliceAccountManagement.jsx'
import UserAccountManagement from './components/UserAccountManagement.jsx'
import ViewReport from './components/ViewReport.jsx'
import { useParams, useNavigate } from 'react-router-dom'

function ViewReportRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <ViewReport reportId={id} onBackToDashboard={() => navigate('/')} />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login onLoginSuccess={() => {}} /> },
  { path: '/unauthorized', element: <div className="p-6">Unauthorized</div> },
  {
    path: '/',
    element: (
      <RequireAuth roles={['SuperAdmin','Dispatcher','Analyst','admin']}>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard onNavigateToReport={() => {}} /> },
      { path: 'report/:id', element: <ViewReportRoute /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'heatmap', element: <Heatmap /> },
      { path: 'dispatch', element: <Dispatch /> },
      {
        path: 'accounts',
        element: (
          <div className="grid gap-6">
            <PoliceAccountManagement />
            <UserAccountManagement />
          </div>
        )
      },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}


