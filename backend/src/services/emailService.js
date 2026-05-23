import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const VERDICT_LABELS = {
  good:    '✅ Отлично',
  partial: '⚠️ Есть недочёты',
  poor:    '🔁 Нужно попробовать ещё раз',
}

const RESULT_LABELS = {
  correct: '✅ Верно',
  partial: '🟡 Частично верно',
  wrong:   '❌ Неверно',
}

function buildHtml(data) {
  const {
    childName, author, title, transcript,
    retellingScore, retellingVerdict, missedPoints, questions, createdAt,
  } = data

  const date = new Date(createdAt).toLocaleString('ru-RU')

  const missedHtml = missedPoints?.length
    ? `<ul style="margin:8px 0;padding-left:20px">${missedPoints.map(m => `<li>${m}</li>`).join('')}</ul>`
    : '<p style="color:#6b7280">Ничего не пропущено 🎉</p>'

  const questionsHtml = questions?.map((q, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${i + 1}. ${q.question}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${q.userAnswer}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${RESULT_LABELS[q.result] ?? q.result}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${q.correctAnswer ?? '—'}</td>
    </tr>
  `).join('') ?? ''

  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:Nunito,Arial,sans-serif;background:#f0f9ff;margin:0;padding:20px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

    <!-- Шапка -->
    <div style="background:#0ea5e9;padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px">📖 Отчёт о пересказе</h1>
      <p style="margin:4px 0 0;color:#bae6fd;font-size:14px">${date}</p>
    </div>

    <div style="padding:24px 32px">

      <!-- Ребёнок и произведение -->
      <div style="background:#f0f9ff;border-radius:12px;padding:16px;margin-bottom:20px">
        <p style="margin:0 0 6px;color:#374151"><strong>Ученик:</strong> ${childName}</p>
        <p style="margin:0 0 6px;color:#374151"><strong>Произведение:</strong> ${title}</p>
        <p style="margin:0;color:#374151"><strong>Автор:</strong> ${author}</p>
      </div>

      <!-- Результат пересказа -->
      <h2 style="font-size:16px;color:#1e40af;margin:0 0 12px">Пересказ</h2>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1;background:#eff6ff;border-radius:12px;padding:12px;text-align:center">
          <p style="margin:0;font-size:28px;font-weight:800;color:#2563eb">${retellingScore}%</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280">полнота</p>
        </div>
        <div style="flex:2;background:#eff6ff;border-radius:12px;padding:12px">
          <p style="margin:0;font-size:14px;font-weight:700;color:#1e40af">${VERDICT_LABELS[retellingVerdict] ?? retellingVerdict}</p>
          ${missedPoints?.length ? `<p style="margin:6px 0 4px;font-size:12px;color:#374151">Не упомянуто:</p>${missedHtml}` : ''}
        </div>
      </div>

      <!-- Транскрипция -->
      <details style="margin-bottom:20px">
        <summary style="cursor:pointer;font-size:14px;font-weight:600;color:#374151;padding:8px 0">
          📝 Транскрипция пересказа
        </summary>
        <div style="background:#f9fafb;border-radius:8px;padding:12px;margin-top:8px;font-size:13px;color:#4b5563;line-height:1.6">
          ${transcript ?? '—'}
        </div>
      </details>

      <!-- Вопросы -->
      <h2 style="font-size:16px;color:#1e40af;margin:0 0 12px">Ответы на вопросы</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        <thead>
          <tr style="background:#f0f9ff">
            <th style="padding:8px 12px;text-align:left;color:#374151">Вопрос</th>
            <th style="padding:8px 12px;text-align:left;color:#374151">Ответ</th>
            <th style="padding:8px 12px;text-align:left;color:#374151">Результат</th>
            <th style="padding:8px 12px;text-align:left;color:#374151">Правильный ответ</th>
          </tr>
        </thead>
        <tbody>${questionsHtml}</tbody>
      </table>

    </div>

    <!-- Подвал -->
    <div style="background:#f0f9ff;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Отчёт создан сервисом <strong>Пересказ</strong>
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendReport(data) {
  const { email, childName, title } = data
  const subject = `Отчёт о пересказе${title !== '—' ? ` — «${title}»` : ''}${childName ? ` (${childName})` : ''}`

  await resend.emails.send({
    from:    process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
    to:      email,
    subject,
    html:    buildHtml(data),
  })
}
