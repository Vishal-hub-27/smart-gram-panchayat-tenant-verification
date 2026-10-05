import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import notificationService from '../services/notificationService';

const TYPE_LABELS = {
  APPLICATION_SUBMITTED: 'Submitted',
  NEW_APPLICATION: 'New application',
  APPLICATION_RESUBMITTED: 'Resubmitted',
  APPLICATION_APPROVED: 'Approved',
  APPLICATION_REJECTED: 'Rejected',
  CORRECTION_REQUIRED: 'Correction needed',
  TRANSFER_REQUESTED: 'Transfer request',
  TRANSFER_APPROVED: 'Transfer approved',
  TRANSFER_REJECTED: 'Transfer rejected',
  MOVE_OUT_REQUESTED: 'Move-out request',
  MOVE_OUT_CONFIRMED: 'Moved out',
  MOVE_OUT_REJECTED: 'Move-out rejected',
};

// Types that deserve visual weight because they ask the reader to act or
// report a negative outcome.
const ATTENTION = new Set(['CORRECTION_REQUIRED', 'APPLICATION_REJECTED', 'TRANSFER_REJECTED', 'MOVE_OUT_REJECTED']);

const notifyBell = () => window.dispatchEvent(new Event('notifications:changed'));

export default function Notifications() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    notificationService
      .list({ page, limit: 15, ...(unreadOnly ? { unread: 'true' } : {}) })
      .then((res) => {
        setItems(res.data.notifications);
        setPagination(res.data.pagination);
        setUnreadCount(res.data.unreadCount);
      })
      .catch(() => showToast('Could not load notifications.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, unreadOnly]);

  const open = async (n) => {
    if (!n.isRead) {
      try {
        await notificationService.markRead(n._id);
        setItems((list) => list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
        notifyBell();
      } catch {
        /* still navigate even if marking failed */
      }
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      showToast('All notifications marked as read.');
      notifyBell();
      load();
    } catch {
      showToast('Something went wrong.', 'error');
    }
  };

  return (
    <DashboardShell title="Notifications">
      <div className="page-header">
        <div>
          <h2>Notifications</h2>
          <div className="subtitle">{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}</div>
        </div>
        <button className="btn-secondary" onClick={markAll} disabled={unreadCount === 0}>
          Mark all as read
        </button>
      </div>

      <div className="mode-toggle">
        <button className={!unreadOnly ? 'active' : ''} onClick={() => { setUnreadOnly(false); setPage(1); }}>All</button>
        <button className={unreadOnly ? 'active' : ''} onClick={() => { setUnreadOnly(true); setPage(1); }}>Unread</button>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading notifications..." />
      ) : items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="Updates about your applications and requests will appear here."
        />
      ) : (
        <div className="notif-list">
          {items.map((n) => (
            <button
              key={n._id}
              className={`notif-item ${n.isRead ? '' : 'unread'} ${ATTENTION.has(n.type) ? 'attention' : ''}`}
              onClick={() => open(n)}
            >
              <div className="notif-item-top">
                <span className="notif-type">{TYPE_LABELS[n.type] || n.type}</span>
                <span className="notif-time">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              <div className="notif-message">{n.message}</div>
            </button>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />
      <Toast toast={toast} />
    </DashboardShell>
  );
}
