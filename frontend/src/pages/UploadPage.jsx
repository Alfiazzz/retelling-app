import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { recognizeMultiplePages, countWords, classifyLength } from '../services/ocrService.js'
import { moderateText } from '../services/aiService.js'
import ProgressBar from '../components/ProgressBar.jsx'

export default function UploadPage() {
  const navigate  = useNavigate()
  const fileRef   = useRef(null)

  const [files,      setFiles]      = useState([])
  const [previews,   setPreviews]   = useState([])
  const [ocr,        setOcr]        = useState(null)
  const [progress,   setProgress]   = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [moderating, setModerating] = useState(false)
  const [error,      setError]      = useState('')
  const [editText,   setEditText]   = useState('')

  const MAX_FILES    = 10
  const MAX_FILE_MB  = 10
  const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024

  function handleFiles(selected) {
    const allSelected = Array.from(selected)
    const byType = allSelected.filter(f => {
      if (f.type.startsWith('image/')) return true
      const ext = f.name.split('.').pop().toLowerCase()
      return ['jpg','jpeg','png'].includes(ext)
    })
    if (!byType.length) {
      setError('Поддерживаются форматы: JPG, PNG')
      return
    }

    const tooLarge = byType.filter(f => f.size > MAX_FILE_SIZE)
    const byTypeAndSize = byType.filter(f => f.size <= MAX_FILE_SIZE)

    // Дописываем к уже добавленным файлам, а не заменяем их.
    // Дубликаты исключаем по имени + размеру — если ребёнок случайно выбрал
    // то же фото второй раз, оно не добавится дважды.
    setFiles(prev => {
      const existingKeys = new Set(prev.map(f => `${f.name}:${f.size}`))
      const newUnique = byTypeAndSize.filter(f => !existingKeys.has(`${f.name}:${f.size}`))
      const combined = [...prev, ...newUnique]
      const limited = combined.slice(0, MAX_FILES)
      const droppedByLimit = combined.length - limited.length

      const warnings = []
      if (tooLarge.length) warnings.push(`Пропущено файлов слишком большого размера (>${MAX_FILE_MB} МБ): ${tooLarge.length}`)
      if (droppedByLimit > 0) warnings.push(`Максимум ${MAX_FILES} файлов, остальные не учтены`)
      if (warnings.length) setError(warnings.join('. '))
      else setError('')

      // Генерируем превью только для новых файлов и дописываем к старым
      const newFilesForPreview = limited.slice(prev.length)
      if (newFilesForPreview.length > 0) {
        const readers = newFilesForPreview.map(f => new Promise(res => {
          const r = new FileReader()
          r.onload = e => res(e.target.result)
          r.readAsDataURL(f)
        }))
        Promise.all(readers).then(newPreviews => {
          setPreviews(p => [...p, ...newPreviews])
        })
      }

      setOcr(null)
      return limited
    })

    // Сбрасываем input чтобы можно было выбрать тот же файл снова
    if (fileRef.current) fileRef.current.value = ''
  }

  // Удаление конкретного фото по индексу
  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
    setOcr(null)
    setError('')
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  async function runOCR() {
    setLoading(true)
    setError('')
    setProgress(0)
    try {
      const result = await recognizeMultiplePages(files, setProgress)
      if (!result.looksRussian) {
        // Конкретная причина важнее общего "качество фото низкое" — текст
        // мог распознаться технически нормально, просто не на том языке,
        // под который настроен OCR (Tesseract здесь работает только с 'rus').
        setError('Похоже, текст не на русском языке. Сервис распознаёт и проверяет тексты только на русском.')
      } else if (result.confidence < 40) {
        setError('Качество фото низкое. Попробуй переснять — лучше освещение, ровнее держи камеру.')
      }
      setOcr(result)
      setEditText(result.text)
    } catch (e) {
      setError('Не удалось распознать текст: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleContinue() {
    const text      = editText.trim()
    const wordCount = countWords(text)
    const length    = classifyLength(wordCount)

    setModerating(true)
    setError('')
    try {
      const result = await moderateText(text)
      if (result.blocked) {
        setError(result.message)
        return
      }
      navigate('/retell', { state: { text, wordCount, length, confidence: ocr?.confidence } })
    } catch (e) {
      setError('Не удалось проверить текст: ' + e.message)
    } finally {
      setModerating(false)
    }
  }

  const wordCount = editText ? countWords(editText) : 0

  return (
    <div className="page-content">

      {/* Hero */}
      <div className="hero-block">
        <div className="hero-emoji-wrap upload">📷</div>
        <h1>Загрузи текст</h1>
        <p>Сфотографируй страницу из книги или учебника</p>
      </div>

      {/* Зона загрузки */}
      {!ocr && (
        <div
          className="upload-zone"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          {files.length === 0 ? (
            <>
              <span className="uz-icon">📸</span>
              <p className="uz-title">Нажми или перетащи фото</p>
              <span className="uz-hint">JPG, PNG · можно несколько страниц</span>
            </>
          ) : (
            <>
              <div className="photo-row" style={{ justifyContent: 'center', marginBottom: 10 }}>
                {previews.map((src, i) => (
                  <div key={i} className="photo-thumb" style={{ position: 'relative' }}>
                    <img src={src} alt={`стр ${i+1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                    <span className="photo-badge">с.{i+1}</span>
                    <button
                      className="photo-remove-btn"
                      onClick={e => { e.stopPropagation(); removeFile(i) }}
                      aria-label={`Удалить страницу ${i+1}`}
                    >✕</button>
                  </div>
                ))}
              </div>
              <span className="uz-hint">{files.length} стр.</span>
            </>
          )}
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="error-box">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Прогресс OCR */}
      {loading && (
        <div className="card">
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
            Распознаю текст...
          </p>
          <ProgressBar value={progress} label="Прогресс" />
        </div>
      )}

      {/* Кнопка добавить ещё страницу */}
      {files.length > 0 && !ocr && !loading && files.length < MAX_FILES && (
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginTop: -4 }}
          onClick={() => fileRef.current?.click()}
        >
          + Добавить ещё страницу
        </button>
      )}

      {/* Кнопка OCR */}
      {files.length > 0 && !ocr && !loading && (
        <button className="btn btn-primary" onClick={runOCR}>
          Распознать текст →
        </button>
      )}

      {/* Результат OCR */}
      {ocr && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="card-label">Распознанный текст</span>
            <span style={{
              fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
              background: ocr.confidence >= 70 ? 'var(--green-soft)' : 'var(--orange-soft)',
              color: ocr.confidence >= 70 ? 'var(--green)' : 'var(--orange)',
            }}>
              {ocr.confidence}%
            </span>
          </div>

          <textarea
            className="text-area"
            rows={9}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            placeholder="Текст не распознан..."
          />

          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            {wordCount} слов · {ocr.pages > 1 ? `${ocr.pages} страниц` : '1 страница'} · можно исправить вручную
          </p>

          <div className="btn-row">
            <button className="btn btn-secondary btn-sm"
              onClick={() => { setOcr(null); setFiles([]); setPreviews([]) }}>
              ← Заново
            </button>
            <button className="btn btn-primary btn-sm"
              onClick={handleContinue} disabled={!editText.trim() || moderating}>
              {moderating ? 'Проверяю...' : 'К пересказу →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
