// AI-сервис через GigaChat API (Сбер)
// Документация: https://developers.sber.ru/docs/ru/gigachat/api/reference

const AI_AVAILABLE = !!process.env.GIGACHAT_KEY

function mockAnalyzeRetelling(originalText, retelling) {
  const origWords = originalText.trim().split(/\s+/).length
  const retellWords = retelling.trim().split(/\s+/).length
  const score = Math.min(100, Math.round((retellWords / (origWords * 0.4)) * 100))
  const verdict = score >= 80 ? 'good' : score >= 50 ? 'partial' : 'poor'
  return { score, verdict, keyPoints: ['Простая оценка по объёму'], missed: verdict !== 'good' ? ['Добавь GIGACHAT_KEY для детального анализа'] : [] }
}

function mockCheckAnswer(userAnswer) {
  return { result: userAnswer.trim().length > 3 ? 'correct' : 'wrong', explanation: 'Ответ принят.', correctAnswer: '' }
}

// Получаем токен доступа через Authorization Key
async function getAccessToken() {
  const { Agent } = await import('node:https')
  const agent = new Agent({ rejectUnauthorized: false })

  const res = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.GIGACHAT_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'RqUID': crypto.randomUUID(),
    },
    body: 'scope=GIGACHAT_API_PERS',
    dispatcher: new (await import('undici')).Agent({ connect: { rejectUnauthorized: false } }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GigaChat auth error: ${res.status} — ${err}`)
  }
  const data = await res.json()
  return data.access_token
}

async function askAI(systemPrompt, userPrompt) {
    console.log('Получаю токен GigaChat...')
    const token = await getAccessToken()
    console.log('Отправляю запрос к GigaChat...')

  const res = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'GigaChat-2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      dispatcher: new (await import('undici')).Agent({ connect: { rejectUnauthorized: false } }),
    })

  if (!res.ok) {
      const err = await res.text()
      console.log(`GigaChat ошибка: ${res.status} — ${err}`)
      throw new Error(`GigaChat error: ${res.status}`)
    }

  const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('Пустой ответ от GigaChat')
    console.log('GigaChat ответил успешно')
    return text
  }

  if (!res.ok) {
    const err = await res.text()
    console.log(`GigaChat ошибка: ${res.status} — ${err}`)
    throw new Error(`GigaChat error: ${res.status}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Пустой ответ от GigaChat')
  console.log('GigaChat ответил успешно')
  return text
}

export async function analyzeRetelling(originalText, retelling) {
  if (!AI_AVAILABLE) return mockAnalyzeRetelling(originalText, retelling)
  const system = `Ты педагогический ассистент. Анализируешь пересказ ребёнка школьного возраста. Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.`
  const user = `Текст:\n"""\n${originalText.slice(0, 3000)}\n"""\nПересказ:\n"""\n${retelling.slice(0, 2000)}\n"""\nВерни JSON:\n{"score": <число 0-100>, "verdict": "good"|"partial"|"poor", "keyPoints": ["..."], "missed": ["..."]}\nverdict = "good" если score>=80, "partial" если 50-79, "poor" если меньше 50.`
  const raw = await askAI(system, user)
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

export async function checkAnswer(question, userAnswer, originalText) {
  if (!AI_AVAILABLE) return mockCheckAnswer(userAnswer)
  const system = `Ты педагогический ассистент. Проверяешь ответы ребёнка на вопросы по тексту. Будь добрым. Отвечай ТОЛЬКО валидным JSON без markdown.`
  const user = `Текст:\n"""\n${originalText.slice(0, 2000)}\n"""\nВопрос: ${question}\nОтвет: ${userAnswer}\nВерни JSON:\n{"result": "correct"|"partial"|"wrong", "explanation": "краткое пояснение", "correctAnswer": "правильный ответ если wrong"}`
  const raw = await askAI(system, user)
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}
