// AI-сервис: анализ пересказа и проверка ответов на вопросы.
// Вызывает бэкенд-API, который проксирует запросы к Groq / Gemini.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function callAI(endpoint, body) {
  const res = await fetch(`${API_URL}/api/ai/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `AI API error: ${res.status}`)
  }
  return res.json()
}

// ─── Анализ пересказа ───────────────────────────────────────────────────────

// Возвращает:
// { score: 0–100, verdict: 'good'|'partial'|'poor',
//   missed: string[], keyPoints: string[] }
export async function analyzeRetelling(originalText, retelling) {
  return callAI('analyze-retelling', { originalText, retelling })
}

// ─── Вопросы по произведению ────────────────────────────────────────────────

// Генерирует 5 вопросов на основе текста (если автор/название не указаны)
export async function generateQuestions(text, meta = {}) {
  return callAI('generate-questions', { text, meta })
}

// Проверяет ответ на конкретный вопрос
// Возвращает: { result: 'correct'|'partial'|'wrong', explanation: string, correctAnswer: string }
export async function checkAnswer(question, userAnswer, originalText) {
  return callAI('check-answer', { question, userAnswer, originalText })
}

// ─── Пять стандартных вопросов ──────────────────────────────────────────────

export const STANDARD_QUESTIONS = [
  { id: 'author',   text: 'Кто автор этого произведения?' },
  { id: 'title',    text: 'Как называется произведение?' },
  { id: 'plot',     text: 'Какой основной сюжет — что происходит в тексте?' },
  { id: 'hero',     text: 'Кто главный герой и как его можно описать?' },
  { id: 'message',  text: 'Какова основная мысль — чему учит этот текст?' },
]
