import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import type { Category, Question } from '../../api/types';
import Spinner from '../../components/Spinner';

const TYPES: Category['type'][] = ['PERMANENT', 'SEASONAL', 'KIDS', 'DRAWING', 'STUDENT'];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [newCat, setNewCat] = useState({ name: '', icon: '🎯', color: '#6C4CE0', type: 'PERMANENT' as Category['type'] });
  const [newQ, setNewQ] = useState({ text: '', answer: '', hint: '', hint2: '', points: 200, isDrawing: false });
  const [showHint2, setShowHint2] = useState(false);

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
      await api.post('/categories', newCat);
      setNewCat({ name: '', icon: '🎯', color: '#6C4CE0', type: 'PERMANENT' });
      toast.success('تمت إضافة الفئة');
      loadCategories();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function deleteCategory(id: string) {
    if (!window.confirm('هل أنت متأكد؟')) return;
    await api.delete(`/categories/${id}`);
    loadCategories();
  }

  async function addQuestion(categoryId: string) {
    if (newQ.text.trim().length < 2 || newQ.answer.trim().length < 1) return toast.error('يرجى تصحيح الأخطاء');
    try {
      await api.post(`/categories/${categoryId}/questions`, { ...newQ, hint: newQ.hint || undefined, hint2: newQ.hint2 || undefined });
      setNewQ({ text: '', answer: '', hint: '', hint2: '', points: 200, isDrawing: false });
      setShowHint2(false);
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

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h2 className="font-bold mb-3">إضافة فئة جديدة</h2>
        <div className="grid sm:grid-cols-5 gap-2 items-end">
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
          <button className="btn btn-primary" onClick={createCategory}>
            إضافة
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {categories.map((cat) => (
          <div key={cat.id} className="card p-4">
            <div className="flex items-center justify-between">
              <button className="flex items-center gap-2 font-bold" onClick={() => toggleExpand(cat)}>
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="text-xs text-[var(--color-ink-faint)]">({cat._count?.questions ?? 0} أسئلة — {cat.type})</span>
              </button>
              <button className="text-[var(--color-danger)] text-sm" onClick={() => deleteCategory(cat.id)}>
                حذف
              </button>
            </div>

            {expanded === cat.id && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <div className="flex flex-col gap-2 mb-4">
                  {questions.map((q) => (
                    <div key={q.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-[var(--color-bg-soft)]">
                      <div>
                        <p className="font-bold">{q.text}</p>
                        <p className="text-[var(--color-ink-faint)]">
                          الإجابة: {q.answer} — {q.points} نقطة
                        </p>
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
                  <input className="input" placeholder="تلميح (اختياري)" value={newQ.hint} onChange={(e) => setNewQ({ ...newQ, hint: e.target.value })} />
                  {showHint2 ? (
                    <input
                      className="input"
                      placeholder="التلميح الثاني (اختياري)"
                      value={newQ.hint2}
                      onChange={(e) => setNewQ({ ...newQ, hint2: e.target.value })}
                    />
                  ) : (
                    <button type="button" className="btn btn-ghost text-sm" onClick={() => setShowHint2(true)}>
                      + إضافة الهنت الثاني
                    </button>
                  )}
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
