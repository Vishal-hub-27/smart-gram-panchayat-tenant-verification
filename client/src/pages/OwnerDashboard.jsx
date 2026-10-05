import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardShell from '../components/DashboardShell';

export default function OwnerDashboard() {
  const { user, profile } = useAuth();

  return (
    <DashboardShell title="Dashboard">
      <span className="stamp-badge">✓ Phone verified</span>
      <h2 style={{ marginTop: 14 }}>Welcome, {profile?.name}</h2>
      <p style={{ color: 'var(--ink-muted)' }}>
        Manage your houses, rooms, and tenants from here.
      </p>

      <div className="info-card">
        <div className="info-row">
          <span className="label">Owner ID</span>
          <span className="mono">{profile?.ownerId}</span>
        </div>
        <div className="info-row">
          <span className="label">Phone</span>
          <span>{user?.phone}</span>
        </div>
        <div className="info-row">
          <span className="label">Village</span>
          <span>{profile?.village}</span>
        </div>
        <div className="info-row">
          <span className="label">Address</span>
          <span>{profile?.address}</span>
        </div>
      </div>

      <Link to="/owner/houses" className="btn-primary-sm" style={{ display: 'inline-block', marginTop: 20, textDecoration: 'none' }}>
        Manage My Houses →
      </Link>
    </DashboardShell>
  );
}
