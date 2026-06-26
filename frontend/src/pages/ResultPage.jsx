import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { STANDARD_QUESTIONS, checkAnswer, getQuestionsResultLevel } from '../services/aiService.js'
import { speak } from '../services/speechService.js'
import VoiceInput from '../components/VoiceInput.jsx'

export default function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state    = location.state

  useEffect(() => { if (!state?.text) navigate('/') }, [])
  if (!state?.text) return null

  const { text, transcript, analysis } = state

  const [qIndex,          setQIndex]          = useState(0)
  const [answers,         setAnswers]         = useState([])
  const [qAnswer,         setQAnswer]         = useState('')
  const [qResult,         setQResult]         = useState(null)
  const [qAttempts,       setQAttempts]       = useState(0)
  const [qLoading,        setQLoading]        = useState(false)
  const [qModErr,         setQModErr]         = useState('')
  const [voiceErr,        setVoiceErr]        = useState('')
  const [injectionAttempts, setInjectionAttempts] = useState(0)

  const questions  = STANDARD_QUESTIONS
  const MAX_ATT    = 2
  const MAX_INJECT = 3

  async function submitAnswer() {
    if (!qAnswer.trim()) return
    setQLoading(true)
    setQModErr(''); setVoiceErr('')
    try {
      const res = await checkAnswer(questions[qIndex].text, qAnswer, text)
      if (res.blocked) {
        if (res.blockType === 'injection') {
          const newAttempts = injectionAttempts + 1
          setInjectionAttempts(newAttempts)
          // При исчерпании попыток — сбрасываем поле и счётчик injection,
          // чтобы ребёнок мог попробовать снова с чистого листа.
          if (newAttempts >= MAX_INJECT) {
            setQAnswer('')
            setInjectionAttempts(0)
          }
          setQModErr(res.message)
        } else {
          // prohibited — жёсткая блокировка, не засчитываем как попытку
          setQModErr(res.message)
        }
        return
      }
      setInjectionAttempts(0)
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
    setQModErr(''); setVoiceErr(''); setInjectionAttempts(0)
    if (qIndex + 1 < questions.length) {
      setQIndex(i => i + 1)
    } else {
      setTimeout(() => {
        speak(getQuestionsResultLevel(newAnswers).voice)
        navigate('/report', { state: { text, transcript, analysis, answers: newAnswers } })
      }, 600)
    }
  }

  function retryAnswer() {
    setQResult(null); setQAnswer(''); setQModErr(''); setVoiceErr('')
  }

  const canRetry   = qResult && qResult.result !== 'correct' && qAttempts < MAX_ATT
  const showAnswer = qResult && qResult.result !== 'correct' && qAttempts >= MAX_ATT

  return (
    <div className="page-content">
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
            {qModErr && (
              <div className="error-box" style={{ marginBottom: 10 }}>
                <span>⚠️</span>
                <span>{qModErr}</span>
              </div>
            )}
            {voiceErr && (
              <div className="error-box" style={{ marginBottom: 10 }}>
                <span>🎤</span>
                <span>{voiceErr}</span>
              </div>
            )}
            <VoiceInput
              value={qAnswer}
              onChange={setQAnswer}
              placeholder="Напиши ответ или нажми 🎤 и скажи вслух"
              rows={3}
              disabled={qLoading}
              onError={setVoiceErr}
            />
            {canRetry && (
              <div className="error-box" style={{ marginBottom: 10 }}>
                <span>🔁</span>
                <span>Не совсем верно. Посмотри на текст и попробуй снова.</span>
              </div>
            )}
            <button className="btn btn-blue"
              onClick={canRetry ? retryAnswer : submitAnswer}
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
    </div>
  )
}
