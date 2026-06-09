import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { STANDARD_QUESTIONS, checkAnswer } from '../services/aiService.js'
import { sendReport, validateEmail } from '../services/emailService.js'
import { speak } from '../services/speechService.js'
import { sessionStore } from '../config/sessionStore.js'

export default function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state    = location.state

  useEffect(() => { if (!state?.text) navigate('/') }, [])
  if (!state?.text) return null

  const { text, meta, transcript, analysis } = state

  const [qIndex,    setQIndex]    = useState(0)
  const [answers,   setAnswers]   = useState([])
  const [phase,     setPhase]     = useState('questions')
  const [qAnswer,   setQAnswer]   = useState('')
  const [qResult,   setQResult]   = useState(null)
  const [qAttempts, setQAttempts] = useState(0)
  const [qLoading,  setQLoading]  = useState(false)
  const [email,     setEmail]     = useState('')
  const [childName, setChildName] = useState('')
  const [emailErr,  setEmailErr]  = useState('')
  const [sending,   setSending]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [sendErr,   setSendErr]   = useState('')

  const questions  = STANDARD_QUESTIONS
  const MAX_ATT    = 2
  const correctCnt = answers.filter(a => a.result === 'correct').length
  const partialCnt = answers.filter(a => a.result === 'partial').length

  async function submitAnswer() {
    if (!qAnswer.trim()) return
    setQLoading(true)
    try {
      const res = await checkAnswer(questions[qIndex].text, qAnswer, text)
      setQResult(res)
      setQAttempts(a => a + 1)
      if (res.result === 'correct') speak('Правильно! Отлично!')
      else if (qAttempts + 1 >= MAX_ATT) speak(`Правильный ответ: ${res.correctAnswer}`)
      else speak('Не совсем верно. Посмотри на текст и попробуй снова.')
    } finally {
      setQLoading(false)
    }
  }

  function nextQuestion() {
    const entry = { question: questions[qIndex].text, userAnswer: qAnswer, ...qResult }
    const newAnswers = [...answers, entry]
    setAnswers(newAnswers)
    setQResult(null); setQAnswer(''); setQAttempts(0)
    if (qIndex + 1 < questions.length) {
      setQIndex(i => i + 1)
    } else {
      setTimeout(() => {
        speak('Молодец! Ты ответил на все вопросы!')
        setPhase('report')
      }, 600)
    }
  }

  function retryAnswer() {
    setQResult(null); setQAnswer('')
  }

  async function handleSend() {
    if (!validateEmail(email)) { setEmailErr('Введи правильный e-mail'); return }
    setEmailErr(''); setSending(true); setSendErr('')
    const data = {
      childName: childName || 'Ученик',
      author:  meta?.author || '—',
      title:   meta?.title  || '—',
      text, transcript,
      retellingScore:   analysis?.score   ?? 0,
      retellingVerdict: analysis?.verdict ?? 'poor',
      missedPoints:     analysis?.missed  ?? [],
      questions: answers,
      email,
      createdAt: new Date().toISOString(),
    }
    sessionStore.add(data)
    try {
      await sendReport(data)
      setSent(true); setPhase('done')
    } catch (e) {
      setSendErr('Не удалось отправить: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  function skipEmail() {
    sessionStore.add({
      childName: childName || 'Ученик',
      author: meta?.author || '—', title: meta?.title || '—',
      text, transcript,
      retellingScore: analysis?.score ?? 0,
      retellingVerdict: analysis?.verdict ?? 'poor',
      missedPoints: analysis?.missed ?? [],
      questions: answers, email: null,
      createdAt: new Date().toISOString(),
    })
    setPhase('done')
  }

  // ── Конфетти ──
  useEffect(() => {
    if (phase !== 'done') return
    const wrap = document.createElement('div')
    wrap.className = 'confetti-layer'
    document.body.appendChild(wrap)
    const colors = ['#FF6B6B','#FFD43B','#51CF66','#339AF0','#FF922B','#CC5DE8']
    for (let i = 0; i < 32; i++) {
      const c = document.createElement('div')
      c.className = 'conf-piece'
      c.style.cssText = `
        left:${Math.random()*100}%;
        background:${colors[i%colors.length]};
        animation-delay:${Math.random()*1.4}s;
        animation-duration:${1.6+Math.random()*0.8}s;
        width:${6+Math.random()*7}px;
        height:${6+Math.random()*7}px;
        border-radius:${Math.random()>0.5?'50%':'2px'};
      `
      wrap.appendChild(c)
    }
    return () => { document.body.removeChild(wrap) }
  }, [phase])

  const canRetry   = qResult && qResult.result !== 'correct' && qAttempts < MAX_ATT
  const showAnswer = qResult && qResult.result !== 'correct' && qAttempts >= MAX_ATT

  return (
    <div className="page-content">

      {/* ── Вопросы ── */}
      {phase === 'questions' && (
        <>
          <div className="hero-block">
            <div className="hero-emoji-wrap result">💬</div>
            <h1>Ответь на вопросы</h1>
            <p>5 вопросов по тексту</p>
          </div>

          <div className="card">
            <div className="q-progress-row">
              <span className="q-label">Вопрос {qIndex+1} из {questions.length}</span>
              <div className="q-dots">
                {questions.map((_,i) => (
                  <div key={i} className={`q-dot ${i<qIndex?'done':i===qIndex?'active':''}`}/>
                ))}
              </div>
            </div>

            <div className="question-bubble">{questions[qIndex].text}</div>

            {!qResult || canRetry ? (
              <>
                <textarea
                  className="text-area"
                  rows={3}
                  placeholder="Напиши ответ здесь..."
                  value={qAnswer}
                  onChange={e => setQAnswer(e.target.value)}
                  disabled={qLoading}
                  style={{ marginBottom: 10 }}
                />
                {canRetry && (
                  <div className="error-box" style={{ marginBottom: 10 }}>
                    <span>🔁</span>
                    <span>Не совсем верно. Посмотри на текст и попробуй снова.</span>
                  </div>
                )}
                <button className="btn btn-blue"
                  onClick={canRetry ? retryAnswer || submitAnswer : submitAnswer}
                  disabled={!qAnswer.trim() || qLoading}>
                  {qLoading ? 'Проверяю...' : canRetry ? 'Попробовать снова' : 'Ответить ↗'}
                </button>
              </>
            ) : (
              <>
                <div className={`answer-result ${qResult.result}`} style={{ marginBottom: 10 }}>
                  <span className="ar-icon">
                    {qResult.result==='correct'?'✅':qResult.result==='partial'?'🟡':'❌'}
                  </span>
                  <div className="ar-text">
                    <strong>
                      {qResult.result==='correct'?'Верно!':qResult.result==='partial'?'Почти верно':'Неверно'}
                    </strong>
                    {' '}{qResult.explanation}
                    {showAnswer && qResult.correctAnswer && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Правильный ответ:</strong> {qResult.correctAnswer}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn btn-blue" onClick={nextQuestion}>
                  {qIndex+1 < questions.length ? 'Следующий вопрос →' : 'Завершить →'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Отчёт ── */}
      {phase === 'report' && (
        <>
          <div className="hero-block">
            <div className="hero-emoji-wrap final">📊</div>
            <h1>Итоговый результат</h1>
          </div>

          <div className="score-grid">
            <div className="score-cell">
              <div className="score-num orange">{analysis?.score ?? 0}%</div>
              <div className="score-label">Пересказ</div>
            </div>
            <div className="score-cell">
              <div className="score-num green">{correctCnt+partialCnt}/{questions.length}</div>
              <div className="score-label">Вопросы</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="card-label">📧 Отправить отчёт на почту</span>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Родитель или учитель получит подробный отчёт с транскрипцией и ответами.
            </p>
            <input className="input-field" placeholder="Имя ребёнка (необязательно)"
              value={childName} onChange={e => setChildName(e.target.value)} />
            <div>
              <input className="input-field" type="email" placeholder="E-mail родителя или учителя"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailErr('') }}
                style={emailErr ? { borderColor: 'var(--coral)' } : {}}
              />
              {emailErr && <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 4 }}>{emailErr}</p>}
            </div>
            {sendErr && (
              <div className="error-box"><span>⚠️</span><span>{sendErr}</span></div>
            )}
            <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
              Нажимая «Отправить», ты соглашаешься на обработку e-mail. Данные не передаются третьим лицам.
            </p>
            <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
              {sending ? 'Отправляю...' : '📧 Отправить отчёт'}
            </button>
            <button onClick={skipEmail}
              style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Пропустить, перейти к итогам
            </button>
          </div>
        </>
      )}

      {/* ── Финал ── */}
      {phase === 'done' && (
        <>
          <div className="final-hero">
            <span className="trophy-icon">🏆</span>
            <h1 className="final-title">Молодец!</h1>
            <p className="final-sub">Ты завершил(а) задание</p>
          </div>

          <div className="stars-row">⭐⭐⭐⭐</div>

          <div className="score-grid">
            <div className="score-cell">
              <div className="score-num orange">{analysis?.score ?? 0}%</div>
              <div className="score-label">Пересказ</div>
            </div>
            <div className="score-cell">
              <div className="score-num green">{correctCnt+partialCnt}/{questions.length}</div>
              <div className="score-label">Вопросы</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(meta?.title || meta?.author) && (
              <div style={{ paddingBottom: 10, borderBottom: '1.5px solid var(--border)' }}>
                {meta.title  && <p style={{ fontWeight: 800, fontSize: 14 }}>{meta.title}</p>}
                {meta.author && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{meta.author}</p>}
              </div>
            )}
            <span className="card-label">Ответы на вопросы</span>
            {answers.map((a, i) => (
              <div key={i} className={`answer-result ${a.result}`}>
                <span className="ar-icon">
                  {a.result==='correct'?'✅':a.result==='partial'?'🟡':'❌'}
                </span>
                <div className="ar-text">
                  <strong>{questions[i]?.text}</strong>
                  <div style={{ marginTop: 2, color: 'var(--muted)' }}>Твой ответ: {a.userAnswer}</div>
                  {a.result!=='correct' && a.correctAnswer && (
                    <div style={{ marginTop: 2 }}>Правильно: {a.correctAnswer}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {sent && (
            <div className="success-box">✅ Отчёт отправлен на {email}</div>
          )}

          <button className="btn btn-primary" onClick={() => navigate('/')}>
            📖 Начать заново
          </button>
        </>
      )}
    </div>
  )
}
