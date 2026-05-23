export default function WaveIndicator({ active = false }) {
  if (!active) return null
  return (
    <div className="flex items-end justify-center gap-1 h-10" aria-hidden="true">
      {[1,2,3,4,5].map(i => (
        <div
          key={i}
          className="wave-bar bg-primary-500 rounded-full"
          style={{ width: 4, height: 24 }}
        />
      ))}
    </div>
  )
}
