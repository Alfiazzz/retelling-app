import { useState } from 'react'
import { speak, FEEDBACK_MESSAGES } from '../services/speechService.js'

const RESULT_CONFIG = {
  correct: { emoji: '✅', text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  partial: { emoji: '🟡', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  wrong:   { emoji: '❌', text: 'text-red-700',   bg: 'bg-red-50 border-red-200'   },
}

export default function QuestionCard({ question, questionNum, total, onAnswer, disabled }) {
  const [answer,   setAnswer]   = useState('')
  const [result,   setResult]   = useState(null)   // { result, explanation, correctAnswer }
  const [attempts, setAttempts] = useState(0)
  const [loading,  setLoading]  = useState(false)

  const MAX_ATTEMPTS = 2

  async function handleSubmit() {
    if (!answer.trim()) return
    setLoading(true)
    try {
      const res = await onAnswer(question, answer)
      setResult(res)
      setAttempts(a => a + 1)

      // Голосовая обратная связь
      if (res.result === 'correct') {
        speak(FEEDBACK_MESSAGES.correct)
      } else if (res.result === 'partial') {
        speak(FEEDBACK_MESSAGES.partial_answer)
      } else {
        speak(attempts + 1 >= MAX_ATTEMPTS
          ? `Правильный ответ: ${res.correctAnswer}`
          : FEEDBACK_MESSAGES.wrong)
      }
    } finally {
      setLoading(false)
    }
  }

  const canRetry = result && result.result !== 'correct' && attempts < MAX_ATTEMPTS
  const showCorrect = result && result.result !== 'correct' && attempts >= MAX_ATTEMPTS

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400 font-medium">
          Вопрос {questionNum} из {total}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i + 1 < questionNum ? 'bg-green-400' :
                i + 1 === questionNum ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-base font-semibold text-gray-800 mb-4">{question.text}</p>

      {!result || canRetry ? (
        <>
          <textarea
            className="input-field resize-none mb-3"
            rows={3}
            placeholder="Напиши ответ здесь..."
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            disabled={loading || disabled}
          />
          {canRetry && (
            <p className="text-sm text-orange-500 mb-2">
              Не совсем верно. Посмотри на текст и попробуй снова.
            </p>
          )}
          <button
            className="btn-primary w-full"
            onClick={() => { setResult(null); setAnswer(''); handleSubmit() }}
            disabled={!answer.trim() || loading || disabled}
          >
            {loading ? 'Проверяю...' : canRetry ? 'Попробовать снова' : 'Ответить'}
          </button>
        </>
      ) : (
        <div className={`rounded-2xl border p-4 ${RESULT_CONFIG[result.result]?.bg}`}>
          <p className={`font-semibold mb-1 ${RESULT_CONFIG[result.result]?.text}`}>
            {RESULT_CONFIG[result.result]?.emoji}{' '}
            {result.result === 'correct' ? 'Верно!'
              : result.result === 'partial' ? 'Почти верно'
              : 'Неверно'}
          </p>
          {result.explanation && (
            <p className="text-sm text-gray-600 mb-2">{result.explanation}</p>
          )}
          {showCorrect && (
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Правильный ответ:</span> {result.correctAnswer}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
