import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth';
import Logo from '../components/Logo';

export default function Login() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname: string } } };

  async function login(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error('اكتب اسمك');
    if (code.trim().length < 1) return toast.error('اكتب الكود');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { name: name.trim(), code: code.trim() });
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
        <form onSubmit={login} className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-center mb-2">تسجيل الدخول</h1>
          <div>
            <label className="label">اسمك</label>
            <input className="input" placeholder="اكتب اسمك" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">الكود</label>
            <input
              className="input text-center tracking-widest"
              placeholder="أدخل الكود"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
