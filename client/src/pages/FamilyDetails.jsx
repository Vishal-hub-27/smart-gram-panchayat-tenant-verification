import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import familyService from '../services/familyService';
import houseService from '../services/houseService';
import roomService from '../services/roomService';

const API_FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function FamilyDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast, showToast } = useToast();

  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [house, setHouse] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);

  const load = () => {
    familyService
      .getById(id)
      .then((res) => {
        setFamily(res.data.family);
        setMembers(res.data.members);
        setHouse(res.data.house);
        setRoom(res.data.room);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) {
    return (
      <DashboardShell title="Family Details">
        <LoadingSpinner label="Loading family details..." />
      </DashboardShell>
    );
  }

  if (notFound || !family) {
    return (
      <DashboardShell title="Family Details">
        <EmptyState title="Family record not found" />
      </DashboardShell>
    );
  }

  const latestCorrection = [...(family.statusHistory || [])].reverse().find((h) => h.status === 'CORRECTION_REQUIRED');
  const correctionNotes = latestCorrection?.note ? latestCorrection.note.split('\n').filter(Boolean) : [];

  return (
    <DashboardShell title="Family Details">
      <div className="breadcrumb">
        <Link to={isAdmin ? '/admin/search' : '/owner/families'}>{isAdmin ? 'Search' : 'Families'}</Link> / {family.headName}
      </div>

      {location.state?.justSubmitted && (
        <div className="alert alert-success">
          Submitted successfully. This family is now pending admin verification.
        </div>
      )}

      {location.state?.transferRequested && (
        <div className="alert alert-success">
          Transfer requested. It's now pending admin approval.
        </div>
      )}

      {location.state?.moveOutRequested && (
        <div className="alert alert-success">
          Move-out requested. It's now pending admin confirmation.
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>{family.headName}</h2>
          <div className="subtitle">
            {family.familyId ? <span className="mono-id">{family.familyId}</span> : 'Family ID pending approval'}
          </div>
        </div>
        <StatusBadge status={family.status} />
      </div>

      {family.status === 'CORRECTION_REQUIRED' && (
        <div className="alert alert-error" style={{ display: 'block' }}>
          <strong>Correction requested by admin</strong>
          {correctionNotes.length > 0 ? (
            <ul style={{ margin: '8px 0 12px 18px' }}>
              {correctionNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: '8px 0 12px' }}>Please review your application and resubmit.</p>
          )}
          {!isAdmin && (
            <button className="btn-primary-sm" onClick={() => setShowResubmit(true)}>
              Update &amp; Resubmit
            </button>
          )}
        </div>
      )}

      {family.duplicateFlags?.length > 0 && (
        <div className="alert alert-error" style={{ display: 'block' }}>
          <strong>⚠ Flagged as a possible duplicate at submission</strong>
          <p style={{ margin: '8px 0 0' }}>
            This application was submitted despite a possible match with an existing record. It will need
            admin attention during verification.
          </p>
        </div>
      )}

      <div className="info-card">
        <div className="info-row"><span className="label">Head phone</span><span>{family.headPhone}</span></div>
        {family.alternatePhone && (
          <div className="info-row"><span className="label">Alternate phone</span><span>{family.alternatePhone}</span></div>
        )}
        <div className="info-row">
          <span className="label">Phone verified</span>
          <span>{family.isHeadPhoneVerified ? 'Yes' : 'Not yet'}</span>
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: '24px 0 8px' }}>Family Members ({members.length + 1})</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Relationship</th>
            <th>Age</th>
            <th>Gender</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{family.headName}</td>
            <td>Head</td>
            <td>—</td>
            <td>—</td>
          </tr>
          {members.map((m) => (
            <tr key={m._id}>
              <td>{m.name}</td>
              <td>{m.relationship}</td>
              <td>{m.age || '—'}</td>
              <td style={{ textTransform: 'capitalize' }}>{m.gender || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: 15, margin: '24px 0 8px' }}>Current Residence</h3>
      <div className="info-card" style={{ marginTop: 0 }}>
        <div className="info-row"><span className="label">House</span><span>{house?.address} ({house?.houseId})</span></div>
        <div className="info-row"><span className="label">Room</span><span>{room?.roomNumber} ({room?.roomId})</span></div>
        <div className="info-row"><span className="label">Village</span><span>{house?.village}</span></div>
      </div>

      {(family.headPhotoUrl || family.documents?.length > 0) && (
        <>
          <h3 style={{ fontSize: 15, margin: '24px 0 8px' }}>Documents</h3>
          <div className="info-card" style={{ marginTop: 0 }}>
            {family.headPhotoUrl && (
              <div className="info-row">
                <span className="label">Head photograph</span>
                <a href={`${API_FILE_BASE}${family.headPhotoUrl}`} target="_blank" rel="noreferrer">View</a>
              </div>
            )}
            {family.documents?.map((doc, i) => (
              <div className="info-row" key={i}>
                <span className="label">{doc.label || `Document ${i + 1}`}</span>
                <a href={`${API_FILE_BASE}${doc.url}`} target="_blank" rel="noreferrer">View</a>
              </div>
            ))}
          </div>
        </>
      )}

      {!isAdmin && (
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <Link to={`/owner/families/${family._id}/history`} className="btn-secondary" style={{ textDecoration: 'none' }}>
            View Residence History
          </Link>
          {family.status === 'ACTIVE' && (
            <>
              <button className="btn-secondary" onClick={() => navigate(`/owner/families/${family._id}/transfer`)}>
                Transfer
              </button>
              <button className="btn-secondary" onClick={() => navigate(`/owner/families/${family._id}/move-out`)}>
                Move Out
              </button>
            </>
          )}
        </div>
      )}
      {isAdmin && (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 20 }}>Viewing as admin — read only.</p>
      )}

      {family.status !== 'CORRECTION_REQUIRED' && family.status !== 'ACTIVE' && (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 20 }}>
          Transfer and move-out actions become available once this application is active.
        </p>
      )}

      {showResubmit && (
        <ResubmitFamilyModal
          family={family}
          members={members}
          onClose={() => setShowResubmit(false)}
          onDone={() => {
            setShowResubmit(false);
            showToast('Application updated and resubmitted.');
            load();
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <Toast toast={toast} />
    </DashboardShell>
  );
}

function ResubmitFamilyModal({ family, members: initialMembers, onClose, onDone, onError }) {
  const [form, setForm] = useState({
    headName: family.headName || '',
    headPhone: family.headPhone || '',
    alternatePhone: family.alternatePhone || '',
    houseId: '',
    roomId: '',
  });
  const [members, setMembers] = useState(
    initialMembers.map((m) => ({ name: m.name, relationship: m.relationship, age: m.age || '', gender: m.gender || '' }))
  );
  const [headPhoto, setHeadPhoto] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    houseService.list().then((res) => setHouses(res.data.houses.filter((h) => h.status === 'active')));
  }, []);

  useEffect(() => {
    if (!form.houseId) return;
    roomService.listByHouse(form.houseId).then((res) => setRooms(res.data.rooms.filter((r) => r.status === 'active')));
  }, [form.houseId]);

  const updateMember = (index, field, value) =>
    setMembers((m) => m.map((mem, i) => (i === index ? { ...mem, [field]: value } : mem)));
  const addMember = () => setMembers((m) => [...m, { name: '', relationship: '', age: '', gender: '' }]);
  const removeMember = (index) => setMembers((m) => m.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (const m of members) {
      if (!m.name || !m.relationship) {
        onError('Each family member needs a name and relationship.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('headName', form.headName);
      data.append('headPhone', form.headPhone);
      if (form.alternatePhone) data.append('alternatePhone', form.alternatePhone);
      if (form.houseId) data.append('houseId', form.houseId);
      if (form.roomId) data.append('roomId', form.roomId);
      data.append('members', JSON.stringify(members));
      if (headPhoto) data.append('headPhoto', headPhoto);
      documents.forEach((doc) => data.append('documents', doc));

      await familyService.resubmit(family._id, data);
      onDone();
    } catch (err) {
      onError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3>Update application</h3>
        <p>Fix the flagged issues, then resubmit for review.</p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="fhname">Family head — name</label>
            <input id="fhname" type="text" value={form.headName} onChange={update('headName')} />
          </div>
          <div className="field">
            <label htmlFor="fhphone">Phone number</label>
            <input id="fhphone" type="tel" value={form.headPhone} onChange={update('headPhone')} />
          </div>

          <div className="field">
            <label>Family members</label>
            {members.map((m, i) => (
              <div key={i} className="member-row">
                <input type="text" placeholder="Name" value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} />
                <input type="text" placeholder="Relationship" value={m.relationship} onChange={(e) => updateMember(i, 'relationship', e.target.value)} />
                <input type="number" placeholder="Age" min="0" value={m.age} onChange={(e) => updateMember(i, 'age', e.target.value)} />
                <select value={m.gender} onChange={(e) => updateMember(i, 'gender', e.target.value)}>
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <button type="button" className="btn-icon-danger" onClick={() => removeMember(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={addMember} style={{ marginTop: 4 }}>
              + Add Member
            </button>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="fhouse">Change house (optional — leave blank to keep current)</label>
            <select id="fhouse" value={form.houseId} onChange={(e) => setForm((f) => ({ ...f, houseId: e.target.value, roomId: '' }))}>
              <option value="">Keep current house</option>
              {houses.map((h) => (
                <option key={h.houseId} value={h.houseId}>{h.address} ({h.houseId})</option>
              ))}
            </select>
          </div>
          {form.houseId && (
            <div className="field">
              <label htmlFor="froom">Room</label>
              <select id="froom" value={form.roomId} onChange={update('roomId')}>
                <option value="">Select a room</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>
                    {r.roomNumber} — {r.capacity - r.currentOccupancy} available
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="fphoto">Replace head photograph (optional)</label>
            <input id="fphoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setHeadPhoto(e.target.files[0])} />
          </div>
          <div className="field">
            <label htmlFor="fdocs">Replace documents (optional, up to 5)</label>
            <input
              id="fdocs"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setDocuments(Array.from(e.target.files).slice(0, 5))}
            />
          </div>

          <div className="modal-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sm" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Resubmit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
