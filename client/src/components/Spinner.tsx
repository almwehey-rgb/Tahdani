export default function Spinner({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-ink-dim)]">
      <div
        className="h-10 w-10 rounded-full border-4 animate-spin"
        style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand-hi)' }}
      />
      <p>{label}</p>
    </div>
  );
}
