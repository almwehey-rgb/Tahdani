import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Logo from './Logo';
import { useAuthStore } from '../store/auth';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
    isActive ? 'bg-[var(--color-surface-hi)] text-white' : 'text-[var(--color-ink-dim)] hover:text-white'
  }`;

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur bg-[rgba(15,16,36,0.85)] border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>الرئيسية</NavLink>
            <NavLink to="/tournaments" className={navLinkClass}>البطولات</NavLink>
            <NavLink to="/episodes" className={navLinkClass}>الحلقات</NavLink>
            <NavLink to="/tv-apply" className={navLinkClass}>شارك في البرنامج</NavLink>
            <NavLink to="/packages" className={navLinkClass}>الباقات</NavLink>
            {user?.role === 'ADMIN' && <NavLink to="/admin" className={navLinkClass}>لوحة التحكم</NavLink>}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-full bg-[var(--color-surface-hi)] text-[var(--color-gold)]">
                  🎮 {user.remainingGames}
                </span>
                <Link to="/account" className="btn btn-ghost !py-2 !px-3 text-sm">{user.name}</Link>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary !py-2 !px-4 text-sm">دخول</Link>
            )}
            <button
              className="md:hidden btn btn-ghost !py-2 !px-3"
              onClick={() => setOpen((o) => !o)}
              aria-label="menu"
            >
              ☰
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden flex flex-col gap-1 px-4 pb-3">
            <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>الرئيسية</NavLink>
            <NavLink to="/tournaments" className={navLinkClass} onClick={() => setOpen(false)}>البطولات</NavLink>
            <NavLink to="/episodes" className={navLinkClass} onClick={() => setOpen(false)}>الحلقات</NavLink>
            <NavLink to="/tv-apply" className={navLinkClass} onClick={() => setOpen(false)}>شارك في البرنامج</NavLink>
            <NavLink to="/packages" className={navLinkClass} onClick={() => setOpen(false)}>الباقات</NavLink>
            {user?.role === 'ADMIN' && <NavLink to="/admin" className={navLinkClass} onClick={() => setOpen(false)}>لوحة التحكم</NavLink>}
            {user && (
              <button
                className="text-right px-3 py-2 rounded-lg text-sm font-semibold text-[var(--color-danger)]"
                onClick={() => {
                  logout();
                  navigate('/');
                  setOpen(false);
                }}
              >
                تسجيل خروج
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-border)] py-6 text-center text-sm text-[var(--color-ink-faint)]">
        تحدّني © {new Date().getFullYear()} — لعبة أسئلة وتحديات جماعية
      </footer>
    </div>
  );
}
