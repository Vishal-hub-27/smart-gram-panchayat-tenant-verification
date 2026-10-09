import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import tenantService from '../services/tenantService';
import houseService from '../services/houseService';
import roomService from '../services/roomService';

const API_FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function TenantDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast, showToast } = useToast();

  const [tenant, setTenant] = useState(null);
  const [house, setHouse] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const handleSendPhoneOtp = async () => {
  setSendingOtp(true);
  setPhoneError('');
  setPhoneSuccess('');

  try {
    await tenantService.sendPhoneOtp(tenant._id);

    setOtpSent(true);
    setPhoneSuccess('OTP sent successfully. Check the server terminal in mock OTP mode.');
  } catch (err) {
    setPhoneError(
      err.response?.data?.message || 'Could not send OTP.'
    );
  } finally {
    setSendingOtp(false);
  }
};

const handleVerifyPhoneOtp = async () => {
  if (!/^\d{6}$/.test(otp)) {
    setPhoneError('Please enter the 6-digit OTP.');
    return;
  }

  setVerifyingOtp(true);
  setPhoneError('');
  setPhoneSuccess('');

  try {
    await tenantService.verifyPhoneOtp(tenant._id, otp);

    setTenant((current) => ({
      ...current,
      isPhoneVerified: true,
    }));

    setOtp('');
    setOtpSent(false);
    setPhoneSuccess('Phone number verified successfully.');
  } catch (err) {
    setPhoneError(
      err.response?.data?.message || 'Invalid OTP.'
    );
  } finally {
    setVerifyingOtp(false);
  }
};

  const load = () => {
    tenantService
      .getById(id)
      .then((res) => {
        setTenant(res.data.tenant);
        setHouse(res.data.house);
        setRoom(res.data.room);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) {
    return (
      <DashboardShell title="Tenant Details">
        <LoadingSpinner label="Loading tenant details..." />
      </DashboardShell>
    );
  }

  if (notFound || !tenant) {
    return (
      <DashboardShell title="Tenant Details">
        <EmptyState title="Tenant record not found" />
      </DashboardShell>
    );
  }

  const latestCorrection = [...(tenant.statusHistory || [])].reverse().find((h) => h.status === 'CORRECTION_REQUIRED');
  const correctionNotes = latestCorrection?.note ? latestCorrection.note.split('\n').filter(Boolean) : [];

  return (
    <DashboardShell title="Tenant Details">
      <div className="breadcrumb">
        <Link to={isAdmin ? '/admin/search' : '/owner/tenants'}>{isAdmin ? 'Search' : 'Tenants'}</Link> / {tenant.name}
      </div>

      {location.state?.justSubmitted && (
        <div className="alert alert-success">
          Application submitted successfully. It's now pending admin verification.
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
          <h2>{tenant.name}</h2>
          <div className="subtitle">
            {tenant.tenantId ? <span className="mono-id">{tenant.tenantId}</span> : 'Tenant ID pending approval'}
          </div>
        </div>
        <StatusBadge status={tenant.status} />
      </div>

      {tenant.status === 'CORRECTION_REQUIRED' && (
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

      {tenant.duplicateFlags?.length > 0 && (
        <div className="alert alert-error" style={{ display: 'block' }}>
          <strong>⚠ Flagged as a possible duplicate at submission</strong>
          <p style={{ margin: '8px 0 0' }}>
            This application was submitted despite a possible match with an existing record. It will need
            admin attention during verification.
          </p>
        </div>
      )}

      <div className="info-card">
        <div className="info-row"><span className="label">Phone</span><span>{tenant.phone}</span></div>
        <div
  className="info-card"
  style={{
    marginTop: 16,
    border: tenant.isPhoneVerified
      ? '1px solid #22c55e'
      : '1px solid #f59e0b',
  }}
>
  <div className="info-row">
    <span className="label">Phone Verification</span>

    {tenant.isPhoneVerified ? (
      <span style={{ color: '#16a34a', fontWeight: 600 }}>
        ✓ Verified
      </span>
    ) : (
      <span style={{ color: '#d97706', fontWeight: 600 }}>
        Not Verified
      </span>
    )}
  </div>

  {!isAdmin && !tenant.isPhoneVerified && (
    <div style={{ marginTop: 16 }}>
      {!otpSent ? (
        <button
          className="btn-primary-sm"
          onClick={handleSendPhoneOtp}
          disabled={sendingOtp}
        >
          {sendingOtp ? 'Sending OTP...' : 'Verify Phone Number'}
        </button>
      ) : (
        <div>
          <p style={{ fontSize: 13, marginBottom: 10 }}>
            Enter the 6-digit OTP sent to <strong>{tenant.phone}</strong>
          </p>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, ''))
              }
              placeholder="Enter OTP"
              style={{
                width: 150,
                padding: '9px 10px',
                border: '1px solid #ccc',
                borderRadius: 6,
              }}
            />

            <button
              className="btn-primary-sm"
              onClick={handleVerifyPhoneOtp}
              disabled={verifyingOtp || otp.length !== 6}
            >
              {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              className="btn-secondary"
              onClick={handleSendPhoneOtp}
              disabled={sendingOtp}
            >
              {sendingOtp ? 'Sending...' : 'Resend OTP'}
            </button>
          </div>
        </div>
      )}

      {phoneSuccess && (
        <div className="alert alert-success" style={{ marginTop: 12 }}>
          {phoneSuccess}
        </div>
      )}

      {phoneError && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          {phoneError}
        </div>
      )}
    </div>
  )}
</div>~
        {tenant.alternatePhone && (
          <div className="info-row"><span className="label">Alternate phone</span><span>{tenant.alternatePhone}</span></div>
        )}
        {tenant.gender && <div className="info-row"><span className="label">Gender</span><span style={{ textTransform: 'capitalize' }}>{tenant.gender}</span></div>}
        {tenant.dateOfBirth && (
          <div className="info-row"><span className="label">Date of birth</span><span>{new Date(tenant.dateOfBirth).toLocaleDateString()}</span></div>
        )}
        {tenant.education && <div className="info-row"><span className="label">Education</span><span>{tenant.education}</span></div>}
        {tenant.employer && <div className="info-row"><span className="label">Employer</span><span>{tenant.employer}</span></div>}
        {tenant.permanentAddress && (
          <div className="info-row"><span className="label">Permanent address</span><span>{tenant.permanentAddress}</span></div>
        )}
      </div>

      <h3 style={{ fontSize: 15, margin: '24px 0 8px' }}>Current Residence</h3>
      <div className="info-card" style={{ marginTop: 0 }}>
        <div className="info-row"><span className="label">House</span><span>{house?.address} ({house?.houseId})</span></div>
        <div className="info-row"><span className="label">Room</span><span>{room?.roomNumber} ({room?.roomId})</span></div>
        <div className="info-row"><span className="label">Village</span><span>{house?.village}</span></div>
      </div>

      {(tenant.photoUrl || tenant.documents?.length > 0) && (
        <>
          <h3 style={{ fontSize: 15, margin: '24px 0 8px' }}>Documents</h3>
          <div className="info-card" style={{ marginTop: 0 }}>
            {tenant.photoUrl && (
              <div className="info-row">
                <span className="label">Photograph</span>
                <a href={`${API_FILE_BASE}${tenant.photoUrl}`} target="_blank" rel="noreferrer">View</a>
              </div>
            )}
            {tenant.documents?.map((doc, i) => (
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
          <Link to={`/owner/tenants/${tenant._id}/history`} className="btn-secondary" style={{ textDecoration: 'none' }}>
            View Residence History
          </Link>
          {tenant.status === 'ACTIVE' && (
            <>
              <button className="btn-secondary" onClick={() => navigate(`/owner/tenants/${tenant._id}/transfer`)}>
                Transfer
              </button>
              <button className="btn-secondary" onClick={() => navigate(`/owner/tenants/${tenant._id}/move-out`)}>
                Move Out
              </button>
            </>
          )}
        </div>
      )}
      {isAdmin && (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 20 }}>Viewing as admin — read only.</p>
      )}

      {tenant.status !== 'CORRECTION_REQUIRED' && tenant.status !== 'ACTIVE' && (
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 20 }}>
          Transfer and move-out actions become available once this application is active.
        </p>
      )}

      {showResubmit && (
        <ResubmitTenantModal
          tenant={tenant}
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

function ResubmitTenantModal({ tenant, onClose, onDone, onError }) {
  const [form, setForm] = useState({
    name: tenant.name || '',
    phone: tenant.phone || '',
    alternatePhone: tenant.alternatePhone || '',
    education: tenant.education || '',
    employer: tenant.employer || '',
    permanentAddress: tenant.permanentAddress || '',
    houseId: '',
    roomId: '',
  });
  const [photo, setPhoto] = useState(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });
      if (photo) data.append('photo', photo);
      documents.forEach((doc) => data.append('documents', doc));

      await tenantService.resubmit(tenant._id, data);
      onDone();
    } catch (err) {
      onError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h3>Update application</h3>
        <p>Fix the flagged issues, then resubmit for review.</p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="rname">Full name</label>
            <input id="rname" type="text" value={form.name} onChange={update('name')} />
          </div>
          <div className="field">
            <label htmlFor="rphone">Phone number</label>
            <input id="rphone" type="tel" value={form.phone} onChange={update('phone')} />
          </div>
          <div className="field">
            <label htmlFor="raddr">Permanent address</label>
            <input id="raddr" type="text" value={form.permanentAddress} onChange={update('permanentAddress')} />
          </div>

          <div className="field">
            <label htmlFor="rhouse">Change house (optional — leave blank to keep current)</label>
            <select id="rhouse" value={form.houseId} onChange={(e) => setForm((f) => ({ ...f, houseId: e.target.value, roomId: '' }))}>
              <option value="">Keep current house</option>
              {houses.map((h) => (
                <option key={h.houseId} value={h.houseId}>{h.address} ({h.houseId})</option>
              ))}
            </select>
          </div>
          {form.houseId && (
            <div className="field">
              <label htmlFor="rroom">Room</label>
              <select id="rroom" value={form.roomId} onChange={update('roomId')}>
                <option value="">Select a room</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId} disabled={r.capacity - r.currentOccupancy < 1}>
                    {r.roomNumber} — {r.capacity - r.currentOccupancy} available
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="rphoto">Replace photograph (optional)</label>
            <input id="rphoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files[0])} />
          </div>
          <div className="field">
            <label htmlFor="rdocs">Replace documents (optional, up to 5)</label>
            <input
              id="rdocs"
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
