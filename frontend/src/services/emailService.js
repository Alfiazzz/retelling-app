// Email-сервис: отправка отчёта через бэкенд → Resend API.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Отправляет итоговый отчёт на e-mail
// sessionData: { childName, text, retelling, retellingScore,
//                retellingVerdict, missedPoints, questions, email }
export async function sendReport(sessionData) {
  const res = await fetch(`${API_URL}/api/report/send`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(sessionData),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Ошибка отправки отчёта')
  }
  return res.json()
}

// Валидация e-mail на клиенте
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
