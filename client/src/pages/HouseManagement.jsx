import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import SearchBar from '../components/SearchBar';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import houseService from '../services/houseService';

export default function HouseManagement() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadHouses = () => {
    setLoading(true);
    houseService
      .list()
      .then((res) => setHouses(res.data.houses))
      .catch(() => showToast('Could not load houses.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(loadHouses, []);

  const filtered = houses.filter((h) => {
    const q = search.toLowerCase();
    return h.address.toLowerCase().includes(q) || h.village.toLowerCase().includes(q);
  });

  return (
    <DashboardShell title="My Houses">
      <div className="page-header">
        <div>
          <h2>My Houses</h2>
          <div className="subtitle">Register and manage houses under your name.</div>
        </div>
        <button className="btn-primary-sm" onClick={() => setShowForm(true)}>
          + Add House
        </button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by address or village..." />

      {loading ? (
        <LoadingSpinner label="Loading your houses..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={houses.length === 0 ? 'No houses registered yet' : 'No houses match your search'}
          description={houses.length === 0 ? 'Add your first house to start managing rooms and tenants.' : ''}
          action={
            houses.length === 0 && (
              <button className="btn-primary-sm" onClick={() => setShowForm(true)}>
                + Add House
              </button>
            )
          }
        />
      ) : (
        <div className="card-grid">
          {filtered.map((house) => (
            <div key={house.houseId} className="entity-card" onClick={() => navigate(`/owner/houses/${house.houseId}`)}>
              <div className="entity-card-top">
                <span className="mono-id">{house.houseId}</span>
                <StatusBadge status={house.status} />
              </div>
              <h4>{house.address}</h4>
              <div className="meta">
                {house.village}
                {house.area ? ` · ${house.area}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AddHouseModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            showToast('House registered successfully.');
            loadHouses();
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <Toast toast={toast} />
    </DashboardShell>
  );
}

function AddHouseModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({ address: '', village: '', area: '', declaredRoomCount: '' });
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });
      if (photo) data.append('photo', photo);

      await houseService.create(data);
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
        <h3>Register a house</h3>
        <p>Add a house you own. You can add rooms to it afterward.</p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="address">Address</label>
            <input id="address" type="text" value={form.address} onChange={update('address')} required />
          </div>
          <div className="field">
            <label htmlFor="village">Village</label>
            <input id="village" type="text" value={form.village} onChange={update('village')} required />
          </div>
          <div className="field">
            <label htmlFor="area">Area / locality (optional)</label>
            <input id="area" type="text" value={form.area} onChange={update('area')} />
          </div>
          <div className="field">
            <label htmlFor="declaredRoomCount">Number of rooms (optional)</label>
            <input
              id="declaredRoomCount"
              type="number"
              min="0"
              value={form.declaredRoomCount}
              onChange={update('declaredRoomCount')}
            />
          </div>
          <div className="field">
            <label htmlFor="photo">House photo (optional)</label>
            <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files[0])} />
          </div>

          <div className="modal-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Register House'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
