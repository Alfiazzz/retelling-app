import { Router } from 'express'
import { sendReport } from '../services/emailService.js'

const router = Router()

// POST /api/report/send
router.post('/send', async (req, res, next) => {
  try {
    const { email, transcript, retellingScore } = req.body
    if (!email) return res.status(400).json({ message: 'Нужен email' })
    if (!transcript) return res.status(400).json({ message: 'Нет транскрипции пересказа' })

    await sendReport(req.body)
    res.json({ ok: true, message: 'Отчёт отправлен' })
  } catch (e) {
    next(e)
  }
})

export default router
