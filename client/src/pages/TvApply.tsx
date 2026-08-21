import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../api/client';

export default function TvApply() {
  const [teamName, setTeamName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (teamName.trim().length < 2) return toast.error('اسم الفريق مطلوب');
    if (phone.trim().length < 6) return toast.error('الرجاء ادخال رقم الهاتف');
    if (!agreed) return toast.error('يجب الموافقة على الشروط');
    setSubmitting(true);
    try {
      await api.post('/tv-applications', {
        teamName: teamName.trim(),
        phone: phone.trim(),
        membersCount: 4,
        gender,
        agreedToTerms: true,
      });
      setDone(true);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">📺</div>
        <h1 className="text-xl font-bold mb-2">تم استلام طلبك بنجاح</h1>
        <p className="text-[var(--color-ink-dim)]">
          سيتم الإتصال بجميع الفرق لتحديد موعد المقابلة قبل اعتماد الفريق للظهور في الحلقات.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-1">شارك في برنامج يا هلا انت صح</h1>
      <p className="text-[var(--color-ink-dim)] mb-6">اصنع بطولتك وتحداهم، صار وقت التحدي على شاشة التلفزيون</p>

      <div className="card p-5 flex flex-col gap-4">
        <div>
          <label className="label">اسم الفريق</label>
          <input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={22} />
        </div>
        <div>
          <label className="label">رقم الهاتف</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label className="label">فئة الفريق</label>
          <div className="flex gap-2">
            <button className={`btn flex-1 ${gender === 'MALE' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setGender('MALE')}>
              شباب
            </button>
            <button className={`btn flex-1 ${gender === 'FEMALE' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setGender('FEMALE')}>
              بنات
            </button>
          </div>
        </div>

        <div className="text-sm text-[var(--color-ink-dim)] bg-[var(--color-bg-soft)] rounded-lg p-3 leading-relaxed">
          شروط التسجيل:
          <ul className="list-disc pr-5 mt-2 flex flex-col gap-1">
            <li>يجب أن يتكون الفريق من 4 لاعبين أعمارهم فوق ٢١ عاماً.</li>
            <li>يتكون الفريق إما من 4 بنات أو 4 شباب فقط.</li>
            <li>يجب أن يكون جميع أعضاء الفريق موافقين على الظهور التلفزيوني ووسائل التواصل الاجتماعي.</li>
          </ul>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          أوافق على شروط التسجيل
        </label>

        <button className="btn btn-gold" onClick={submit} disabled={submitting}>
          {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
        </button>
      </div>
    </div>
  );
}
