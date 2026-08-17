import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth';
import type { GiftCode, Package } from '../api/types';
import Spinner from '../components/Spinner';

export default function Gifts() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [selected, setSelected] = useState<Package | null>(null);
  const [sent, setSent] = useState<GiftCode[]>([]);
  const [received, setReceived] = useState<GiftCode[]>([]);
  const [redeemCode, setRedeemCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { user, setUser } = useAuthStore();

  async function loadAll() {
    setLoading(true);
    const [pkgRes, sentRes, receivedRes] = await Promise.all([
      api.get('/packages'),
      api.get('/gifts/sent'),
      api.get('/gifts/received'),
    ]);
    setPackages(pkgRes.data.packages);
    setSent(sentRes.data.gifts);
    setReceived(receivedRes.data.gifts);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function purchaseGift() {
    if (!selected) return toast.error('يرجى اختيار الباقة التي تريد إهدائها');
    setBusy(true);
    try {
      const { data } = await api.post('/payments/checkout', {
        packageId: selected.id,
        purpose: 'GIFT',
      });
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        navigate(`/payment/callback?purchaseId=${data.purchaseId}`);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  async function redeem() {
    if (redeemCode.trim().length < 4) return toast.error('الرجاء إدخال رمز الهدية');
    setBusy(true);
    try {
      const { data } = await api.post('/gifts/redeem', { code: redeemCode.trim() });
      toast.success(`تمت إضافة ${data.gamesAdded} لعبة إلى حسابك!`);
      if (user) setUser({ ...user, remainingGames: user.remainingGames + data.gamesAdded });
      setRedeemCode('');
      loadAll();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">اهدي ألعاب</h1>
        <p className="text-[var(--color-ink-dim)] mb-4">اختار الباقة التي تريد إهدائها</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => setSelected(pkg)}
              className="card p-4 text-center"
              style={{ borderColor: selected?.id === pkg.id ? 'var(--color-gold)' : undefined, borderWidth: selected?.id === pkg.id ? 2 : 1 }}
            >
              <p className="font-bold text-sm">{pkg.name}</p>
              <p className="font-black" style={{ color: 'var(--color-gold)' }}>
                {pkg.price.toFixed(3)} {pkg.currency}
              </p>
            </button>
          ))}
        </div>
        {selected && (
          <div className="card p-4 max-w-md animate-pop">
            <p className="text-sm text-[var(--color-ink-dim)] mb-3">
              بعد الدفع بينشئ لك كود هدية تقدر ترسله لأي شخص بأي وسيلة تبيها — واتساب، رسالة، أو حتى تسليمه باليد.
            </p>
            <button className="btn btn-gold w-full" onClick={purchaseGift} disabled={busy}>
              🎁 ادفع وأنشئ كود الهدية
            </button>
          </div>
        )}
      </div>

      <div className="card p-5 max-w-md">
        <h2 className="font-bold mb-2">استلم هدية</h2>
        <div className="flex gap-2">
          <input className="input" placeholder="أدخل كود الهدية" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} />
          <button className="btn btn-primary !px-5" onClick={redeem} disabled={busy}>
            استلم
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-bold mb-3">هدايا أرسلتها</h2>
          {sent.length === 0 && <p className="text-sm text-[var(--color-ink-faint)]">لم يتم تقديم أي هدايا حتى الآن.</p>}
          <div className="flex flex-col gap-2">
            {sent.map((g) => (
              <div key={g.id} className="card p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-bold">{g.package.name}</p>
                  <p className="font-mono text-xs text-[var(--color-ink-faint)]">{g.code}</p>
                </div>
                <span className={g.status === 'REDEEMED' ? 'text-[var(--color-success)]' : 'text-[var(--color-ink-faint)]'}>
                  {g.status === 'REDEEMED' ? `تم استلامها${g.redeemedByUser ? ' — ' + g.redeemedByUser.name : ''}` : 'لم يتم استلامها'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-bold mb-3">هدايا استلمتها</h2>
          {received.length === 0 && <p className="text-sm text-[var(--color-ink-faint)]">لم تقم بشراء أي لعبة عبر الهدايا بعد.</p>}
          <div className="flex flex-col gap-2">
            {received.map((g) => (
              <div key={g.id} className="card p-3 flex items-center justify-between text-sm">
                <p className="font-bold">{g.package.name}</p>
                <span className="text-[var(--color-ink-faint)]">من {g.fromUser?.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
