import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth';
import Spinner from '../components/Spinner';

type Result = { status: 'PAID' | 'FAILED'; purpose: 'SELF' | 'GIFT'; giftCode: string | null; remainingGames?: number } | null;

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const purchaseId = params.get('purchaseId');
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    if (!purchaseId) {
      setError('لا يوجد معرّف عملية دفع');
      return;
    }
    api
      .post(`/payments/verify/${purchaseId}`)
      .then(({ data }) => {
        setResult(data);
        if (data.status === 'PAID' && data.purpose === 'SELF' && user) {
          setUser({ ...user, remainingGames: data.remainingGames ?? user.remainingGames });
        }
      })
      .catch((err) => setError(apiErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold mb-2">تعذر التحقق من الدفع</h1>
        <p className="text-[var(--color-ink-dim)] mb-6">{error}</p>
        <Link to="/packages" className="btn btn-primary">
          الرجوع للباقات
        </Link>
      </div>
    );
  }

  if (!result) return <Spinner label="جاري التحقق من عملية الدفع..." />;

  if (result.status !== 'PAID') {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-xl font-bold mb-2">فشل في عملية الدفع</h1>
        <p className="text-[var(--color-ink-dim)] mb-6">لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى.</p>
        <Link to="/packages" className="btn btn-primary">
          حاول مرة أخرى
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h1 className="text-xl font-bold mb-2">تم الدفع بنجاح</h1>
      {result.purpose === 'GIFT' && result.giftCode ? (
        <>
          <p className="text-[var(--color-ink-dim)] mb-3">شارك هذا الكود مع من تريد إهداءه:</p>
          <p className="text-2xl font-black tracking-widest mb-6 p-3 rounded-lg" style={{ background: 'var(--color-surface-hi)', color: 'var(--color-gold)' }}>
            {result.giftCode}
          </p>
          <Link to="/gifts" className="btn btn-primary">
            الرجوع للهدايا
          </Link>
        </>
      ) : (
        <>
          <p className="text-[var(--color-ink-dim)] mb-6">تمت إضافة الألعاب إلى حسابك. رصيدك الحالي: {result.remainingGames}</p>
          <Link to="/dashboard" className="btn btn-primary">
            ابدأ اللعب
          </Link>
        </>
      )}
    </div>
  );
}
