import Groq           from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const provider = process.env.AI_PROVIDER ?? 'groq'

// ─── Инициализация клиентов ──────────────────────────────────────────────────
let groqClient, geminiModel

if (provider === 'groq' && process.env.GROQ_API_KEY) {
  groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
}
if ((provider === 'gemini' || !groqClient) && process.env.GEMINI_API_KEY) {
  const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  geminiModel  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
}

// ─── Универсальный вызов AI ──────────────────────────────────────────────────
async function askAI(systemPrompt, userPrompt) {
  if (groqClient && provider === 'groq') {
    const res = await groqClient.chat.completions.create({
      model:    'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature: 0.3,
      max_tokens:  1024,
    })
    return res.choices[0].message.content
  }

  if (geminiModel) {
    const res = await geminiModel.generateContent(
      `${systemPrompt}\n\n${userPrompt}`
    )
    return res.response.text()
  }

  throw new Error('AI провайдер не настроен. Добавь GROQ_API_KEY или GEMINI_API_KEY в .env')
}

// ─── Анализ пересказа ────────────────────────────────────────────────────────
export async function analyzeRetelling(originalText, retelling) {
  const system = `Ты — педагогический ассистент. Анализируешь пересказ ребёнка школьного возраста.
Отвечай ТОЛЬКО валидным JSON без markdown-блоков и пояснений.`

  const user = `Исходный текст:
"""
${originalText.slice(0, 3000)}
"""

Пересказ ребёнка:
"""
${retelling.slice(0, 2000)}
"""

Задача:
1. Выдели 5–8 ключевых смысловых блоков исходного текста.
2. Проверь, какие из них упомянуты в пересказе (учитывай синонимы и перефразировки, не требуй дословного совпадения).
3. Вычисли процент полноты (охваченные блоки / всего блоков * 100).
4. Определи вердикт: "good" (80%+), "partial" (50–79%), "poor" (меньше 50%).
5. Перечисли пропущенные смысловые блоки простым детским языком (1–2 предложения каждый).

Верни JSON:
{
  "score": <число 0-100>,
  "verdict": "good"|"partial"|"poor",
  "keyPoints": ["..."],
  "missed": ["..."]
}`

  const raw  = await askAI(system, user)
  const json = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(json)
}

// ─── Проверка ответа на вопрос ───────────────────────────────────────────────
export async function checkAnswer(question, userAnswer, originalText) {
  const system = `Ты — педагогический ассистент. Проверяешь ответы ребёнка на вопросы по тексту.
Будь добрым и поддерживающим. Отвечай ТОЛЬКО валидным JSON без markdown-блоков.`

  const user = `Текст произведения (фрагмент для контекста):
"""
${originalText.slice(0, 2000)}
"""

Вопрос: ${question}
Ответ ребёнка: ${userAnswer}

Оцени ответ:
- "correct" — ответ верный или близкий по смыслу
- "partial" — ответ частично верный, есть важное уточнение
- "wrong"   — ответ неверный

Для вопроса об основной мысли принимай широкий диапазон ответов если суть верна.

Верни JSON:
{
  "result": "correct"|"partial"|"wrong",
  "explanation": "<краткое пояснение для ребёнка, 1 предложение, дружелюбно>",
  "correctAnswer": "<правильный ответ, если result != correct>"
}`

  const raw  = await askAI(system, user)
  const json = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(json)
}
