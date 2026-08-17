import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import Spinner from './Spinner';

// Players never see a login screen: the first time someone without a
// session hits a protected route, we silently create a guest account for
// them and carry on. /login still exists for anyone who wants to sign in
// as an existing account (mainly the admin).
export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const [guestPending, setGuestPending] = useState(!token);

  useEffect(() => {
    if (token) return;
    let cancelled = false;
    api
      .post('/auth/guest')
      .then(({ data }) => {
        if (!cancelled) setSession(data.token, data.user);
      })
      .finally(() => {
        if (!cancelled) setGuestPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token && guestPending) return <Spinner />;
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}
