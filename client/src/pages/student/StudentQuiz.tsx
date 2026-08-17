import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { StudentQuestion } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function StudentQuiz() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    api.get(`/student/subjects/${subjectId}/questions`).then(({ data }) => {
      setQuestions(data.questions);
      setLoading(false);
    });
  }, [subjectId]);

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === questions[index].correctIndex) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  if (loading) return <Spinner />;
  if (questions.length === 0) return <p className="text-center py-16 text-[var(--color-ink-faint)]">لا توجد أسئلة لهذه المادة بعد.</p>;

  if (finished) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🎓</div>
        <h1 className="text-2xl font-extrabold mb-2">
          نتيجتك: {score} / {questions.length}
        </h1>
        <div className="flex justify-center gap-3 mt-6">
          <button className="btn btn-primary" onClick={() => navigate('/new-game/student')}>
            مادة أخرى
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
            الرئيسية
          </button>
        </div>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <p className="text-sm text-[var(--color-ink-dim)] mb-2 text-center">
        سؤال {index + 1} من {questions.length}
      </p>
      <div className="card p-6 animate-pop">
        <p className="text-lg font-bold text-center mb-6">{q.text}</p>
        <div className="flex flex-col gap-2">
          {q.choices.map((choice, i) => {
            const isCorrect = i === q.correctIndex;
            const isPicked = i === picked;
            let style = 'border-[var(--color-border)]';
            if (picked !== null) {
              if (isCorrect) style = 'border-[var(--color-success)] bg-[var(--color-success)]/10';
              else if (isPicked) style = 'border-[var(--color-danger)] bg-[var(--color-danger)]/10';
            }
            return (
              <button key={i} onClick={() => pick(i)} className={`p-3 rounded-lg border text-right ${style}`}>
                {choice}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <button className="btn btn-primary w-full mt-5" onClick={next}>
            {index + 1 >= questions.length ? 'عرض النتيجة' : 'اللي بعده'}
          </button>
        )}
      </div>
    </div>
  );
}
