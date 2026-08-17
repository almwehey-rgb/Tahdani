export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-extrabold" style={{ fontSize: size * 0.55 }}>
      <span
        className="inline-flex items-center justify-center rounded-2xl"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, var(--color-brand), var(--color-gold))',
        }}
      >
        <span style={{ fontSize: size * 0.55 }}>🏆</span>
      </span>
      <span>
        تحدّ<span style={{ color: 'var(--color-gold)' }}>ني</span>
      </span>
    </span>
  );
}
