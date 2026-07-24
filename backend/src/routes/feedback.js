import { Router } from 'express'
import rateLimit from 'express-rate-limit'

const router = Router()

const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { ok: true },
  validate: { xForwardedForHeader: false },
})

// POST /api/feedback/send
router.post('/send', feedbackLimiter, async (req, res) => {
  const { rating, title } = req.body
  const r = parseInt(rating)
  if (!r || r < 1 || r > 5) {
    return res.status(400).json({ message: 'Нужна оценка от 1 до 5' })
  }

  const stars = '⭐'.repeat(r) + '☆'.repeat(5 - r)
  const date = new Date().toLocaleString('ru-RU')
  const titleText = title ? `«${title}»` : 'произведение не определено'

  console.log(`Получен отзыв: ${r}/5 (${titleText}) в ${date}`)

  try {
    if (process.env.RUSENDER_API_KEY) {
      const resp = await fetch('https://api.rusender.ru/api/v1/external-mails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.RUSENDER_API_KEY,
        },
        body: JSON.stringify({
          mail: {
            to: { email: '5005404@mail.ru' },
            from: { email: 'noreply@pereskazka-ai.ru', name: 'Пересказка.ai' },
            subject: `⭐ Новый отзыв: ${r}/5 — Пересказка.ai`,
            html: `
              <div style="font-family:Arial,sans-serif;padding:24px;background:#FFF9F0">
                <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
                  <h2 style="color:#FF6B6B;font-size:20px;margin-bottom:12px">⭐ Новый отзыв о сервисе</h2>
                  <div style="background:#FFF3CD;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">
                    <div style="font-size:32px;margin-bottom:4px">${stars}</div>
                    <div style="font-size:20px;font-weight:800;color:#854F0B">${r} из 5</div>
                  </div>
                  <div style="background:#F9F5EE;border-radius:12px;padding:12px;margin-bottom:16px">
                    <p style="margin:0;font-size:13px;color:#374151"><strong>Произведение:</strong> ${titleText}</p>
                    <p style="margin:6px 0 0;font-size:13px;color:#374151"><strong>Дата:</strong> ${date}</p>
                  </div>
                  <p style="color:#8B8FA8;font-size:12px;margin:0">Пересказка.ai</p>
                </div>
              </div>
            `,
          }
        }),
      })
      const result = await resp.json().catch(() => ({}))
      if (resp.ok) {
        console.log('✅ Отзыв отправлен на 5005404@mail.ru')
      } else {
        console.error('❌ Ошибка RuSender при отзыве:', JSON.stringify(result))
      }
    } else {
      console.log('RUSENDER_API_KEY не настроен — отзыв не отправлен')
    }
  } catch (e) {
    console.error('Ошибка отправки отзыва:', e.message)
  }

  res.json({ ok: true })
})

export default router
