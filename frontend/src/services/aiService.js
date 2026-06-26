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

// ─── Модерация текста ───────────────────────────────────────────────────────

// Мгновенная словарная проверка распознанного (OCR) текста на запрещённый
// контент — вызывается перед переходом к пересказу.
// Возвращает: { blocked: boolean, message?: string }
export async function moderateText(text) {
  return callAI('moderate-text', { text })
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

// ─── Итог по ответам на вопросы ─────────────────────────────────────────────

// Раньше финальный экран всегда показывал одну и ту же похвалу "Молодец!"
// и фиксированное количество звёзд независимо от того, сколько ответов
// было верными — это противоречило результату, который тут же показывался
// цифрами (например, "0 из 5", но сверху "Молодец!"). Эта функция
// определяет уровень результата по доле верных/частично верных ответов,
// чтобы похвала и звёзды были честными, но тон всегда оставался мягким —
// даже на нижнем уровне это не "ты не справился", а "не расстраивайся".
//
// answers — массив объектов { result: 'correct'|'partial'|'wrong', ... },
// как формируется в ResultPage.jsx/ReportPage.jsx.
export function getQuestionsResultLevel(answers) {
  const total = answers.length
  const score = answers.filter(a => a.result === 'correct' || a.result === 'partial').length
  const ratio = total > 0 ? score / total : 0

  if (ratio === 1) {
    return {
      level: 'excellent',
      title: 'Отлично! Ты ответил на все вопросы!',
      stars: 5,
      voice: 'Молодец! Ты ответил на все вопросы!',
    }
  }
  if (ratio >= 0.6) {
    return {
      level: 'good',
      title: 'Хорошая работа!',
      stars: 4,
      voice: 'Хорошая работа! Ты справился с большинством вопросов!',
    }
  }
  if (ratio > 0) {
    return {
      level: 'okay',
      title: 'Ты старался!',
      stars: 2,
      voice: 'Ты старался! В следующий раз получится ещё лучше.',
    }
  }
  return {
    level: 'poor',
    title: 'Не расстраивайся, попробуй ещё раз!',
    stars: 1,
    voice: 'Не расстраивайся! Перечитай текст и попробуй снова.',
  }
}
