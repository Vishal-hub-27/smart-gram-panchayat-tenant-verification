import { NavLink } from 'react-router-dom';

const OWNER_LINKS = [
  { to: '/owner/dashboard', label: 'Dashboard' },
  { to: '/owner/houses', label: 'My Houses' },
  { to: '/owner/tenants', label: 'Tenants' },
  { to: '/owner/families', label: 'Families' },
  { to: '/owner/notifications', label: 'Notifications' },
];

const ADMIN_LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/verifications', label: 'Verification Queue' },
  { to: '/admin/search', label: 'Search' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/residence-requests', label: 'Transfers & Move-Outs' },
  { to: '/admin/notifications', label: 'Notifications' },
  { to: '/admin/audit-logs', label: 'Audit Logs' },
];

export default function Sidebar({ role, open, onClose }) {
  const links = role === 'admin' ? ADMIN_LINKS : OWNER_LINKS;

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">Gram Panchayat</div>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              onClick={onClose}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
