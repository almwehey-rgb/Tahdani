import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/admin', label: 'الملخص', end: true },
  { to: '/admin/categories', label: 'الفئات والأسئلة' },
  { to: '/admin/packages', label: 'الباقات' },
  { to: '/admin/discounts', label: 'أكواد الخصم' },
  { to: '/admin/purchases', label: 'المدفوعات' },
  { to: '/admin/var-reports', label: 'بلاغات VAR' },
  { to: '/admin/tv-applications', label: 'طلبات التلفزيون' },
  { to: '/admin/episodes', label: 'الحلقات' },
  { to: '/admin/student-content', label: 'حقيبة الطالب' },
];

export default function AdminLayout() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-4">لوحة التحكم</h1>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-[var(--color-border)] pb-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-semibold ${
                isActive ? 'bg-[var(--color-surface-hi)] text-[var(--color-ink)]' : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
