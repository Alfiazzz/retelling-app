const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'openrouter/auto'

const AI_AVAILABLE = !!process.env.OPENROUTER_API_KEY

function mockAnalyzeRetelling(originalText, retelling) {
  const origWords   = originalText.trim().split(/\s+/).length
  const retellWords = retelling.trim().split(/\s+/).length
  const score       = Math.min(100, Math.round((retellWords / (origWords * 0.4)) * 100))
  const verdict     = score >= 80 ? 'good' : score >= 50 ? 'partial' : 'poor'
  return {
    score,
    verdict,
    keyPoints: ['AI-анализ не настроен — используется простая оценка по объёму'],
    missed: verdict !== 'good' ? ['Добавь OPENROUTER_API_KEY для детального анализа'] : [],
  }
}

function mockCheckAnswer(userAnswer) {
  const hasAnswer = userAnswer.trim().length > 3
  return {
    result: hasAnswer ? 'correct' : 'wrong',
    explanation: hasAnswer ? 'Ответ принят. Для точной проверки добавь AI-ключ.' : 'Ответ слишком короткий.',
    correctAnswer: '',
  }
}

async function askAI(systemPrompt, userPrompt) {
  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL ?? 'http://localhost:5173',
      'X-Title': 'Retelling App',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenRouter error: ${res.status} — ${err?.error?.message ?? 'unknown'}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function analyzeRetelling(originalText, retelling) {
  if (!AI_AVAILABLE) return mockAnalyzeRetelling(originalText, retelling)
  const system = `Ты — педагогический ассистент. Анализируешь пересказ ребёнка школьного возраста. Отвечай ТОЛЬКО валидным JSON без markdown-блоков и пояснений.`
  const user = `Исходный текст:\n"""\n${originalText.slice(0, 3000)}\n"""\n\nПересказ ребёнка:\n"""\n${retelling.slice(0, 2000)}\n"""\n\nВерни JSON:\n{\n  "score": <число 0-100>,\n  "verdict": "good"|"partial"|"poor",\n  "keyPoints": ["..."],\n  "missed": ["..."]\n}`
  const raw = await askAI(system, user)
  const json = raw.replace(/\`\`\`json|\`\`\`/g, '').trim()
  return JSON.parse(json)
}

export async function checkAnswer(question, userAnswer, originalText) {
  if (!AI_AVAILABLE) return mockCheckAnswer(userAnswer)
  const system = `Ты — педагогический ассистент. Проверяешь ответы ребёнка на вопросы по тексту. Будь добрым. Отвечай ТОЛЬКО валидным JSON без markdown-блоков.`
  const user = `Текст:\n"""\n${originalText.slice(0, 2000)}\n"""\n\nВопрос: ${question}\nОтвет ребёнка: ${userAnswer}\n\nВерни JSON:\n{\n  "result": "correct"|"partial"|"wrong",\n  "explanation": "<пояснение>",\n  "correctAnswer": "<правильный ответ если wrong>"\n}`
  const raw = await askAI(system, user)
  const json = raw.replace(/\`\`\`json|\`\`\`/g, '').trim()
  return JSON.parse(json)
}
