import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import LoadingSpinner from '../components/LoadingSpinner';
import houseService from '../services/houseService';
import roomService from '../services/roomService';
import tenantService from '../services/tenantService';

const STEPS = ['Tenant Details', 'House & Room', 'Documents', 'Review & Submit'];

export default function AddSingleTenant() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    alternatePhone: '',
    dateOfBirth: '',
    gender: '',
    education: '',
    permanentAddress: '',
    currentResidence: '',
    employer: '',
    houseId: '',
    roomId: '',
  });
  const [photo, setPhoto] = useState(null);
  const [documents, setDocuments] = useState([]);

  const [duplicateMatches, setDuplicateMatches] = useState(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    houseService
      .list()
      .then((res) => setHouses(res.data.houses.filter((h) => h.status === 'active')))
      .catch(() => setError('Could not load your houses.'));
  }, []);

  useEffect(() => {
    if (!form.houseId) {
      setRooms([]);
      return;
    }
    setLoadingRooms(true);
    roomService
      .listByHouse(form.houseId)
      .then((res) => setRooms(res.data.rooms.filter((r) => r.status === 'active')))
      .catch(() => setError('Could not load rooms for this house.'))
      .finally(() => setLoadingRooms(false));
  }, [form.houseId]);

  const goNext = async () => {
    setError('');

    if (step === 0) {
      if (!form.name || !form.phone) {
        setError('Please fill in the name and phone number.');
        return;
      }
      if (!duplicateAcknowledged) {
        setCheckingDuplicate(true);
        try {
          const res = await tenantService.checkDuplicate(form.phone);
          if (res.data.possibleDuplicate) {
            setDuplicateMatches(res.data.matches);
            setCheckingDuplicate(false);
            return; // show warning, wait for explicit acknowledgement
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Something went wrong. Please try again.');
          setCheckingDuplicate(false);
          return;
        }
        setCheckingDuplicate(false);
      }
    }

    if (step === 1 && (!form.houseId || !form.roomId)) {
      setError('Please select a house and room.');
      return;
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleAcknowledgeDuplicate = () => {
    setDuplicateAcknowledged(true);
    setDuplicateMatches(null);
    setStep(1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });
      if (duplicateAcknowledged) data.append('duplicateAcknowledged', 'true');
      if (photo) data.append('photo', photo);
      documents.forEach((doc) => data.append('documents', doc));

      const res = await tenantService.create(data);

      if (res.data.possibleDuplicate && !res.data.created) {
        // Server-side re-check caught something the client-side check missed
        // (e.g. a duplicate created in the meantime). Show it and require
        // acknowledgement again before resubmitting.
        setDuplicateMatches(res.data.matches);
        setDuplicateAcknowledged(false);
        setStep(0);
        return;
      }

      navigate(`/owner/tenants/${res.data.tenant._id}`, { state: { justSubmitted: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHouse = houses.find((h) => h.houseId === form.houseId);
  const selectedRoom = rooms.find((r) => r.roomId === form.roomId);

  return (
    <DashboardShell title="Add Single Tenant">
      <div className="breadcrumb">
        <Link to="/owner/tenants">Tenants</Link> / Add Single Tenant
      </div>

      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <div key={label} className={`wizard-step ${i === step ? 'current' : i < step ? 'done' : ''}`}>
            <span className="wizard-step-dot">{i < step ? '✓' : i + 1}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {duplicateMatches && (
        <div className="alert alert-error" style={{ display: 'block' }}>
          <strong>⚠ Possible Existing Record</strong>
          <p style={{ margin: '8px 0' }}>
            A tenant with this phone number may already exist in the system:
          </p>
          <ul style={{ margin: '0 0 12px 18px' }}>
            {duplicateMatches.map((m, i) => (
              <li key={i}>
                {m.name} — {m.id ? <span className="mono">{m.id}</span> : 'pending review'} ({m.recordType},{' '}
                {m.status})
              </li>
            ))}
          </ul>
          <p style={{ margin: '0 0 12px' }}>
            Please verify before creating another record. If you're sure this is a different person, you may
            continue.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={() => setDuplicateMatches(null)}>
              Go Back &amp; Edit
            </button>
            <button className="btn-primary-sm" onClick={handleAcknowledgeDuplicate}>
              Continue Anyway
            </button>
          </div>
        </div>
      )}

      {!duplicateMatches && (
        <div className="wizard-card">
          {step === 0 && (
            <div>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" type="text" value={form.name} onChange={update('name')} required />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone number</label>
                <input id="phone" type="tel" inputMode="numeric" value={form.phone} onChange={update('phone')} required />
              </div>
              <div className="field">
                <label htmlFor="alternatePhone">Alternate phone (optional)</label>
                <input id="alternatePhone" type="tel" inputMode="numeric" value={form.alternatePhone} onChange={update('alternatePhone')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="field">
                  <label htmlFor="dateOfBirth">Date of birth (optional)</label>
                  <input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update('dateOfBirth')} />
                </div>
                <div className="field">
                  <label htmlFor="gender">Gender (optional)</label>
                  <select id="gender" value={form.gender} onChange={update('gender')}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="education">Education (optional)</label>
                <input id="education" type="text" value={form.education} onChange={update('education')} />
              </div>
              <div className="field">
                <label htmlFor="employer">Employer / company (optional)</label>
                <input id="employer" type="text" value={form.employer} onChange={update('employer')} />
              </div>
              <div className="field">
                <label htmlFor="permanentAddress">Permanent address (optional)</label>
                <input id="permanentAddress" type="text" value={form.permanentAddress} onChange={update('permanentAddress')} />
              </div>
              <div className="field">
                <label htmlFor="currentResidence">Current residence notes (optional)</label>
                <input id="currentResidence" type="text" value={form.currentResidence} onChange={update('currentResidence')} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="field">
                <label htmlFor="houseId">House</label>
                <select id="houseId" value={form.houseId} onChange={(e) => setForm((f) => ({ ...f, houseId: e.target.value, roomId: '' }))}>
                  <option value="">Select a house</option>
                  {houses.map((h) => (
                    <option key={h.houseId} value={h.houseId}>
                      {h.address} ({h.houseId})
                    </option>
                  ))}
                </select>
              </div>

              {form.houseId && (
                <div className="field">
                  <label htmlFor="roomId">Room</label>
                  {loadingRooms ? (
                    <LoadingSpinner label="Loading rooms..." />
                  ) : (
                    <select id="roomId" value={form.roomId} onChange={update('roomId')}>
                      <option value="">Select a room</option>
                      {rooms.map((r) => {
                        const available = r.capacity - r.currentOccupancy;
                        return (
                          <option key={r.roomId} value={r.roomId} disabled={available <= 0}>
                            {r.roomNumber} — {available > 0 ? `${available} of ${r.capacity} available` : 'Full'}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="field">
                <label htmlFor="photo">Tenant photograph (optional)</label>
                <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files[0])} />
              </div>
              <div className="field">
                <label htmlFor="documents">Identity / supporting documents (optional, up to 5)</label>
                <input
                  id="documents"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setDocuments(Array.from(e.target.files).slice(0, 5))}
                />
                <div className="field-hint">JPEG, PNG, WEBP, or PDF. Max 5MB per file.</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Review before submitting</h3>
              <div className="info-card" style={{ marginTop: 0 }}>
                <div className="info-row"><span className="label">Name</span><span>{form.name}</span></div>
                <div className="info-row"><span className="label">Phone</span><span>{form.phone}</span></div>
                <div className="info-row"><span className="label">House</span><span>{selectedHouse?.address}</span></div>
                <div className="info-row"><span className="label">Room</span><span>{selectedRoom?.roomNumber}</span></div>
                <div className="info-row"><span className="label">Photo</span><span>{photo ? photo.name : 'Not attached'}</span></div>
                <div className="info-row"><span className="label">Documents</span><span>{documents.length} file(s)</span></div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 14 }}>
                This application will be submitted for admin verification. A Tenant ID is generated only after
                approval.
              </p>
            </div>
          )}

          <div className="modal-form-actions" style={{ justifyContent: 'space-between', marginTop: 28 }}>
            <button className="btn-secondary" onClick={goBack} disabled={step === 0}>
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn-primary-sm" onClick={goNext} disabled={checkingDuplicate}>
                {checkingDuplicate ? 'Checking...' : 'Next'}
              </button>
            ) : (
              <button className="btn-primary-sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
