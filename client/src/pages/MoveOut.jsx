import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import LoadingSpinner from '../components/LoadingSpinner';
import tenantService from '../services/tenantService';
import familyService from '../services/familyService';
import moveOutService from '../services/moveOutService';

const todayStr = () => new Date().toISOString().split('T')[0];

export default function MoveOut() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isFamily = location.pathname.includes('/families/');
  const service = isFamily ? familyService : tenantService;
  const detailLink = isFamily ? `/owner/families/${id}` : `/owner/tenants/${id}`;

  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moveOutDate, setMoveOutDate] = useState(todayStr());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    service
      .getById(id)
      .then((res) => setSubject(res.data.tenant || res.data.family))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { moveOutDate, reason };
      if (isFamily) {
        await moveOutService.createForFamily(id, payload);
      } else {
        await moveOutService.createForTenant(id, payload);
      }
      navigate(detailLink, { state: { moveOutRequested: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell title="Move Out">
        <LoadingSpinner label="Loading..." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Move Out">
      <div className="breadcrumb">
        <Link to={detailLink}>{isFamily ? subject?.headName : subject?.name}</Link> / Move Out
      </div>

      <h2 style={{ marginBottom: 4 }}>Move out {isFamily ? subject?.headName : subject?.name}</h2>
      <p className="subtitle" style={{ marginBottom: 20 }}>
        This ends their residence here. Their record and history are kept — nothing is deleted.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="wizard-card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="moveOutDate">Move-out date</label>
            <input id="moveOutDate" type="date" value={moveOutDate} onChange={(e) => setMoveOutDate(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="reason">Reason (optional)</label>
            <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 16 }}>
            This needs admin confirmation before the room's occupancy is updated.
          </p>

          <div className="modal-form-actions" style={{ justifyContent: 'space-between' }}>
            <Link to={detailLink} className="btn-secondary" style={{ textDecoration: 'none' }}>Cancel</Link>
            <button type="submit" className="btn-danger" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Request Move Out'}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
