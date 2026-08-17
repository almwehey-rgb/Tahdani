import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import type { DiscountCode } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function AdminDiscounts() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: '', percentOff: 10, maxUses: 100 });

  async function load() {
    const { data } = await api.get('/discounts');
    setCodes(data.codes);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (form.code.trim().length < 3) return toast.error('كود الخصم مطلوب');
    try {
      await api.post('/discounts', form);
      setForm({ code: '', percentOff: 10, maxUses: 100 });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    await api.delete(`/discounts/${id}`);
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h2 className="font-bold mb-3">إضافة كود خصم</h2>
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <input className="input" placeholder="الكود" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <input type="number" className="input" placeholder="نسبة الخصم %" value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: Number(e.target.value) })} />
          <input type="number" className="input" placeholder="الحد الأقصى للاستخدام" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} />
          <button className="btn btn-primary" onClick={create}>
            إضافة
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {codes.map((c) => (
          <div key={c.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-bold font-mono">{c.code}</p>
              <p className="text-sm text-[var(--color-ink-dim)]">
                {c.percentOff}% — استُخدم {c.usedCount}/{c.maxUses}
              </p>
            </div>
            <button className="text-[var(--color-danger)] text-sm" onClick={() => remove(c.id)}>
              إلغاء تفعيل
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
