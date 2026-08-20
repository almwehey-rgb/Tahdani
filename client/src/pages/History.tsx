import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../api/client';
import Spinner from '../components/Spinner';

type HistoryTeam = { id: string; name: string; color: string; score: number };

type HistoryGame = {
  id: string;
  mode: 'CLASSIC' | 'KIDS' | 'STUDENT';
  createdAt: string;
  finishedAt: string | null;
  winnerTeamId: string | null;
  isTie: boolean;
  teams: HistoryTeam[];
  categories: string[];
};

const MODE_LABELS: Record<HistoryGame['mode'], string> = {
  CLASSIC: 'تحدّي',
  KIDS: 'أطفال',
  STUDENT: 'حقيبة الطالب',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function History() {
  const [games, setGames] = useState<HistoryGame[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/games/history');
      setGames(data.games);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setGames([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteOne(game: HistoryGame) {
    if (!window.confirm(`حذف لعبة ${formatDate(game.createdAt)} نهائياً؟`)) return;
    setBusy(true);
    try {
      await api.delete(`/games/${game.id}`);
      setGames((prev) => (prev || []).filter((g) => g.id !== game.id));
      toast.success('تم الحذف');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    const count = games?.length ?? 0;
    if (!window.confirm(`حذف كل السجل (${count} لعبة) نهائياً؟ ما راح تقدر ترجعها.`)) return;
    setBusy(true);
    try {
      await api.delete('/games/history');
      setGames([]);
      toast.success('تم مسح السجل');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (games === null) return <Spinner />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">سجل الألعاب</h1>
          <p className="text-[var(--color-ink-dim)]">{games.length} لعبة سابقة</p>
        </div>
        {games.length > 0 && (
          <button className="btn btn-ghost !text-[var(--color-danger)] shrink-0" onClick={deleteAll} disabled={busy}>
            🗑 مسح السجل كامل
          </button>
        )}
      </div>

      {games.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-bold mb-1">ما فيه ألعاب سابقة</p>
          <p className="text-sm text-[var(--color-ink-dim)]">الألعاب اللي تخلّصها بتظهر هنا</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {games.map((game) => {
            const ranked = [...game.teams].sort((a, b) => b.score - a.score);
            return (
              <div key={game.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {MODE_LABELS[game.mode] || game.mode} — {formatDate(game.createdAt)}
                    </p>
                    {game.categories.length > 0 && (
                      <p className="text-sm text-[var(--color-ink-faint)] truncate">{game.categories.join(' · ')}</p>
                    )}
                  </div>
                  <button
                    className="text-[var(--color-danger)] text-sm shrink-0"
                    onClick={() => deleteOne(game)}
                    disabled={busy}
                  >
                    حذف
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ranked.map((team) => {
                    const isWinner = !game.isTie && team.id === game.winnerTeamId;
                    return (
                      <span
                        key={team.id}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold border-2"
                        style={{
                          borderColor: isWinner ? team.color : 'var(--color-border)',
                          background: isWinner ? `${team.color}22` : 'transparent',
                        }}
                      >
                        {isWinner && '🏆 '}
                        {team.name}: {team.score}
                      </span>
                    );
                  })}
                  {game.isTie && <span className="px-3 py-1.5 text-sm text-[var(--color-ink-faint)]">تعادل</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
