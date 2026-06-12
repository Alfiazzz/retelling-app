import { Router } from 'express'
    import nodemailer from 'nodemailer'

const router = Router()

// POST /api/notify/payment — уведомление о нажатии кнопки оплаты
    router.post('/payment', async (req, res) => {
      const { timestamp } = req.body
      console.log(`Пользователь нажал "Оплатить" в ${timestamp}`)

  try {
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          const transporter = nodemailer.createTransport({
            host: 'mail.pereskazka-ai.ru',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          })
          await transporter.sendMail({
            from: `"Пересказка.ai" <${process.env.SMTP_USER}>`,
            to:   '5005404@mail.ru',
            subject: '💳 Новый пользователь нажал "Оплатить"',
            html: `
              <div style="font-family:Arial,sans-serif;padding:20px">
                <h2>Кто-то нажал кнопку "Оплатить"!</h2>
                <p><strong>Время:</strong> ${new Date(timestamp).toLocaleString('ru-RU')}</p>
                <p>Пользователь увидел экран оплаты и нажал кнопку. Возможно стоит связаться с ним.</p>
              </div>
            `,
          })
          console.log('Уведомление отправлено на 5005404@mail.ru')
        }
      } catch (e) {
        console.log('Ошибка отправки уведомления:', e.message)
      }

  res.json({ ok: true })
    })

export default router
