import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import type { GameBoard, GameTile, LifelineType } from '../../api/types';
import { LIFELINE_LABELS } from '../../api/types';
import Spinner from '../../components/Spinner';
import DrawingCanvas from './DrawingCanvas';
import { useGameUiStore } from '../../store/gameUi';

export default function Board() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<GameBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [turn, setTurn] = useState(0);
  const [openTile, setOpenTile] = useState<GameTile | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [phase, setPhase] = useState<'main' | 'steal'>('main');
  const [phoneOverlay, setPhoneOverlay] = useState<number | null>(null);
  const [varOpen, setVarOpen] = useState(false);
  const [varNote, setVarNote] = useState('');
  const [pickedPlayer, setPickedPlayer] = useState<string | null>(null);
  const [trapTargetIndex, setTrapTargetIndex] = useState<number | null>(null);
  const [doublePointsActive, setDoublePointsActive] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(72);
  const setFinishGameHandler = useGameUiStore((s) => s.setFinishGameHandler);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<'main' | 'steal'>('main');

  // The site header is rendered by the shared Layout, above this page, and
  // its real height varies (mobile vs desktop nav, the credits badge, the
  // admin link). This page must fit inside exactly what's left of the
  // viewport below it — otherwise the bottom board row gets pushed past the
  // fold and needs a scroll to reach, which is what "fill the screen" is
  // meant to avoid.
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const update = () => setHeaderHeight(header.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setFinishGameHandler(finishGame);
    return () => setFinishGameHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/games/${id}/board`);
      setBoard(data);
    } catch {
      toast.error('تعذر تحميل اللعبة');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Lock body scroll while a fixed-position overlay (question modal, phone
  // lifeline) is open — without this, mobile Safari/Chrome can leave the
  // page's own scroll gesture "fighting" the overlay's touch handling
  // (especially the drawing canvas, which sets touch-action:none) and the
  // whole screen stops responding to taps until reload.
  useEffect(() => {
    const shouldLock = !!openTile || phoneOverlay !== null;
    document.body.style.overflow = shouldLock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [openTile, phoneOverlay]);

  useEffect(() => {
    if (!openTile) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    phaseRef.current = 'main';
    setPhase('main');
    setTimeLeft(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (phaseRef.current === 'main') {
            phaseRef.current = 'steal';
            setPhase('steal');
            return 10;
          }
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTile?.gameQuestionId]);

  const activeTeamIndex = trapTargetIndex ?? turn;
  const activeTeam = board?.teams[activeTeamIndex];

  const tileHints = openTile
    ? [openTile.hint, openTile.hint2, openTile.hint3, openTile.hint4].filter((h): h is string => !!h)
    : [];

  // Long questions at the same fixed huge font wrap to 3+ lines and crowd
  // out the answer/buttons below — step the size down as the text grows
  // instead of always using the "short question" size.
  const questionTextClass = (() => {
    const len = openTile?.text?.length ?? 0;
    if (len > 140) return 'text-lg sm:text-xl md:text-2xl';
    if (len > 80) return 'text-xl sm:text-2xl md:text-3xl';
    return 'text-3xl sm:text-5xl';
  })();

  const answeredCount = board?.tiles.filter((t) => t.answeredByTeamId).length ?? 0;
  const totalTiles = board?.tiles.length ?? 0;
  const allAnswered = totalTiles > 0 && answeredCount === totalTiles;

  async function undoAnswer(tile: GameTile) {
    if (!window.confirm('تراجع عن الإجابة وإعادة فتح السؤال؟')) return;
    try {
      const { data } = await api.post(`/games/${id}/questions/${tile.gameQuestionId}/undo`);
      const reopened = { ...tile, ...data.tile, answeredByTeamId: null, isCorrect: null, isOpened: true };
      setBoard((prev) =>
        prev
          ? { ...prev, teams: data.teams, tiles: prev.tiles.map((t) => (t.gameQuestionId === tile.gameQuestionId ? reopened : t)) }
          : prev,
      );
      await openQuestion(reopened);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function openQuestion(tile: GameTile) {
    if (tile.answeredByTeamId) return undoAnswer(tile);
    setPickedPlayer(null);
    setTrapTargetIndex(null);
    setDoublePointsActive(false);
    setShowAnswer(false);
    setRevealedHints(0);
    if (tile.isOpened && tile.text) {
      setOpenTile(tile);
      return;
    }
    try {
      const { data } = await api.post(`/games/${id}/questions/${tile.gameQuestionId}/open`);
      const opened = { ...tile, ...data.tile, isOpened: true };
      setOpenTile(opened);
      setBoard((prev) => (prev ? { ...prev, tiles: prev.tiles.map((t) => (t.gameQuestionId === tile.gameQuestionId ? opened : t)) } : prev));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function markAnswer(teamId: string | null) {
    if (!openTile || !board) return;
    const gqId = openTile.gameQuestionId;
    const points = openTile.points;
    const resolvedTeamId = teamId ?? activeTeam!.id;
    const isCorrect = !!teamId;
    const previousTeams = board.teams;
    const previousTiles = board.tiles;
    const previousTurn = turn;
    const wasDoubleActive = doublePointsActive;

    // Close the modal and reflect the result immediately — waiting on the
    // round trip(s) before doing this is what made every answer feel
    // laggy. Reconciled with the server's authoritative numbers below,
    // and rolled all the way back if the request itself fails.
    setBoard({
      ...board,
      teams: isCorrect
        ? board.teams.map((t) => (t.id === resolvedTeamId ? { ...t, score: t.score + (wasDoubleActive ? points * 2 : points) } : t))
        : board.teams,
      tiles: board.tiles.map((t) => (t.gameQuestionId === gqId ? { ...t, answeredByTeamId: resolvedTeamId, isCorrect } : t)),
    });
    setOpenTile(null);
    setDoublePointsActive(false);
    setTurn((t) => (t + 1) % board.teams.length);

    try {
      const { data } = await api.post(`/games/${id}/questions/${gqId}/answer`, { teamId: resolvedTeamId, isCorrect });
      // Merge in just the score — trusting the response's team shape
      // wholesale has broken this screen before (a route that returned
      // teams without players/lifelines silently wiped both everywhere
      // they're read, crashing the whole page on the next render).
      const scoreByTeamId = new Map<string, number>(data.teams.map((t: { id: string; score: number }) => [t.id, t.score]));
      setBoard((prev) => (prev ? { ...prev, teams: prev.teams.map((t) => (scoreByTeamId.has(t.id) ? { ...t, score: scoreByTeamId.get(t.id)! } : t)) } : prev));

      if (isCorrect && wasDoubleActive) {
        // Awarded as a second adjust-score on top of the normal points the
        // /answer call above already gave — reusing that endpoint instead
        // of teaching the server a new "double" concept.
        try {
          const { data: bonus } = await api.post(`/games/${id}/teams/${resolvedTeamId}/adjust-score`, { delta: points });
          setBoard((prev) => (prev ? { ...prev, teams: prev.teams.map((t) => (t.id === resolvedTeamId ? { ...t, score: bonus.team.score } : t)) } : prev));
          toast.success(`ضاعفت النقاط! +${points} إضافية 2️⃣`);
        } catch (err) {
          toast.error(apiErrorMessage(err));
        }
      }
    } catch (err) {
      setBoard((prev) => (prev ? { ...prev, teams: previousTeams, tiles: previousTiles } : prev));
      setTurn(previousTurn);
      toast.error(apiErrorMessage(err));
    }
  }

  async function useLifeline(type: LifelineType) {
    if (!activeTeam || !board) return;
    const lifeline = activeTeam.lifelines.find((l) => l.type === type && !l.used);
    if (!lifeline) return;
    const previousTeams = board.teams;

    // Apply each lifeline's local effect immediately instead of waiting on
    // the round trip — for STEAL_POINTS this means mirroring the server's
    // "steal from whoever has the most" rule client-side so the toast and
    // score update happen right away; reconciled with the server's answer
    // below, and rolled back entirely if the request fails.
    let optimisticStolen = 0;
    let teams = board.teams.map((t) =>
      t.id === activeTeam.id ? { ...t, lifelines: t.lifelines.map((l) => (l.id === lifeline.id ? { ...l, used: true } : l)) } : t,
    );
    if (type === 'STEAL_POINTS' && openTile) {
      const opponent = [...teams].filter((t) => t.id !== activeTeam.id).sort((a, b) => b.score - a.score)[0];
      if (opponent) {
        optimisticStolen = Math.min(openTile.points, opponent.score);
        if (optimisticStolen > 0) {
          teams = teams.map((t) => {
            if (t.id === opponent.id) return { ...t, score: t.score - optimisticStolen };
            if (t.id === activeTeam.id) return { ...t, score: t.score + optimisticStolen };
            return t;
          });
        }
      }
    }
    setBoard({ ...board, teams });
    if (type === 'PHONE_A_FRIEND') setPhoneOverlay(60);
    if (type === 'TRAP') setTrapTargetIndex((turn + 1) % board.teams.length);
    if (type === 'PICK_ANSWERER') setPickedPlayer(activeTeam.players[Math.floor(Math.random() * activeTeam.players.length)]?.name || null);
    if (type === 'DOUBLE_ANSWER') toast.success('يمكن للفريق تجربة إجابتين لهذا السؤال');
    if (type === 'STEAL_POINTS') {
      if (optimisticStolen > 0) toast.success(`سرقت ${optimisticStolen} نقطة من الفريق المنافس! 💰`);
      else toast('الفريق المنافس ما عنده نقاط تُسرق حاليا', { icon: '😅' });
    }
    if (type === 'DOUBLE_POINTS') {
      setDoublePointsActive(true);
      toast.success('راح تتضاعف نقاط هذا السؤال لو جاوبتوا صح! 2️⃣');
    }

    try {
      const { data } = await api.post(`/games/${id}/lifelines/${lifeline.id}/use`, { gameQuestionId: openTile?.gameQuestionId });
      // The route re-fetches teams (with players + lifelines) after marking
      // the lifeline used and, for STEAL_POINTS, moving score between
      // teams — trusting that response keeps this in sync with the server
      // instead of recomputing scores locally.
      setBoard((prev) => (prev ? { ...prev, teams: data.teams } : prev));
    } catch (err) {
      setBoard((prev) => (prev ? { ...prev, teams: previousTeams } : prev));
      if (type === 'PHONE_A_FRIEND') setPhoneOverlay(null);
      if (type === 'TRAP') setTrapTargetIndex(null);
      if (type === 'PICK_ANSWERER') setPickedPlayer(null);
      if (type === 'DOUBLE_POINTS') setDoublePointsActive(false);
      toast.error(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    if (phoneOverlay === null) return;
    if (phoneOverlay <= 0) {
      setPhoneOverlay(null);
      return;
    }
    const t = setTimeout(() => setPhoneOverlay((p) => (p !== null ? p - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [phoneOverlay]);

  async function submitVar() {
    if (!openTile || varNote.trim().length < 2) return;
    try {
      await api.post(`/games/${id}/var`, { questionId: openTile.gameQuestionId, note: varNote.trim() });
      toast.success('تم إرسال الملاحظة، شكرا لمساعدتك');
      setVarOpen(false);
      setVarNote('');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function adjustScore(teamId: string, delta: number) {
    if (!board) return;
    const team = board.teams.find((t) => t.id === teamId);
    if (!team) return;
    const previousScore = team.score;
    // Apply the change locally right away — waiting on the round trip made
    // every click feel laggy even though the request itself was fast.
    // Falls back to a revert + toast if the server ends up disagreeing.
    setBoard({ ...board, teams: board.teams.map((t) => (t.id === teamId ? { ...t, score: Math.max(0, previousScore + delta) } : t)) });
    try {
      const { data } = await api.post(`/games/${id}/teams/${teamId}/adjust-score`, { delta });
      setBoard((prev) => (prev ? { ...prev, teams: prev.teams.map((t) => (t.id === teamId ? { ...t, score: data.team.score } : t)) } : prev));
    } catch (err) {
      setBoard((prev) => (prev ? { ...prev, teams: prev.teams.map((t) => (t.id === teamId ? { ...t, score: previousScore } : t)) } : prev));
      toast.error(apiErrorMessage(err));
    }
  }

  async function finishGame() {
    if (!window.confirm('هل تريد إنهاء اللعبة؟')) return;
    try {
      await api.post(`/games/${id}/finish`);
      navigate(`/game/${id}/result`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (loading || !board) return <Spinner />;

  const categoriesWithTiles = board.categories.map((cat) => ({
    category: cat,
    tiles: board.tiles.filter((t) => t.categoryId === cat.id).sort((a, b) => a.points - b.points),
  }));

  const boardColumns = Math.min(categoriesWithTiles.length, 3);
  const boardRows = boardColumns > 0 ? Math.ceil(categoriesWithTiles.length / boardColumns) : 1;

  return (
    <div className="w-full px-4 sm:px-8 py-6 flex flex-col" style={{ height: `calc(100dvh - ${headerHeight}px)` }}>
      <p className="text-center text-base font-semibold text-[var(--color-ink-dim)] mb-4 shrink-0">
        {answeredCount} / {totalTiles} أسئلة {allAnswered && totalTiles > 0 && '— اكتملت جميع الأسئلة! 🎉'}
      </p>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">
        <div className="lg:w-64 xl:w-72 shrink-0 flex flex-col gap-3">
          {board.teams.map((team, idx) => (
            <div
              key={team.id}
              className="card p-4 flex flex-col items-center justify-center text-center gap-3 flex-1 transition-all"
              style={
                idx === activeTeamIndex
                  ? {
                      borderColor: team.color,
                      borderWidth: 3,
                      background: `linear-gradient(160deg, ${team.color}2E, ${team.color}0D)`,
                      boxShadow: `0 0 0 4px ${team.color}26, 0 12px 28px -10px ${team.color}66`,
                    }
                  : { borderColor: 'var(--color-border)', borderWidth: 1 }
              }
            >
              <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: team.color }}>
                {team.name}
              </p>
              {idx === activeTeamIndex && <span className="text-sm font-bold" style={{ color: team.color }}>🎯 دورهم</span>}
              <div className="flex items-center justify-center gap-3">
                <button
                  className="w-10 h-10 rounded-full text-xl font-black flex items-center justify-center leading-none"
                  style={{ background: `${team.color}33`, color: team.color }}
                  onClick={() => adjustScore(team.id, -50)}
                  title="اخصم نقاط"
                >
                  −
                </button>
                <p className="text-5xl sm:text-6xl font-black">{team.score}</p>
                <button
                  className="w-10 h-10 rounded-full text-xl font-black flex items-center justify-center leading-none"
                  style={{ background: `${team.color}33`, color: team.color }}
                  onClick={() => adjustScore(team.id, 50)}
                  title="أضف نقاط"
                >
                  +
                </button>
              </div>
              <div className="flex gap-2.5 flex-wrap justify-center">
                {team.lifelines.map((l) => (
                  <span
                    key={l.id}
                    title={LIFELINE_LABELS[l.type].label}
                    className={`text-2xl sm:text-3xl ${l.used ? 'opacity-25 grayscale' : ''}`}
                  >
                    {LIFELINE_LABELS[l.type].icon}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">
          <div
            className="grid gap-3 flex-1 min-h-0"
            style={{
              gridTemplateColumns: `repeat(${boardColumns}, minmax(0,1fr))`,
              gridTemplateRows: `repeat(${boardRows}, minmax(0,1fr))`,
            }}
          >
            {categoriesWithTiles.map(({ category, tiles }) => {
          const leftTiles = tiles.filter((_, i) => i % 2 === 0);
          const rightTiles = tiles.filter((_, i) => i % 2 === 1);
          const renderTile = (tile: GameTile, isLast: boolean) => (
            <button
              key={tile.gameQuestionId}
              title={tile.answeredByTeamId ? 'اضغط للتراجع عن الإجابة وإعادة فتح السؤال' : undefined}
              onClick={() => openQuestion(tile)}
              className={`flex-1 min-w-0 min-h-0 flex items-center justify-center px-0.5 font-extrabold text-sm sm:text-xl md:text-3xl whitespace-nowrap transition-colors hover:bg-[var(--color-tile-hover)] relative ${
                isLast ? '' : 'border-b'
              }`}
              style={{
                borderColor: 'var(--color-border)',
                opacity: tile.answeredByTeamId ? 0.35 : 1,
                background: tile.answeredByTeamId
                  ? board.teams.find((t) => t.id === tile.answeredByTeamId)?.color + '22'
                  : undefined,
              }}
            >
              {tile.isDrawing && '🎨 '}
              {tile.answeredByTeamId ? (tile.isCorrect ? '✔' : '—') : tile.points}
              {tile.usedVar && <span className="absolute top-1 left-1 text-xs">🚩</span>}
            </button>
          );
          return (
            <div
              key={category.id}
              className="rounded-2xl overflow-hidden min-w-0 h-full flex flex-col"
              style={{ border: `1px solid ${category.color}55` }}
            >
              <div className="flex items-stretch flex-1 min-h-0" style={{ background: 'var(--color-bg-soft)' }}>
                <div className="flex flex-col flex-1 min-w-0">
                  {leftTiles.map((tile, i) => renderTile(tile, i === leftTiles.length - 1))}
                </div>
                <div
                  className="relative w-9 sm:w-24 md:w-40 shrink-0"
                  style={{ background: `linear-gradient(160deg, ${category.color}44, ${category.color}18)` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-lg sm:text-4xl md:text-6xl">{category.icon}</div>
                  {category.imageUrl && (
                    <img
                      src={category.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain p-1 sm:p-2"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  {rightTiles.map((tile, i) => renderTile(tile, i === rightTiles.length - 1))}
                </div>
              </div>
              <div
                className="text-center font-extrabold text-[10px] sm:text-lg md:text-xl py-1.5 sm:py-2 px-1 truncate text-white shrink-0"
                style={{ background: category.color }}
              >
                {category.name}
              </div>
            </div>
          );
            })}
          </div>
        {openTile && activeTeam && (
          <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && null}>
            <div className="card w-full h-full p-6 sm:p-10 animate-pop overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <span className="text-base sm:text-lg font-bold" style={{ color: activeTeam.color }}>
                  دور فريق: {activeTeam.name} {pickedPlayer && `— يجيب: ${pickedPlayer}`}
                  {doublePointsActive && <span className="text-[var(--color-gold)]"> — نقاط مضاعفة 2️⃣</span>}
                </span>
                <span className={`font-black text-2xl sm:text-3xl ${timeLeft <= 5 ? 'text-[var(--color-danger)] animate-pulse-ring rounded-full px-2' : ''}`}>
                  {phase === 'main' ? '⏱️' : '⏳'} {timeLeft}ث
                </span>
              </div>

              {openTile.isDrawing ? (
                <>
                  <p className="text-center text-base sm:text-lg text-[var(--color-ink-dim)] mb-2 shrink-0">كلمة الرسم (لأعضاء الفريق الراسم فقط)</p>
                  <p className="text-center text-3xl sm:text-5xl font-black mb-4 shrink-0">{showAnswer ? openTile.answer : '•••••'}</p>
                  <button className="btn btn-ghost w-full mb-4 text-lg sm:text-xl !py-3 shrink-0" onClick={() => setShowAnswer((s) => !s)}>
                    {showAnswer ? 'إخفاء الكلمة' : 'اظهر الكلمة للرسام'}
                  </button>
                  <DrawingCanvas />
                </>
              ) : (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0 py-4">
                    <p className={`${questionTextClass} font-bold text-center leading-relaxed`}>{openTile.text}</p>
                    {openTile.imageUrl && (
                      <img
                        src={openTile.imageUrl}
                        alt=""
                        className="mx-auto max-h-64 sm:max-h-80 rounded-lg border border-[var(--color-border)]"
                      />
                    )}
                    {showAnswer && (
                      <p
                        className="text-center text-2xl sm:text-4xl font-extrabold p-4 rounded-lg"
                        style={{ background: 'var(--color-surface-hi)', color: 'var(--color-success)' }}
                      >
                        {openTile.answer}
                      </p>
                    )}
                  </div>
                  <button className="btn btn-ghost w-full mb-4 text-lg sm:text-xl !py-3 shrink-0" onClick={() => setShowAnswer((s) => !s)}>
                    {showAnswer ? 'إخفاء الإجابة' : 'اظهر الإجابة'}
                  </button>
                </>
              )}

              <div className="flex flex-wrap gap-3 justify-center mb-4 shrink-0">
                {activeTeam.lifelines
                  .filter((l) => !l.used)
                  .map((l) => (
                    <button key={l.id} className="btn btn-ghost !py-2.5 !px-4 text-base sm:text-lg" onClick={() => useLifeline(l.type)}>
                      {LIFELINE_LABELS[l.type].icon} {LIFELINE_LABELS[l.type].label}
                    </button>
                  ))}
                {tileHints.length > 0 &&
                  (() => {
                    const shownCount = Math.max(revealedHints, 1);
                    return (
                      <div className="w-full flex flex-col items-center gap-3 mt-1">
                        {tileHints.slice(0, shownCount).map((h, i) => (
                          <span key={i} className="text-xl sm:text-2xl md:text-3xl font-semibold leading-snug text-[var(--color-ink-dim)] text-center">
                            💡 {h}
                          </span>
                        ))}
                        {shownCount < tileHints.length && (
                          <button
                            type="button"
                            className="btn btn-ghost !py-2 !px-5 text-base sm:text-lg mt-1"
                            onClick={() => setRevealedHints(shownCount + 1)}
                          >
                            الهنت التالي ▶
                          </button>
                        )}
                      </div>
                    );
                  })()}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2 shrink-0">
                {board.teams.map((team) => (
                  <button
                    key={team.id}
                    className="btn btn-primary text-lg sm:text-xl !py-3.5"
                    style={{ background: team.color }}
                    onClick={() => markAnswer(team.id)}
                  >
                    ✔ {team.name} جاوب صح
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost w-full mb-2 text-base sm:text-lg !py-3 shrink-0" onClick={() => markAnswer(null)}>
                لا أحد جاوب / اللي بعده
              </button>
              <button className="text-sm sm:text-base text-[var(--color-ink-faint)] w-full text-center shrink-0" onClick={() => setVarOpen((v) => !v)}>
                🚩 ساعدنا في تعديل الخطأ (VAR)
              </button>
              {varOpen && (
                <div className="mt-2 flex gap-2 shrink-0">
                  <input className="input" placeholder="اكتب الخطأ ليتم تعديله" value={varNote} onChange={(e) => setVarNote(e.target.value)} />
                  <button className="btn btn-primary !px-4" onClick={submitVar}>
                    ارسل
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {phoneOverlay !== null && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex flex-col items-center justify-center gap-4">
          <div className="text-5xl animate-pulse-ring rounded-full p-6">📞</div>
          <p className="text-lg font-bold">اتصال بصديق — {phoneOverlay} ثانية متبقية</p>
          <button className="btn btn-ghost" onClick={() => setPhoneOverlay(null)}>
            إغلاق
          </button>
        </div>
      )}
    </div>
  );
}
