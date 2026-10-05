import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import SearchBar from '../components/SearchBar';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import tenantService from '../services/tenantService';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'CORRECTION_REQUIRED', label: 'Correction Required' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'MOVED_OUT', label: 'Moved Out' },
];

export default function TenantManagement() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    tenantService
      .list(statusFilter ? { status: statusFilter } : {})
      .then((res) => setTenants(res.data.tenants))
      .catch(() => showToast('Could not load tenants.', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = tenants.filter((t) => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.phone.includes(q);
  });

  return (
    <DashboardShell title="Tenants">
      <div className="page-header">
        <div>
          <h2>Tenants</h2>
          <div className="subtitle">Single tenants living in your houses. Manage families separately.</div>
        </div>
        <button className="btn-primary-sm" onClick={() => navigate('/owner/tenants/add-single')}>
          + Add Tenant
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or phone..." />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '9px 14px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 14,
            background: 'var(--surface)',
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading tenants..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tenants.length === 0 ? 'No tenants registered yet' : 'No tenants match your search'}
          description={tenants.length === 0 ? 'Add your first tenant to begin the verification process.' : ''}
          action={
            tenants.length === 0 && (
              <button className="btn-primary-sm" onClick={() => navigate('/owner/tenants/add-single')}>
                + Add Tenant
              </button>
            )
          }
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>House</th>
              <th>Room</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/owner/tenants/${t._id}`)}>
                <td>{t.name}</td>
                <td>{t.phone}</td>
                <td>{t.houseId?.address || '—'}</td>
                <td>{t.roomId?.roomNumber || '—'}</td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Toast toast={toast} />
    </DashboardShell>
  );
}
