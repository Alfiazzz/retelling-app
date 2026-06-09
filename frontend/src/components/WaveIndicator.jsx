export default function WaveIndicator({ active = false }) {
  if (!active) return null
  return (
    <div className="wave-display" aria-hidden="true">
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} className="wave-bar" />
      ))}
    </div>
  )
}
