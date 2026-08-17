import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import type { Tournament, TournamentMatch } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TournamentMatch | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  async function load() {
    const { data } = await api.get(`/tournaments/${id}`);
    setTournament(data.tournament);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitResult() {
    if (!editing || scoreA === scoreB) return toast.error('لا يمكن التعادل، حدد فريق فائز');
    try {
      const { data } = await api.post(`/tournaments/${id}/matches/${editing.id}/result`, { teamAScore: scoreA, teamBScore: scoreB });
      setTournament(data.tournament);
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (loading || !tournament) return <Spinner />;

  const rounds = [...new Set(tournament.matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">{tournament.name}</h1>
          <p className="text-[var(--color-ink-dim)]">{tournament.format === 'KNOCKOUT' ? 'نظام إقصائي' : 'نظام دوري'}</p>
        </div>
        {tournament.championTeam && (
          <div className="text-center">
            <p className="text-3xl">🏆</p>
            <p className="font-bold" style={{ color: 'var(--color-gold)' }}>
              بطل البطولة: {tournament.championTeam}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {rounds.map((round) => (
            <div key={round} className="flex flex-col gap-3 justify-center min-w-[220px]">
              <p className="text-center text-sm font-bold text-[var(--color-ink-dim)]">
                {round === rounds[rounds.length - 1] && tournament.format === 'KNOCKOUT' ? 'النهائي' : `الجولة ${round}`}
              </p>
              {tournament.matches
                .filter((m) => m.round === round)
                .map((m) => (
                  <button
                    key={m.id}
                    disabled={!m.teamAName || !m.teamBName || m.status !== 'PENDING'}
                    onClick={() => {
                      setEditing(m);
                      setScoreA(m.teamAScore);
                      setScoreB(m.teamBScore);
                    }}
                    className="card p-3 text-sm text-right disabled:opacity-60"
                  >
                    <MatchRow name={m.teamAName} score={m.teamAScore} isWinner={m.winnerName === m.teamAName} done={m.status === 'DONE'} />
                    <div className="h-px bg-[var(--color-border)] my-1" />
                    <MatchRow name={m.teamBName} score={m.teamBScore} isWinner={m.winnerName === m.teamBName} done={m.status === 'DONE'} />
                    {m.status === 'BYE' && <p className="text-[10px] text-[var(--color-ink-faint)] mt-1">تأهل تلقائي</p>}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 animate-pop">
            <h2 className="font-bold mb-4 text-center">نتيجة المباراة</h2>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="flex-1">{editing.teamAName}</span>
              <input type="number" className="input w-20 text-center" value={scoreA} onChange={(e) => setScoreA(Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="flex-1">{editing.teamBName}</span>
              <input type="number" className="input w-20 text-center" value={scoreB} onChange={(e) => setScoreB(Number(e.target.value))} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={submitResult}>
                حفظ النتيجة
              </button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchRow({ name, score, isWinner, done }: { name: string | null; score: number; isWinner: boolean; done: boolean }) {
  return (
    <div className={`flex items-center justify-between ${isWinner ? 'font-bold' : ''}`} style={{ color: isWinner ? 'var(--color-success)' : undefined }}>
      <span>{name || 'بانتظار الفائز'}</span>
      {done && <span>{score}</span>}
    </div>
  );
}
