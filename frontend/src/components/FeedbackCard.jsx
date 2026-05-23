// Карточка с результатом анализа пересказа

const VERDICT_CONFIG = {
  good: {
    emoji: '🌟',
    title: 'Отлично!',
    bg:    'bg-green-50 border-green-200',
    text:  'text-green-800',
  },
  partial: {
    emoji: '⚠️',
    title: 'Есть недочёты',
    bg:    'bg-yellow-50 border-yellow-200',
    text:  'text-yellow-800',
  },
  poor: {
    emoji: '🔁',
    title: 'Попробуй ещё раз',
    bg:    'bg-orange-50 border-orange-200',
    text:  'text-orange-800',
  },
}

export default function FeedbackCard({ verdict, score, missed = [], onRetry, onContinue }) {
  const cfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.poor

  return (
    <div className={`card border-2 ${cfg.bg} text-center`}>
      <div className="text-5xl mb-3">{cfg.emoji}</div>
      <h2 className={`text-xl font-extrabold mb-1 ${cfg.text}`}>{cfg.title}</h2>
      <p className="text-gray-500 text-sm mb-4">Полнота пересказа: {score}%</p>

      {missed.length > 0 && (
        <div className="text-left bg-white rounded-2xl p-4 mb-4 border border-yellow-100">
          <p className="text-sm font-semibold text-gray-700 mb-2">Ты не упомянул(а):</p>
          <ul className="space-y-1">
            {missed.map((m, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="mt-0.5 text-yellow-500">•</span> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        {verdict !== 'good' && (
          <button onClick={onRetry} className="btn-secondary text-sm py-2 px-5">
            Попробовать снова
          </button>
        )}
        <button onClick={onContinue} className="btn-primary text-sm py-2 px-5">
          {verdict === 'good' ? 'Перейти к вопросам →' : 'Всё равно продолжить →'}
        </button>
      </div>
    </div>
  )
}
