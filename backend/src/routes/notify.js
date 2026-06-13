import { Router } from 'express'

const router = Router()

router.post('/payment', async (req, res) => {
  const { timestamp } = req.body
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
      console.log(`RuSender ответ: ${response.status}`, JSON.stringify(result))
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
