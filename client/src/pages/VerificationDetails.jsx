import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import verificationService from '../services/verificationService';

const API_FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const CHECKLIST_ITEMS = [
  'Owner information verified',
  'House and room details verified',
  'Uploaded documents are legible and match the applicant',
  'Photograph is clear and present',
  'Phone verification status is acceptable',
  'Room capacity confirmed for this application',
  'No unresolved duplicate concerns',
];

export default function VerificationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState(null); // { message } after an action succeeds

  const [checked, setChecked] = useState({});
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    verificationService
      .getById(id)
      .then((res) => setData(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const toggleCheck = (item) => setChecked((c) => ({ ...c, [item]: !c[item] }));

  const handleApprove = async () => {
    setConfirmApprove(false);
    setSubmitting(true);
    setError('');
    try {
      const res = await verificationService.approve(id);
      setResolved({ message: res.message });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await verificationService.reject(id, rejectReason.trim());
      setShowReject(false);
      setResolved({ message: res.message });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestCorrection = async () => {
    const notes = correctionText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (notes.length === 0) {
      setError('Please enter at least one correction reason.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await verificationService.requestCorrection(id, notes);
      setShowCorrection(false);
      setResolved({ message: res.message });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell title="Verification">
        <LoadingSpinner label="Loading application..." />
      </DashboardShell>
    );
  }

  if (notFound || !data) {
    return (
      <DashboardShell title="Verification">
        <EmptyState title="Application not found" />
      </DashboardShell>
    );
  }

  const { verification, subject, members, owner, house, room } = data;
  const isTenant = verification.subjectType === 'tenant';
  const documents = subject.documents || [];
  const photoUrl = isTenant ? subject.photoUrl : subject.headPhotoUrl;

  if (resolved) {
    return (
      <DashboardShell title="Verification">
        <div className="alert alert-success">{resolved.message}</div>
        <Link to="/admin/verifications" className="btn-primary-sm" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 10 }}>
          Back to Queue
        </Link>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Verification">
      <div className="breadcrumb">
        <Link to="/admin/verifications">Verification Queue</Link> / {isTenant ? subject.name : subject.headName}
      </div>

      <div className="page-header">
        <div>
          <h2>{isTenant ? subject.name : subject.headName}</h2>
          <div className="subtitle" style={{ textTransform: 'capitalize' }}>
            {verification.subjectType} application
          </div>
        </div>
        <StatusBadge status={verification.status} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {subject.duplicateFlags?.length > 0 && (
        <div className="alert alert-error" style={{ display: 'block' }}>
          <strong>⚠ Duplicate warning</strong>
          <p style={{ margin: '8px 0 0' }}>
            This was flagged as a possible duplicate at submission against:{' '}
            {subject.duplicateFlags.map((f, i) => (
              <span key={i}>
                {i > 0 && ', '}
                {f.name} ({f.recordType}, {f.matchedId || 'pending'})
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="verify-split">
        <div className="verify-left">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Application Details</h3>
          <div className="info-card" style={{ marginTop: 0 }}>
            {isTenant ? (
              <>
                <div className="info-row"><span className="label">Name</span><span>{subject.name}</span></div>
                <div className="info-row"><span className="label">Phone</span><span>{subject.phone}</span></div>
                {subject.alternatePhone && <div className="info-row"><span className="label">Alternate phone</span><span>{subject.alternatePhone}</span></div>}
                {subject.gender && <div className="info-row"><span className="label">Gender</span><span style={{ textTransform: 'capitalize' }}>{subject.gender}</span></div>}
                {subject.education && <div className="info-row"><span className="label">Education</span><span>{subject.education}</span></div>}
                {subject.employer && <div className="info-row"><span className="label">Employer</span><span>{subject.employer}</span></div>}
                {subject.permanentAddress && <div className="info-row"><span className="label">Permanent address</span><span>{subject.permanentAddress}</span></div>}
              </>
            ) : (
              <>
                <div className="info-row"><span className="label">Head</span><span>{subject.headName}</span></div>
                <div className="info-row"><span className="label">Phone</span><span>{subject.headPhone}</span></div>
                <div className="info-row"><span className="label">Phone verified</span><span>{subject.isHeadPhoneVerified ? 'Yes' : 'Not yet'}</span></div>
                <div className="info-row"><span className="label">Members</span><span>{(members?.length || 0) + 1} total</span></div>
              </>
            )}
          </div>

          {!isTenant && members?.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Family Members</h3>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr><th>Name</th><th>Relationship</th></tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m._id}><td>{m.name}</td><td>{m.relationship}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Owner</h3>
          <div className="info-card" style={{ marginTop: 0 }}>
            <div className="info-row"><span className="label">Name</span><span>{owner?.name}</span></div>
            <div className="info-row"><span className="label">Owner ID</span><span className="mono">{owner?.ownerId}</span></div>
            <div className="info-row"><span className="label">Village</span><span>{owner?.village}</span></div>
          </div>

          <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>House &amp; Room</h3>
          <div className="info-card" style={{ marginTop: 0 }}>
            <div className="info-row"><span className="label">House</span><span>{house?.address} ({house?.houseId})</span></div>
            <div className="info-row"><span className="label">Village</span><span>{house?.village}</span></div>
            <div className="info-row"><span className="label">Room</span><span>{room?.roomNumber} ({room?.roomId})</span></div>
            <div className="info-row"><span className="label">Capacity</span><span>{room?.currentOccupancy} / {room?.capacity} occupied</span></div>
          </div>
        </div>

        <div className="verify-right">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Documents &amp; Photos</h3>
          <div className="info-card" style={{ marginTop: 0 }}>
            {photoUrl && (
              <div className="info-row">
                <span className="label">Photograph</span>
                <a href={`${API_FILE_BASE}${photoUrl}`} target="_blank" rel="noreferrer">View</a>
              </div>
            )}
            {documents.length === 0 && !photoUrl && <div className="info-row"><span className="label">No documents uploaded</span></div>}
            {documents.map((doc, i) => (
              <div className="info-row" key={i}>
                <span className="label">{doc.label || `Document ${i + 1}`}</span>
                <a href={`${API_FILE_BASE}${doc.url}`} target="_blank" rel="noreferrer">View</a>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 15, margin: '20px 0 10px' }}>Verification Checklist</h3>
          <div className="checklist">
            {CHECKLIST_ITEMS.map((item) => (
              <label key={item} className="checklist-item">
                <input type="checkbox" checked={!!checked[item]} onChange={() => toggleCheck(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="verify-actions">
        <button className="btn-secondary" onClick={() => setShowCorrection(true)} disabled={submitting}>
          Request Correction
        </button>
        <button className="btn-danger" onClick={() => setShowReject(true)} disabled={submitting}>
          Reject
        </button>
        <button className="btn-primary-sm" onClick={() => setConfirmApprove(true)} disabled={submitting}>
          Approve
        </button>
      </div>

      <ConfirmDialog
        open={confirmApprove}
        title="Approve this application?"
        message={`This will generate a permanent ${isTenant ? 'Tenant' : 'Family'} ID and mark the record as active. This cannot be undone from here.`}
        confirmLabel="Approve"
        onConfirm={handleApprove}
        onCancel={() => setConfirmApprove(false)}
      />

      {showReject && (
        <div className="dialog-overlay" onClick={() => setShowReject(false)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h3>Reject application</h3>
            <p>Provide a reason. The owner will be able to see this on their application.</p>
            <textarea
              className="correction-textarea"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
            />
            <div className="modal-form-actions">
              <button className="btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleReject} disabled={submitting}>
                {submitting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorrection && (
        <div className="dialog-overlay" onClick={() => setShowCorrection(false)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h3>Request correction</h3>
            <p>Enter one issue per line, e.g.:</p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: -8 }}>
              Document image is unclear<br />House address incomplete<br />Tenant photograph missing
            </p>
            <textarea
              className="correction-textarea"
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              placeholder="One issue per line..."
            />
            <div className="modal-form-actions">
              <button className="btn-secondary" onClick={() => setShowCorrection(false)}>Cancel</button>
              <button className="btn-primary-sm" onClick={handleRequestCorrection} disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Correction Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
