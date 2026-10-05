import { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import transferService from '../services/transferService';
import moveOutService from '../services/moveOutService';

export default function ResidenceRequestQueue() {
  const { toast, showToast } = useToast();
  const [tab, setTab] = useState('transfer');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmApprove, setConfirmApprove] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const svc = tab === 'transfer' ? transferService : moveOutService;

  const load = () => {
    setLoading(true);
    svc
      .list({ status: 'PENDING' })
      .then((res) => setRequests(res.data.requests))
      .catch(() => showToast('Could not load requests.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const handleApprove = async () => {
    const req = confirmApprove;
    setConfirmApprove(null);
    try {
      await svc.approve(req._id);
      showToast('Request approved.');
      load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong.', 'error');
    }
  };

  const handleReject = async () => {
    const req = rejectTarget;
    setRejectTarget(null);
    try {
      await svc.reject(req._id, rejectReason);
      setRejectReason('');
      showToast('Request rejected.');
      load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong.', 'error');
    }
  };

  return (
    <DashboardShell title="Transfers & Move-Outs">
      <div className="page-header">
        <div>
          <h2>Transfers &amp; Move-Outs</h2>
          <div className="subtitle">Requests awaiting your confirmation.</div>
        </div>
      </div>

      <div className="mode-toggle">
        <button className={tab === 'transfer' ? 'active' : ''} onClick={() => setTab('transfer')}>Transfers</button>
        <button className={tab === 'move_out' ? 'active' : ''} onClick={() => setTab('move_out')}>Move-Outs</button>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading requests..." />
      ) : requests.length === 0 ? (
        <EmptyState title="Nothing pending" description={`No ${tab === 'transfer' ? 'transfer' : 'move-out'} requests awaiting review.`} />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{tab === 'transfer' ? 'From' : 'House'}</th>
              {tab === 'transfer' && <th>To</th>}
              {tab === 'move_out' && <th>Move-out Date</th>}
              <th>Reason</th>
              <th>Requested</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r._id}>
                <td>{r.fromHouseId?.address} / {r.fromRoomId?.roomNumber}</td>
                {tab === 'transfer' && <td>{r.toHouseId?.address} / {r.toRoomId?.roomNumber}</td>}
                {tab === 'move_out' && <td>{r.moveOutDate ? new Date(r.moveOutDate).toLocaleDateString() : '—'}</td>}
                <td>{r.reason || '—'}</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" onClick={() => setRejectTarget(r)}>Reject</button>
                  <button className="btn-primary-sm" onClick={() => setConfirmApprove(r)}>Approve</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={!!confirmApprove}
        title={tab === 'transfer' ? 'Approve this transfer?' : 'Confirm this move-out?'}
        message={
          tab === 'transfer'
            ? 'This will move the resident to the new room and update the occupancy of both rooms immediately.'
            : 'This will end the residence and free up the room slot immediately.'
        }
        confirmLabel="Confirm"
        onConfirm={handleApprove}
        onCancel={() => setConfirmApprove(null)}
      />

      {rejectTarget && (
        <div className="dialog-overlay" onClick={() => setRejectTarget(null)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h3>Reject request</h3>
            <p>Optionally provide a reason.</p>
            <textarea
              className="correction-textarea"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional)..."
            />
            <div className="modal-form-actions">
              <button className="btn-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </DashboardShell>
  );
}
