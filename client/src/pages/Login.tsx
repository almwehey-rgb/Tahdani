import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth';
import Logo from '../components/Logo';

export default function Login() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode] = useState('+973');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [devCode, setDevCode] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname: string } } };

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    if (phone.trim().length < 6) return toast.error('الرجاء ادخال رقم الهاتف');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/request-otp', { phone: phone.trim(), countryCode });
      setDevCode(data.devCode || '');
      setStep('otp');
      toast.success('تم إرسال رمز التحقق');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) return toast.error('أدخل رمز التحقق المكون من 6 أرقام');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', {
        phone: phone.trim(),
        countryCode,
        code: code.trim(),
        name: name.trim() || undefined,
      });
      setSession(data.token, data.user);
      toast.success(`أهلا ${data.user.name}!`);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="flex justify-center mb-8">
        <Logo size={44} />
      </div>
      <div className="card p-6 animate-pop">
        {step === 'phone' ? (
          <form onSubmit={requestOtp} className="flex flex-col gap-4">
            <h1 className="text-xl font-bold text-center mb-2">تسجيل الدخول</h1>
            <div>
              <label className="label">رقم الهاتف</label>
              <div className="flex gap-2">
                <span className="input w-24 text-center opacity-70 select-none">{countryCode}</span>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="39XXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>
            <button className="btn btn-primary" disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'ارسل رمز التحقق'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="flex flex-col gap-4">
            <h1 className="text-xl font-bold text-center mb-1">أدخل رمز التحقق</h1>
            <p className="text-center text-sm text-[var(--color-ink-dim)]">
              أُرسل الرمز إلى {countryCode}
              {phone}
            </p>
            {devCode && (
              <div className="text-center text-xs rounded-lg py-2 px-3" style={{ background: 'var(--color-surface-hi)', color: 'var(--color-gold)' }}>
                (تجريبي) رمز التحقق: <b className="tracking-widest">{devCode}</b>
              </div>
            )}
            <div>
              <label className="label">رمز التحقق</label>
              <input
                className="input text-center tracking-[0.5em] text-lg"
                inputMode="numeric"
                maxLength={6}
                placeholder="------"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            <div>
              <label className="label">اسمك (لأول مرة فقط)</label>
              <input className="input" placeholder="اكتب اسمك" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={loading}>
              {loading ? 'جاري التحقق...' : 'دخول'}
            </button>
            <button type="button" className="text-sm text-[var(--color-ink-faint)]" onClick={() => setStep('phone')}>
              تغيير رقم الهاتف
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
