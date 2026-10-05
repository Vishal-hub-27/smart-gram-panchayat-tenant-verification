import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import LoadingSpinner from '../components/LoadingSpinner';
import houseService from '../services/houseService';
import roomService from '../services/roomService';
import familyService from '../services/familyService';

export default function AddFamily() {
  const [mode, setMode] = useState('new');

  return (
    <DashboardShell title="Add Family">
      <div className="breadcrumb">
        <Link to="/owner/families">Families</Link> / Add Family
      </div>

      <div className="mode-toggle">
        <button className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>
          New Family
        </button>
        <button className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>
          Existing Family
        </button>
      </div>

      {mode === 'new' ? <NewFamilyWizard /> : <ExistingFamilyClaim />}
    </DashboardShell>
  );
}

const STEPS = ['Family Head', 'Members', 'House & Room', 'Documents', 'Review & Submit'];
const EMPTY_MEMBER = { name: '', relationship: '', age: '', gender: '' };

function NewFamilyWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ headName: '', headPhone: '', alternatePhone: '', houseId: '', roomId: '' });
  const [members, setMembers] = useState([]);
  const [headPhoto, setHeadPhoto] = useState(null);
  const [documents, setDocuments] = useState([]);

  const [duplicateMatches, setDuplicateMatches] = useState(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const occupantCount = 1 + members.length;

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

  const updateMember = (index, field, value) => {
    setMembers((m) => m.map((mem, i) => (i === index ? { ...mem, [field]: value } : mem)));
  };
  const addMember = () => setMembers((m) => [...m, { ...EMPTY_MEMBER }]);
  const removeMember = (index) => setMembers((m) => m.filter((_, i) => i !== index));

  const goNext = async () => {
    setError('');

    if (step === 0) {
      if (!form.headName || !form.headPhone) {
        setError("Please fill in the family head's name and phone number.");
        return;
      }
      if (!duplicateAcknowledged) {
        setCheckingDuplicate(true);
        try {
          const res = await familyService.checkDuplicate(form.headPhone);
          if (res.data.possibleDuplicate) {
            setDuplicateMatches(res.data.matches);
            setCheckingDuplicate(false);
            return;
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Something went wrong. Please try again.');
          setCheckingDuplicate(false);
          return;
        }
        setCheckingDuplicate(false);
      }
    }

    if (step === 1) {
      for (const m of members) {
        if (!m.name || !m.relationship) {
          setError('Each family member needs a name and relationship.');
          return;
        }
      }
    }

    if (step === 2 && (!form.houseId || !form.roomId)) {
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
      data.append('headName', form.headName);
      data.append('headPhone', form.headPhone);
      if (form.alternatePhone) data.append('alternatePhone', form.alternatePhone);
      data.append('houseId', form.houseId);
      data.append('roomId', form.roomId);
      data.append('members', JSON.stringify(members));
      if (duplicateAcknowledged) data.append('duplicateAcknowledged', 'true');
      if (headPhoto) data.append('headPhoto', headPhoto);
      documents.forEach((doc) => data.append('documents', doc));

      const res = await familyService.create(data);

      if (res.data.possibleDuplicate && !res.data.created) {
        setDuplicateMatches(res.data.matches);
        setDuplicateAcknowledged(false);
        setStep(0);
        return;
      }

      navigate(`/owner/families/${res.data.family._id}`, { state: { justSubmitted: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHouse = houses.find((h) => h.houseId === form.houseId);
  const selectedRoom = rooms.find((r) => r.roomId === form.roomId);

  return (
    <div>
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
          <p style={{ margin: '8px 0' }}>A record with this phone number may already exist in the system:</p>
          <ul style={{ margin: '0 0 12px 18px' }}>
            {duplicateMatches.map((m, i) => (
              <li key={i}>
                {m.name} — {m.id ? <span className="mono">{m.id}</span> : 'pending review'} ({m.recordType},{' '}
                {m.status})
              </li>
            ))}
          </ul>
          <p style={{ margin: '0 0 12px' }}>
            Please verify before creating another record. If this is a different family, you may continue.
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
                <label htmlFor="headName">Family head — full name</label>
                <input id="headName" type="text" value={form.headName} onChange={update('headName')} required />
              </div>
              <div className="field">
                <label htmlFor="headPhone">Phone number</label>
                <input id="headPhone" type="tel" inputMode="numeric" value={form.headPhone} onChange={update('headPhone')} required />
              </div>
              <div className="field">
                <label htmlFor="alternatePhone">Alternate phone (optional)</label>
                <input id="alternatePhone" type="tel" inputMode="numeric" value={form.alternatePhone} onChange={update('alternatePhone')} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginBottom: 14 }}>
                Add other members of this family. The head is already counted — you don't need to add them again.
              </p>
              {members.map((m, i) => (
                <div key={i} className="member-row">
                  <input
                    type="text"
                    placeholder="Name"
                    value={m.name}
                    onChange={(e) => updateMember(i, 'name', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g. Wife, Son)"
                    value={m.relationship}
                    onChange={(e) => updateMember(i, 'relationship', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Age"
                    min="0"
                    value={m.age}
                    onChange={(e) => updateMember(i, 'age', e.target.value)}
                  />
                  <select value={m.gender} onChange={(e) => updateMember(i, 'gender', e.target.value)}>
                    <option value="">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <button type="button" className="btn-icon-danger" onClick={() => removeMember(i)} aria-label="Remove member">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={addMember} style={{ marginTop: 8 }}>
                + Add Member
              </button>
              <div className="field-hint" style={{ marginTop: 14 }}>
                Total people in this family: <strong>{occupantCount}</strong> (head + {members.length} member
                {members.length === 1 ? '' : 's'})
              </div>
            </div>
          )}

          {step === 2 && (
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
                        const fits = available >= occupantCount;
                        return (
                          <option key={r.roomId} value={r.roomId} disabled={!fits}>
                            {r.roomNumber} — {available} of {r.capacity} available
                            {!fits ? ` (needs ${occupantCount})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  <div className="field-hint">This family needs space for {occupantCount} people.</div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="field">
                <label htmlFor="headPhoto">Family head photograph (optional)</label>
                <input id="headPhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setHeadPhoto(e.target.files[0])} />
              </div>
              <div className="field">
                <label htmlFor="documents">Supporting documents (optional, up to 5)</label>
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

          {step === 4 && (
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Review before submitting</h3>
              <div className="info-card" style={{ marginTop: 0 }}>
                <div className="info-row"><span className="label">Family Head</span><span>{form.headName}</span></div>
                <div className="info-row"><span className="label">Phone</span><span>{form.headPhone}</span></div>
                <div className="info-row"><span className="label">Members</span><span>{members.length}</span></div>
                <div className="info-row"><span className="label">House</span><span>{selectedHouse?.address}</span></div>
                <div className="info-row"><span className="label">Room</span><span>{selectedRoom?.roomNumber}</span></div>
                <div className="info-row"><span className="label">Documents</span><span>{documents.length} file(s)</span></div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 14 }}>
                This application will be submitted for admin verification. A Family ID is generated only after
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
    </div>
  );
}

function ExistingFamilyClaim() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('enter-id');
  const [error, setError] = useState('');

  const [familyIdInput, setFamilyIdInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const [verifiedFamily, setVerifiedFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentResidence, setCurrentResidence] = useState(null);

  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [residenceForm, setResidenceForm] = useState({ houseId: '', roomId: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    houseService
      .list()
      .then((res) => setHouses(res.data.houses.filter((h) => h.status === 'active')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!residenceForm.houseId) {
      setRooms([]);
      return;
    }
    setLoadingRooms(true);
    roomService
      .listByHouse(residenceForm.houseId)
      .then((res) => setRooms(res.data.rooms.filter((r) => r.status === 'active')))
      .catch(() => {})
      .finally(() => setLoadingRooms(false));
  }, [residenceForm.houseId]);

  const handleLookup = async () => {
    setError('');
    if (!familyIdInput.trim()) {
      setError('Please enter a Family ID.');
      return;
    }
    setLookingUp(true);
    try {
      const res = await familyService.lookup(familyIdInput.trim());
      setPreview(res.data);
      const otpRes = await familyService.sendHeadOtp(familyIdInput.trim());
      setDevOtp(otpRes.data?.devOtp || '');
      setPhase('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Family not found. Please check the ID and try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSendingOtp(true);
    try {
      const res = await familyService.sendHeadOtp(familyIdInput.trim());
      setDevOtp(res.data?.devOtp || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setVerifying(true);
    try {
      const res = await familyService.verifyHeadOtp(familyIdInput.trim(), otp);
      setVerifiedFamily(res.data.family);
      setMembers(res.data.members);
      setCurrentResidence(res.data.currentResidence);
      setResidenceForm({
        houseId: res.data.currentResidence.house?.houseId || '',
        roomId: res.data.currentResidence.room?.roomId || '',
      });
      setPhase('claim-form');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect OTP. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitResidence = async () => {
    setError('');
    if (!residenceForm.houseId || !residenceForm.roomId) {
      setError('Please select a house and room.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await familyService.updateResidence(familyIdInput.trim(), residenceForm);
      navigate(`/owner/families/${res.data._id}`, { state: { justSubmitted: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wizard-card">
      {error && <div className="alert alert-error">{error}</div>}

      {phase === 'enter-id' && (
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginBottom: 14 }}>
            Enter the Family ID for a family that already exists in the system (e.g. one relocating to your
            house).
          </p>
          <div className="field">
            <label htmlFor="familyIdInput">Family ID</label>
            <input
              id="familyIdInput"
              type="text"
              placeholder="F-2026-0001"
              value={familyIdInput}
              onChange={(e) => setFamilyIdInput(e.target.value)}
            />
          </div>
          <button className="btn-primary-sm" onClick={handleLookup} disabled={lookingUp}>
            {lookingUp ? 'Looking up...' : 'Find Family'}
          </button>
        </div>
      )}

      {phase === 'otp' && preview && (
        <div>
          <div className="info-card" style={{ marginTop: 0 }}>
            <div className="info-row"><span className="label">Family ID</span><span className="mono">{preview.familyId}</span></div>
            <div className="info-row"><span className="label">Head</span><span>{preview.headName}</span></div>
            <div className="info-row"><span className="label">Phone</span><span>{preview.maskedPhone}</span></div>
            <div className="info-row"><span className="label">Members</span><span>{preview.memberCount}</span></div>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', margin: '16px 0' }}>
            An OTP has been sent to the family head's registered phone to confirm this claim.
          </p>
          {devOtp && (
            <div className="dev-otp-hint">
              Development mode — SMS is mocked. Your OTP: <span className="mono">{devOtp}</span>
            </div>
          )}
          <div className="field">
            <label htmlFor="otp">OTP code</label>
            <input
              id="otp"
              className="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary-sm" onClick={handleVerifyOtp} disabled={verifying || otp.length !== 6}>
              {verifying ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button className="btn-secondary" onClick={handleResendOtp} disabled={sendingOtp}>
              {sendingOtp ? 'Sending...' : 'Resend OTP'}
            </button>
          </div>
        </div>
      )}

      {phase === 'claim-form' && verifiedFamily && (
        <div>
          <div className="alert alert-success">Phone verified. Showing existing family record.</div>

          <h3 style={{ fontSize: 15, margin: '18px 0 8px' }}>Family Members</h3>
          <table className="data-table" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Relationship</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{verifiedFamily.headName}</td>
                <td>Head</td>
              </tr>
              {members.map((m) => (
                <tr key={m._id}>
                  <td>{m.name}</td>
                  <td>{m.relationship}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Update Residence</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 14 }}>
            Currently at {currentResidence?.house?.address || 'unknown'}, room{' '}
            {currentResidence?.room?.roomNumber || '—'}. Select the new house and room.
          </p>

          <div className="field">
            <label htmlFor="newHouseId">House</label>
            <select
              id="newHouseId"
              value={residenceForm.houseId}
              onChange={(e) => setResidenceForm({ houseId: e.target.value, roomId: '' })}
            >
              <option value="">Select a house</option>
              {houses.map((h) => (
                <option key={h.houseId} value={h.houseId}>
                  {h.address} ({h.houseId})
                </option>
              ))}
            </select>
          </div>

          {residenceForm.houseId && (
            <div className="field">
              <label htmlFor="newRoomId">Room</label>
              {loadingRooms ? (
                <LoadingSpinner label="Loading rooms..." />
              ) : (
                <select
                  id="newRoomId"
                  value={residenceForm.roomId}
                  onChange={(e) => setResidenceForm((f) => ({ ...f, roomId: e.target.value }))}
                >
                  <option value="">Select a room</option>
                  {rooms.map((r) => {
                    const available = r.capacity - r.currentOccupancy;
                    const occupantCount = 1 + members.length;
                    const fits = available >= occupantCount || r.roomId === currentResidence?.room?.roomId;
                    return (
                      <option key={r.roomId} value={r.roomId} disabled={!fits}>
                        {r.roomNumber} — {available} of {r.capacity} available
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          <button className="btn-primary-sm" onClick={handleSubmitResidence} disabled={submitting} style={{ marginTop: 10 }}>
            {submitting ? 'Submitting...' : 'Submit for Admin Review'}
          </button>
        </div>
      )}
    </div>
  );
}
