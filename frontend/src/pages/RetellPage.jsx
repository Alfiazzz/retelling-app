import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createSpeechRecognizer, isSpeechRecognitionSupported, speak } from '../services/speechService.js'
import { analyzeRetelling } from '../services/aiService.js'
import WaveIndicator from '../components/WaveIndicator.jsx'

const SILENCE_TIMEOUT_MS = 30_000

export default function RetellPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const state     = location.state

  // Если попали сюда без текста — вернуть на главную
  useEffect(() => { if (!state?.text) navigate('/') }, [])
  if (!state?.text) return null

  const { text, wordCount, length, meta } = state

  const [phase,       setPhase]       = useState('intro')   // intro | recording | paused | analyzing | done
  const [transcript,  setTranscript]  = useState('')
  const [interim,     setInterim]     = useState('')
  const [elapsed,     setElapsed]     = useState(0)         // секунды
  const [error,       setError]       = useState('')
  const [analysis,    setAnalysis]    = useState(null)
  const [showText,    setShowText]    = useState(false)

  const recognizerRef  = useRef(null)
  const timerRef       = useRef(null)
  const silenceRef     = useRef(null)
  const lastSpeechRef  = useRef(Date.now())
  const maxSecs        = length.maxRecordMin * 60

  // Таймер записи
  useEffect(() => {
    if (phase === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= maxSecs) { stopRecording(); return e }
          return e + 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [phase])

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function startRecording() {
    if (!isSpeechRecognitionSupported()) {
      setError('Браузер не поддерживает распознавание речи. Используй Chrome или Edge.')
      return
    }
    setError('')
    setTranscript('')
    setInterim('')
    setElapsed(0)

    const rec = createSpeechRecognizer({
      onResult: ({ final, interim: int }) => {
        setTranscript(final)
        setInterim(int)
        lastSpeechRef.current = Date.now()
        clearTimeout(silenceRef.current)
        silenceRef.current = setTimeout(() => {
          speak('Ты ещё здесь? Продолжай пересказ или нажми завершить.')
        }, SILENCE_TIMEOUT_MS)
      },
      onEnd: (final) => {
        setTranscript(final)
        setInterim('')
        clearTimeout(silenceRef.current)
      },
      onError: (msg) => setError(msg),
    })

    if (!rec) return
    recognizerRef.current = rec
    rec.start()
    setPhase('recording')
  }

  function pauseRecording() {
    recognizerRef.current?.stop()
    clearTimeout(silenceRef.current)
    setPhase('paused')
  }

  function resumeRecording() {
    recognizerRef.current?.start()
    setPhase('recording')
  }

  function stopRecording() {
    recognizerRef.current?.stop()
    clearTimeout(silenceRef.current)
    setPhase('analyzing')
  }

  function resetRecording() {
    recognizerRef.current?.abort()
    clearTimeout(silenceRef.current)
    clearInterval(timerRef.current)
    setTranscript('')
    setInterim('')
    setElapsed(0)
    setPhase('intro')
  }

  // Запускаем анализ когда перешли в фазу 'analyzing'
  useEffect(() => {
    if (phase !== 'analyzing') return
    const t = transcript.trim()
    if (!t || t.split(/\s+/).length < 5) {
      setError('Пересказ слишком короткий. Попробуй ещё раз.')
      setPhase('intro')
      return
    }
    analyzeRetelling(text, t)
      .then(result => {
        setAnalysis(result)
        setPhase('done')
      })
      .catch(e => {
        setError('Ошибка анализа: ' + e.message)
        setPhase('intro')
      })
  }, [phase])

  function handleContinue() {
    navigate('/result', {
      state: { text, meta, transcript, analysis }
    })
  }

  const timeLeft = maxSecs - elapsed
  const isRecording = phase === 'recording'
  const isPaused    = phase === 'paused'

  return (
    <div className="space-y-5">
      <div className="text-center pt-2">
        <h1 className="text-2xl font-extrabold text-gray-800">🎤 Перескажи текст</h1>
        <p className="text-gray-500 text-sm mt-1">
          Текст: {wordCount} слов · {length.label} · максимум {length.maxRecordMin} мин
        </p>
      </div>

      {/* Показать/скрыть исходный текст */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between text-sm font-semibold text-primary-600"
          onClick={() => setShowText(v => !v)}
        >
          <span>📄 Исходный текст</span>
          <span>{showText ? '▲ скрыть' : '▼ показать'}</span>
        </button>
        {showText && (
          <div className="mt-3 text-sm text-gray-700 leading-relaxed max-h-48 overflow-y-auto border-t border-sky-100 pt-3 whitespace-pre-wrap">
            {text}
          </div>
        )}
      </div>

      {/* Основной блок записи */}
      <div className="card text-center space-y-4">

        {phase === 'intro' && (
          <>
            <div className="text-4xl">🎙️</div>
            <p className="text-gray-600 text-sm leading-relaxed">
              Прочитай текст, потом нажми кнопку и расскажи его своими словами.
              Говори чётко и не торопись.
            </p>
            <button className="btn-primary w-full text-base py-4" onClick={startRecording}>
              Начать пересказ
            </button>
          </>
        )}

        {(isRecording || isPaused) && (
          <>
            {/* Таймер */}
            <div className="flex items-center justify-between text-sm">
              <span className={`font-mono font-bold text-lg ${timeLeft < 30 ? 'text-orange-500' : 'text-primary-600'}`}>
                {formatTime(elapsed)}
              </span>
              <span className="text-gray-400">осталось {formatTime(timeLeft)}</span>
            </div>

            <WaveIndicator active={isRecording} />

            {isPaused && (
              <div className="text-orange-400 text-sm font-medium">⏸ Пауза</div>
            )}

            {/* Субтитры */}
            <div className="bg-sky-50 rounded-2xl px-4 py-3 text-left min-h-[60px]">
              <p className="text-sm text-gray-700 leading-relaxed">
                {transcript}
                {interim && <span className="text-gray-400"> {interim}</span>}
                {!transcript && !interim && (
                  <span className="text-gray-400 italic">Говори — здесь появится твоя речь...</span>
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1 text-sm py-2"
                onClick={isPaused ? resumeRecording : pauseRecording}>
                {isPaused ? '▶ Продолжить' : '⏸ Пауза'}
              </button>
              <button className="btn-danger flex-1 text-sm py-2" onClick={stopRecording}>
                ⏹ Завершить
              </button>
            </div>
            <button className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={resetRecording}>
              Записать заново
            </button>
          </>
        )}

        {phase === 'analyzing' && (
          <>
            <div className="text-4xl animate-spin">⚙️</div>
            <p className="text-gray-600 font-medium">Анализирую пересказ...</p>
            <p className="text-gray-400 text-sm">Обычно это занимает 5–10 секунд</p>
          </>
        )}

        {phase === 'done' && analysis && (
          <>
            <div className="text-4xl">
              {analysis.verdict === 'good' ? '🌟' : analysis.verdict === 'partial' ? '⚠️' : '🔁'}
            </div>
            <p className="font-bold text-gray-800 text-lg">
              {analysis.verdict === 'good'    ? 'Отлично!' :
               analysis.verdict === 'partial' ? 'Есть недочёты' :
               'Попробуй ещё раз'}
            </p>
            <p className="text-gray-500 text-sm">Полнота пересказа: {analysis.score}%</p>

            {analysis.missed?.length > 0 && (
              <div className="text-left bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
                <p className="text-sm font-semibold text-gray-700 mb-2">Ты не упомянул(а):</p>
                <ul className="space-y-1">
                  {analysis.missed.map((m, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-yellow-500">•</span>{m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              {analysis.verdict !== 'good' && (
                <button className="btn-secondary flex-1 text-sm" onClick={resetRecording}>
                  Попробовать снова
                </button>
              )}
              <button className="btn-primary flex-1 text-sm" onClick={handleContinue}>
                К вопросам →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
