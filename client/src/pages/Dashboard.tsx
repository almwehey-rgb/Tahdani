import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import type { Game } from '../api/types';
import Spinner from '../components/Spinner';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [activeGame, setActiveGame] = useState<Game | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/games/active').then(({ data }) => setActiveGame(data.game));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-1">أهلا {user?.name} 👋</h1>
      <p className="text-[var(--color-ink-dim)] mb-6">لديك {user?.remainingGames ?? 0} لعبة متبقية</p>

      {activeGame === undefined && <Spinner />}

      {activeGame && (
        <div className="card p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pop">
          <div>
            <p className="font-bold">لديك لعبة نشطة الآن</p>
            <p className="text-sm text-[var(--color-ink-dim)]">هل تريد متابعة اللعب أو الاعادة؟</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn btn-primary" onClick={() => navigate(`/game/${activeGame.id}/board`)}>
              متابعة اللعب
            </button>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                await api.post(`/games/${activeGame.id}/abandon`);
                setActiveGame(null);
              }}
            >
              إعادة البدء
            </button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <ActionCard to="/new-game" icon="🎮" title="لعبة تحدّي" desc="لعبة تقليدية بفريقين وفئات ووسائل مساعدة" />
        <ActionCard to="/new-game/kids" icon="🧸" title="واجهة الأطفال" desc="أسئلة مبسطة وممتعة للصغار" />
        <ActionCard to="/new-game/student" icon="🎓" title="حقيبة الطالب" desc="مراجعة المواد الدراسية بطريقة تفاعلية" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <ActionCard to="/packages" icon="💳" title="شراء ألعاب" desc="اختر باقتك المفضلة" />
        <ActionCard to="/gifts" icon="🎁" title="الهدايا" desc="أهدِ لعبة أو استلم هدية" />
        <ActionCard to="/tournaments" icon="🏆" title="البطولات" desc="أنشئ بطولة بين عدة فرق" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <ActionCard to="/history" icon="📜" title="سجل الألعاب" desc="شوف ألعابك السابقة واحذف اللي ما تبيه" />
      </div>
    </div>
  );
}

function ActionCard({ to, icon, title, desc }: { to: string; icon: string; title: string; desc: string }) {
  return (
    <Link to={to} className="card p-5 hover:border-[var(--color-brand-hi)] transition-colors">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-ink-dim)]">{desc}</p>
    </Link>
  );
}
