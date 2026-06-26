// Email через RuSender API (HTTP — работает с Render)

const RUSENDER_API_URL = 'https://api.rusender.ru/api/v1/external-mails/send'

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

// Все текстовые поля в письме (имя ребёнка, название, автор, транскрипция,
// вопросы/ответы) приходят от пользователя и вставляются в HTML-шаблон
// через интерполяцию строк — без экранирования это stored XSS: например,
// childName вида "<img src=x onerror=...>" попало бы в письмо как есть.
// Экранируем все 5 спецсимволов HTML перед подстановкой.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHtml(data) {
  const { childName, transcript, analysis,
    retellingScore, retellingVerdict, missedPoints, questions, createdAt } = data
  // Автор и название берём из analysis (извлечены GigaChat из текста),
  // а не из ручного ввода пользователя — поля на экране загрузки убраны.
  const author = escapeHtml(analysis?.author ?? 'Неизвестно')
  const title  = escapeHtml(analysis?.title  ?? 'Неизвестно')
  const date = new Date(createdAt).toLocaleString('ru-RU')
  const missedHtml = missedPoints?.length
    ? `<ul style="margin:8px 0;padding-left:20px">${missedPoints.map(m => `<li style="margin-bottom:4px">${escapeHtml(m)}</li>`).join('')}</ul>`
    : '<p style="color:#6b7280">Ничего не пропущено 🎉</p>'
  const questionsHtml = questions?.map((q, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${i+1}. ${escapeHtml(q.question)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${escapeHtml(q.userAnswer)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${RESULT_LABELS[q.result] ?? escapeHtml(q.result)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${q.correctAnswer ? escapeHtml(q.correctAnswer) : '—'}</td>
    </tr>`).join('') ?? ''

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f0f9ff;padding:20px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#FF6B6B,#FF922B);padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:22px">📖 Отчёт о пересказе — <a href="https://pereskazka-ai.ru" target="_blank" rel="noopener noreferrer" style="color:#fff;text-decoration:underline;">Пересказка-ai.ru</a></h1>
    <p style="margin:4px 0 0;color:#FFE8D6;font-size:14px">${date}</p>
  </div>
  <div style="padding:24px 32px">
    <div style="background:#FFF9F0;border-radius:12px;padding:16px;margin-bottom:20px">
      <p style="margin:0 0 6px;color:#374151"><strong>Ученик:</strong> ${escapeHtml(childName) || '—'}</p>
      <p style="margin:0 0 6px;color:#374151"><strong>Произведение:</strong> ${title}</p>
      <p style="margin:0;color:#374151"><strong>Автор:</strong> ${author}</p>
    </div>
    <h2 style="font-size:16px;color:#FF6B6B;margin:0 0 12px">Результат пересказа</h2>
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div style="flex:1;background:#FFF3CD;border-radius:12px;padding:12px;text-align:center">
        <p style="margin:0;font-size:28px;font-weight:800;color:#E8A000">${Number(retellingScore) || 0}%</p>
        <p style="margin:4px 0 0;font-size:12px;color:#854F0B">полнота</p>
      </div>
      <div style="flex:2;background:#FFF9F0;border-radius:12px;padding:12px">
        <p style="margin:0;font-size:14px;font-weight:700;color:#FF6B6B">${VERDICT_LABELS[retellingVerdict] ?? escapeHtml(retellingVerdict)}</p>
        ${missedPoints?.length ? `<p style="margin:6px 0 4px;font-size:12px;color:#374151">Не упомянуто:</p>${missedHtml}` : ''}
      </div>
    </div>
    <h2 style="font-size:16px;color:#FF6B6B;margin:0 0 12px">Ответы на вопросы</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead><tr style="background:#FFF3CD">
        <th style="padding:8px 12px;text-align:left;color:#854F0B">Вопрос</th>
        <th style="padding:8px 12px;text-align:left;color:#854F0B">Ответ</th>
        <th style="padding:8px 12px;text-align:left;color:#854F0B">Результат</th>
        <th style="padding:8px 12px;text-align:left;color:#854F0B">Правильный ответ</th>
      </tr></thead>
      <tbody>${questionsHtml}</tbody>
    </table>
    <h2 style="font-size:16px;color:#FF6B6B;margin:0 0 8px">Транскрипция пересказа</h2>
    <p style="background:#F9F5EE;padding:12px;border-radius:8px;font-size:13px;line-height:1.6;color:#374151">${escapeHtml(transcript) || '—'}</p>
  </div>
  <div style="background:#FFF9F0;padding:16px 32px;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af"><a href="https://pereskazka-ai.ru" target="_blank" rel="noopener noreferrer" style="color:#9ca3af;text-decoration:underline;">Пересказка-ai.ru</a> — сервис проверки пересказа текста</p>
  </div>
</div>
</body></html>`
}

// Тема письма у RuSender ограничена 255 символами. Это вторая линия защиты
// поверх валидации в routes/report.js — даже если туда попадёт что-то
// неожиданно длинное (новое поле, обход валидации и т.п.), тема всё равно
// не отправится сломанной.
const MAX_SUBJECT_LEN = 255

function clampSubject(subject) {
  if (subject.length <= MAX_SUBJECT_LEN) return subject
  return subject.slice(0, MAX_SUBJECT_LEN - 1) + '…'
}

export async function sendReport(data) {
  if (!process.env.RUSENDER_API_KEY) {
    console.log('RUSENDER_API_KEY не настроен — письмо не отправлено')
    return
  }

  const { email, childName } = data
  const title = data.analysis?.title ?? null
  const subject = clampSubject(
    `Отчёт о пересказе${title ? ` — «${title}»` : ''}${childName ? ` (${childName})` : ''}`
  )

  console.log(`Отправляю письмо через RuSender на ${email}...`)

  const res = await fetch(RUSENDER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.RUSENDER_API_KEY,
    },
    body: JSON.stringify({
      mail: {
        to: { email },
        from: {
          email: `noreply@pereskazka-ai.ru`,
          name: 'Пересказка-ai',
        },
        subject,
        html: buildHtml(data),
      }
    }),
  })

  const result = await res.json().catch(() => ({}))

  if (!res.ok) {
    // Подробности — только в серверный лог. Наружу (через throw) уходит
    // нейтральное сообщение без деталей стороннего API: пользователю эти
    // детали не нужны и не должны быть видны, это внутренняя техническая
    // информация о чужом сервисе.
    console.error(`RuSender error: ${res.status}`, JSON.stringify(result))
    throw new Error('Не удалось отправить письмо. Попробуй ещё раз чуть позже.')
  }

  console.log(`✅ Письмо отправлено на ${email}`)
}
