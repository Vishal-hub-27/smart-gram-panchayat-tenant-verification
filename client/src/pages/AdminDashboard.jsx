import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardShell from '../components/DashboardShell';
import LoadingSpinner from '../components/LoadingSpinner';
import BarChart from '../components/BarChart';
import reportService from '../services/reportService';

const STAT_CARDS = [
  ['totalOwners', 'Total Owners'],
  ['totalHouses', 'Total Houses'],
  ['totalRooms', 'Total Rooms'],
  ['activeTenants', 'Active Tenants'],
  ['totalFamilies', 'Total Families'],
  ['singleTenants', 'Single Tenants'],
  ['pendingApplications', 'Pending Applications'],
  ['correctionRequired', 'Correction Required'],
  ['availableRooms', 'Available Rooms'],
  ['movedOutTenants', 'Moved-Out Residents'],
  ['transferRequests', 'Pending Transfers'],
  ['pendingMoveOuts', 'Pending Move-Outs'],
];

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([reportService.getDashboardStats(), reportService.getDashboardCharts()])
      .then(([s, c]) => {
        setStats(s.data);
        setCharts(c.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Dashboard">
      <span className="stamp-badge">Admin access</span>
      <h2 style={{ marginTop: 14 }}>Welcome, {profile?.name}</h2>
      <p style={{ color: 'var(--ink-muted)' }}>An overview of everyone and everywhere under Gram Panchayat records.</p>

      <div style={{ display: 'flex', gap: 10, margin: '16px 0 8px' }}>
        <Link to="/admin/verifications" className="btn-primary-sm" style={{ textDecoration: 'none' }}>
          Verification Queue →
        </Link>
        <Link to="/admin/search" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Search
        </Link>
        <Link to="/admin/reports" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Reports
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading dashboard..." />
      ) : (
        <>
          <div className="stat-grid">
            {STAT_CARDS.map(([key, label]) => (
              <div className="stat-card" key={key}>
                <div className="stat-value">{stats?.[key] ?? 0}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h3>Tenant Registrations by Month</h3>
              <BarChart
                data={(charts?.registrationsByMonth.tenants || []).map((r) => ({ label: monthLabel(r._id), value: r.count }))}
              />
            </div>
            <div className="chart-card">
              <h3>Family Registrations by Month</h3>
              <BarChart
                data={(charts?.registrationsByMonth.families || []).map((r) => ({ label: monthLabel(r._id), value: r.count }))}
              />
            </div>
            <div className="chart-card">
              <h3>Active vs Inactive — Tenants</h3>
              <BarChart
                data={[
                  { label: 'Active', value: charts?.activeVsInactive.tenants.active || 0 },
                  { label: 'Inactive', value: charts?.activeVsInactive.tenants.inactive || 0 },
                ]}
              />
            </div>
            <div className="chart-card">
              <h3>Single vs Family Applications</h3>
              <BarChart
                data={[
                  { label: 'Single Tenants', value: charts?.singleVsFamily.single || 0 },
                  { label: 'Families', value: charts?.singleVsFamily.family || 0 },
                ]}
              />
            </div>
            <div className="chart-card">
              <h3>House Occupancy</h3>
              <BarChart
                data={(charts?.houseOccupancy || []).map((h) => ({ label: h.house, value: h.occupancyRate }))}
                maxBars={8}
              />
            </div>
            <div className="chart-card">
              <h3>Pending vs Approved Applications</h3>
              <BarChart
                data={(charts?.pendingVsApproved || []).map((r) => ({ label: r._id, value: r.count }))}
              />
            </div>
            <div className="chart-card">
              <h3>Transfers by Month</h3>
              <BarChart
                data={(charts?.tenantMovement.transfersByMonth || []).map((r) => ({ label: monthLabel(r._id), value: r.count }))}
              />
            </div>
            <div className="chart-card">
              <h3>Move-Outs by Month</h3>
              <BarChart
                data={(charts?.tenantMovement.moveOutsByMonth || []).map((r) => ({ label: monthLabel(r._id), value: r.count }))}
              />
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
