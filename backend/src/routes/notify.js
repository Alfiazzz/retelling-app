import { Router } from 'express'
import rateLimit from 'express-rate-limit'

const router = Router()

// Этот роут реально отправляет письмо через RuSender при каждом вызове —
// в отличие от остальных роутов, он не защищён ничем, кроме общего
// лимита 30/мин на весь /api. Каждый вызов стоит реальных денег/квоты
// стороннего сервиса и шлёт письмо на личный адрес владельца, поэтому
// здесь нужен отдельный, более жёсткий лимит — иначе это лёгкий вектор
// для спама почты владельца и исчерпания квоты RuSender.
const paymentNotifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { ok: true }, // отвечаем как обычно — фронту не нужно знать о лимите
  validate: { xForwardedForHeader: false },
})

router.post('/payment', paymentNotifyLimiter, async (req, res) => {
  // Время фиксируем на сервере, а не берём из тела запроса: клиентский
  // timestamp — не только ненадёжный источник времени (его можно подделать),
  // но и был бы пользовательским вводом, вставляемым в HTML письма без
  // экранирования. Используя серверное время, убираем этот вектор целиком,
  // а не просто экранируем его.
  const timestamp = new Date().toISOString()
  console.log(`Пользователь нажал "Оплатить" в ${timestamp}`)

  try {
    if (process.env.RUSENDER_API_KEY) {
      const response = await fetch('https://api.rusender.ru/api/v1/external-mails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.RUSENDER_API_KEY,
        },
        body: JSON.stringify({
          mail: {
            to: { email: '5005404@mail.ru' },
            from: {
              email: 'noreply@pereskazka-ai.ru',
              name: 'Пересказка.ai',
            },
            subject: '💳 Новый пользователь нажал "Оплатить"',
            html: `
              <div style="font-family:Arial,sans-serif;padding:24px;background:#FFF9F0">
                <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
                  <h2 style="color:#FF6B6B;font-size:20px;margin-bottom:12px">
                    💳 Кто-то нажал "Оплатить"!
                  </h2>
                  <p style="color:#374151;font-size:14px;line-height:1.6;margin-bottom:16px">
                    Пользователь дошёл до экрана оплаты и нажал кнопку.
                  </p>
                  <div style="background:#FFF3CD;border-radius:12px;padding:12px 16px;margin-bottom:16px">
                    <p style="margin:0;font-size:13px;color:#854F0B">
                      <strong>Время:</strong> ${new Date(timestamp).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <p style="color:#8B8FA8;font-size:12px">Пересказка.ai</p>
                </div>
              </div>
            `,
          }
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.ok) {
        console.log('✅ Уведомление отправлено на 5005404@mail.ru')
      } else {
        console.log('❌ Ошибка RuSender:', JSON.stringify(result))
      }
    } else {
      console.log('RUSENDER_API_KEY не настроен — уведомление не отправлено')
    }
  } catch (e) {
    console.log('Ошибка отправки уведомления:', e.message)
  }

  res.json({ ok: true })
})

export default router
