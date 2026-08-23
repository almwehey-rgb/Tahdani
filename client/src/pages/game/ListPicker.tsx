import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Category, Question } from '../../api/types';
import Spinner from '../../components/Spinner';

/** Categories holding at least one question with a hidden-answer list. */
export default function ListPicker() {
  const [ready, setReady] = useState<{ cat: Category; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/categories');
      const withQuestions = (data.categories as Category[]).filter((c) => (c._count?.questions ?? 0) > 0);
      // Only a category's own questions say whether they carry a list, so the
      // ones holding no questions at all are skipped before asking.
      const found: { cat: Category; count: number }[] = [];
      for (const cat of withQuestions) {
        try {
          const res = await api.get(`/categories/${cat.id}/questions`);
          const n = (res.data.questions as Question[]).filter((q) => q.answers && q.answers.length > 0).length;
          if (n > 0) found.push({ cat, count: n });
        } catch {
          // a category that fails to load simply does not appear
        }
      }
      setReady(found);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-1">السهل الممتنع</h1>
      <p className="text-[var(--color-ink-dim)] mb-6">
        سؤال واحد وله عدة إجابات مخفية. خمّنوا أكبر عدد قبل ما ينتهي الوقت — الإجابة الصعبة نقاطها أعلى.
      </p>

      {ready.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-bold mb-2">ما في فئة جاهزة بعد</p>
          <p className="text-sm text-[var(--color-ink-dim)] mb-4">
            افتح لوحة التحكم ← الفئات، أضف سؤالاً واستخدم صندوق «إجابات متعددة».
          </p>
          <Link className="btn btn-primary" to="/admin/categories">
            لوحة التحكم
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {ready.map(({ cat, count }) => (
            <Link
              key={cat.id}
              to={`/list/${cat.id}`}
              className="card p-4 flex items-center gap-3 hover:border-[var(--color-brand-hi)] transition-colors"
            >
              {cat.imageUrl ? (
                <img src={cat.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="w-12 h-12 rounded-lg grid place-items-center bg-[var(--color-bg-soft)] text-2xl shrink-0">
                  {cat.icon}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-bold truncate">{cat.name}</p>
                <p className="text-sm text-[var(--color-ink-faint)]">{count} سؤال جاهز</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
