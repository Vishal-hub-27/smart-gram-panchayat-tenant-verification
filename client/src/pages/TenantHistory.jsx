import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import tenantService from '../services/tenantService';
import familyService from '../services/familyService';

// One page serves both tenants and families — the route (/tenants/ vs
// /families/) decides which service to call.
export default function TenantHistory() {
  const { id } = useParams();
  const location = useLocation();
  const isFamily = location.pathname.includes('/families/');
  const service = isFamily ? familyService : tenantService;
  const backLink = isFamily ? '/owner/families' : '/owner/tenants';

  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    service
      .getHistory(id)
      .then((res) => setHistory(res.data.history))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardShell title="Residence History">
        <LoadingSpinner label="Loading residence history..." />
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell title="Residence History">
        <EmptyState title="Could not load residence history" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Residence History">
      <div className="breadcrumb">
        <Link to={backLink}>{isFamily ? 'Families' : 'Tenants'}</Link> / Residence History
      </div>

      <div className="page-header">
        <div>
          <h2>Residence History</h2>
          <div className="subtitle">Every residence period on record, oldest first. Nothing here is ever edited or removed.</div>
        </div>
      </div>

      {history.length === 0 ? (
        <EmptyState title="No residence history yet" description="This record hasn't been approved into an active residence." />
      ) : (
        <div className="timeline">
          {history.map((entry) => (
            <div key={entry._id} className="timeline-entry">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-dates">
                  {new Date(entry.fromDate).toLocaleDateString()} →{' '}
                  {entry.toDate ? new Date(entry.toDate).toLocaleDateString() : 'Present'}
                </div>
                <div className="timeline-house">
                  {entry.houseId?.address} <span className="mono-id">({entry.houseId?.houseId})</span>
                </div>
                <div className="timeline-meta">
                  Room {entry.roomId?.roomNumber} ({entry.roomId?.roomId}) · {entry.houseId?.village} · Owner:{' '}
                  {entry.ownerId?.name} ({entry.ownerId?.ownerId})
                </div>
                {entry.endReason && (
                  <div className="timeline-reason">
                    Ended due to: {entry.endReason === 'transfer' ? 'Transfer' : 'Move-out'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
