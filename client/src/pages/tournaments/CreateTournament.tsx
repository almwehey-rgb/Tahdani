import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../api/client';

export default function CreateTournament() {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'KNOCKOUT' | 'ROUND_ROBIN'>('KNOCKOUT');
  const [teamNames, setTeamNames] = useState<string[]>(['', '', '', '']);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  function updateTeam(i: number, value: string) {
    setTeamNames((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }

  async function create() {
    if (name.trim().length < 2 || name.trim().length > 10) return toast.error('اسم البطولة لا يمكن أن يتجاوز ١٠ حروف');
    const cleaned = teamNames.map((t) => t.trim()).filter(Boolean);
    if (cleaned.length < 3) return toast.error('يجب كتابة أسماء جميع الفرق (3 فرق على الأقل)');
    setCreating(true);
    try {
      const { data } = await api.post('/tournaments', { name: name.trim(), format, teamNames: cleaned });
      navigate(`/tournaments/${data.tournament.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-6">بطولة جديدة</h1>
      <div className="card p-5 flex flex-col gap-4">
        <div>
          <label className="label">اسم البطولة (١٠ حروف بحد أقصى)</label>
          <input className="input" maxLength={10} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="label">اختر نظام البطولة</label>
          <div className="flex gap-2">
            <button
              className={`btn flex-1 ${format === 'KNOCKOUT' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFormat('KNOCKOUT')}
            >
              إقصائي (أقواس)
            </button>
            <button
              className={`btn flex-1 ${format === 'ROUND_ROBIN' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFormat('ROUND_ROBIN')}
            >
              دوري (الكل ضد الكل)
            </button>
          </div>
        </div>

        <div>
          <label className="label">أسماء الفرق</label>
          <div className="flex flex-col gap-2">
            {teamNames.map((t, i) => (
              <input key={i} className="input" placeholder={`فريق ${i + 1}`} value={t} onChange={(e) => updateTeam(i, e.target.value)} />
            ))}
          </div>
          <button className="btn btn-ghost text-sm mt-2" onClick={() => setTeamNames((prev) => [...prev, ''])}>
            + إضافة فريق
          </button>
        </div>

        <button className="btn btn-gold" onClick={create} disabled={creating}>
          {creating ? 'جاري الإنشاء...' : '🎲 ابدأ البطولة'}
        </button>
      </div>
    </div>
  );
}
