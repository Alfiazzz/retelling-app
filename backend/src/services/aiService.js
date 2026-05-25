const HF_API_URL = 'https://router.huggingface.co/hf-inference/v1/chat/completions'
const MODEL = 'meta-llama/Llama-3.2-3B-Instruct'

const AI_AVAILABLE = !!process.env.HF_TOKEN

function mockAnalyzeRetelling(originalText, retelling) {
  const origWords = originalText.trim().split(/\s+/).length
  const retellWords = retelling.trim().split(/\s+/).length
  const score = Math.min(100, Math.round((retellWords / (origWords * 0.4)) * 100))
  const verdict = score >= 80 ? 'good' : score >= 50 ? 'partial' : 'poor'
  return { score, verdict, keyPoints: ['Простая оценка по объёму'], missed: verdict !== 'good' ? ['Добавь HF_TOKEN для детального анализа'] : [] }
}

function mockCheckAnswer(userAnswer) {
  return { result: userAnswer.trim().length > 3 ? 'correct' : 'wrong', explanation: 'Ответ принят.', correctAnswer: '' }
}

async function askAI(systemPrompt, userPrompt) {
  console.log(`Отправляю запрос к HuggingFace модели: ${MODEL}`)
  const res = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message ?? `HTTP ${res.status}`
    console.log(`Ошибка HuggingFace: ${msg}`)
    throw new Error(`HF error: ${msg}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Пустой ответ от модели')
  console.log('HuggingFace ответил успешно')
  return text
}

export async function analyzeRetelling(originalText, retelling) {
  if (!AI_AVAILABLE) return mockAnalyzeRetelling(originalText, retelling)
  const system = `Ты педагогический ассистент. Анализируешь пересказ ребёнка. Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.`
  const user = `Текст:\n"""\n${originalText.slice(0, 2000)}\n"""\nПересказ:\n"""\n${retelling.slice(0, 1500)}\n"""\nВерни JSON:\n{"score": <число 0-100>, "verdict": "good", "keyPoints": ["..."], "missed": ["..."]}\nverdict = "good" если score>=80, "partial" если 50-79, "poor" если меньше 50.`
  const raw = await askAI(system, user)
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

export async function checkAnswer(question, userAnswer, originalText) {
  if (!AI_AVAILABLE) return mockCheckAnswer(userAnswer)
  const system = `Ты педагогический ассистент. Проверяешь ответы ребёнка. Отвечай ТОЛЬКО валидным JSON без markdown.`
  const user = `Текст:\n"""\n${originalText.slice(0, 1500)}\n"""\nВопрос: ${question}\nОтвет: ${userAnswer}\nВерни JSON:\n{"result": "correct", "explanation": "...", "correctAnswer": ""}\nresult = "correct" если верно, "partial" если частично, "wrong" если неверно.`
  const raw = await askAI(system, user)
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}
