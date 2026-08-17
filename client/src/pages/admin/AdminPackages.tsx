import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import type { Package } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function AdminPackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', gamesCount: 1, price: 1, currency: 'BHD', sortOrder: 0 });

  async function load() {
    const { data } = await api.get('/packages');
    setPackages(data.packages);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (form.name.trim().length < 2) return toast.error('اسم الباقة مطلوب');
    try {
      await api.post('/packages', form);
      setForm({ name: '', gamesCount: 1, price: 1, currency: 'BHD', sortOrder: 0 });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    if (!window.confirm('هل أنت متأكد؟')) return;
    await api.delete(`/packages/${id}`);
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h2 className="font-bold mb-3">إضافة باقة</h2>
        <div className="grid sm:grid-cols-5 gap-2 items-end">
          <input className="input" placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="number" className="input" placeholder="عدد الألعاب" value={form.gamesCount} onChange={(e) => setForm({ ...form, gamesCount: Number(e.target.value) })} />
          <input type="number" step="0.001" className="input" placeholder="السعر" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          <input className="input" placeholder="العملة" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <button className="btn btn-primary" onClick={create}>
            إضافة
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {packages.map((p) => (
          <div key={p.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-bold">{p.name}</p>
              <p className="text-sm text-[var(--color-ink-dim)]">
                {p.gamesCount} لعبة — {p.price.toFixed(3)} {p.currency}
              </p>
            </div>
            <button className="text-[var(--color-danger)] text-sm" onClick={() => remove(p.id)}>
              حذف
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
