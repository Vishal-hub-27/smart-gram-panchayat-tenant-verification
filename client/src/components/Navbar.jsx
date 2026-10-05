import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar({ title, onMenuClick }) {
  const { profile, logout } = useAuth();

  return (
    <div className="navbar">
      <div className="navbar-left">
        <button className="navbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
          ☰
        </button>
        <h2 className="navbar-title">{title}</h2>
      </div>
      <div className="navbar-right">
        <NotificationBell />
        <span className="navbar-user">{profile?.name}</span>
        <button className="btn-link" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
