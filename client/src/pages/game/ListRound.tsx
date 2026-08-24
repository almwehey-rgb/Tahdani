import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../api/client';
import type { Category, Question } from '../../api/types';
import Spinner from '../../components/Spinner';

type Aid = 'HINT' | 'PASS' | 'FREEZE' | 'DOUBLE' | 'PHONE';

const AIDS: { id: Aid; label: string }[] = [
  { id: 'HINT', label: 'تلميح' },
  { id: 'PASS', label: 'باس' },
  { id: 'FREEZE', label: 'وقف الوقت' },
  { id: 'DOUBLE', label: 'جاوب جوابين' },
  { id: 'PHONE', label: 'اتصال بصديق' },
];

const AIDS_PER_TEAM = 3;
const TURN_CHOICES = [15, 30, 45];
const QUESTION_CHOICES = [0, 300, 600]; // 0 = no overall cap

type Team = { name: string; color: string; score: number; aids: Aid[]; used: Aid[] };

const START_TEAMS: Team[] = [
  { name: 'الفريق الأول', color: '#E0447A', score: 0, aids: [], used: [] },
  { name: 'الفريق الثاني', color: '#2E8FC9', score: 0, aids: [], used: [] },
];

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s);
}

export default function ListRound() {
  const { categoryId } = useParams();
  const navigate = useNavigate();

  const [category, setCategory] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [started, setStarted] = useState(false);
  const [teams, setTeams] = useState<Team[]>(START_TEAMS);
  const [turnSeconds, setTurnSeconds] = useState(30);
  const [questionSeconds, setQuestionSeconds] = useState(0);

  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, number>>({}); // answerId -> team index
  const [hinted, setHinted] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [turnLeft, setTurnLeft] = useState(30);
  const [questionLeft, setQuestionLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/categories/${categoryId}/list`);
        setCategory(data.category as Category);
        setQuestions(data.questions as Question[]);
      } catch {
        setCategory(null);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId]);

  // Both clocks run off one interval: the turn clock hands the turn over when
  // it empties, the question clock ends the question outright.
  useEffect(() => {
    if (!running) {
      if (tick.current) clearInterval(tick.current);
      return;
    }
    tick.current = setInterval(() => {
      setTurnLeft((t) => {
        if (t <= 1) {
          setActive((a) => (a === 0 ? 1 : 0));
          return turnSeconds;
        }
        return t - 1;
      });
      if (questionSeconds > 0) {
        setQuestionLeft((q) => {
          if (q <= 1) {
            setRunning(false);
            return 0;
          }
          return q - 1;
        });
      }
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running, turnSeconds, questionSeconds]);

  const question = questions[qIndex];
  const answers = useMemo(
    () => [...(question?.answers || [])].sort((a, b) => a.points - b.points),
    [question],
  );
  const allFound = answers.length > 0 && answers.every((a) => revealed[a.id] !== undefined);

  const reveal = useCallback(
    (answerId: string, points: number) => {
      if (revealed[answerId] !== undefined) return;
      setRevealed((r) => ({ ...r, [answerId]: active }));
      setTeams((t) => t.map((x, i) => (i === active ? { ...x, score: x.score + points } : x)));
      setTurnLeft(turnSeconds); // a correct answer buys the team a fresh turn
    },
    [revealed, active, turnSeconds],
  );

  function useAid(aid: Aid) {
    const team = teams[active];
    if (!team.aids.includes(aid) || team.used.includes(aid)) return;
    setTeams((t) => t.map((x, i) => (i === active ? { ...x, used: [...x.used, aid] } : x)));

    if (aid === 'FREEZE') {
      setRunning(false);
      toast('توقف الوقت', { icon: '⏸️' });
    } else if (aid === 'PASS') {
      setActive((a) => (a === 0 ? 1 : 0));
      setTurnLeft(turnSeconds);
      toast('الدور انتقل للفريق الثاني', { icon: '↪️' });
    } else if (aid === 'HINT') {
      const hidden = answers.filter((a) => revealed[a.id] === undefined && !hinted.includes(a.id));
      if (!hidden.length) return toast('ما بقي إجابة مخفية', { icon: '💡' });
      // the dearest one still hidden — a nudge on a cheap answer is worth nothing
      setHinted((h) => [...h, hidden[hidden.length - 1].id]);
    } else if (aid === 'DOUBLE') {
      toast('جاوب جوابين — للفريق محاولتان متتاليتان', { icon: '🔁' });
    } else {
      toast('اتصال بصديق — دقيقة للاستعانة بشخص من برّا', { icon: '📞' });
    }
  }

  function toggleAid(teamIndex: number, aid: Aid) {
    setTeams((t) =>
      t.map((x, i) => {
        if (i !== teamIndex) return x;
        if (x.aids.includes(aid)) return { ...x, aids: x.aids.filter((a) => a !== aid) };
        if (x.aids.length >= AIDS_PER_TEAM) return x;
        return { ...x, aids: [...x.aids, aid] };
      }),
    );
  }

  function beginRound() {
    if (teams.some((t) => t.aids.length !== AIDS_PER_TEAM)) {
      return toast.error(`كل فريق يختار ${AIDS_PER_TEAM} وسائل`);
    }
    setTurnLeft(turnSeconds);
    setQuestionLeft(questionSeconds);
    setStarted(true);
  }

  function nextQuestion() {
    setRevealed({});
    setHinted([]);
    setTurnLeft(turnSeconds);
    setQuestionLeft(questionSeconds);
    setRunning(false);
    setTeams((t) => t.map((x) => ({ ...x, used: [] }))); // aids refresh each question
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
        <button className="btn btn-ghost" onClick={() => navigate('/list')}>رجوع</button>
      </div>
    );
  }

  // ---------- setup ----------
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-1">جاهز للجولة؟</h1>
        <p className="text-[var(--color-ink-dim)] mb-6">راجع اختياراتك قبل ما تبدأ — {category?.name}</p>

        <div className="card p-5 mb-4">
          <p className="label mb-2">الفرق</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {teams.map((t, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                <input
                  className="input"
                  value={t.name}
                  onChange={(e) => setTeams((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 mb-4">
          <p className="label mb-1">وسائل المساعدة</p>
          <p className="text-xs text-[var(--color-ink-faint)] mb-3">
            كل فريق يختار {AIDS_PER_TEAM} — اضغط على الوسيلة لاختيارها أو إلغائها
          </p>
          {teams.map((t, i) => (
            <div key={i} className="mb-3 last:mb-0">
              <p className="text-sm font-bold mb-2" style={{ color: t.color }}>
                {t.name} <span className="text-[var(--color-ink-faint)]">({t.aids.length}/{AIDS_PER_TEAM})</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {AIDS.map((aid) => {
                  const on = t.aids.includes(aid.id);
                  return (
                    <button
                      key={aid.id}
                      onClick={() => toggleAid(i, aid.id)}
                      className={`rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
                        on
                          ? 'bg-[var(--color-brand)] text-white border-transparent'
                          : 'border-dashed border-[var(--color-border)] text-[var(--color-ink-faint)]'
                      }`}
                    >
                      {aid.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5 mb-4">
          <p className="label mb-2">مؤقّت الدور</p>
          <div className="flex gap-2 mb-4">
            {TURN_CHOICES.map((s) => (
              <button
                key={s}
                onClick={() => setTurnSeconds(s)}
                className={`flex-1 rounded-xl py-3 font-bold border ${
                  turnSeconds === s ? 'bg-[var(--color-brand)] text-white border-transparent' : 'border-[var(--color-border)]'
                }`}
              >
                {s} ث
              </button>
            ))}
          </div>
          <p className="label mb-2">مؤقّت السؤال</p>
          <div className="flex gap-2">
            {QUESTION_CHOICES.map((s) => (
              <button
                key={s}
                onClick={() => setQuestionSeconds(s)}
                className={`flex-1 rounded-xl py-3 font-bold border ${
                  questionSeconds === s ? 'bg-[var(--color-brand)] text-white border-transparent' : 'border-[var(--color-border)]'
                }`}
              >
                {s === 0 ? 'بدون' : `${s / 60} دقائق`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => navigate('/list')}>رجوع</button>
          <button className="btn btn-primary flex-1" onClick={beginRound}>ابدأ الجولة</button>
        </div>
      </div>
    );
  }

  // ---------- result ----------
  if (!question) {
    const winner = teams[0].score === teams[1].score ? null : teams[0].score > teams[1].score ? teams[0] : teams[1];
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold mb-6">انتهت الجولة 🎉</h1>
        <div className="flex justify-center gap-4 mb-6">
          {teams.map((t) => (
            <div key={t.name} className="card p-5 min-w-[9rem]">
              <p className="font-bold mb-1" style={{ color: t.color }}>{t.name}</p>
              <p className="text-4xl font-extrabold tabular-nums">{t.score}</p>
            </div>
          ))}
        </div>
        <p className="text-lg mb-6">{winner ? `الفائز: ${winner.name} 🏆` : 'تعادل!'}</p>
        <button className="btn btn-primary" onClick={() => navigate('/list')}>جولة جديدة</button>
      </div>
    );
  }

  // ---------- play ----------
  const half = Math.ceil(answers.length / 2);
  const columns = [answers.slice(0, half), answers.slice(half)];
  const judgeUrl = `${window.location.origin}/judge/${categoryId}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="text-center mb-4 relative">
        <p className="text-sm text-[var(--color-ink-faint)]">
          سؤال {qIndex + 1} من {questions.length} · {category?.name}
        </p>
        <h1 className="text-xl sm:text-2xl font-extrabold mt-1">{question.text}</h1>
        <button
          className="btn btn-ghost !py-1.5 !px-3 text-sm mt-2 sm:mt-0 sm:absolute sm:top-0 sm:left-0"
          onClick={() => setQrOpen(true)}
        >
          ⚖️ باركود الحكم
        </button>
      </div>

      {qrOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setQrOpen(false)}
        >
          <div className="card p-6 text-center max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="font-extrabold text-lg mb-1">⚖️ ورقة الحكم</p>
            <p className="text-sm text-[var(--color-ink-dim)] mb-4">
              خل الحكم يمسح الباركود بكاميرا جواله — بتفتح له كل الإجابات ونقاطها.
            </p>
            <div className="bg-white p-3 rounded-xl inline-block mb-4">
              <QRCodeSVG value={judgeUrl} size={200} level="M" />
            </div>
            <p className="text-xs text-[var(--color-ink-faint)] break-all mb-4">{judgeUrl}</p>
            <button className="btn btn-primary w-full" onClick={() => setQrOpen(false)}>
              تمام
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-stretch mb-5">
        {[0, 1].map((i) => {
          const t = teams[i];
          const panel = (
            <div
              key={i}
              onClick={() => setActive(i)}
              className={`card p-3 sm:p-4 cursor-pointer transition-colors ${active === i ? 'border-2' : 'opacity-60'}`}
              style={active === i ? { borderColor: t.color } : undefined}
            >
              <p className="font-bold text-center" style={{ color: t.color }}>{t.name}</p>
              <p className="text-3xl font-extrabold text-center tabular-nums my-1" style={{ color: t.color }}>
                {t.score}
              </p>
              <div className="flex flex-wrap gap-1 justify-center">
                {t.aids.map((a) => {
                  const spent = t.used.includes(a);
                  return (
                    <button
                      key={a}
                      disabled={spent || active !== i}
                      onClick={(e) => {
                        e.stopPropagation();
                        useAid(a);
                      }}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold border ${
                        spent
                          ? 'opacity-35 line-through border-[var(--color-border)]'
                          : 'border-[var(--color-border)] hover:bg-[var(--color-tile-hover)]'
                      }`}
                    >
                      {AIDS.find((x) => x.id === a)!.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
          // the clock sits between the two panels
          return i === 0 ? (
            panel
          ) : (
            [
              <div key="clock" className="flex flex-col items-center justify-center px-1 sm:px-3">
                <span className="text-xs text-[var(--color-ink-faint)]">الوقت</span>
                <span
                  className={`text-3xl sm:text-4xl font-extrabold tabular-nums ${
                    turnLeft <= 5 ? 'text-[var(--color-danger)]' : ''
                  }`}
                >
                  {turnLeft}
                </span>
                {questionSeconds > 0 && (
                  <span className="text-xs text-[var(--color-ink-faint)] tabular-nums">{mmss(questionLeft)}</span>
                )}
                <button className="btn btn-ghost !py-1 !px-2 text-xs mt-1" onClick={() => setRunning((r) => !r)}>
                  {running ? '⏸️' : '▶️'}
                </button>
              </div>,
              panel,
            ]
          );
        })}
      </div>

      <div className="card p-4 mb-4">
        <p className="text-center font-bold text-sm text-[var(--color-ink-faint)] mb-3">الإجابات</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-2">
              {col.map((a, ri) => {
                const byIndex = revealed[a.id];
                const found = byIndex !== undefined;
                const showHint = !found && hinted.includes(a.id);
                const slot = ci * half + ri + 1;
                return (
                  <button
                    key={a.id}
                    onClick={() => reveal(a.id, a.points)}
                    disabled={found}
                    className={`flex items-center gap-2 rounded-xl px-2 py-2.5 border transition-colors ${
                      found ? 'border-transparent' : 'border-[var(--color-border)] hover:bg-[var(--color-tile-hover)]'
                    }`}
                    style={found ? { background: `${teams[byIndex].color}22`, borderColor: teams[byIndex].color } : undefined}
                  >
                    <span className="w-7 h-7 shrink-0 rounded-lg grid place-items-center text-xs font-extrabold bg-[var(--color-bg-soft)]">
                      {slot}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-start font-bold">
                      {found ? a.text : showHint ? `${a.text.trim().charAt(0)} …` : '؟ ؟ ؟ ؟ ؟'}
                    </span>
                    <span className="shrink-0 font-extrabold tabular-nums text-sm">+{a.points}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between gap-2">
        <button className="btn btn-ghost" onClick={() => navigate('/list')}>إنهاء الجولة</button>
        <button className="btn btn-primary" onClick={nextQuestion}>
          {allFound || (questionSeconds > 0 && questionLeft === 0) ? 'السؤال التالي ←' : 'تخطي السؤال ←'}
        </button>
      </div>
    </div>
  );
}
