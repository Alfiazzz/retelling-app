export default function ProgressBar({ value = 0, label = '' }) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="w-full bg-sky-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-primary-500 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  )
}
