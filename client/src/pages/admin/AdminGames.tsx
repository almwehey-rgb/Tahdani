import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import Spinner from '../../components/Spinner';

type AdminTeam = { id: string; name: string; color: string; score: number };

type AdminGame = {
  id: string;
  mode: 'CLASSIC' | 'KIDS' | 'STUDENT';
  status: 'ACTIVE' | 'FINISHED';
  createdAt: string;
  winnerTeamId: string | null;
  isTie: boolean;
  userName: string;
  teams: AdminTeam[];
  categoryCount: number;
};

const MODE_LABELS: Record<string, string> = { CLASSIC: 'تحدّي', KIDS: 'أطفال', STUDENT: 'حقيبة الطالب' };

export default function AdminGames() {
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/admin/games');
      setGames(data.games);
      setTotal(data.total);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setGames([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteOne(game: AdminGame) {
    if (!window.confirm(`حذف لعبة ${game.userName} نهائياً؟`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/games/${game.id}`);
      setGames((prev) => (prev || []).filter((g) => g.id !== game.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success('تم الحذف');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteFinished() {
    if (!window.confirm('حذف كل الألعاب المنتهية في التطبيق نهائياً؟ الألعاب النشطة ما راح تتأثر.')) return;
    setBusy(true);
    try {
      const { data } = await api.delete('/admin/games/finished');
      toast.success(`تم حذف ${data.deleted} لعبة`);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (games === null) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[var(--color-ink-dim)]">
          {total} لعبة منشأة{games.length < total && ` — معروض آخر ${games.length}`}
        </p>
        <button className="btn btn-ghost !text-[var(--color-danger)] shrink-0" onClick={deleteFinished} disabled={busy}>
          🗑 حذف كل الألعاب المنتهية
        </button>
      </div>

      {games.length === 0 ? (
        <div className="card p-10 text-center text-[var(--color-ink-dim)]">ما فيه ألعاب</div>
      ) : (
        <div className="flex flex-col gap-2">
          {games.map((game) => (
            <div key={game.id} className="card p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-sm">
                  {game.userName} — {MODE_LABELS[game.mode] || game.mode}
                  {game.status === 'ACTIVE' && (
                    <span className="mr-2 px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-surface-hi)' }}>
                      نشطة
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-ink-faint)]">
                  {new Date(game.createdAt).toLocaleString('ar')} — {game.categoryCount} فئات
                </p>
                <p className="text-xs text-[var(--color-ink-dim)] truncate">
                  {game.teams.map((t) => `${t.name}: ${t.score}`).join(' · ')}
                </p>
              </div>
              <button className="text-[var(--color-danger)] text-sm shrink-0" onClick={() => deleteOne(game)} disabled={busy}>
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
