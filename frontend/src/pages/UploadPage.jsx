import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { recognizeMultiplePages, countWords, classifyLength } from '../services/ocrService.js'
import ProgressBar from '../components/ProgressBar.jsx'

export default function UploadPage() {
  const navigate  = useNavigate()
  const fileRef   = useRef(null)

  const [files,    setFiles]    = useState([])
  const [previews, setPreviews] = useState([])
  const [ocr,      setOcr]      = useState(null)
  const [progress, setProgress] = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [editText, setEditText] = useState('')
  const [meta,     setMeta]     = useState({ author: '', title: '' })

  function handleFiles(selected) {
    const arr = Array.from(selected).filter(f => {
      if (f.type.startsWith('image/')) return true
      const ext = f.name.split('.').pop().toLowerCase()
      return ['jpg','jpeg','png'].includes(ext)
    })
    if (!arr.length) {
      setError('Поддерживаются форматы: JPG, PNG')
      return
    }
    setFiles(arr)
    setOcr(null)
    setError('')
    const readers = arr.map(f => new Promise(res => {
      const r = new FileReader()
      r.onload = e => res(e.target.result)
      r.readAsDataURL(f)
    }))
    Promise.all(readers).then(setPreviews)
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
      if (result.confidence < 40) {
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

  function handleContinue() {
    const text      = editText.trim()
    const wordCount = countWords(text)
    const length    = classifyLength(wordCount)
    navigate('/retell', { state: { text, wordCount, length, meta, confidence: ocr?.confidence } })
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
                  <div key={i} className="photo-thumb">
                    <img src={src} alt={`стр ${i+1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                    <span className="photo-badge">с.{i+1}</span>
                  </div>
                ))}
              </div>
              <span className="uz-hint">{files.length} стр. · нажми чтобы изменить</span>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1.5px solid var(--border)', paddingTop: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Автор и название <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(если знаешь)</span>
            </p>
            <input className="input-field" placeholder="Автор произведения"
              value={meta.author} onChange={e => setMeta(m => ({ ...m, author: e.target.value }))} />
            <input className="input-field" placeholder="Название произведения"
              value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} />
          </div>

          <div className="btn-row">
            <button className="btn btn-secondary btn-sm"
              onClick={() => { setOcr(null); setFiles([]); setPreviews([]) }}>
              ← Заново
            </button>
            <button className="btn btn-primary btn-sm"
              onClick={handleContinue} disabled={!editText.trim()}>
              К пересказу →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
