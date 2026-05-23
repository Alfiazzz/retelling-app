import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { recognizeMultiplePages, countWords, classifyLength } from '../services/ocrService.js'
import ProgressBar from '../components/ProgressBar.jsx'

export default function UploadPage() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [files,    setFiles]    = useState([])      // File[]
  const [previews, setPreviews] = useState([])      // base64 превью
  const [ocr,      setOcr]      = useState(null)    // { text, confidence, pages }
  const [progress, setProgress] = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [editText, setEditText] = useState('')
  const [meta,     setMeta]     = useState({ author: '', title: '' })

  function handleFiles(selected) {
    const arr = Array.from(selected).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (!arr.length) return
    setFiles(arr)
    setOcr(null)
    setError('')
    // Генерируем превью
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
        setError('Качество распознавания низкое. Попробуй переснять — лучше освещение, ровнее держи камеру.')
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
    navigate('/retell', {
      state: { text, wordCount, length, meta, confidence: ocr?.confidence }
    })
  }

  const wordCount = editText ? countWords(editText) : 0

  return (
    <div className="space-y-5">
      <div className="text-center pt-2">
        <h1 className="text-2xl font-extrabold text-gray-800">📖 Загрузи текст</h1>
        <p className="text-gray-500 text-sm mt-1">Сфотографируй страницу из книги или учебника</p>
      </div>

      {/* Зона загрузки */}
      {!ocr && (
        <div
          className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-colors
            ${files.length ? 'border-primary-400 bg-sky-50' : 'border-sky-200 hover:border-primary-400 hover:bg-sky-50'}`}
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          {files.length === 0 ? (
            <>
              <div className="text-5xl mb-3">📷</div>
              <p className="font-semibold text-gray-700">Нажми или перетащи фото</p>
              <p className="text-sm text-gray-400 mt-1">JPG, PNG, PDF · можно несколько страниц</p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt={`стр ${i+1}`}
                    className="h-24 w-auto rounded-xl border border-sky-200 object-cover shadow-sm" />
                ))}
              </div>
              <p className="text-sm text-primary-600 font-medium">
                {files.length} {files.length === 1 ? 'страница' : 'страниц(ы)'} · нажми чтобы изменить
              </p>
            </>
          )}
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Прогресс OCR */}
      {loading && (
        <div className="card">
          <p className="text-sm text-gray-600 mb-3 font-medium">Распознаю текст...</p>
          <ProgressBar value={progress} label="Прогресс" />
        </div>
      )}

      {/* Кнопка запуска OCR */}
      {files.length > 0 && !ocr && !loading && (
        <button className="btn-primary w-full" onClick={runOCR}>
          Распознать текст →
        </button>
      )}

      {/* Результат OCR + редактор */}
      {ocr && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Распознанный текст</h2>
            <span className={`text-xs px-2 py-1 rounded-full font-medium
              ${ocr.confidence >= 70 ? 'bg-green-100 text-green-700' :
                ocr.confidence >= 40 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'}`}>
              Точность: {ocr.confidence}%
            </span>
          </div>

          <textarea
            className="input-field resize-none text-sm leading-relaxed"
            rows={10}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            placeholder="Текст не распознан..."
          />

          <p className="text-xs text-gray-400">
            {wordCount} слов · {ocr.pages > 1 ? `${ocr.pages} страниц` : '1 страница'} · 
            можешь исправить ошибки вручную
          </p>

          {/* Метаданные */}
          <div className="border-t border-sky-100 pt-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              Автор и название <span className="text-gray-400 font-normal">(если знаешь)</span>
            </p>
            <input
              className="input-field"
              placeholder="Автор произведения"
              value={meta.author}
              onChange={e => setMeta(m => ({ ...m, author: e.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Название произведения"
              value={meta.title}
              onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
            />
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1 text-sm" onClick={() => { setOcr(null); setFiles([]); setPreviews([]) }}>
              ← Загрузить заново
            </button>
            <button className="btn-primary flex-1 text-sm" onClick={handleContinue} disabled={!editText.trim()}>
              Перейти к пересказу →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
