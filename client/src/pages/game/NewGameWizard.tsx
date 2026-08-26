import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import type { Category, LifelineType } from '../../api/types';
import { LIFELINE_LABELS } from '../../api/types';
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

const SELECTABLE_LIFELINE_TYPES: LifelineType[] = ['PHONE_A_FRIEND', 'STEAL_POINTS', 'DOUBLE_POINTS'];

// Browsing 500+ categories through one search box is hopeless, so the picker
// also offers quick groups. Each is matched against the category name; a
// category can appear under more than one, and chips with no matches are
// hidden, so this stays correct as categories are added.
const CATEGORY_GROUPS: { label: string; match: RegExp }[] = [
  { label: 'فيها أسئلة', match: /(?:)/ }, // handled specially below
  { label: 'كرة قدم', match: /كرة|الكرة|دوري|كأس|مونديال|لاعب|هدف|مدرب|نادي|منتخب|FUT|أندية/ },
  { label: 'فن وأغاني', match: /أغاني|اغاني|أغنية|فنان|فن |مسرحي|طرب/ },
  { label: 'مسلسلات وأفلام', match: /مسلسل|فيلم|أفلام|سينما|بوسترات|دراما/ },
  { label: 'من أنا؟', match: /من أنا|من انا/ },
  { label: 'ولا كلمة', match: /ولا كلمة/ },
  { label: 'إي لا', match: /إي لا|إي لأ|اي لا|إي أو لأ/ },
  { label: 'حروف', match: /حروف/ },
  { label: 'دول وجغرافيا', match: /جغرافيا|دول|عاصمة|أعلام|خرائط|معالم|السعودية|الكويت|الأردن|قطر|مصر/ },
  { label: 'إسلامي', match: /قرآن|إسلامي|اسلامي|أنبياء|دين|جزء عم|نشيد|أذان/ },
  { label: 'ألعاب', match: /ألعاب|العاب|لعبة|أنمي|انمي/ },
  { label: 'صور ومقاطع', match: /صورة|صور |لقطة|مقاطع|شعارات|إيموجي|ايموجي/ },
];

const TEAM_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
const TEAM_NAME_DEFAULTS = ['الفريق الأول', 'الفريق الثاني', 'الفريق الثالث', 'الفريق الرابع'];
const MAX_TEAMS = 4;

