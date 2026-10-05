import { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import reportService from '../services/reportService';

const REPORTS = [
  { key: 'tenants', title: 'Tenant Report', fetch: reportService.getTenantReport, fields: [
    ['totalTenants', 'Total Tenants'], ['activeTenants', 'Active Tenants'], ['inactiveTenants', 'Inactive Tenants'],
    ['singleTenants', 'Single Tenants'], ['activeFamilies', 'Active Families'], ['familyMembers', 'Family Members (incl. heads)'],
  ]},
  { key: 'houses', title: 'House Report', fetch: reportService.getHouseReport, fields: [
    ['totalHouses', 'Total Houses'], ['totalRooms', 'Total Rooms'], ['occupiedSlots', 'Occupied Slots'],
    ['availableSlots', 'Available Slots'], ['capacityUtilization', 'Capacity Utilization (%)'],
  ]},
  { key: 'movement', title: 'Movement Report', fetch: reportService.getMovementReport, fields: [
    ['newRegistrations', 'New Registrations'], ['transfers', 'Transfers'], ['moveOuts', 'Move-Outs'], ['activeResidents', 'Active Residents'],
  ]},
];

export default function Reports() {
  const { toast, showToast } = useToast();
  const [filters, setFilters] = useState({ year: '', from: '', to: '' });
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const activeFilters = () => {
    const p = {};
    if (filters.year) p.year = filters.year;
    else {
      if (filters.from) p.from = filters.from;
      if (filters.to) p.to = filters.to;
    }
    return p;
  };

  const load = () => {
    setLoading(true);
    const params = activeFilters();
    Promise.all(REPORTS.map((r) => r.fetch(params)))
      .then((results) => {
        const next = {};
        REPORTS.forEach((r, i) => (next[r.key] = results[i].data));
        setData(next);
      })
      .catch(() => showToast('Could not load reports.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  return (
    <DashboardShell title="Reports">
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <div className="subtitle">Tenant, house, and movement summaries. Filter by year or date range.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <input
          type="number"
          placeholder="Year, e.g. 2026"
          value={filters.year}
          onChange={(e) => setFilters({ year: e.target.value, from: '', to: '' })}
          style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, width: 140 }}
        />
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--ink-muted)' }}>or</span>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, year: '', from: e.target.value }))}
          style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5 }}
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, year: '', to: e.target.value }))}
          style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5 }}
        />
      </div>

      {loading ? (
        <LoadingSpinner label="Generating reports..." />
      ) : (
        <div className="report-grid">
          {REPORTS.map((r) => (
            <div key={r.key} className="report-card">
              <div className="report-card-header">
                <h3>{r.title}</h3>
                <a
                  className="btn-secondary"
                  style={{ textDecoration: 'none', fontSize: 12.5, padding: '6px 12px' }}
                  href={reportService.csvUrl(r.key, activeFilters())}
                  target="_blank"
                  rel="noreferrer"
                >
                  Export CSV
                </a>
              </div>
              <div className="info-card" style={{ marginTop: 0 }}>
                {r.fields.map(([key, label]) => (
                  <div className="info-row" key={key}>
                    <span className="label">{label}</span>
                    <span>{data[r.key]?.[key] ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Toast toast={toast} />
    </DashboardShell>
  );
}
