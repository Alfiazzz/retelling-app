import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { STANDARD_QUESTIONS, getQuestionsResultLevel } from '../services/aiService.js'
import { sendReport, validateEmail } from '../services/emailService.js'
import { sessionStore } from '../config/sessionStore.js'

export default function ReportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state    = location.state

  useEffect(() => { if (!state?.text) navigate('/') }, [])
  if (!state?.text) return null

  const { text, transcript, analysis, answers } = state

  const [phase,     setPhase]     = useState('report')
  const [email,     setEmail]     = useState('')
  const [childName, setChildName] = useState('')
  const [emailErr,  setEmailErr]  = useState('')
  const [sending,   setSending]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [sendErr,   setSendErr]   = useState('')

  const questions   = STANDARD_QUESTIONS
  const correctCnt  = answers.filter(a => a.result === 'correct').length
  const partialCnt  = answers.filter(a => a.result === 'partial').length
  const resultLevel = getQuestionsResultLevel(answers)

  // Иконка и эмодзи итогового экрана зависят от уровня результата:
  // хорошие результаты — победный кубок, слабые — более нейтральная книга,
  // чтобы не создавать контраст между бодрым 🏆 и грустными цифрами.
  const LEVEL_ICONS = {
    excellent: { trophy: '🏆', sub: 'Ты справился(ась) на отлично!' },
    good:      { trophy: '🌟', sub: 'Ты хорошо справился(ась)!' },
    okay:      { trophy: '📖', sub: 'Ты завершил(а) задание' },
    poor:      { trophy: '📖', sub: 'Ты завершил(а) задание' },
  }
  const levelIcon = LEVEL_ICONS[resultLevel.level]

  async function handleSend() {
    if (!validateEmail(email)) { setEmailErr('Введи правильный e-mail'); return }
    setEmailErr(''); setSending(true); setSendErr('')
    const data = {
      childName: childName || 'Ученик',
      text, transcript,
      analysis,
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
      const isNetworkError = e instanceof TypeError
      setSendErr(isNetworkError
        ? 'Не удалось связаться с сервером. Проверь интернет-соединение и попробуй ещё раз.'
        : (e.message || 'Не удалось отправить отчёт. Попробуй ещё раз чуть позже.'))
    } finally {
      setSending(false)
    }
  }

  function skipEmail() {
    sessionStore.add({
      childName: childName || 'Ученик',
      text, transcript,
      analysis,
      retellingScore: analysis?.score ?? 0,
      retellingVerdict: analysis?.verdict ?? 'poor',
      missedPoints: analysis?.missed ?? [],
      questions: answers, email: null,
      createdAt: new Date().toISOString(),
    })
    setPhase('done')
  }

  // Конфетти — только для хороших результатов: для 'okay' и 'poor'
  // запускать праздничную анимацию нелогично и противоречит мягкому тону
  // ("не расстраивайся") — это было бы ещё одним противоречием, хотя и
  // меньшим, чем заголовок "Молодец!" при 0/5 правильных ответов.
  useEffect(() => {
    if (phase !== 'done') return
    if (resultLevel.level !== 'excellent' && resultLevel.level !== 'good') return
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

  return (
    <div className="page-content">

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
              value={childName} onChange={e => setChildName(e.target.value)} maxLength={100} />
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
            <span className="trophy-icon">{levelIcon.trophy}</span>
            <h1 className="final-title">{resultLevel.title}</h1>
            <p className="final-sub">{levelIcon.sub}</p>
          </div>

          <div className="stars-row">
            {'⭐'.repeat(resultLevel.stars)}
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

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(analysis?.title || analysis?.author) && (
              <div style={{ paddingBottom: 10, borderBottom: '1.5px solid var(--border)' }}>
                {analysis.title  && <p style={{ fontWeight: 800, fontSize: 14 }}>{analysis.title}</p>}
                {analysis.author && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{analysis.author}</p>}
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
