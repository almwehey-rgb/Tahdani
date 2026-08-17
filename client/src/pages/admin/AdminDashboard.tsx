import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

interface Summary {
  users: number;
  games: number;
  purchases: number;
  revenue: number;
  tournaments: number;
  pendingTvApplications: number;
  openVarReports: number;
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.get('/admin/summary').then(({ data }) => setSummary(data));
  }, []);

  if (!summary) return <Spinner />;

  const cards = [
    { label: 'المستخدمون', value: summary.users, icon: '👤' },
    { label: 'الألعاب المُنشأة', value: summary.games, icon: '🎮' },
    { label: 'عمليات الشراء', value: summary.purchases, icon: '💳' },
    { label: 'الإيرادات (BHD)', value: summary.revenue.toFixed(3), icon: '💰' },
    { label: 'البطولات', value: summary.tournaments, icon: '🏆' },
    { label: 'طلبات تلفزيون قيد الانتظار', value: summary.pendingTvApplications, icon: '📺' },
    { label: 'بلاغات VAR مفتوحة', value: summary.openVarReports, icon: '🚩' },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="card p-5">
          <div className="text-2xl mb-2">{c.icon}</div>
          <p className="text-2xl font-black">{c.value}</p>
          <p className="text-sm text-[var(--color-ink-dim)]">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
