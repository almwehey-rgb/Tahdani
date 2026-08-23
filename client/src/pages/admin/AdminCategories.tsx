import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import { uploadImage } from '../../api/uploadImage';
import type { Category, Question } from '../../api/types';
import Spinner from '../../components/Spinner';

const TYPES: Category['type'][] = ['PERMANENT', 'SEASONAL', 'KIDS', 'DRAWING', 'STUDENT'];
const HINT_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع'];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [newCat, setNewCat] = useState({ name: '', icon: '🎯', color: '#6C4CE0', imageUrl: '', type: 'PERMANENT' as Category['type'] });
  // which category's cover is being edited, and the URL being typed for it
  const [editingCover, setEditingCover] = useState<string | null>(null);
  const [coverDraft, setCoverDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newQ, setNewQ] = useState({
    text: '',
    answer: '',
    hint: '',
    hint2: '',
    hint3: '',
    hint4: '',
    imageUrl: '',
    videoUrl: '',
    grayscale: false,
    points: 200,
    isDrawing: false,
  });
  const [visibleHints, setVisibleHints] = useState(1);
  // Hidden answers for a list question ("السهل الممتنع"): each row is one
  // answer with its own score. Left empty, the question stays a normal one.
  const [listAnswers, setListAnswers] = useState<{ text: string; points: number }[]>([]);

  async function loadCategories() {
    setLoading(true);
    const { data } = await api.get('/categories');
    setCategories(data.categories);
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function toggleExpand(cat: Category) {
    if (expanded === cat.id) {
      setExpanded(null);
      return;
    }
    setExpanded(cat.id);
    const { data } = await api.get(`/categories/${cat.id}/questions`);
    setQuestions(data.questions);
  }

  async function createCategory() {
    if (newCat.name.trim().length < 2) return toast.error('اسم الفئة مطلوب');
    try {
      await api.post('/categories', { ...newCat, imageUrl: newCat.imageUrl.trim() || undefined });
      setNewCat({ name: '', icon: '🎯', color: '#6C4CE0', imageUrl: '', type: 'PERMANENT' });
      toast.success('تمت إضافة الفئة');
      loadCategories();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  // Name the category and its question count: a bare "are you sure?" next to a
  // category holding hundreds of questions is far too easy to click through.
  async function deleteCategory(cat: Category) {
    const count = cat._count?.questions ?? 0;
    const warning = count > 0 ? `\n\nفيها ${count} سؤال وراح تختفي من اللعبة.` : '';
    if (!window.confirm(`حذف فئة "${cat.name}"؟${warning}`)) return;
    await api.delete(`/categories/${cat.id}`);
    loadCategories();
  }

  async function pickImage(file: File | undefined, onDone: (url: string) => void) {
    if (!file) return;
    setUploading(true);
    try {
      onDone(await uploadImage(file));
      toast.success('تم رفع الصورة');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function saveCover(cat: Category) {
    try {
      await api.put(`/categories/${cat.id}`, { imageUrl: coverDraft.trim() || null });
      toast.success(coverDraft.trim() ? 'تم حفظ الصورة' : 'تمت إزالة الصورة');
      setEditingCover(null);
      loadCategories();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function addQuestion(categoryId: string) {
    const filled = listAnswers.filter((a) => a.text.trim());
    if (newQ.text.trim().length < 2) return toast.error('نص السؤال مطلوب');
    if (!newQ.answer.trim() && filled.length === 0) return toast.error('اكتب إجابة، أو أضف إجابات متعددة');
    try {
      await api.post(`/categories/${categoryId}/questions`, {
        ...newQ,
        hint: newQ.hint || undefined,
        hint2: newQ.hint2 || undefined,
        hint3: newQ.hint3 || undefined,
        hint4: newQ.hint4 || undefined,
        imageUrl: newQ.imageUrl || undefined,
        videoUrl: newQ.videoUrl || undefined,
        answers: listAnswers.filter((a) => a.text.trim()).map((a) => ({ text: a.text.trim(), points: a.points })),
      });
      setNewQ({
        text: '',
        answer: '',
        hint: '',
        hint2: '',
        hint3: '',
        hint4: '',
        imageUrl: '',
        videoUrl: '',
        grayscale: false,
        points: 200,
        isDrawing: false,
      });
      setVisibleHints(1);
      setListAnswers([]);
      const { data } = await api.get(`/categories/${categoryId}/questions`);
      setQuestions(data.questions);
      loadCategories();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function deleteQuestion(qid: string) {
    await api.delete(`/categories/questions/${qid}`);
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
    loadCategories();
  }

  async function deleteAllQuestions(categoryId: string) {
    if (!window.confirm(`هل أنت متأكد؟ راح يتم حذف كل الأسئلة (${questions.length}) في هذه الفئة نهائياً.`)) return;
    await api.delete(`/categories/${categoryId}/questions`);
    setQuestions([]);
    loadCategories();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h2 className="font-bold mb-3">إضافة فئة جديدة</h2>
        <div className="grid sm:grid-cols-6 gap-2 items-end">
          <div className="sm:col-span-2">
            <label className="label">الاسم</label>
            <input className="input" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          </div>
          <div>
            <label className="label">أيقونة (إيموجي)</label>
            <input className="input" value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} />
          </div>
          <div>
            <label className="label">النوع</label>
            <select className="input" value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value as Category['type'] })}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">رابط صورة الغلاف (اختياري)</label>
            <input
              className="input"
              placeholder="https://... أو ارفع صورة"
              value={newCat.imageUrl}
              onChange={(e) => setNewCat({ ...newCat, imageUrl: e.target.value })}
            />
            <label className="btn btn-ghost mt-1 w-full cursor-pointer text-sm">
              {uploading ? 'جاري الرفع...' : '📷 من جهازي'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  pickImage(e.target.files?.[0], (url) => setNewCat((c) => ({ ...c, imageUrl: url })));
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <button className="btn btn-primary" onClick={createCategory}>
            إضافة
          </button>
        </div>
        {newCat.imageUrl.trim() && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-[var(--color-ink-dim)]">معاينة:</span>
            <img
              src={newCat.imageUrl.trim()}
              alt=""
              className="w-16 h-16 rounded-lg object-cover border border-[var(--color-border)]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25'; }}
              onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {categories.map((cat) => (
          <div key={cat.id} className="card p-4">
            <div className="flex items-center justify-between">
              <button className="flex items-center gap-2 font-bold text-start" onClick={() => toggleExpand(cat)}>
                {cat.imageUrl ? (
                  <img src={cat.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-[var(--color-border)]" />
                ) : (
                  <span className="w-9 h-9 rounded-lg shrink-0 grid place-items-center bg-[var(--color-bg-soft)] text-lg">{cat.icon}</span>
                )}
                <span>{cat.name}</span>
                <span className="text-xs text-[var(--color-ink-faint)]">({cat._count?.questions ?? 0} أسئلة — {cat.type})</span>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  className="text-sm text-[var(--color-brand-hi)]"
                  onClick={() => {
                    setEditingCover(editingCover === cat.id ? null : cat.id);
                    setCoverDraft(cat.imageUrl || '');
                  }}
                >
                  {cat.imageUrl ? 'تغيير الصورة' : 'إضافة صورة'}
                </button>
                <button className="text-[var(--color-danger)] text-sm" onClick={() => deleteCategory(cat)}>
                  حذف
                </button>
              </div>
            </div>

            {editingCover === cat.id && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3 flex flex-col sm:flex-row gap-3 sm:items-end">
                <img
                  src={coverDraft.trim() || undefined}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover border border-[var(--color-border)] bg-[var(--color-bg-soft)] shrink-0"
                />
                <div className="flex-1">
                  <label className="label">رابط الصورة</label>
                  <input
                    className="input"
                    placeholder="https://..."
                    value={coverDraft}
                    onChange={(e) => setCoverDraft(e.target.value)}
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <label className="btn btn-ghost cursor-pointer text-sm">
                      {uploading ? 'جاري الرفع...' : '📷 اختر من جهازي'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          pickImage(e.target.files?.[0], setCoverDraft);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      أو الصق رابطاً. اتركه فارغاً لإزالة الصورة.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary" disabled={uploading} onClick={() => saveCover(cat)}>حفظ</button>
                  <button className="btn btn-ghost" onClick={() => setEditingCover(null)}>إلغاء</button>
                </div>
              </div>
            )}

            {expanded === cat.id && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                {questions.length > 0 && (
                  <div className="flex justify-end mb-2">
                    <button className="text-[var(--color-danger)] text-sm" onClick={() => deleteAllQuestions(cat.id)}>
                      حذف كل الأسئلة ({questions.length})
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2 mb-4">
                  {questions.map((q) => (
                    <div key={q.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-[var(--color-bg-soft)]">
                      <div>
                        <p className="font-bold">{q.text}</p>
                        {q.answers && q.answers.length > 0 ? (
                          <p className="text-[var(--color-ink-faint)]">
                            {q.answers.length} إجابة مخفية:{' '}
                            {q.answers.map((a) => `${a.text} (${a.points})`).join('، ')}
                          </p>
                        ) : (
                          <p className="text-[var(--color-ink-faint)]">
                            الإجابة: {q.answer} — {q.points} نقطة
                          </p>
                        )}
                      </div>
                      <button className="text-[var(--color-danger)]" onClick={() => deleteQuestion(q.id)}>
                        حذف
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-2 mb-2">
                  <input className="input" placeholder="نص السؤال" value={newQ.text} onChange={(e) => setNewQ({ ...newQ, text: e.target.value })} />
                  <input className="input" placeholder="الإجابة" value={newQ.answer} onChange={(e) => setNewQ({ ...newQ, answer: e.target.value })} />

                  <div className="rounded-xl border border-[var(--color-border)] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">إجابات متعددة (السهل الممتنع)</span>
                      <button
                        type="button"
                        className="text-sm text-[var(--color-brand-hi)]"
                        onClick={() => setListAnswers((a) => [...a, { text: '', points: 100 }])}
                      >
                        + إضافة إجابة
                      </button>
                    </div>
                    {listAnswers.length === 0 ? (
                      <p className="text-xs text-[var(--color-ink-faint)]">
                        اتركها فارغة لسؤال عادي بإجابة واحدة. أضف إجابات هنا ليصير السؤال من نوع «خمّن كل الإجابات» — كل إجابة بنقاطها.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {listAnswers.map((a, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <span className="text-xs text-[var(--color-ink-faint)] w-5 shrink-0">{i + 1}.</span>
                            <input
                              className="input flex-1"
                              placeholder="الإجابة المخفية"
                              value={a.text}
                              onChange={(e) =>
                                setListAnswers((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                              }
                            />
                            <input
                              className="input w-24 shrink-0"
                              type="number"
                              min={0}
                              step={50}
                              value={a.points}
                              onChange={(e) =>
                                setListAnswers((prev) =>
                                  prev.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) || 0 } : x)),
                                )
                              }
                            />
                            <button
                              type="button"
                              className="text-[var(--color-danger)] text-sm shrink-0"
                              onClick={() => setListAnswers((prev) => prev.filter((_, j) => j !== i))}
                            >
                              حذف
                            </button>
                          </div>
                        ))}
                        <p className="text-xs text-[var(--color-ink-faint)]">
                          البديهية نقاطها أقل، والصعبة أعلى — لين 1000.
                        </p>
                      </div>
                    )}
                  </div>
                  <input className="input" placeholder="التلميح الأول (اختياري)" value={newQ.hint} onChange={(e) => setNewQ({ ...newQ, hint: e.target.value })} />
                  {(['hint2', 'hint3', 'hint4'] as const).map((key, i) =>
                    visibleHints > i + 1 ? (
                      <input
                        key={key}
                        className="input"
                        placeholder={`التلميح ${HINT_ORDINALS[i + 1]} (اختياري)`}
                        value={newQ[key]}
                        onChange={(e) => setNewQ({ ...newQ, [key]: e.target.value })}
                      />
                    ) : visibleHints === i + 1 ? (
                      <button key={key} type="button" className="btn btn-ghost text-sm" onClick={() => setVisibleHints(i + 2)}>
                        + إضافة الهنت {HINT_ORDINALS[i + 1]}
                      </button>
                    ) : null
                  )}
                  <input
                    className="input"
                    placeholder="رابط صورة (اختياري)"
                    value={newQ.imageUrl}
                    onChange={(e) => setNewQ({ ...newQ, imageUrl: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="رابط فيديو أو يوتيوب (اختياري)"
                    value={newQ.videoUrl}
                    onChange={(e) => setNewQ({ ...newQ, videoUrl: e.target.value })}
                  />
                  <label className="flex items-center gap-2 text-sm px-1">
                    <input
                      type="checkbox"
                      checked={newQ.grayscale}
                      onChange={(e) => setNewQ({ ...newQ, grayscale: e.target.checked })}
                    />
                    أبيض وأسود (يخفي ألوان الفانيلة)
                  </label>
                  <select className="input" value={newQ.points} onChange={(e) => setNewQ({ ...newQ, points: Number(e.target.value) })}>
                    <option value={200}>200</option>
                    <option value={400}>400</option>
                    <option value={600}>600</option>
                  </select>
                </div>
                <button className="btn btn-primary text-sm" onClick={() => addQuestion(cat.id)}>
                  + إضافة سؤال
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
