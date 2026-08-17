import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

interface VarReport {
  id: string;
  note: string;
  status: string;
  createdAt: string;
  question: { text: string; answer: string; category: { name: string } };
}

export default function AdminVarReports() {
  const [reports, setReports] = useState<VarReport[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await api.get('/admin/var-reports');
    setReports(data.reports);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string) {
    await api.put(`/admin/var-reports/${id}/resolve`);
    load();
  }

  if (loading) return <Spinner />;
  if (reports.length === 0) return <p className="text-[var(--color-ink-faint)]">لا توجد بلاغات حاليا</p>;

  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-hi)]">{r.question.category.name}</span>
            {r.status === 'OPEN' ? (
              <button className="btn btn-primary !py-1 !px-3 text-xs" onClick={() => resolve(r.id)}>
                وضع كمحلول
              </button>
            ) : (
              <span className="text-xs text-[var(--color-success)]">تم الحل</span>
            )}
          </div>
          <p className="font-bold text-sm mb-1">{r.question.text}</p>
          <p className="text-xs text-[var(--color-ink-faint)] mb-2">الإجابة الحالية: {r.question.answer}</p>
          <p className="text-sm bg-[var(--color-bg-soft)] rounded-lg p-2">ملاحظة اللاعب: {r.note}</p>
        </div>
      ))}
    </div>
  );
}
