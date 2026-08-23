import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../api/client';
import type { Category, Question } from '../../api/types';
import Spinner from '../../components/Spinner';

const ROUND_SECONDS = 90;

type Aid = 'HINT' | 'DOUBLE' | 'PASS' | 'FREEZE' | 'PHONE';

const AIDS: { id: Aid; label: string; icon: string; note: string }[] = [
  { id: 'HINT', label: 'تلميح', icon: '💡', note: 'يكشف أول حرف من إجابة مخفية' },
  { id: 'DOUBLE', label: 'جاوب جوابين', icon: '🔁', note: 'الفريق يرمي إجابتين ورا بعض' },
  { id: 'PASS', label: 'باس', icon: '↪️', note: 'يمرّر الدور للفريق الثاني' },
  { id: 'FREEZE', label: 'وقف الوقت', icon: '⏸️', note: 'يجمّد العداد' },
  { id: 'PHONE', label: 'اتصال بصديق', icon: '📞', note: 'استعانة بشخص من برّا' },
];

type TeamState = { name: string; score: number; used: Aid[] };

export default function ListRound() {
  const { categoryId } = useParams();
  const navigate = useNavigate();

  const [category, setCategory] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, string>>({}); // answerId -> team name
  const [hinted, setHinted] = useState<string[]>([]); // answerIds showing their first letter
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(0);
  const [teams, setTeams] = useState<TeamState[]>([
    { name: 'الفريق الأول', score: 0, used: [] },
    { name: 'الفريق الثاني', score: 0, used: [] },
  ]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const [cats, qs] = await Promise.all([
        api.get('/categories'),
        api.get(`/categories/${categoryId}/questions`),
      ]);
      setCategory(cats.data.categories.find((c: Category) => c.id === categoryId) || null);
      // only questions that actually carry a hidden list can be played here
      setQuestions((qs.data.questions as Question[]).filter((q) => q.answers && q.answers.length > 0));
      setLoading(false);
    })();
  }, [categoryId]);

  useEffect(() => {
    if (!running) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  const question = questions[qIndex];
  const answers = useMemo(
    () => [...(question?.answers || [])].sort((a, b) => a.points - b.points),
    [question],
  );
  const allFound = answers.length > 0 && answers.every((a) => revealed[a.id]);

  const reveal = useCallback(
    (answerId: string, points: number) => {
      if (revealed[answerId]) return;
      const teamName = teams[active].name;
      setRevealed((r) => ({ ...r, [answerId]: teamName }));
      setTeams((t) => t.map((x, i) => (i === active ? { ...x, score: x.score + points } : x)));
    },
    [revealed, teams, active],
  );

  function useAid(aid: Aid) {
    if (teams[active].used.includes(aid)) return;
    setTeams((t) => t.map((x, i) => (i === active ? { ...x, used: [...x.used, aid] } : x)));

    if (aid === 'FREEZE') {
      setRunning(false);
      toast('توقف الوقت — اضغط تشغيل لما تجهزون', { icon: '⏸️' });
    } else if (aid === 'PASS') {
      setActive((a) => (a === 0 ? 1 : 0));
      toast('الدور انتقل للفريق الثاني', { icon: '↪️' });
    } else if (aid === 'HINT') {
      const hidden = answers.filter((a) => !revealed[a.id] && !hinted.includes(a.id));
      if (!hidden.length) return toast('ما بقي إجابة مخفية', { icon: '💡' });
      // the hardest one still hidden gets the nudge — the cheap ones need none
      const target = hidden[hidden.length - 1];
      setHinted((h) => [...h, target.id]);
    } else {
      toast(AIDS.find((a) => a.id === aid)!.note, { icon: AIDS.find((a) => a.id === aid)!.icon });
    }
  }

  function nextQuestion() {
    setRevealed({});
    setHinted([]);
    setSeconds(ROUND_SECONDS);
    setRunning(false);
    setQIndex((i) => i + 1);
  }

  if (loading) return <Spinner />;

  if (!questions.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-extrabold mb-2">{category?.name || 'الفئة'}</h1>
        <p className="text-[var(--color-ink-dim)] mb-6">
          ما في أسئلة بإجابات متعددة في هذه الفئة. أضفها من لوحة التحكم ← الفئات ← «إجابات متعددة».
        </p>
        <button className="btn btn-ghost" onClick={() => navigate('/list')}>
          رجوع
        </button>
      </div>
    );
  }

  if (!question) {
    const winner = teams[0].score === teams[1].score ? null : teams[0].score > teams[1].score ? teams[0] : teams[1];
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold mb-4">انتهت الجولة 🎉</h1>
        <div className="flex justify-center gap-6 mb-6">
          {teams.map((t) => (
            <div key={t.name} className="card p-5">
              <p className="font-bold mb-1">{t.name}</p>
              <p className="text-3xl font-extrabold">{t.score}</p>
            </div>
          ))}
        </div>
        <p className="text-lg mb-6">{winner ? `الفائز: ${winner.name} 🏆` : 'تعادل!'}</p>
        <button className="btn btn-primary" onClick={() => navigate('/list')}>
          جولة جديدة
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-sm text-[var(--color-ink-faint)]">
          {category?.name} — سؤال {qIndex + 1} من {questions.length}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`font-extrabold text-2xl tabular-nums ${seconds <= 10 ? 'text-[var(--color-danger)]' : ''}`}
          >
            {seconds}ث
          </span>
          <button className="btn btn-ghost !py-1 !px-3" onClick={() => setRunning((r) => !r)}>
            {running ? '⏸️ إيقاف' : '▶️ تشغيل'}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {teams.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setActive(i)}
            className={`card p-4 text-start transition-colors ${
              active === i ? 'border-[var(--color-brand-hi)] border-2' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <input
                className="bg-transparent font-bold outline-none w-full"
                value={t.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTeams((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <span className="text-2xl font-extrabold tabular-nums">{t.score}</span>
            </div>
            {active === i && <p className="text-xs text-[var(--color-brand-hi)] mt-1">الدور عليه الآن</p>}
          </button>
        ))}
      </div>

      <div className="card p-5 mb-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-center mb-4">{question.text}</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {answers.map((a, i) => {
            const by = revealed[a.id];
            const showHint = !by && hinted.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => reveal(a.id, a.points)}
                disabled={!!by}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-start border transition-colors ${
                  by
                    ? 'bg-[var(--color-bg-soft)] border-[var(--color-brand-hi)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-tile-hover)]'
                }`}
              >
                <span className="font-bold min-w-0 truncate">
                  {by ? a.text : showHint ? `${a.text.trim().charAt(0)} …` : `${i + 1}. ● ● ●`}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {by && <span className="text-xs text-[var(--color-ink-faint)]">{by}</span>}
                  <span className="font-extrabold tabular-nums">{a.points}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {AIDS.map((aid) => {
          const used = teams[active].used.includes(aid.id);
          return (
            <button
              key={aid.id}
              title={aid.note}
              disabled={used}
              onClick={() => useAid(aid.id)}
              className={`btn ${used ? 'btn-ghost opacity-40' : 'btn-ghost'} !py-2 !px-3 text-sm`}
            >
              {aid.icon} {aid.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between gap-2">
        <button className="btn btn-ghost" onClick={() => navigate('/list')}>
          إنهاء الجولة
        </button>
        <button className="btn btn-primary" onClick={nextQuestion}>
          {allFound || seconds === 0 ? 'السؤال التالي ←' : 'تخطي السؤال ←'}
        </button>
      </div>
    </div>
  );
}
