import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import type { Purchase } from '../api/types';
import Spinner from '../components/Spinner';

export default function Account() {
  const { user, logout } = useAuthStore();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/purchases/mine').then(({ data }) => setPurchases(data.purchases)).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">حسابي</h1>

      <div className="card p-5">
        <p className="font-bold text-lg mb-1">{user.name}</p>
        <p className="text-sm text-[var(--color-ink-dim)]">الألعاب المتبقية: {user.remainingGames}</p>
      </div>

      <div>
        <h2 className="font-bold mb-3">سجل الدفع</h2>
        {loading ? (
          <Spinner />
        ) : purchases.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">لا تتوافر بيانات</p>
        ) : (
          <div className="flex flex-col gap-2">
            {purchases.map((p) => (
              <div key={p.id} className="card p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-bold">{p.package.name}</p>
                  <p className="text-xs text-[var(--color-ink-faint)]">{new Date(p.createdAt).toLocaleDateString('ar')}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold">{p.amount.toFixed(3)} {p.package.currency}</p>
                  <p className={p.status === 'PAID' ? 'text-[var(--color-success)] text-xs' : 'text-[var(--color-danger)] text-xs'}>
                    {p.status === 'PAID' ? 'نجاح' : p.status === 'PENDING' ? 'قيد الانتظار' : 'فشل'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="btn btn-danger self-start"
        onClick={() => {
          logout();
          navigate('/');
        }}
      >
        تسجيل خروج
      </button>
    </div>
  );
}
