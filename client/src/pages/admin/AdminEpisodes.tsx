import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';
import type { Episode } from '../../api/types';
import Spinner from '../../components/Spinner';

export default function AdminEpisodes() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', number: 1, description: '' });

  async function load() {
    const { data } = await api.get('/episodes');
    setEpisodes(data.episodes);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (form.title.trim().length < 2) return toast.error('عنوان الحلقة مطلوب');
    try {
      await api.post('/episodes', form);
      setForm({ title: '', number: form.number + 1, description: '' });
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    await api.delete(`/episodes/${id}`);
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h2 className="font-bold mb-3">إضافة حلقة</h2>
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <input className="input" placeholder="العنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input type="number" className="input" placeholder="الرقم" value={form.number} onChange={(e) => setForm({ ...form, number: Number(e.target.value) })} />
          <input className="input sm:col-span-1" placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn btn-primary" onClick={create}>
            إضافة
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {episodes.map((e) => (
          <div key={e.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-bold">{e.title}</p>
              {e.description && <p className="text-sm text-[var(--color-ink-dim)]">{e.description}</p>}
            </div>
            <button className="text-[var(--color-danger)] text-sm" onClick={() => remove(e.id)}>
              حذف
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
