import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Category, Question } from '../../api/types';
import Spinner from '../../components/Spinner';

/**
 * The judge's answer sheet, opened by scanning the QR shown during a list
 * round. It is reached on a phone that is usually not signed in, so it reads
 * the public list endpoint and never touches the round's own state — the
 * judge only needs to know which answers count and what each is worth.
 */
export default function JudgeSheet() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/categories/${categoryId}/list`);
        setCategory(data.category);
        setQuestions(data.questions);
      } catch {
        setError('ما قدرنا نفتح ورقة الإجابات. تأكد من الرابط أو امسح الباركود مرة ثانية.');
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId]);

  // Judging is mostly "did they just say something on the list?", so a search
  // across every question beats paging to the right one by hand.
  const hits = useMemo(() => {
    const q = search.trim();
    if (!q) return null;
    const norm = (s: string) =>
      s.replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
    const needle = norm(q);
    const out: { question: Question; text: string; points: number }[] = [];
    questions.forEach((question) =>
      (question.answers ?? []).forEach((a) => {
        if (norm(a.text).includes(needle)) out.push({ question, text: a.text, points: a.points });
      }),
    );
    return out;
  }, [search, questions]);

  if (loading) return <Spinner />;

  if (error || !category) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4">🚫</p>
        <p className="font-bold mb-2">تعذّر الفتح</p>
        <p className="text-sm text-[var(--color-ink-dim)]">{error}</p>
      </div>
    );
  }

  const current = questions[index];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div
        className="rounded-2xl px-4 py-3 mb-4 text-center"
        style={{ background: 'var(--color-surface-hi)', border: '1px solid var(--color-border)' }}
      >
        <p className="font-extrabold text-lg">⚖️ ورقة الحكم — {category.name}</p>
        <p className="text-xs text-[var(--color-danger)] font-bold mt-1">لا تعرض هذي الشاشة للاعبين</p>
      </div>

      <input
        className="input mb-4"
        placeholder="ابحث عن إجابة قالوها…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {hits ? (
        <div>
          <p className="text-sm text-[var(--color-ink-dim)] mb-2">
            {hits.length === 0 ? 'ما لقيت هذي الإجابة بأي سؤال — يعني غلط.' : `لقيت ${hits.length} إجابة مطابقة:`}
          </p>
          <div className="flex flex-col gap-2">
            {hits.map((h, i) => (
              <div key={i} className="card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{h.text}</p>
                  <p className="text-xs text-[var(--color-ink-faint)] truncate">{h.question.text}</p>
                </div>
                <span className="font-black shrink-0" style={{ color: 'var(--color-gold)' }}>
                  +{h.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : questions.length === 0 ? (
        <p className="card p-6 text-center text-[var(--color-ink-dim)]">ما في أسئلة جاهزة بهذي الفئة.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            <button className="btn btn-ghost !py-2 !px-4" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              ← السابق
            </button>
            <span className="text-sm font-bold text-[var(--color-ink-dim)]">
              سؤال {index + 1} من {questions.length}
            </span>
            <button
              className="btn btn-ghost !py-2 !px-4"
              disabled={index >= questions.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              التالي →
            </button>
          </div>

          <p className="font-extrabold text-lg mb-3 leading-relaxed">{current.text}</p>

          <div className="flex flex-col gap-2">
            {(current.answers ?? []).map((a, i) => (
              <div key={a.id} className="card p-3 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-black"
                  style={{ background: 'var(--color-surface-hi)' }}>
                  {i + 1}
                </span>
                <p className="font-bold flex-1 min-w-0">{a.text}</p>
                <span className="font-black shrink-0" style={{ color: 'var(--color-gold)' }}>
                  +{a.points}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
