import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

interface TvApplication {
  id: string;
  teamName: string;
  phone: string;
  gender: string;
  status: string;
  createdAt: string;
}

export default function AdminTvApplications() {
  const [applications, setApplications] = useState<TvApplication[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await api.get('/tv-applications');
    setApplications(data.applications);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markReviewed(id: string) {
    await api.put(`/tv-applications/${id}/status`, { status: 'REVIEWED' });
    load();
  }

  if (loading) return <Spinner />;
  if (applications.length === 0) return <p className="text-[var(--color-ink-faint)]">لا توجد طلبات حاليا</p>;

  return (
    <div className="flex flex-col gap-2">
      {applications.map((a) => (
        <div key={a.id} className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-bold">{a.teamName}</p>
            <p className="text-sm text-[var(--color-ink-dim)]">
              {a.phone} — {a.gender === 'MALE' ? 'شباب' : 'بنات'}
            </p>
          </div>
          {a.status === 'PENDING' ? (
            <button className="btn btn-primary !py-1.5 !px-3 text-sm" onClick={() => markReviewed(a.id)}>
              وضع كمُراجَع
            </button>
          ) : (
            <span className="text-sm text-[var(--color-success)]">تمت المراجعة</span>
          )}
        </div>
      ))}
    </div>
  );
}
