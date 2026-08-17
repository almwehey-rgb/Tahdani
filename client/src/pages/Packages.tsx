import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../api/client';
import type { Package } from '../api/types';
import Spinner from '../components/Spinner';

export default function Packages() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Package | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get('/packages').then(({ data }) => setPackages(data.packages)).finally(() => setLoading(false));
  }, []);

  async function checkout() {
    if (!selected) return toast.error('يرجى تحديد الحزمة');
    setPaying(true);
    try {
      const { data } = await api.post('/payments/checkout', {
        packageId: selected.id,
        discountCode: discountCode.trim() || undefined,
        purpose: 'SELF',
      });
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        // Discount code brought the price to zero — nothing to pay, already fulfilled.
        navigate(`/payment/callback?purchaseId=${data.purchaseId}`);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setPaying(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-1">الباقات</h1>
      <p className="text-[var(--color-ink-dim)] mb-6">اختر الباقة التي تناسبك واستمتع بلعبات إضافية</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelected(pkg)}
            className="card p-5 text-center transition-all"
            style={{ borderColor: selected?.id === pkg.id ? 'var(--color-gold)' : undefined, borderWidth: selected?.id === pkg.id ? 2 : 1 }}
          >
            <p className="text-3xl mb-2">🎮</p>
            <p className="font-bold mb-1">{pkg.name}</p>
            <p className="text-sm text-[var(--color-ink-dim)] mb-3">استمتع | {pkg.name}</p>
            <p className="text-xl font-black" style={{ color: 'var(--color-gold)' }}>
              {pkg.price.toFixed(3)} {pkg.currency}
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="card p-5 max-w-md animate-pop">
          <h2 className="font-bold mb-3">إتمام الشراء: {selected.name}</h2>
          <label className="label">كود خصم (اختياري)</label>
          <div className="flex gap-2 mb-4">
            <input className="input" placeholder="WELCOME10" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
          </div>
          <button className="btn btn-gold w-full" onClick={checkout} disabled={paying}>
            {paying ? 'جاري التحويل لبوابة الدفع...' : `ادفع الآن — ${selected.price.toFixed(3)} ${selected.currency}`}
          </button>
          <p className="text-xs text-[var(--color-ink-faint)] text-center mt-2">سيتم تحويلك لصفحة دفع آمنة لإتمام العملية</p>
        </div>
      )}
    </div>
  );
}
