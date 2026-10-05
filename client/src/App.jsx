import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

import Login from './pages/Login';
import Register from './pages/Register';
import OtpVerification from './pages/OtpVerification';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HouseManagement from './pages/HouseManagement';
import HouseDetails from './pages/HouseDetails';
import TenantManagement from './pages/TenantManagement';
import AddSingleTenant from './pages/AddSingleTenant';
import TenantDetails from './pages/TenantDetails';
import FamilyManagement from './pages/FamilyManagement';
import AddFamily from './pages/AddFamily';
import FamilyDetails from './pages/FamilyDetails';
import VerificationQueue from './pages/VerificationQueue';
import VerificationDetails from './pages/VerificationDetails';
import TenantHistory from './pages/TenantHistory';
import TransferTenant from './pages/TransferTenant';
import MoveOut from './pages/MoveOut';
import ResidenceRequestQueue from './pages/ResidenceRequestQueue';
import Notifications from './pages/Notifications';
import AuditLogs from './pages/AuditLogs';
import GlobalSearch from './pages/GlobalSearch';
import Reports from './pages/Reports';

import './index.css';

// Sends an already-logged-in user straight to their dashboard instead of
// showing them the login/register screens again.
function RedirectIfAuthed({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Loading..." />;
  if (isAuthenticated) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/owner/dashboard'} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <Register />
          </RedirectIfAuthed>
        }
      />
      <Route path="/verify-otp" element={<OtpVerification />} />

      <Route
        path="/owner/dashboard"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/houses"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <HouseManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/houses/:id"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <HouseDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/tenants"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <TenantManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/tenants/add-single"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <AddSingleTenant />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/tenants/:id"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <TenantDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/families"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <FamilyManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/families/add"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <AddFamily />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/families/:id"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <FamilyDetails />
          </ProtectedRoute>
        }
      />
      {['tenants', 'families'].flatMap((type) => [
        <Route
          key={`${type}-history`}
          path={`/owner/${type}/:id/history`}
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <TenantHistory />
            </ProtectedRoute>
          }
        />,
        <Route
          key={`${type}-transfer`}
          path={`/owner/${type}/:id/transfer`}
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <TransferTenant />
            </ProtectedRoute>
          }
        />,
        <Route
          key={`${type}-move-out`}
          path={`/owner/${type}/:id/move-out`}
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MoveOut />
            </ProtectedRoute>
          }
        />,
      ])}
      <Route
        path="/admin/residence-requests"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ResidenceRequestQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/notifications"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuditLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/search"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <GlobalSearch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tenants/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TenantDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/families/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <FamilyDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/verifications"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <VerificationQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/verifications/:id"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <VerificationDetails />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
