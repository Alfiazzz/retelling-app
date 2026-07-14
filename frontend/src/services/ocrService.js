import Tesseract from 'tesseract.js'
import { checkLooksRussian } from './languageCheckService.js'

// OCR-сервис на базе Tesseract.js.
// Работает полностью в браузере — без серверных запросов.

// Минимальная уверенность Tesseract для слова чтобы считать его реальным
// текстом, а не мусором с картинки. Слова с confidence ниже этого порога
// (обычно это символы с иллюстраций, декоративных элементов, теней и т.п.)
// исключаются из итогового текста перед отправкой в GigaChat.
// Порог 40 подобран эмпирически: нормальный текст книги обычно 70-99,
// мусор с картинок обычно 0-30. Порог 40 даёт запас в обе стороны.
const WORD_CONFIDENCE_THRESHOLD = 40

export async function recognizeText(imageFile, onProgress) {
  const result = await Tesseract.recognize(imageFile, 'rus', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })

  // Вариант В: фильтрация мусора с картинок в два шага.
  //
  // Шаг 1 — фильтрация по confidence отдельных слов.
  // Tesseract возвращает confidence для каждого слова — это его собственная
  // оценка насколько уверенно он распознал символы. Слова с низким confidence
  // (< WORD_CONFIDENCE_THRESHOLD) — это чаще всего мусор с иллюстраций,
  // а не реальный текст. Фильтруем их и собираем чистый текст из оставшихся.
  //
  // Шаг 2 — удаление пустых строк.
  // После удаления мусорных слов некоторые строки становятся пустыми
  // (строка состояла только из мусора — например, строка с картинкой).
  // Убираем такие строки чтобы не засорять текст лишними пробелами.

  const words = result.data.words ?? []

  if (words.length === 0) {
    // Если Tesseract не вернул слова — используем сырой текст как раньше
    return {
      text:       result.data.text.trim(),
      confidence: result.data.confidence,
    }
  }

  // Шаг 1: оставляем только слова с достаточной уверенностью.
  // Исключение — буквица (drop cap): крупная декоративная первая буква абзаца.
  // Tesseract распознаёт её как отдельный символ с низким confidence из-за
  // нестандартного шрифта и размера, хотя это реальная буква текста.
  // Признаки буквицы: одна заглавная буква, а следующее слово начинается
  // со строчной (продолжение того же слова: "Ж" + "ил-был" = "Жил-был").
  function isDropCap(word, nextWord) {
    if (!word || !nextWord) return false
    const isOneLetter = word.text.length === 1
    const isUpperCase = word.text === word.text.toUpperCase() && /[А-ЯЁA-Z]/.test(word.text)
    const nextStartsLower = nextWord.text.length > 0 &&
      nextWord.text[0] === nextWord.text[0].toLowerCase()
    return isOneLetter && isUpperCase && nextStartsLower
  }

  const cleanWords = words.filter((w, i) => {
    if (w.confidence >= WORD_CONFIDENCE_THRESHOLD) return true
    // Низкий confidence — проверяем не буквица ли это
    return isDropCap(w, words[i + 1])
  })

  // Восстанавливаем текст построчно, сохраняя структуру абзацев.
  // Буквицу склеиваем с остатком слова без пробела.
  // Каждое слово от Tesseract знает свою позицию (bbox), по ней определяем
  // переносы строк: если следующее слово стоит значительно ниже предыдущего
  // — это новая строка.
  let cleanText = ''
  let prevBottom = null
  for (let i = 0; i < cleanWords.length; i++) {
    const word = cleanWords[i]
    const prevWord = cleanWords[i - 1]
    const top = word.bbox?.y0 ?? 0
    const bottom = word.bbox?.y1 ?? 0
    const height = bottom - top

    // Если предыдущее слово было буквицей — склеиваем без пробела
    const prevWasDropCap = prevWord &&
      prevWord.text.length === 1 &&
      /[А-ЯЁA-Z]/.test(prevWord.text) &&
      prevWord.confidence < WORD_CONFIDENCE_THRESHOLD

    if (prevWasDropCap) {
      cleanText += word.text
    } else if (prevBottom !== null && top > prevBottom + height * 0.5) {
      cleanText += '\n' + word.text
    } else if (cleanText.length > 0) {
      cleanText += ' ' + word.text
    } else {
      cleanText += word.text
    }
    prevBottom = bottom
  }

  // Шаг 2: убираем пустые строки (остались от строк с картинками)
  const filteredText = cleanText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')

  return {
    text:       filteredText,
    confidence: result.data.confidence,
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
