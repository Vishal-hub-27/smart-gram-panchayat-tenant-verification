import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

/**
 * Not in the original page/component list, but a small justified addition:
 * every authenticated page (owner or admin) needs the same Sidebar +
 * Navbar composition, and repeating that wiring in every page would
 * violate DRY. This wraps it once.
 */
export default function DashboardShell({ title, children }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="dash-shell-v2">
      <Sidebar role={user?.role} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="dash-main">
        <Navbar title={title} onMenuClick={() => setMenuOpen(true)} />
        <div className="dash-content">{children}</div>
      </div>
    </div>
  );
}
