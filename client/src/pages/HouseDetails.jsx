import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import houseService from '../services/houseService';
import roomService from '../services/roomService';

const ROOM_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'shared', label: 'Shared' },
  { value: 'family', label: 'Family' },
];

export default function HouseDetails() {
  const { id: houseId } = useParams();
  const { toast, showToast } = useToast();

  const [house, setHouse] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  const load = () => {
    setLoading(true);
    houseService
      .getById(houseId)
      .then((res) => {
        setHouse(res.data.house);
        setRooms(res.data.rooms);
      })
      .catch(() => showToast('Could not load house details.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [houseId]);

  const handleToggleStatus = async () => {
    setConfirmToggle(false);
    const nextStatus = house.status === 'active' ? 'inactive' : 'active';
    try {
      const data = new FormData();
      data.append('status', nextStatus);
      const res = await houseService.update(houseId, data);
      setHouse(res.data);
      showToast(`House marked as ${nextStatus}.`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong.', 'error');
    }
  };

  if (loading) {
    return (
      <DashboardShell title="House Details">
        <LoadingSpinner label="Loading house details..." />
      </DashboardShell>
    );
  }

  if (!house) {
    return (
      <DashboardShell title="House Details">
        <EmptyState title="House not found" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="House Details">
      <div className="breadcrumb">
        <Link to="/owner/houses">My Houses</Link> / {house.houseId}
      </div>

      <div className="page-header">
        <div>
          <h2>{house.address}</h2>
          <div className="subtitle">
            {house.village}
            {house.area ? ` · ${house.area}` : ''} · <span className="mono-id">{house.houseId}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <StatusBadge status={house.status} />
          <button className="btn-secondary" onClick={() => setConfirmToggle(true)}>
            Mark {house.status === 'active' ? 'Inactive' : 'Active'}
          </button>
        </div>
      </div>

      <div className="page-header" style={{ marginTop: 32 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>Rooms</h2>
          <div className="subtitle">Manage rooms and track occupancy for this house.</div>
        </div>
        <button className="btn-primary-sm" onClick={() => setShowRoomForm(true)}>
          + Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          title="No rooms added yet"
          description="Add rooms to this house before registering tenants."
          action={
            <button className="btn-primary-sm" onClick={() => setShowRoomForm(true)}>
              + Add Room
            </button>
          }
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Occupied</th>
              <th>Available</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.roomId}>
                <td>
                  {room.roomNumber} <span className="mono-id">({room.roomId})</span>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{room.roomType}</td>
                <td>{room.capacity}</td>
                <td>{room.currentOccupancy}</td>
                <td>{room.capacity - room.currentOccupancy}</td>
                <td>
                  <StatusBadge status={room.currentOccupancy >= room.capacity ? 'full' : room.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showRoomForm && (
        <AddRoomModal
          houseId={house.houseId}
          onClose={() => setShowRoomForm(false)}
          onCreated={() => {
            setShowRoomForm(false);
            showToast('Room added successfully.');
            load();
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <ConfirmDialog
        open={confirmToggle}
        title={`Mark house as ${house.status === 'active' ? 'inactive' : 'active'}?`}
        message="This affects how the house appears in listings. It won't remove any existing rooms or history."
        confirmLabel="Confirm"
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmToggle(false)}
      />

      <Toast toast={toast} />
    </DashboardShell>
  );
}

function AddRoomModal({ houseId, onClose, onCreated, onError }) {
  const [form, setForm] = useState({ roomNumber: '', roomType: 'single', capacity: '' });
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await roomService.create({ houseId, ...form });
      onCreated();
    } catch (err) {
      onError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <h3>Add a room</h3>
        <p>Rooms track capacity so tenant placement never exceeds available space.</p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="roomNumber">Room number / name</label>
            <input id="roomNumber" type="text" value={form.roomNumber} onChange={update('roomNumber')} required />
          </div>
          <div className="field">
            <label htmlFor="roomType">Room type</label>
            <select id="roomType" value={form.roomType} onChange={update('roomType')}>
              {ROOM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="capacity">Maximum capacity</label>
            <input id="capacity" type="number" min="1" value={form.capacity} onChange={update('capacity')} required />
          </div>

          <div className="modal-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
