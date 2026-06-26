import { useState, useRef, useEffect } from 'react'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../services/speechService.js'
import { checkLooksRussian } from '../services/languageCheckService.js'

// Поле ввода текста с кнопкой микрофона для голосового ответа.
// Один тап по 🎤 — начинается запись (кнопка меняет вид на "идёт запись").
// Текст распознаётся вживую и дописывается в поле по ходу речи.
// Повторный тап по той же кнопке — запись останавливается, финальный текст
// остаётся в поле, ребёнок видит результат и может его поправить руками
// перед отправкой.
//
// Простой клик (а не зажатие) выбран намеренно: у детей разного возраста
// разный уровень моторики, и press-and-hold (как в Telegram) требует
// одновременно удерживать кнопку и говорить, не отпуская раньше времени —
// это сложнее для маленьких детей, чем два отдельных, не привязанных
// по времени тапа. Тот же принцип уже используется в RetellPage.jsx для
// записи пересказа — поведение единообразно для всего сервиса.
//
// Если браузер не поддерживает распознавание речи — иконка микрофона
// не показывается, остаётся обычное текстовое поле (без иконки).
//
// Props:
//   value, onChange(text) — как у обычного controlled textarea
//   disabled — блокирует и поле, и микрофон (например, во время отправки)
//   placeholder, rows — пробрасываются в textarea
//   onError(message) — вызывается при ошибках распознавания (например, нет доступа к микрофону)

export default function VoiceInput({
  value, onChange, disabled, placeholder, rows = 3, onError,
}) {
  const supported = isSpeechRecognitionSupported()

  const [isRecording, setIsRecording] = useState(false)
  const [interim,     setInterim]     = useState('')

  const recRef      = useRef(null)
  const baseTextRef = useRef('') // текст в поле на момент начала записи — к нему дописываем

  // На случай размонтирования компонента во время активной записи
  useEffect(() => {
    return () => { recRef.current?.abort() }
  }, [])

  function startVoiceInput() {
    if (!supported || disabled || isRecording) return

    const textBeforeRecording = value ?? ''
    baseTextRef.current = textBeforeRecording

    const rec = createSpeechRecognizer({
      onResult: ({ final, interim: int }) => {
        setInterim(int)
        if (final) {
          const sep = baseTextRef.current && !baseTextRef.current.endsWith(' ') ? ' ' : ''
          const combined = (baseTextRef.current + sep + final).trim() + ' '
          baseTextRef.current = combined
          onChange(combined)
        }
      },
      onEnd: () => {
        setInterim('')
        setIsRecording(false)
        const recognizedText = baseTextRef.current.trim()
        // Web Speech API настроен на 'ru-RU' (см. speechService.js) и не
        // сообщает сам "это не тот язык" — он просто подгоняет звук под
        // русские фонемы. Проверяем уже готовую расшифровку именно здесь
        // (а не в submitAnswer на ResultPage), потому что только здесь
        // точно известно, что текст пришёл из голосовой записи, а не был
        // напечатан руками — ручной ввод на другом языке это не наша забота.
        // Берём только вновь добавленный за эту запись фрагмент (а не весь
        // накопленный текст), чтобы не размывать проверку, если до записи
        // в поле уже был нормальный русский текст, напечатанный руками.
        const newPart = recognizedText.slice(textBeforeRecording.length).trim()
        if (newPart && !checkLooksRussian(newPart).looksRussian) {
          onError?.('Похоже, ответ распознан не на русском языке. Попробуй сказать ещё раз по-русски или напиши ответ вручную.')
        }
        onChange(recognizedText)
      },
      onError: (msg) => {
        setInterim('')
        setIsRecording(false)
        onError?.(msg)
      },
    })

    if (!rec) {
      onError?.('Браузер не поддерживает распознавание речи.')
      return
    }
    recRef.current = rec
    rec.start()
    setIsRecording(true)
  }

  function stopVoiceInput() {
    if (!isRecording) return
    recRef.current?.stop()
  }

  function toggleVoiceInput() {
    if (isRecording) stopVoiceInput()
    else startVoiceInput()
  }

  const displayValue = isRecording
    ? `${value}${interim ? (value && !value.endsWith(' ') ? ' ' : '') + interim : ''}`
    : value

  return (
    <div className="voice-input-wrap">
      <textarea
        className="text-area"
        rows={rows}
        placeholder={placeholder}
        value={displayValue}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || isRecording}
        style={{ paddingRight: supported ? 52 : undefined }}
      />
      {supported && (
        <button
          type="button"
          aria-label={isRecording ? 'Остановить запись' : 'Ответить голосом'}
          className={`voice-mic-btn ${isRecording ? 'recording' : ''}`}
          disabled={disabled}
          onClick={toggleVoiceInput}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>
      )}
      {isRecording && (
        <div className="voice-recording-hint">
          <span className="voice-recording-dot" /> Идёт запись — нажми ещё раз, когда закончишь
        </div>
      )}
    </div>
  )
}
