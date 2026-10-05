import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import LoadingSpinner from '../components/LoadingSpinner';
import tenantService from '../services/tenantService';
import familyService from '../services/familyService';
import houseService from '../services/houseService';
import roomService from '../services/roomService';
import transferService from '../services/transferService';

export default function TransferTenant() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isFamily = location.pathname.includes('/families/');
  const subjectType = isFamily ? 'family' : 'tenant';
  const service = isFamily ? familyService : tenantService;
  const detailLink = isFamily ? `/owner/families/${id}` : `/owner/tenants/${id}`;

  const [subject, setSubject] = useState(null);
  const [currentHouse, setCurrentHouse] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ houseId: '', roomId: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    service
      .getById(id)
      .then((res) => {
        setSubject(res.data.tenant || res.data.family);
        setCurrentHouse(res.data.house);
        setCurrentRoom(res.data.room);
      })
      .finally(() => setLoading(false));

    houseService.list().then((res) => setHouses(res.data.houses.filter((h) => h.status === 'active')));
  }, [id]);

  useEffect(() => {
    if (!form.houseId) {
      setRooms([]);
      return;
    }
    roomService.listByHouse(form.houseId).then((res) => setRooms(res.data.rooms.filter((r) => r.status === 'active')));
  }, [form.houseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.houseId || !form.roomId) {
      setError('Please select a destination house and room.');
      return;
    }
    setSubmitting(true);
    try {
      await transferService.create({
        subjectType,
        subjectId: id,
        toHouseId: form.houseId,
        toRoomId: form.roomId,
        reason: form.reason,
      });
      navigate(detailLink, { state: { transferRequested: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell title="Request Transfer">
        <LoadingSpinner label="Loading..." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Request Transfer">
      <div className="breadcrumb">
        <Link to={detailLink}>{isFamily ? subject?.headName : subject?.name}</Link> / Request Transfer
      </div>

      <h2 style={{ marginBottom: 4 }}>Transfer {isFamily ? subject?.headName : subject?.name}</h2>
      <p className="subtitle" style={{ marginBottom: 20 }}>
        Currently at {currentHouse?.address}, room {currentRoom?.roomNumber}.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="wizard-card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="houseId">New house</label>
            <select
              id="houseId"
              value={form.houseId}
              onChange={(e) => setForm((f) => ({ ...f, houseId: e.target.value, roomId: '' }))}
              required
            >
              <option value="">Select a house</option>
              {houses.map((h) => (
                <option key={h.houseId} value={h.houseId}>{h.address} ({h.houseId})</option>
              ))}
            </select>
          </div>

          {form.houseId && (
            <div className="field">
              <label htmlFor="roomId">New room</label>
              <select id="roomId" value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))} required>
                <option value="">Select a room</option>
                {rooms.map((r) => {
                  const available = r.capacity - r.currentOccupancy;
                  return (
                    <option key={r.roomId} value={r.roomId} disabled={available <= 0}>
                      {r.roomNumber} — {available} of {r.capacity} available
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="reason">Reason (optional)</label>
            <input id="reason" type="text" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>

          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 16 }}>
            This request needs admin approval before the residence actually changes. The old residence remains
            on record permanently.
          </p>

          <div className="modal-form-actions" style={{ justifyContent: 'space-between' }}>
            <Link to={detailLink} className="btn-secondary" style={{ textDecoration: 'none' }}>Cancel</Link>
            <button type="submit" className="btn-primary-sm" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Request Transfer'}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
