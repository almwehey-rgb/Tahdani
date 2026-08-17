import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import type { StudentSubject } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function AdminStudentContent() {
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectForm, setSubjectForm] = useState({ name: '', grade: '', semester: '' });
  const [qSubjectId, setQSubjectId] = useState('');
  const [qForm, setQForm] = useState({ text: '', choicesRaw: '', correctIndex: 0 });

  async function load() {
    const { data } = await api.get('/student/subjects');
    setSubjects(data.subjects);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createSubject() {
    if (subjectForm.name.trim().length < 2) return toast.error('اسم المادة مطلوب');
    try {
      await api.post('/student/subjects', subjectForm);
      setSubjectForm({ name: '', grade: '', semester: '' });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function createQuestion() {
    const choices = qForm.choicesRaw.split(',').map((c) => c.trim()).filter(Boolean);
    if (!qSubjectId) return toast.error('اختر المادة أولا');
    if (qForm.text.trim().length < 2 || choices.length < 2) return toast.error('يرجى تصحيح الأخطاء');
    try {
      await api.post('/student/questions', { subjectId: qSubjectId, text: qForm.text, choices, correctIndex: qForm.correctIndex });
      setQForm({ text: '', choicesRaw: '', correctIndex: 0 });
      toast.success('تمت إضافة السؤال');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h2 className="font-bold mb-3">إضافة مادة دراسية</h2>
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <input className="input" placeholder="اسم المادة" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
          <input className="input" placeholder="المرحلة الدراسية" value={subjectForm.grade} onChange={(e) => setSubjectForm({ ...subjectForm, grade: e.target.value })} />
          <input className="input" placeholder="الفصل الدراسي" value={subjectForm.semester} onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })} />
          <button className="btn btn-primary" onClick={createSubject}>
            إضافة
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold mb-3">إضافة سؤال اختيار من متعدد</h2>
        <select className="input mb-2" value={qSubjectId} onChange={(e) => setQSubjectId(e.target.value)}>
          <option value="">اختر المادة</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.grade} — {s.semester}
            </option>
          ))}
        </select>
        <input className="input mb-2" placeholder="نص السؤال" value={qForm.text} onChange={(e) => setQForm({ ...qForm, text: e.target.value })} />
        <input className="input mb-2" placeholder="الخيارات مفصولة بفاصلة" value={qForm.choicesRaw} onChange={(e) => setQForm({ ...qForm, choicesRaw: e.target.value })} />
        <input
          type="number"
          className="input mb-3"
          placeholder="رقم الخيار الصحيح (0 = الأول)"
          value={qForm.correctIndex}
          onChange={(e) => setQForm({ ...qForm, correctIndex: Number(e.target.value) })}
        />
        <button className="btn btn-primary" onClick={createQuestion}>
          إضافة السؤال
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {subjects.map((s) => (
          <div key={s.id} className="card p-4">
            <p className="font-bold">{s.name}</p>
            <p className="text-sm text-[var(--color-ink-dim)]">
              {s.grade} — {s.semester} — {s._count?.questions ?? 0} أسئلة
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
