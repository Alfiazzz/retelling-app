export default function ProgressBar({ value = 0, label = '' }) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
          <span>{label}</span>
          <span style={{ fontWeight: 700 }}>{value}%</span>
        </div>
      )}
      <div className="acc-track">
        <div className="acc-fill" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}
