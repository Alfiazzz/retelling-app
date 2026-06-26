import Tesseract from 'tesseract.js'
import { checkLooksRussian } from './languageCheckService.js'

// OCR-сервис на базе Tesseract.js.
// Работает полностью в браузере — без серверных запросов.

export async function recognizeText(imageFile, onProgress) {
  const result = await Tesseract.recognize(imageFile, 'rus', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  return {
    text:       result.data.text.trim(),
    confidence: result.data.confidence,  // 0–100
  }
}

// Распознать несколько страниц и объединить
export async function recognizeMultiplePages(files, onProgress) {
  const results = []
  for (let i = 0; i < files.length; i++) {
    const pageResult = await recognizeText(files[i], (p) => {
      if (onProgress) onProgress(Math.round((i / files.length) * 100 + p / files.length))
    })
    results.push(pageResult)
  }
  const text = results.map(r => r.text).join('\n\n')
  // Проверка языка — над уже готовым текстом, без дополнительного времени
  // ожидания: OCR-распознавание (Tesseract настроен только на 'rus') и так
  // уже отработало, мы просто иначе интерпретируем то, что получили.
  const { looksRussian } = checkLooksRussian(text)
  return {
    text,
    confidence: Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length),
    pages:      results.length,
    looksRussian,
  }
}

// Подсчёт слов
export function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// Категория объёма текста
export function classifyLength(wordCount) {
  if (wordCount <= 300) return { label: 'короткий', maxRecordMin: 3 }
  if (wordCount <= 800) return { label: 'средний',  maxRecordMin: 7 }
  return                       { label: 'длинный',  maxRecordMin: 15 }
}
