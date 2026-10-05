import { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import auditService from '../services/auditService';

const ACTIONS = [
  'APPROVED_TENANT', 'APPROVED_FAMILY',
  'REJECTED_TENANT', 'REJECTED_FAMILY',
  'CORRECTION_REQUESTED_TENANT', 'CORRECTION_REQUESTED_FAMILY',
  'TRANSFER_APPROVED', 'TRANSFER_REJECTED',
  'MOVE_OUT_APPROVED', 'MOVE_OUT_REJECTED',
];

const filterInput = {
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13.5,
  background: 'var(--surface)',
  fontFamily: 'var(--font-body)',
};

export default function AuditLogs() {
  const { toast, showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', targetType: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
    auditService
      .list(params)
      .then((res) => {
        setLogs(res.data.logs);
        setPagination(res.data.pagination);
      })
      .catch(() => showToast('Could not load audit logs.', 'error'))
      .finally(() => setLoading(false));
  }, [page, filters]);

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  return (
    <DashboardShell title="Audit Logs">
      <div className="page-header">
        <div>
          <h2>Audit Logs</h2>
          <div className="subtitle">A permanent record of sensitive admin actions. Read-only — entries can't be edited or removed.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select style={filterInput} value={filters.action} onChange={setFilter('action')}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={filterInput} value={filters.targetType} onChange={setFilter('targetType')}>
          <option value="">All targets</option>
          <option value="tenant">Tenant</option>
          <option value="family">Family</option>
          <option value="transfer">Transfer</option>
          <option value="move_out">Move-out</option>
        </select>
        <label style={{ fontSize: 13, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          From <input type="date" style={filterInput} value={filters.from} onChange={setFilter('from')} />
        </label>
        <label style={{ fontSize: 13, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          To <input type="date" style={filterInput} value={filters.to} onChange={setFilter('to')} />
        </label>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading audit logs..." />
      ) : logs.length === 0 ? (
        <EmptyState title="No matching entries" description="Actions like approvals and rejections are recorded here automatically." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td>
                    {l.actorName || '—'}
                    {l.actorAdminId && <div className="mono-id">{l.actorAdminId}</div>}
                  </td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{l.action}</span></td>
                  <td>
                    {l.targetLabel || '—'}
                    {l.targetId && <div className="mono-id">{l.targetId}</div>}
                  </td>
                  <td style={{ maxWidth: 280 }}>{l.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />
      <Toast toast={toast} />
    </DashboardShell>
  );
}
