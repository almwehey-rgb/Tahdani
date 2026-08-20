import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
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
  const [accessCode, setAccessCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  useEffect(() => {
    api.get('/admin/summary').then(({ data }) => setSummary(data));
    api.get('/admin/access-code').then(({ data }) => setAccessCode(data.accessCode || ''));
  }, []);

  async function saveCode() {
    if (newCode.trim().length < 3) return toast.error('الكود يجب أن يكون 3 أحرف على الأقل');
    setSavingCode(true);
    try {
      const { data } = await api.put('/admin/access-code', { accessCode: newCode.trim() });
      setAccessCode(data.accessCode);
      setNewCode('');
      toast.success('تم تحديث كود الدخول');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingCode(false);
    }
  }

  if (!summary) return <Spinner />;

  const cards = [
    { label: 'المستخدمون', value: summary.users, icon: '👤' },
    { label: 'الألعاب المُنشأة', value: summary.games, icon: '🎮' },
    { label: 'عمليات الشراء', value: summary.purchases, icon: '💳' },
    { label: 'الإيرادات (د.ك)', value: summary.revenue.toFixed(3), icon: '💰' },
    { label: 'البطولات', value: summary.tournaments, icon: '🏆' },
    { label: 'طلبات تلفزيون قيد الانتظار', value: summary.pendingTvApplications, icon: '📺' },
    { label: 'بلاغات VAR مفتوحة', value: summary.openVarReports, icon: '🚩' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5 max-w-md">
        <h2 className="font-bold mb-1">كود الدخول المشترك</h2>
        <p className="text-sm text-[var(--color-ink-dim)] mb-3">هذا هو الكود اللي يدخل فيه الجميع بدل رقم الهاتف</p>
        <p className="font-mono text-lg font-black mb-3 tracking-widest" style={{ color: 'var(--color-gold)' }}>
          {accessCode || '—'}
        </p>
        <div className="flex gap-2">
          <input className="input" placeholder="كود جديد" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <button className="btn btn-primary !px-5" onClick={saveCode} disabled={savingCode}>
            تحديث
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="text-2xl mb-2">{c.icon}</div>
            <p className="text-2xl font-black">{c.value}</p>
            <p className="text-sm text-[var(--color-ink-dim)]">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
