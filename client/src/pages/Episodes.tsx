import { useEffect, useState } from 'react';
import type { Episode } from '../api/types';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

export default function Episodes() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/episodes').then(({ data }) => setEpisodes(data.episodes)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-1">برنامج يا هلا انت صح</h1>
      <p className="text-[var(--color-ink-dim)] mb-6">شارك في البرنامج التلفزيوني، وتابع حلقات الموسم</p>

      {loading ? (
        <Spinner />
      ) : episodes.length === 0 ? (
        <p className="text-[var(--color-ink-faint)]">لا تتوافر حلقات بعد</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {episodes.map((e) => (
            <div key={e.id} className="card p-5">
              <p className="font-bold mb-1">{e.title}</p>
              {e.description && <p className="text-sm text-[var(--color-ink-dim)]">{e.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
