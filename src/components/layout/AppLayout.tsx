import { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

export function AppLayout() {
  const { isAdmin, logout } = useAdmin();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/', label: 'لوحة الترتيب', end: true },
    ...(isAdmin
      ? [
          { to: '/history', label: 'سجل التقييمات', end: false },
          { to: '/admin', label: 'لوحة الإدارة', end: false },
        ]
      : []),
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-block">
            <button
              type="button"
              className="icon-btn mobile-only"
              aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Link to="/" className="brand-link brand-text-only" onClick={() => setOpen(false)}>
              <span className="brand-name-next">Next</span>
              <span className="brand-name-dev">Dev</span>
            </Link>
          </div>

          <nav className={`main-nav ${open ? 'open' : ''}`}>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            {isAdmin ? (
              <button
                type="button"
                className="nav-link nav-btn"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
              >
                خروج الأدمن
              </button>
            ) : (
              <NavLink
                to="/admin/login"
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setOpen(false)}
              >
                دخول الأدمن
              </NavLink>
            )}
          </nav>


        </div>
      </header>

      {open ? (
        <button
          type="button"
          className="nav-scrim mobile-only"
          aria-label="إغلاق"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
