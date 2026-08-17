import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

interface AdminPurchase {
  id: string;
  amount: number;
  status: string;
  purpose: string;
  provider: string | null;
  createdAt: string;
  package: { name: string; currency: string };
  user: { name: string };
}

export default function AdminPurchases() {
  const [purchases, setPurchases] = useState<AdminPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/purchases/admin/all').then(({ data }) => setPurchases(data.purchases)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-[var(--color-ink-faint)] border-b border-[var(--color-border)]">
            <th className="py-2 px-2">المستخدم</th>
            <th className="py-2 px-2">الباقة</th>
            <th className="py-2 px-2">المبلغ</th>
            <th className="py-2 px-2">الحالة</th>
            <th className="py-2 px-2">البوابة</th>
            <th className="py-2 px-2">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id} className="border-b border-[var(--color-border)]">
              <td className="py-2 px-2">{p.user.name}</td>
              <td className="py-2 px-2">{p.package.name}</td>
              <td className="py-2 px-2">
                {p.amount.toFixed(3)} {p.package.currency}
              </td>
              <td className="py-2 px-2">
                <span className={p.status === 'PAID' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{p.status}</span>
                {p.purpose === 'GIFT' && <span className="text-[var(--color-gold)] text-xs mr-1">(هدية)</span>}
              </td>
              <td className="py-2 px-2 text-[var(--color-ink-faint)]">{p.provider || '—'}</td>
              <td className="py-2 px-2 text-[var(--color-ink-faint)]">{new Date(p.createdAt).toLocaleDateString('ar')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
