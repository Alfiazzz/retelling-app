import { Router } from 'express'
import { analyzeRetelling, checkAnswer } from '../services/aiService.js'

const router = Router()

// POST /api/ai/analyze-retelling
router.post('/analyze-retelling', async (req, res, next) => {
  try {
    const { originalText, retelling } = req.body
    if (!originalText || !retelling) {
      return res.status(400).json({ message: 'Нужны originalText и retelling' })
    }
    const result = await analyzeRetelling(originalText, retelling)
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// POST /api/ai/check-answer
router.post('/check-answer', async (req, res, next) => {
  try {
    const { question, userAnswer, originalText } = req.body
    if (!question || !userAnswer) {
      return res.status(400).json({ message: 'Нужны question и userAnswer' })
    }
    const result = await checkAnswer(question, userAnswer, originalText ?? '')
    res.json(result)
  } catch (e) {
    next(e)
  }
})

export default router
