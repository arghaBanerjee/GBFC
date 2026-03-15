import { Navigate, useLocation } from 'react-router-dom'

export default function ProtectedRoute({ children, user, loading }) {
  const location = useLocation()

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
  }

  if (!user) {
    // Redirect to login with the current location as return URL
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }

  return children
}
