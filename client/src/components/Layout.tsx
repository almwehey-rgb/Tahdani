import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Logo from './Logo';
import { useAuthStore } from '../store/auth';
import { useGameUiStore } from '../store/gameUi';
import { useThemeStore } from '../store/theme';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-[var(--color-surface-hi)] text-[var(--color-ink)]'
      : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
  }`;

// The game board sizes itself to exactly fill the viewport below the
// header (see Board.tsx) so the whole thing is visible without scrolling —
// a footer strip here would just eat into that space for no reason.
const HIDE_FOOTER_PATTERN = /^\/game\/[^/]+\/board$/;

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const showFooter = !HIDE_FOOTER_PATTERN.test(location.pathname);
  const finishGameHandler = useGameUiStore((s) => s.finishGameHandler);
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur bg-[var(--color-header-bg)] border-b border-[var(--color-border)]">
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
            {finishGameHandler && (
              <button className="btn btn-danger !py-2 !px-3 text-sm" onClick={finishGameHandler}>
                إنهاء اللعبة
              </button>
            )}
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
              className="btn btn-ghost !py-2 !px-3"
              onClick={toggleTheme}
              aria-label="تبديل المظهر"
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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

      {showFooter && (
        <footer className="border-t border-[var(--color-border)] py-6 text-center text-sm text-[var(--color-ink-faint)]">
          تحدّني © {new Date().getFullYear()} — لعبة أسئلة وتحديات جماعية
        </footer>
      )}
    </div>
  );
}
