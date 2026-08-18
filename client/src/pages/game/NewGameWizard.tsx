import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import type { Category, LifelineType } from '../../api/types';
import { LIFELINE_LABELS, LIFELINE_TYPES } from '../../api/types';
import Spinner from '../../components/Spinner';

const PALETTE = ['#ff7a4d', '#3fc6ff', '#7c5cff', '#34d399', '#ffc94d', '#ff5c72'];

interface WizardTeam {
  name: string;
  color: string;
  players: string[];
}

function emptyTeam(name: string, color: string): WizardTeam {
  return { name, color, players: [''] };
}

export default function NewGameWizard({ mode }: { mode: 'CLASSIC' | 'KIDS' }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<'teams' | 'categories' | 'lifelines'>('teams');

  const [teams, setTeams] = useState<WizardTeam[]>([emptyTeam('الفريق الأول', PALETTE[0]), emptyTeam('الفريق الثاني', PALETTE[1])]);
  const [pool, setPool] = useState<string[]>(['']);
  const [autoSplit, setAutoSplit] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [lifelines, setLifelines] = useState<Record<number, LifelineType[]>>({ 0: [], 1: [] });
  const [creating, setCreating] = useState(false);

  const categoryType = mode === 'KIDS' ? 'KIDS' : undefined;
  const requiredCategoryCount = mode === 'KIDS' ? 1 : 6;

  useEffect(() => {
    setLoadingCats(true);
    api
      .get('/categories', { params: categoryType ? { type: categoryType } : undefined })
      .then(({ data }) => {
        const cats: Category[] = mode === 'CLASSIC' ? data.categories.filter((c: Category) => c.type !== 'KIDS' && c.type !== 'STUDENT') : data.categories;
        setCategories(cats);
      })
      .finally(() => setLoadingCats(false));
  }, [mode]);

  function updateTeam(idx: number, patch: Partial<WizardTeam>) {
    setTeams((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function shufflePool() {
    const names = pool.map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) {
      toast.error('يرجى إدخال اسمين على الأقل لخلط الفرق');
      return;
    }
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setTeams((prev) => [
      { ...prev[0], players: shuffled.slice(0, mid) },
      { ...prev[1], players: shuffled.slice(mid) },
    ]);
    toast.success('تم تقسيم الفرق بنجاح!');
  }

  function validateTeams(): string | null {
    for (const t of teams) {
      if (t.name.trim().length < 2) return 'اسم الفريق مطلوب (حرفين على الأقل)';
      if (t.name.trim().length > 22) return 'يجب ألا يزيد اسم الفريق عن 22 حرفا';
      const players = t.players.map((p) => p.trim()).filter(Boolean);
      if (players.length === 0) return 'الرجاء إدخال عدد صحيح من اللاعبين';
    }
    if (teams[0].name.trim().toLowerCase() === teams[1].name.trim().toLowerCase()) return 'اسم الفريق مكرر، يرجى التغيير';
    return null;
  }

  function goCategories() {
    const err = validateTeams();
    if (err) return toast.error(err);
    if (mode === 'KIDS' && categories.length > 0) {
      setSelectedCategories(categories.map((c) => c.id));
      createGame(categories.map((c) => c.id), {});
      return;
    }
    setStep('categories');
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= requiredCategoryCount) {
        toast.error(`اختر ${requiredCategoryCount} فئات فقط`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function goLifelines() {
    if (selectedCategories.length !== requiredCategoryCount) {
      toast.error(`اختر ${requiredCategoryCount} فئات فقط`);
      return;
    }
    setStep('lifelines');
  }

  function toggleLifeline(teamIdx: number, type: LifelineType) {
    setLifelines((prev) => {
      const current = prev[teamIdx] || [];
      if (current.includes(type)) return { ...prev, [teamIdx]: current.filter((l) => l !== type) };
      if (current.length >= 3) {
        toast.error('اختر 3 وسائل مساعدة فقط');
        return prev;
      }
      return { ...prev, [teamIdx]: [...current, type] };
    });
  }

  async function createGame(categoryIds: string[], lifelinesMap: Record<number, LifelineType[]>) {
    setCreating(true);
    try {
      const { data } = await api.post('/games', {
        mode,
        teams: teams.map((t, i) => ({
          name: t.name.trim(),
          color: t.color,
          players: t.players.map((p) => p.trim()).filter(Boolean),
          lifelines: lifelinesMap[i] || [],
        })),
        categoryIds,
      });
      navigate(`/game/${data.game.id}/board`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const readyForClassicSubmit = useMemo(
    () => teams.every((t) => (lifelines[teams.indexOf(t)] || []).length === 3),
    [teams, lifelines],
  );

  if (user && user.remainingGames < 1) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">😔</div>
        <h1 className="text-xl font-bold mb-2">لا يوجد لديك ألعاب متبقية</h1>
        <p className="text-[var(--color-ink-dim)] mb-6">يرجى شراء باقة جديدة للمتابعة</p>
        <button className="btn btn-gold" onClick={() => navigate('/packages')}>
          شراء باقة
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-1">{mode === 'KIDS' ? 'واجهة الأطفال' : 'إعداد لعبة جديدة'}</h1>
      <div className="flex items-center gap-2 mb-6 text-sm text-[var(--color-ink-dim)]">
        <StepDot active={step === 'teams'} label="الفرق" />
        <span>—</span>
        <StepDot active={step === 'categories'} label="الفئات" />
        {mode === 'CLASSIC' && (
          <>
            <span>—</span>
            <StepDot active={step === 'lifelines'} label="وسائل المساعدة" />
          </>
        )}
      </div>

      {step === 'teams' && (
        <div className="card p-5 animate-pop">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">حدد معلومات الفرق</h2>
            <button className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={() => setAutoSplit((v) => !v)}>
              {autoSplit ? 'إدخال يدوي' : 'قسملي الفرق تلقائيا'}
            </button>
          </div>

          {autoSplit && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-bg-soft)] border border-[var(--color-border)]">
              <label className="label">اكتب أسامي الاعبين (لاعب في كل سطر)</label>
              <textarea
                className="input min-h-24"
                value={pool.join('\n')}
                onChange={(e) => setPool(e.target.value.split('\n'))}
                placeholder={'أحمد\nسارة\nمحمد\nلولوة'}
              />
              <button className="btn btn-primary mt-3" onClick={shufflePool}>
                🔀 خلط الفرق
              </button>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {teams.map((team, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[var(--color-bg-soft)] border border-[var(--color-border)]">
                <label className="label">اسم الفريق {idx === 0 ? 'الأول' : 'الثاني'}</label>
                <input className="input mb-3" value={team.name} onChange={(e) => updateTeam(idx, { name: e.target.value })} />

                <label className="label">لون الفريق</label>
                <div className="flex gap-2 mb-3">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      className="w-7 h-7 rounded-full border-2"
                      style={{ background: c, borderColor: team.color === c ? 'white' : 'transparent' }}
                      onClick={() => updateTeam(idx, { color: c })}
                    />
                  ))}
                </div>

                <label className="label">اللاعبون</label>
                <div className="flex flex-col gap-2">
                  {team.players.map((p, pi) => (
                    <div key={pi} className="flex gap-2">
                      <input
                        className="input"
                        placeholder="اسم اللاعب"
                        value={p}
                        onChange={(e) => {
                          const players = [...team.players];
                          players[pi] = e.target.value;
                          updateTeam(idx, { players });
                        }}
                      />
                      {team.players.length > 1 && (
                        <button
                          className="btn btn-ghost !px-3"
                          onClick={() => updateTeam(idx, { players: team.players.filter((_, i) => i !== pi) })}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-ghost text-sm" onClick={() => updateTeam(idx, { players: [...team.players, ''] })}>
                    + إضافة المزيد من الأعضاء
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary w-full mt-6" onClick={goCategories} disabled={creating}>
            {creating ? 'جاري الإنشاء...' : 'التالي: اختر الفئات'}
          </button>
        </div>
      )}

      {step === 'categories' && (
        <div className="card p-5 animate-pop">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">
              اختر الفئات ({selectedCategories.length}/{requiredCategoryCount})
            </h2>
            <button className="text-sm text-[var(--color-ink-faint)]" onClick={() => setStep('teams')}>
              رجوع
            </button>
          </div>
          {loadingCats ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map((c) => {
                const selected = selectedCategories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCategory(c.id)}
                    className="rounded-xl overflow-hidden border-2 text-center transition-all"
                    style={{ borderColor: selected ? c.color : 'var(--color-border)' }}
                  >
                    <div
                      className="relative aspect-[16/10]"
                      style={{ background: `linear-gradient(160deg, ${c.color}66, ${c.color}22)` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">{c.icon}</div>
                      {c.imageUrl && (
                        <img
                          src={c.imageUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-contain p-2"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ background: `${c.color}55` }}>
                          ✔
                        </div>
                      )}
                    </div>
                    <div className="py-2 px-2" style={{ background: selected ? `${c.color}22` : 'var(--color-bg-soft)' }}>
                      <div className="text-sm font-bold">{c.name}</div>
                      {c.type === 'SEASONAL' && <div className="text-[10px] text-[var(--color-gold)] mt-1">موسمية</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <button
            className="btn btn-primary w-full mt-6"
            onClick={mode === 'CLASSIC' ? goLifelines : () => createGame(selectedCategories, {})}
            disabled={creating || selectedCategories.length !== requiredCategoryCount}
          >
            {creating ? 'جاري الإنشاء...' : mode === 'CLASSIC' ? 'التالي: وسائل المساعدة' : 'ابدأ اللعب'}
          </button>
        </div>
      )}

      {step === 'lifelines' && mode === 'CLASSIC' && (
        <div className="card p-5 animate-pop">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">اختر وسائل المساعدة بشكل كامل</h2>
            <button className="text-sm text-[var(--color-ink-faint)]" onClick={() => setStep('categories')}>
              رجوع
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {teams.map((team, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[var(--color-bg-soft)] border border-[var(--color-border)]">
                <p className="font-bold mb-3" style={{ color: team.color }}>
                  {team.name} : اختر 3 وسائل مساعدة
                </p>
                <div className="flex flex-col gap-2">
                  {LIFELINE_TYPES.map((type) => {
                    const chosen = (lifelines[idx] || []).includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleLifeline(idx, type)}
                        className="flex items-center gap-2 p-2.5 rounded-lg text-right border transition-colors"
                        style={{
                          borderColor: chosen ? team.color : 'var(--color-border)',
                          background: chosen ? `${team.color}22` : 'transparent',
                        }}
                      >
                        <span className="text-xl">{LIFELINE_LABELS[type].icon}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-bold">{LIFELINE_LABELS[type].label}</span>
                          <span className="block text-xs text-[var(--color-ink-faint)]">{LIFELINE_LABELS[type].desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-gold w-full mt-6"
            disabled={!readyForClassicSubmit || creating}
            onClick={() => createGame(selectedCategories, lifelines)}
          >
            {creating ? 'جاري الإنشاء...' : '🎮 ابدأ اللعب'}
          </button>
        </div>
      )}
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={active ? 'font-bold text-[var(--color-gold)]' : ''}>{label}</span>
  );
}
