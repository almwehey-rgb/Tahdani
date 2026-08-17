import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Tournament } from '../../api/types';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

export default function TournamentsList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournaments').then(({ data }) => setTournaments(data.tournaments)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">البطولات</h1>
          <p className="text-[var(--color-ink-dim)]">اصنع بطولتك وتحداهم، صار وقت التحدي مع تحدّني</p>
        </div>
        <Link to="/tournaments/new" className="btn btn-gold">
          + بطولة جديدة
        </Link>
      </div>

      {loading ? (
        <Spinner />
      ) : tournaments.length === 0 ? (
        <p className="text-[var(--color-ink-faint)]">لا يوجد بطولات، لم تلعب أي بطولة إلى الآن، ابدأ بطولتك</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="card p-5 hover:border-[var(--color-brand-hi)]">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-lg">{t.name}</p>
                <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-hi)]">
                  {t.status === 'FINISHED' ? 'انتهت' : t.status === 'IN_PROGRESS' ? 'جارية' : 'إعداد'}
                </span>
              </div>
              <p className="text-sm text-[var(--color-ink-dim)]">{t.teams.length} فرق — {t.format === 'KNOCKOUT' ? 'إقصائي' : 'دوري'}</p>
              {t.championTeam && <p className="text-sm mt-2 font-bold" style={{ color: 'var(--color-gold)' }}>🏆 بطل البطولة: {t.championTeam}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
