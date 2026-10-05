import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import searchService from '../services/searchService';

const RECORD_LABELS = { tenant: 'Tenant', family: 'Family', house: 'House', owner: 'Owner' };

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await searchService.search(q.trim());
      setResults(res.data.results);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell title="Search">
      <div className="page-header">
        <div>
          <h2>Global Search</h2>
          <div className="subtitle">
            Search by Tenant ID, Family ID, House ID, Owner ID, name, or phone number.
          </div>
        </div>
      </div>

      <form onSubmit={runSearch} className="search-bar" style={{ maxWidth: 480 }}>
        <span className="search-icon">⌕</span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="T-2026-0001, a name, or a phone number..."
        />
      </form>
      <button className="btn-primary-sm" onClick={runSearch} style={{ marginTop: 12 }} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      {loading && <LoadingSpinner label="Searching..." />}

      {!loading && results && results.length === 0 && (
        <div style={{ marginTop: 20 }}>
          <EmptyState title="No matching records found" description="Try a different name, ID, or phone number." />
        </div>
      )}

      {!loading && results && results.length > 0 && (
        <table className="data-table" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>ID</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={i}
                style={{ cursor: r.link ? 'pointer' : 'default' }}
                onClick={() => r.link && navigate(r.link)}
              >
                <td>{RECORD_LABELS[r.recordType] || r.recordType}</td>
                <td>{r.name}</td>
                <td>{r.id ? <span className="mono-id">{r.id}</span> : '—'}</td>
                <td>{r.status ? <StatusBadge status={r.status} /> : '—'}</td>
                <td>{r.link ? <span className="btn-link">View →</span> : <span style={{ color: 'var(--ink-muted)', fontSize: 12 }}>No detail page yet</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardShell>
  );
}
