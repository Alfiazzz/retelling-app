import { useNavigate, useLocation } from 'react-router-dom'

const STEPS = [
  { path: '/',       label: 'Текст',    num: 1 },
  { path: '/retell', label: 'Пересказ', num: 2 },
  { path: '/result', label: 'Вопросы',  num: 3 },
  { path: '/report', label: 'Отчёт',    num: 4 },
]

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentIndex = STEPS.findIndex(s => s.path === location.pathname)

  return (
    <header>
      <div className="app-header">
        <a className="logo" href="/" onClick={e => { e.preventDefault(); navigate('/') }}>
          <div className="logo-icon">📖</div>
          <span>
            <span className="logo-text-main">Пересказка</span>
            <span className="logo-text-dot">-</span>
            <span className="logo-text-ai">ai</span>
          </span>
        </a>

        {currentIndex > 0 && (
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Назад
          </button>
        )}
      </div>

      {currentIndex >= 0 && (
        <div className="step-bar">
          {STEPS.map((step, i) => {
            const status = i < currentIndex ? 'done' : i === currentIndex ? 'active' : ''
            return (
              <div key={step.path} className={`step-item ${status}`}>
                <div className="step-circle">
                  {i < currentIndex ? '✓' : step.num}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </header>
  )
}
