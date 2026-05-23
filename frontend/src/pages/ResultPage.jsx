import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { STANDARD_QUESTIONS, checkAnswer } from '../services/aiService.js'
import { sendReport, validateEmail } from '../services/emailService.js'
import { speak } from '../services/speechService.js'
import { sessionStore } from '../config/sessionStore.js'
import QuestionCard from '../components/QuestionCard.jsx'

export default function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state    = location.state

  useEffect(() => { if (!state?.text) navigate('/') }, [])
  if (!state?.text) return null

  const { text, meta, transcript, analysis } = state

  const [qIndex,    setQIndex]    = useState(0)
  const [answers,   setAnswers]   = useState([])   // { question, userAnswer, result, explanation, correctAnswer }
  const [phase,     setPhase]     = useState('questions')  // questions | report | done
  const [email,     setEmail]     = useState('')
  const [emailErr,  setEmailErr]  = useState('')
  const [sending,   setSending]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [sendErr,   setSendErr]   = useState('')
  const [childName, setChildName] = useState('')

  const questions = STANDARD_QUESTIONS

  async function handleAnswer(question, userAnswer) {
    const res = await checkAnswer(question.text, userAnswer, text)
    return res
  }

  function handleAnswerDone(question, userAnswer, result) {
    const entry = { question: question.text, userAnswer, ...result }
    setAnswers(prev => [...prev, entry])

    if (qIndex + 1 < questions.length) {
      setTimeout(() => setQIndex(i => i + 1), 800)
    } else {
      // Все вопросы отвечены
      setTimeout(() => {
        speak('Молодец! Ты ответил на все вопросы. Теперь отправим результат.')
        setPhase('report')
      }, 1000)
    }
  }

  async function handleSendReport() {
    if (!validateEmail(email)) {
      setEmailErr('Введи правильный e-mail адрес')
      return
    }
    setEmailErr('')
    setSending(true)
    setSendErr('')

    const sessionData = {
      childName: childName || 'Ученик',
      author:    meta?.author || '—',
      title:     meta?.title  || '—',
      text,
      transcript,
      retellingScore:   analysis?.score   ?? 0,
      retellingVerdict: analysis?.verdict ?? 'poor',
      missedPoints:     analysis?.missed  ?? [],
      questions:        answers,
      email,
      createdAt: new Date().toISOString(),
    }

    // Сохраняем в локальную историю
    sessionStore.add(sessionData)

    try {
      await sendReport(sessionData)
      setSent(true)
      setPhase('done')
    } catch (e) {
      setSendErr('Не удалось отправить отчёт: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  function skipEmail() {
    const sessionData = {
      childName: childName || 'Ученик',
      author:  meta?.author || '—',
      title:   meta?.title  || '—',
      text, transcript,
      retellingScore:   analysis?.score   ?? 0,
      retellingVerdict: analysis?.verdict ?? 'poor',
      missedPoints:     analysis?.missed  ?? [],
      questions: answers,
      email: null,
      createdAt: new Date().toISOString(),
    }
    sessionStore.add(sessionData)
    setPhase('done')
  }

  const correctCount = answers.filter(a => a.result === 'correct').length
  const partialCount = answers.filter(a => a.result === 'partial').length

  return (
    <div className="space-y-5">

      {/* Фаза: вопросы */}
      {phase === 'questions' && (
        <>
          <div className="text-center pt-2">
            <h1 className="text-2xl font-extrabold text-gray-800">💬 Ответь на вопросы</h1>
            <p className="text-gray-500 text-sm mt-1">5 вопросов по тексту</p>
          </div>

          <QuestionCard
            key={qIndex}
            question={questions[qIndex]}
            questionNum={qIndex + 1}
            total={questions.length}
            onAnswer={async (q, a) => {
              const res = await handleAnswer(q, a)
              // Небольшая задержка чтобы пользователь увидел результат
              setTimeout(() => handleAnswerDone(q, a, res), 1500)
              return res
            }}
          />
        </>
      )}

      {/* Фаза: ввод email и отправка отчёта */}
      {phase === 'report' && (
        <>
          <div className="text-center pt-2">
            <h1 className="text-2xl font-extrabold text-gray-800">📊 Итоговый результат</h1>
          </div>

          {/* Краткий итог */}
          <div className="card space-y-3">
            <h2 className="font-bold text-gray-800">Результаты сессии</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-extrabold text-primary-600">{analysis?.score ?? 0}%</p>
                <p className="text-xs text-gray-500 mt-0.5">полнота пересказа</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-extrabold text-green-600">
                  {correctCount + partialCount}/{questions.length}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">верных ответов</p>
              </div>
            </div>
          </div>

          {/* Форма отчёта */}
          <div className="card space-y-4">
            <h2 className="font-bold text-gray-800">📧 Отправить отчёт на почту</h2>
            <p className="text-sm text-gray-500">
              Родитель или учитель получит подробный отчёт с транскрипцией пересказа и ответами на вопросы.
            </p>

            <input
              className="input-field"
              placeholder="Имя ребёнка (необязательно)"
              value={childName}
              onChange={e => setChildName(e.target.value)}
            />
            <div>
              <input
                className={`input-field ${emailErr ? 'border-red-300 focus:ring-red-300' : ''}`}
                type="email"
                placeholder="E-mail родителя или учителя"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailErr('') }}
              />
              {emailErr && <p className="text-xs text-red-500 mt-1">{emailErr}</p>}
            </div>

            {sendErr && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
                ⚠️ {sendErr}
              </div>
            )}

            <p className="text-xs text-gray-400">
              Нажимая «Отправить», ты соглашаешься на обработку e-mail для отправки отчёта.
              Данные не передаются третьим лицам.
            </p>

            <button
              className="btn-primary w-full"
              onClick={handleSendReport}
              disabled={sending}
            >
              {sending ? 'Отправляю...' : 'Отправить отчёт'}
            </button>
            <button className="text-sm text-gray-400 hover:text-gray-600 w-full text-center underline"
              onClick={skipEmail}>
              Пропустить, перейти к итогам
            </button>
          </div>
        </>
      )}

      {/* Фаза: финальный экран */}
      {phase === 'done' && (
        <>
          <div className="text-center pt-2">
            <div className="text-5xl mb-3">🏆</div>
            <h1 className="text-2xl font-extrabold text-gray-800">Молодец!</h1>
            <p className="text-gray-500 text-sm mt-1">Ты завершил(а) задание</p>
          </div>

          {/* Итоговая карточка */}
          <div className="card space-y-4">
            {(meta?.title || meta?.author) && (
              <div>
                {meta.title  && <p className="font-semibold text-gray-800">{meta.title}</p>}
                {meta.author && <p className="text-sm text-gray-500">{meta.author}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-extrabold text-primary-600">{analysis?.score ?? 0}%</p>
                <p className="text-xs text-gray-500 mt-0.5">пересказ</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-extrabold text-green-600">
                  {correctCount + partialCount}/{questions.length}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">вопросы</p>
              </div>
            </div>

            {/* Ответы на вопросы */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Ответы на вопросы:</p>
              {answers.map((a, i) => (
                <div key={i} className={`rounded-2xl px-3 py-2 text-sm flex gap-2 items-start
                  ${a.result === 'correct' ? 'bg-green-50' :
                    a.result === 'partial'  ? 'bg-yellow-50' : 'bg-red-50'}`}>
                  <span>{a.result === 'correct' ? '✅' : a.result === 'partial' ? '🟡' : '❌'}</span>
                  <div>
                    <p className="font-medium text-gray-700">{questions[i]?.text}</p>
                    <p className="text-gray-500 text-xs mt-0.5">Твой ответ: {a.userAnswer}</p>
                    {a.result !== 'correct' && a.correctAnswer && (
                      <p className="text-gray-600 text-xs mt-0.5">Правильно: {a.correctAnswer}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {sent && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700 text-center">
                ✅ Отчёт отправлен на {email}
              </div>
            )}
          </div>

          <button className="btn-primary w-full" onClick={() => navigate('/')}>
            Начать заново 📖
          </button>
        </>
      )}
    </div>
  )
}
