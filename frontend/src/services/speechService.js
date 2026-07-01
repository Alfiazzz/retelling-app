// Речевой сервис: STT (запись → текст) и TTS (текст → голос).
// Использует Web Speech API — встроен в браузер, бесплатно.

// ─── STT ────────────────────────────────────────────────────────────────────

export function isSpeechRecognitionSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createSpeechRecognizer({ onResult, onEnd, onError }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    onError?.('Браузер не поддерживает распознавание речи. Используй Chrome или Edge.')
    return null
  }

  const recognizer = new SpeechRecognition()
  recognizer.lang          = 'ru-RU'
  recognizer.continuous    = true
  recognizer.interimResults = true

  let finalTranscript = ''

  recognizer.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) {
        finalTranscript += t + ' '
      } else {
        interim += t
      }
    }
    onResult?.({ final: finalTranscript.trim(), interim })
  }

  recognizer.onerror = (e) => {
    const msgs = {
      'not-allowed':  'Доступ к микрофону запрещён. Разреши в настройках браузера.',
      'no-speech':    'Речь не обнаружена. Говори громче.',
      'network':      'Ошибка сети при распознавании.',
    }
    onError?.(msgs[e.error] ?? `Ошибка распознавания: ${e.error}`)
  }

  recognizer.onend = () => {
    onEnd?.(finalTranscript.trim())
  }

  return {
    start:  () => { finalTranscript = ''; recognizer.start() },
    // resume() — возобновление после паузы: не сбрасывает накопленный
    // finalTranscript, начинает дописывать к уже распознанному тексту.
    resume: (existingTranscript = '') => {
      finalTranscript = existingTranscript ? existingTranscript + ' ' : ''
      recognizer.start()
    },
    stop:   () => recognizer.stop(),
    abort:  () => recognizer.abort(),
    reset:  () => { finalTranscript = '' },
  }
}

// ─── TTS ────────────────────────────────────────────────────────────────────

export function isTTSSupported() {
  return !!window.speechSynthesis
}

export function speak(text, options = {}) {
  if (!window.speechSynthesis) return

  window.speechSynthesis.cancel()

  const utterance        = new SpeechSynthesisUtterance(text)
  utterance.lang         = 'ru-RU'
  utterance.rate         = options.rate  ?? 1.0   // 0.5 – 2.0
  utterance.pitch        = options.pitch ?? 1.1   // чуть выше для детей
  utterance.volume       = options.volume ?? 1.0
  utterance.onend        = options.onEnd  ?? null
  utterance.onerror      = options.onError ?? null

  // Подбираем русский голос если доступен
  const voices = window.speechSynthesis.getVoices()
  const ruVoice = voices.find(v => v.lang.startsWith('ru'))
  if (ruVoice) utterance.voice = ruVoice

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}

// Голосовые сообщения обратной связи
export const FEEDBACK_MESSAGES = {
  good:    'Отлично! Ты замечательно пересказал текст! Молодец!',
  partial: (missed) =>
    `Хорошая работа! Но ты немного пропустил. ${missed} Попробуй запомнить эти моменты.`,
  poor:    'Ты начал хорошо, но текст раскрыт совсем немного. Перечитай и попробуй ещё раз — у тебя получится!',
  correct: 'Правильно! Отлично!',
  wrong:   'Не совсем верно. Посмотри на текст ещё раз и попробуй снова.',
  partial_answer: 'Почти правильно! Запомни уточнение.',
}
