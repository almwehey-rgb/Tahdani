import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Game, Team } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function ResultScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    api.get(`/games/${id}/board`).then(({ data }) => {
      setGame(data.game);
      setTeams(data.teams);
      setLoading(false);
    });
  }, [id]);

  async function runTiebreak() {
    setSpinning(true);
    setTimeout(async () => {
      const { data } = await api.post(`/games/${id}/tiebreak`);
      setGame(data.game);
      setSpinning(false);
    }, 1800);
  }

  if (loading || !game) return <Spinner />;

  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const winner = game.winnerTeamId ? teams.find((t) => t.id === game.winnerTeamId) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">{winner ? '🏆' : '🤝'}</div>
      <h1 className="text-3xl font-black mb-2">
        {winner ? `فاز فريق ${winner.name}!` : game.isTie ? 'لقد تعادلتما!' : 'انتهت اللعبة'}
      </h1>

      <div className="grid grid-cols-2 gap-4 my-8">
        {sorted.map((t) => (
          <div key={t.id} className="card p-5" style={{ borderColor: t.id === game.winnerTeamId ? t.color : undefined, borderWidth: t.id === game.winnerTeamId ? 2 : 1 }}>
            <p className="font-bold" style={{ color: t.color }}>
              {t.name}
            </p>
            <p className="text-3xl font-black">{t.score}</p>
          </div>
        ))}
      </div>

      {game.isTie && !game.winnerTeamId && (
        <div className="card p-6 mb-6">
          <p className="mb-4">لقد تعادلتم في اللعبة، هل تريد تجربة اليانصيب لتحديد الفائز؟</p>
          <button className="btn btn-gold" onClick={runTiebreak} disabled={spinning}>
            {spinning ? '🎰 جاري السحب...' : '🎰 عطني التقسيمة (يانصيب)'}
          </button>
        </div>
      )}

      <div className="flex justify-center gap-3">
        <button className="btn btn-primary" onClick={() => navigate('/new-game')}>
          لعبة جديدة
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
          الرئيسية
        </button>
      </div>
    </div>
  );
}
