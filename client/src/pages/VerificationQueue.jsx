import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import verificationService from '../services/verificationService';

export default function VerificationQueue() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    verificationService
      .listPending(typeFilter ? { subjectType: typeFilter } : {})
      .then((res) => setEntries(res.data.entries))
      .catch(() => showToast('Could not load the verification queue.', 'error'))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  return (
    <DashboardShell title="Verification Queue">
      <div className="page-header">
        <div>
          <h2>Verification Queue</h2>
          <div className="subtitle">Applications awaiting review, oldest first.</div>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '9px 14px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 14,
            background: 'var(--surface)',
          }}
        >
          <option value="">All types</option>
          <option value="tenant">Single Tenants</option>
          <option value="family">Families</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading queue..." />
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing pending" description="All applications have been reviewed." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Owner</th>
              <th>House</th>
              <th>Submitted</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/verifications/${e._id}`)}>
                <td style={{ textTransform: 'capitalize' }}>{e.subjectType}</td>
                <td>
                  {e.subjectPreview?.name || '—'}
                  {e.subjectPreview?.hasDuplicateFlag && (
                    <span title="Possible duplicate flagged" style={{ marginLeft: 6 }}>
                      ⚠
                    </span>
                  )}
                </td>
                <td>{e.ownerId?.name || '—'}</td>
                <td>{e.houseId?.address || '—'}</td>
                <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                <td>
                  <StatusBadge status={e.status} />
                </td>
                <td>
                  <span className="btn-link">Review →</span>
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
