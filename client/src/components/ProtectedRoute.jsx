import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Wraps a page that requires authentication. Optionally restrict to
 * specific roles via `allowedRoles` (e.g. ['admin']).
 *
 * Usage:
 *   <Route path="/admin/dashboard" element={
 *     <ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>
 *   } />
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner label="Checking your session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in, but wrong role for this page — send them to their own
    // dashboard rather than showing a confusing blocked page.
    const fallback = user.role === 'admin' ? '/admin/dashboard' : '/owner/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
}