export default function NewGameWizard({ mode }: { mode: 'CLASSIC' | 'KIDS' | 'DANGER' }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<'teams' | 'categories' | 'lifelines'>('teams');

  const [teams, setTeams] = useState<WizardTeam[]>([emptyTeam('الفريق الأول', PALETTE[0]), emptyTeam('الفريق الثاني', PALETTE[1])]);
  const [pool, setPool] = useState<string[]>(['']);
  const [autoSplit, setAutoSplit] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('الكل');

  const [lifelines, setLifelines] = useState<Record<number, LifelineType[]>>({});
  const [creating, setCreating] = useState(false);

  // DANGER (فئة "خطر ونقاط") is a single-category quick-play shortcut just
  // like KIDS, but it still plays as a normal CLASSIC game server-side —
  // Game.mode only distinguishes credit cost and STUDENT's separate flow.
  const categoryType = mode === 'KIDS' ? 'KIDS' : mode === 'DANGER' ? 'DANGER' : undefined;
  const requiredCategoryCount = mode === 'KIDS' || mode === 'DANGER' ? 1 : 6;
  const serverMode = mode === 'DANGER' ? 'CLASSIC' : mode;

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

  function addTeam() {
    setTeams((prev) => {
      if (prev.length >= MAX_TEAMS) return prev;
      return [...prev, emptyTeam(TEAM_NAME_DEFAULTS[prev.length], PALETTE[prev.length % PALETTE.length])];
    });
    setLifelines({});
  }

  function removeTeam(idx: number) {
    setTeams((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));
    setLifelines({});
  }

  function shufflePool() {
    const names = pool.map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) {
      toast.error('يرجى إدخال اسمين على الأقل لخلط الفرق');
      return;
    }
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    setTeams((prev) =>
      prev.map((t, i) => ({ ...t, players: shuffled.filter((_, ni) => ni % prev.length === i) })),
    );
    toast.success('تم تقسيم الفرق بنجاح!');
  }

  function validateTeams(): string | null {
    for (const t of teams) {
      if (t.name.trim().length < 2) return 'اسم الفريق مطلوب (حرفين على الأقل)';
      if (t.name.trim().length > 22) return 'يجب ألا يزيد اسم الفريق عن 22 حرفا';
      const players = t.players.map((p) => p.trim()).filter(Boolean);
      if (players.length === 0) return 'الرجاء إدخال عدد صحيح من اللاعبين';
    }
    const names = teams.map((t) => t.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return 'اسم الفريق مكرر، يرجى التغيير';
    return null;
  }

  function goCategories() {
    const err = validateTeams();
    if (err) return toast.error(err);
    if ((mode === 'KIDS' || mode === 'DANGER') && categories.length > 0) {
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
        mode: serverMode,
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

  function matchesGroup(c: Category, label: string) {
    if (label === 'الكل') return true;
    if (label === 'فيها أسئلة') return (c._count?.questions ?? 0) > 0;
    const group = CATEGORY_GROUPS.find((g) => g.label === label);
    return group ? group.match.test(c.name) : true;
  }

  // Only offer a chip when it actually leads somewhere.
  const groupChips = useMemo(() => {
    const chips = [{ label: 'الكل', count: categories.length }];
    for (const g of CATEGORY_GROUPS) {
      const count = categories.filter((c) => matchesGroup(c, g.label)).length;
      if (count > 0) chips.push({ label: g.label, count });
    }
    return chips;
  }, [categories]);

  const visibleCategories = useMemo(() => {
    const q = categorySearch.trim();
    return categories.filter((c) => c.name.includes(q) && matchesGroup(c, activeGroup));
  }, [categories, categorySearch, activeGroup]);

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
    <div className="max-w-[1600px] mx-auto px-4 py-10">
      {step === 'categories' && selectedCategories.length === requiredCategoryCount && (
        <div className="sticky top-16 z-30 -mx-4 px-4 py-2 mb-3 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)]">
          <button
            className="btn btn-primary w-full animate-pop"
            onClick={mode === 'CLASSIC' ? goLifelines : () => createGame(selectedCategories, {})}
            disabled={creating}
          >
            {creating ? 'جاري الإنشاء...' : mode === 'CLASSIC' ? 'التالي: وسائل المساعدة' : 'ابدأ اللعب'}
          </button>
        </div>
      )}
      <h1 className="text-2xl font-extrabold mb-1">
        {mode === 'KIDS' ? 'واجهة الأطفال' : mode === 'DANGER' ? 'خطر ونقاط' : 'إعداد لعبة جديدة'}
      </h1>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">اسم الفريق {TEAM_ORDINALS[idx] || idx + 1}</label>
                  {teams.length > 2 && (
                    <button className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-danger)]" onClick={() => removeTeam(idx)}>
                      ✕ إزالة الفريق
                    </button>
                  )}
                </div>
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

          {teams.length < MAX_TEAMS && (
            <button className="btn btn-ghost w-full mt-4" onClick={addTeam}>
              + إضافة فريق
            </button>
          )}

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
          <input
            className="input mb-3"
            placeholder="🔍 ابحث عن فئة..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {groupChips.map((chip) => {
              const active = activeGroup === chip.label;
              return (
                <button
                  key={chip.label}
                  onClick={() => setActiveGroup(chip.label)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                    active
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-ink-dim)] hover:border-[var(--color-primary)]'
                  }`}
                >
                  {chip.label}
                  <span className={`mr-1.5 text-xs ${active ? 'opacity-80' : 'opacity-60'}`}>{chip.count}</span>
                </button>
              );
            })}
          </div>
          {loadingCats ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {visibleCategories.map((c) => {
                const selected = selectedCategories.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleCategory(c.id)} className="text-right transition-all">
                    <div
                      className="relative rounded-2xl overflow-hidden aspect-[4/5] border-2 flex flex-col"
                      style={{
                        background: `linear-gradient(160deg, ${c.color}33, ${c.color}11)`,
                        borderColor: selected ? c.color : 'var(--color-border)',
                      }}
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toast(`${c.icon} ${c.name} — ${c._count?.questions ?? 0} سؤال`);
                        }}
                        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm text-white text-xs font-bold flex items-center justify-center"
                      >
                        i
                      </span>
                      {selected && (
                        <span
                          className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-sm text-white"
                          style={{ background: c.color }}
                        >
                          ✔
                        </span>
                      )}
                      <div className="flex-1 relative flex items-center justify-center text-4xl">
                        {c.icon}
                        {c.imageUrl && (
                          <img
                            src={c.imageUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain p-3"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <div
                        className="px-2 py-3 sm:py-4 text-center text-lg sm:text-xl md:text-2xl font-extrabold text-white leading-tight line-clamp-2"
                        style={{ background: c.color }}
                      >
                        {c.name}
                        {c.type === 'SEASONAL' && <span className="text-[var(--color-gold-hi,#ffdb85)]"> · موسمية</span>}
                      </div>
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
                  {SELECTABLE_LIFELINE_TYPES.map((type) => {
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
