import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { StudentSubject } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function SubjectPicker() {
  const [grades, setGrades] = useState<string[]>([]);
  const [grade, setGrade] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/grades').then(({ data }) => {
      setGrades(data.grades);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!grade) return;
    api.get('/student/subjects', { params: { grade } }).then(({ data }) => setSubjects(data.subjects));
  }, [grade]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-1">حقيبة الطالب</h1>
      <p className="text-[var(--color-ink-dim)] mb-6">راجع دراستك من خلال الألعاب المتوفرة، اختر مرحلة دراسية من بين المراحل التالية</p>

      {loading ? (
        <Spinner />
      ) : grades.length === 0 ? (
        <p className="text-[var(--color-ink-faint)]">لا توجد فئة متاحة في الوقت الراهن. يرجى التحقق مرة أخرى في وقت لاحق!</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {grades.map((g) => (
              <button key={g} className={`btn !py-2 !px-4 text-sm ${grade === g ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setGrade(g)}>
                {g}
              </button>
            ))}
          </div>

          {grade && (
            <div className="grid sm:grid-cols-2 gap-4">
              {subjects.map((s) => (
                <Link key={s.id} to={`/student/${s.id}`} className="card p-5 hover:border-[var(--color-brand-hi)]">
                  <p className="font-bold mb-1">{s.name}</p>
                  <p className="text-sm text-[var(--color-ink-dim)]">{s.semester} — {s._count?.questions ?? 0} أسئلة</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
