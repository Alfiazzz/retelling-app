import { Router } from 'express'
import { sendReport } from '../services/emailService.js'

const router = Router()

// Та же логика, что и на фронте (frontend/src/services/emailService.js) —
// дублируем здесь, потому что фронтовая валидация не защита: запрос на этот
// роут можно отправить и напрямую, минуя интерфейс.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// author/title больше не приходят из пользовательского ввода — они
// извлекаются GigaChat из originalText в поле analysis. Поэтому валидировать
// их как "поля формы" не нужно: clampSubject в emailService.js защищает от
// слишком длинной темы даже если GigaChat вернёт что-то неожиданное.
const MAX_NAME_LEN       = 100
const MAX_TRANSCRIPT_LEN = 20000

// POST /api/report/send
router.post('/send', async (req, res, next) => {
  try {
    const { email, transcript, childName } = req.body

    if (!email) return res.status(400).json({ message: 'Нужен email' })
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Некорректный e-mail' })
    if (!transcript) return res.status(400).json({ message: 'Нет транскрипции пересказа' })

    if (transcript.length > MAX_TRANSCRIPT_LEN) {
      return res.status(400).json({ message: 'Слишком длинный пересказ' })
    }
    if (typeof childName === 'string' && childName.length > MAX_NAME_LEN) {
      return res.status(400).json({ message: 'Поле «childName» слишком длинное' })
    }

    await sendReport(req.body)
    res.json({ ok: true, message: 'Отчёт отправлен' })
  } catch (e) {
    next(e)
  }
})

export default router
