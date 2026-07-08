import { useState, useEffect, useRef } from 'react'
  import { useNavigate, useLocation } from 'react-router-dom'
  import { createSpeechRecognizer, isSpeechRecognitionSupported, speak } from '../services/speechService.js'
  import { analyzeRetelling } from '../services/aiService.js'
  import { checkLooksRussian } from '../services/languageCheckService.js'

const SILENCE_MS = 30_000

export default function RetellPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const state    = location.state

  useEffect(() => { if (!state?.text) navigate('/') }, [])
    if (!state?.text) return null

  const { text, wordCount, length } = state
    const maxSecs = length.maxRecordMin * 60

  const [phase,      setPhase]      = useState('intro')
    const [transcript, setTranscript] = useState('')
    const [interim,    setInterim]    = useState('')
    const [elapsed,    setElapsed]    = useState(0)
    const [error,      setError]      = useState('')
    const [analysis,   setAnalysis]   = useState(null)
    const [showText,   setShowText]   = useState(false)
    const [injectionAttempts, setInjectionAttempts] = useState(0)
    const [showPaywall,    setShowPaywall]    = useState(false)
    const [paywallPaid,    setPaywallPaid]    = useState(false)
    const [paywallLoading, setPaywallLoading] = useState(false)
    const [paywallError,   setPaywallError]   = useState('')
    const recRef     = useRef(null)
    const timerRef   = useRef(null)
    const silenceRef = useRef(null)

  async function handlePaywall() {
      setPaywallLoading(true)
      setPaywallError('')
      try {
        await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/notify/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp: new Date().toISOString() }),
        })
      } catch (e) {
        console.log('Уведомление не отправлено:', e.message)
      }
      setPaywallPaid(true)
      setPaywallLoading(false)
    }

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

  function fmt(s) {
      return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
    }

  function startRecording() {
      if (!isSpeechRecognitionSupported()) {
        setError('Браузер не поддерживает распознавание речи. Используй Chrome или Edge.')
        return
      }
      setError(''); setTranscript(''); setInterim(''); setElapsed(0)
      const rec = createSpeechRecognizer({
        onResult: ({ final, interim: int }) => {
          setTranscript(final); setInterim(int)
          clearTimeout(silenceRef.current)
          silenceRef.current = setTimeout(() => speak('Ты ещё здесь? Продолжай пересказ.'), SILENCE_MS)
        },
        onEnd: (final) => { setTranscript(final); setInterim(''); clearTimeout(silenceRef.current) },
        onError: (msg) => setError(msg),
      })
      if (!rec) return
      recRef.current = rec
      rec.start()
      // Запускаем таймер тишины сразу при старте — иначе вопрос "Ты ещё здесь?"
      // не прозвучит если ребёнок молчит с самого начала записи (onResult не
      // вызывается пока нет речи, значит таймер без этой строки никогда не стартует)
      silenceRef.current = setTimeout(() => speak('Ты ещё здесь? Продолжай пересказ.'), SILENCE_MS)
      setPhase('recording')
    }

  function pauseRecording() {
      recRef.current?.stop(); clearTimeout(silenceRef.current); setPhase('paused')
    }

  function resumeRecording() {
      const rec = createSpeechRecognizer({
        onResult: ({ final, interim: int }) => {
          setTranscript(final); setInterim(int)
          clearTimeout(silenceRef.current)
          silenceRef.current = setTimeout(() => speak('Ты ещё здесь? Продолжай пересказ.'), SILENCE_MS)
        },
        onEnd: (final) => { setTranscript(final); setInterim(''); clearTimeout(silenceRef.current) },
        onError: (msg) => setError(msg),
      })
      if (!rec) return
      recRef.current = rec
      rec.resume(transcript)
      // Та же логика что и в startRecording — таймер стартует сразу,
      // чтобы ловить тишину с момента возобновления, а не с первого слова
      silenceRef.current = setTimeout(() => speak('Ты ещё здесь? Продолжай пересказ.'), SILENCE_MS)
      setPhase('recording')
    }

  function stopRecording() {
    recRef.current?.stop(); clearTimeout(silenceRef.current)
    // Если слов меньше 20 — показываем уточняющий вопрос перед анализом
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length
    if (wordCount > 0 && wordCount < 20) {
      speak('Ты сказал совсем немного. Хочешь добавить что-нибудь ещё?')
      setPhase('confirming')
    } else {
      setPhase('analyzing')
    }
  }

  function resetRecording() {
      recRef.current?.abort(); clearTimeout(silenceRef.current); clearInterval(timerRef.current)
      setTranscript(''); setInterim(''); setElapsed(0); setPhase('intro')
    }

  useEffect(() => {
      if (phase !== 'analyzing') return
      const t = transcript.trim()
      if (!t) {
        setError('Пересказ пустой. Попробуй ещё раз.')
        setPhase('intro'); return
      }
      if (!checkLooksRussian(t).looksRussian) {
        setError('Похоже, пересказ распознан не на русском языке. Сервис понимает и проверяет только русскую речь.')
        setPhase('intro'); return
      }
      analyzeRetelling(text, t)
        .then(r => {
          if (r.blocked) {
            if (r.blockType === 'injection') {
              const newAttempts = injectionAttempts + 1
              setInjectionAttempts(newAttempts)
              setError(r.message)
              setPhase('intro')
              if (newAttempts >= 3) {
                setTranscript('')
                setInjectionAttempts(0)
              }
            } else {
              setError(r.message)
              setPhase('intro')
            }
            return
          }
          setInjectionAttempts(0)
          setAnalysis(r); setPhase('done')
        })
        .catch(e => { setError('Ошибка анализа: ' + e.message); setPhase('intro') })
    }, [phase])

  const timeLeft  = maxSecs - elapsed
    const isRec     = phase === 'recording'
    const isPaused  = phase === 'paused'

  return (
      <div className="page-content">

      <div className="hero-block">
          <div className="hero-emoji-wrap record">🎤</div>
          <h1>Перескажи текст</h1>
          <p>{wordCount} слов · {length.label} · максимум {length.maxRecordMin} мин</p>
        </div>

      <div className="card" style={{ padding: '12px 16px' }}>
          <button className="toggle-text-btn" onClick={() => setShowText(v => !v)}>
            <span>📄 Исходный текст</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{showText ? '▲ скрыть' : '▼ показать'}</span>
          </button>
          {showText && (
            <div style={{
              marginTop: 10, paddingTop: 10,
              borderTop: '1.5px solid var(--border)',
              fontSize: 13, lineHeight: 1.7,
              color: 'var(--text)',
              maxHeight: 160, overflowY: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {text}
            </div>
          )}
        </div>

      <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
{phase === 'intro' && (
          <>
            <p className="rec-hint-top">Нажми кнопку и начни пересказывать текст вслух</p>
            <div className="rec-btn-wrap">
              <button className="rec-btn" onClick={startRecording}>🎤</button>
              <span className="rec-hint">Нажми чтобы начать</span>
            </div>
          </>
        )}

        {(isRec || isPaused) && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="timer-display">{fmt(elapsed)}</span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: timeLeft < 30 ? 'var(--coral)' : 'var(--muted)'
              }}>
                осталось {fmt(timeLeft)}
              </span>
            </div>

            {isRec ? (
              <div className="wave-display" style={{ marginBottom: 12 }}>
                {[1,2,3,4,5,6,7].map(i => <div key={i} className="wave-bar" />)}
              </div>
            ) : (
              <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 700 }}>⏸ Пауза</span>
              </div>
            )}

            <div className="subtitle-box" style={{ marginBottom: 14, textAlign: 'left' }}>
              {transcript || interim ? (
                <>
                  {transcript}
                  {interim && <span className="subtitle-interim"> {interim}</span>}
                </>
              ) : (
                <span className="subtitle-interim" style={{ fontStyle: 'italic' }}>
                  Говори — здесь появится твоя речь...
                </span>
              )}
            </div>

            <div className="btn-row" style={{ marginBottom: 10 }}>
              <button className="btn btn-secondary btn-sm"
                onClick={isPaused ? resumeRecording : pauseRecording}>
                {isPaused ? '▶ Продолжить' : '⏸ Пауза'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={stopRecording}>
                ⏹ Завершить
              </button>
            </div>
            <button onClick={resetRecording}
              style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Записать заново
            </button>
          </>
        )}

        {phase === 'analyzing' && (
          <div className="analyzing-box">
            <span className="analyzing-spinner">⚙️</span>
            <p className="analyzing-title">Анализирую пересказ...</p>
            <p className="analyzing-hint">Обычно 5–10 секунд</p>
          </div>
        )}

        {phase === 'confirming' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤔</div>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Ты сказал совсем немного.
            </p>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
              Хочешь добавить что-нибудь ещё?
            </p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={resumeRecording}>
                🎤 Да, расскажу ещё
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setPhase('analyzing')}>
                Нет, проверить →
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && analysis && (
          <>
            <div className={`verdict-card ${analysis.verdict}`} style={{ marginBottom: 14, textAlign: 'left' }}>
              <div className="verdict-icon-box">
                {analysis.verdict === 'good' ? '🌟' : analysis.verdict === 'partial' ? '⚠️' : '🔁'}
              </div>
              <div className="verdict-body">
                <div className="verdict-title">
                  {analysis.verdict === 'good' ? 'Отлично!' : analysis.verdict === 'partial' ? 'Есть недочёты' : 'Попробуй ещё раз'}
                </div>
                <div className="verdict-score">Полнота пересказа</div>
              </div>
              <div className="verdict-pct">{analysis.score}%</div>
            </div>

            {analysis.missed?.length > 0 && (
              <div className="missed-card" style={{ marginBottom: 14, textAlign: 'left' }}>
                <div className="missed-title">
                  <span>ℹ️</span> Ты не упомянул(а):
                </div>
                {analysis.missed.map((m, i) => (
                  <div key={i} className="missed-item">
                    <div className="missed-num">{i+1}</div>
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="btn-row">
              {analysis.verdict !== 'good' && (
                <button className="btn btn-secondary btn-sm" onClick={resetRecording}>↩ Снова</button>
              )}
              <button
                className="btn btn-blue btn-sm"
                onClick={() => setShowPaywall(true)}
                disabled={analysis.score < 50}
                title={analysis.score < 50 ? 'Сначала улучши пересказ' : ''}
              >
                К вопросам →
              </button>
            </div>

            {analysis.score < 50 && (
              <div className="error-box" style={{ marginTop: 12 }}>
                <span>💡</span>
                <span>Полнота пересказа меньше 50%. Попробуй пересказать ещё раз — постарайся вспомнить больше деталей!</span>
              </div>
            )}

            {showPaywall && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
              }}>
                <div style={{
                  background: '#fff', borderRadius: 24, padding: '28px 24px',
                  maxWidth: 360, width: '100%', textAlign: 'center',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                }}>
                  {!paywallPaid ? (
                    <>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
                      <h2 style={{
                        fontFamily: 'Fredoka One, cursive', fontSize: 22,
                        color: '#1A1A2E', marginBottom: 10,
                      }}>
                        Продолжить за 49 ₽
                      </h2>
                      <p style={{ fontSize: 14, color: '#8B8FA8', lineHeight: 1.6, marginBottom: 20 }}>
                        Чтобы ответить на вопросы по тексту и получить подробный отчёт на e-mail — оплатите доступ на 24 часа.
                      </p>
                      <div style={{
                        background: '#FFF3CD', borderRadius: 16, padding: '12px 16px',
                        marginBottom: 20, fontSize: 13, color: '#854F0B', fontWeight: 700,
                      }}>
                        💳 Стоимость: 49 ₽ / 24 часа
                      </div>
                      {paywallError && (
                        <div style={{ background: '#FFF0EE', borderRadius: 12, padding: '10px 14px',
                          marginBottom: 14, fontSize: 13, color: '#C0392B' }}>
                          ⚠️ {paywallError}
                        </div>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={handlePaywall}
                        disabled={paywallLoading}
                        style={{ marginBottom: 10 }}
                      >
                        {paywallLoading ? 'Подождите...' : '💳 Оплатить 49 ₽'}
                      </button>
                      <button
                        onClick={() => setShowPaywall(false)}
                        style={{ fontSize: 13, color: '#8B8FA8', background: 'none',
                          border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Отмена
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
                      <h2 style={{
                        fontFamily: 'Fredoka One, cursive', fontSize: 22,
                        color: '#1A1A2E', marginBottom: 10,
                      }}>
                        Поздравляем!
                      </h2>
                      <p style={{ fontSize: 14, color: '#8B8FA8', lineHeight: 1.6, marginBottom: 24 }}>
                        Вы выиграли бесплатный доступ! Ничего платить не нужно — продолжайте пользоваться сервисом.
                      </p>
                      <button
                        className="btn btn-green"
                        onClick={() => {
                          setShowPaywall(false)
                          navigate('/result', { state: { text, transcript, analysis } })
                        }}
                      >
                        Перейти к вопросам →
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="error-box"><span>⚠️</span><span>{error}</span></div>
      )}
    </div>
  )
}
