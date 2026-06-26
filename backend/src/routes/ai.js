import { Router } from 'express'
import { analyzeRetelling, checkAnswer } from '../services/aiService.js'
import { checkContent, MODERATION_MESSAGE } from '../services/moderationService.js'

const router = Router()

// Лимиты на входные тексты. Помимо защиты от опечаток/мусора, это и
// финансовая защита: originalText/retelling/userAnswer уходят в промпт
// к платному GigaChat API — без верхней границы длины можно было бы
// искусственно раздувать счета за токены или просто перегружать сервер
// мегабайтными запросами (в рамках общего express.json лимита 2mb).
const MAX_TEXT_LEN     = 20000 // originalText / retelling — текст книги/пересказ
const MAX_ANSWER_LEN   = 2000  // userAnswer / question — короткий ответ/вопрос

// Проверяет, что значение — непустая строка в пределах maxLen. Возвращает
// текст ошибки или null, если всё в порядке. Так как req.body может
// содержать что угодно (число, объект, массив, null), важно проверять
// typeof явно — иначе строковые методы (.trim(), .slice() и т.д.) ниже по
// цепочке упадут с 500 на не-строковом значении.
function validateText(value, fieldName, maxLen) {
  if (typeof value !== 'string' || !value.trim()) {
    return `Нужен непустой ${fieldName}`
  }
  if (value.length > maxLen) {
    return `Поле «${fieldName}» слишком длинное (максимум ${maxLen} символов)`
  }
  return null
}

// POST /api/ai/moderate-text
// Мгновенная словарная проверка распознанного (OCR) текста — до похода
// к пересказу. Для OCR-текста (книга) реагируем только на prohibited-контент;
// injection-паттерны в тексте книги не блокируем — там защита через промпт
// GigaChat (ребёнок не вводил этот текст голосом, это распознанная книга).
router.post('/moderate-text', (req, res) => {
  const { text } = req.body
  const err = validateText(text, 'text', MAX_TEXT_LEN)
  if (err) return res.status(400).json({ message: err })

  const result = checkContent(text)
  if (!result.safe && result.type === 'prohibited') {
    return res.json({ blocked: true, blockType: 'prohibited', message: MODERATION_MESSAGE })
  }
  res.json({ blocked: false })
})

// POST /api/ai/analyze-retelling
router.post('/analyze-retelling', async (req, res, next) => {
  try {
    const { originalText, retelling } = req.body
    const err = validateText(originalText, 'originalText', MAX_TEXT_LEN)
      ?? validateText(retelling, 'retelling', MAX_TEXT_LEN)
    if (err) return res.status(400).json({ message: err })

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
    const err = validateText(question, 'question', MAX_ANSWER_LEN)
      ?? validateText(userAnswer, 'userAnswer', MAX_ANSWER_LEN)
      ?? (originalText !== undefined && originalText !== ''
            ? validateText(originalText, 'originalText', MAX_TEXT_LEN) : null)
    if (err) return res.status(400).json({ message: err })

    const result = await checkAnswer(question, userAnswer, originalText ?? '')
    res.json(result)
  } catch (e) {
    next(e)
  }
})

export default router
