import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const features = [
  { icon: '🗂️', title: '6 فئات من اختيارك', desc: 'شكّل لوحة اللعبة باختيار 6 فئات من عشرات الفئات المتجددة.' },
  { icon: '🧩', title: '5 وسائل مساعدة', desc: 'اتصال بصديق، جاوب جوابين، وضحلي أكثر، الفخ، واختر المجيب.' },
  { icon: '🎨', title: 'جولة رسم وتخمين', desc: 'فئة رسم خاصة يتنافس فيها الفريقان على التخمين السريع.' },
  { icon: '🏆', title: 'بطولات وأقواس', desc: 'أنشئ بطولة كاملة بين عدة فرق مع قرعة تلقائية للأدوار.' },
  { icon: '🧸', title: 'وضع الأطفال', desc: 'أسئلة مبسطة وممتعة مصممة خصيصا للصغار.' },
  { icon: '🎓', title: 'حقيبة الطالب', desc: 'راجع موادك الدراسية بأسلوب تفاعلي وممتع.' },
];

export default function Home() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 pt-14 pb-10 text-center">
        <div
          className="inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-5"
          style={{ background: 'var(--color-surface-hi)', color: 'var(--color-gold)' }}
        >
          🎉 نسخة محسّنة من لعبة الأسئلة الجماعية المفضلة لديك
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-5">
          حدّي أصحابك في
          <br />
          <span style={{ color: 'var(--color-gold)' }}>أقوى لعبة أسئلة جماعية</span>
        </h1>
        <p className="text-lg text-[var(--color-ink-dim)] max-w-2xl mx-auto mb-8">
          كوّن فريقين، اختر فئاتك، استخدم وسائل المساعدة، وتحدّى في جولة الرسم — كل هذا وأكثر بتصميم أوضح وتجربة أسرع.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to={user ? '/new-game' : '/login'} className="btn btn-gold text-lg">
            🎮 ابدأ اللعب الآن
          </Link>
          <Link to="/new-game/kids" className="btn btn-ghost text-lg">
            🧸 واجهة الأطفال
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-[var(--color-ink-dim)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-extrabold mb-2">جاهزين لبطولة كاملة؟</h2>
            <p className="text-[var(--color-ink-dim)]">أنشئ بطولة بين أكثر من فريقين مع قرعة تلقائية وتتبع للأدوار.</p>
          </div>
          <Link to="/tournaments" className="btn btn-primary shrink-0">
            إنشاء بطولة
          </Link>
        </div>
      </section>
    </div>
  );
}
