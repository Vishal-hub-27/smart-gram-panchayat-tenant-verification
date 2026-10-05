import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import notificationService from '../services/notificationService';

const POLL_MS = 45000;

// Unread-count bell for the navbar. Polls a deliberately cheap count
// endpoint (rather than the full list) and also refreshes immediately when
// the Notifications page dispatches "notifications:changed".
export default function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    notificationService
      .unreadCount()
      .then((res) => setCount(res.data.unreadCount))
      .catch(() => {}); // a failed poll should never disturb the page
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    window.addEventListener('notifications:changed', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications:changed', refresh);
    };
  }, [refresh]);

  return (
    <Link
      to={`/${user?.role}/notifications`}
      className="notif-bell"
      aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
    >
      <span aria-hidden="true">🔔</span>
      {count > 0 && <span className="notif-badge">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
