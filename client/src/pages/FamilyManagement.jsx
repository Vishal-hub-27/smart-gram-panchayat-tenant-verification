import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import SearchBar from '../components/SearchBar';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import familyService from '../services/familyService';

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

export default function FamilyManagement() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    familyService
      .list(statusFilter ? { status: statusFilter } : {})
      .then((res) => setFamilies(res.data.families))
      .catch(() => showToast('Could not load families.', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = families.filter((f) => {
    const q = search.toLowerCase();
    return f.headName.toLowerCase().includes(q) || f.headPhone.includes(q);
  });

  return (
    <DashboardShell title="Families">
      <div className="page-header">
        <div>
          <h2>Families</h2>
          <div className="subtitle">Register new families or update an existing family's residence.</div>
        </div>
        <button className="btn-primary-sm" onClick={() => navigate('/owner/families/add')}>
          + Add Family
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by head name or phone..." />
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
        <LoadingSpinner label="Loading families..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={families.length === 0 ? 'No families registered yet' : 'No families match your search'}
          description={families.length === 0 ? 'Add a new family or bring in an existing one that has relocated.' : ''}
          action={
            families.length === 0 && (
              <button className="btn-primary-sm" onClick={() => navigate('/owner/families/add')}>
                + Add Family
              </button>
            )
          }
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Head of Family</th>
              <th>Phone</th>
              <th>House</th>
              <th>Room</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/owner/families/${f._id}`)}>
                <td>{f.headName}</td>
                <td>{f.headPhone}</td>
                <td>{f.houseId?.address || '—'}</td>
                <td>{f.roomId?.roomNumber || '—'}</td>
                <td>
                  <StatusBadge status={f.status} />
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
