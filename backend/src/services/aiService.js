// ИСПРАВЛЕНО: используем открытую модель Falcon-7B-Instruct
const HF_API_URL = 'https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct/v1/chat/completions'

// const MODEL = 'meta-llama/Llama-3.1-8B-Instruct:hf-inference'  // УДАЛЕНО

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
  console.log(`Отправляю запрос к HuggingFace модели: tiiuae/falcon-7b-instruct`)
  
  const res = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })
  
  if (!res.ok) {
    const errorText = await res.text()
    console.log(`Ошибка HuggingFace API: ${res.status}`)
    console.log(`Детали: ${errorText.slice(0, 300)}`)
    throw new Error(`HF API error: ${res.status} - ${errorText.slice(0, 100)}`)
  }
  
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  
  if (!text) {
    console.log('Пустой ответ от модели')
    throw new Error('Пустой ответ от модели')
  }
  
  console.log('HuggingFace ответил успешно')
  return text
}

export async function analyzeRetelling(originalText, retelling) {
  if (!AI_AVAILABLE) {
    console.log('HF_TOKEN не найден, использую mock-режим')
    return mockAnalyzeRetelling(originalText, retelling)
  }
  
  const system = `Ты педагогический ассистент. Анализируешь пересказ ребёнка. Отвечай ТОЛЬКО валидным JSON без markdown и пояснений.`
  
  const user = `Текст:
"""
${originalText.slice(0, 2000)}
"""
Пересказ:
"""
${retelling.slice(0, 1500)}
"""
Верни JSON:
{"score": <число 0-100>, "verdict": "good", "keyPoints": ["..."], "missed": ["..."]}
verdict = "good" если score>=80, "partial" если 50-79, "poor" если меньше 50.`
  
  try {
    const raw = await askAI(system, user)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(cleaned)
    console.log('Анализ пересказа завершён:', result.score, 'баллов')
    return result
  } catch (error) {
    console.error('Ошибка при анализе пересказа:', error.message)
    return mockAnalyzeRetelling(originalText, retelling)
  }
}

export async function checkAnswer(question, userAnswer, originalText) {
  if (!AI_AVAILABLE) {
    console.log('HF_TOKEN не найден, использую mock-режим для проверки ответов')
    return mockCheckAnswer(userAnswer)
  }
  
  const system = `Ты педагогический ассистент. Проверяешь ответы ребёнка. Отвечай ТОЛЬКО валидным JSON без markdown.`
  
  const user = `Текст:
"""
${originalText.slice(0, 1500)}
"""
Вопрос: ${question}
Ответ: ${userAnswer}
Верни JSON:
{"result": "correct", "explanation": "...", "correctAnswer": ""}
result = "correct" если верно, "partial" если частично, "wrong" если неверно.`
  
  try {
    const raw = await askAI(system, user)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(cleaned)
    console.log('Ответ проверен:', result.result)
    return result
  } catch (error) {
    console.error('Ошибка при проверке ответа:', error.message)
    return mockCheckAnswer(userAnswer)
  }
}
