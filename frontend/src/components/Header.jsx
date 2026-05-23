import { Link, useNavigate, useLocation } from 'react-router-dom'

export default function Header() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const isHome    = location.pathname === '/'

  return (
    <header className="bg-white border-b border-sky-100 shadow-sm">
      <div className="container mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl">📖</span>
          <span className="font-extrabold text-lg text-primary-600">Пересказ</span>
        </Link>

        {!isHome && (
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-primary-600 transition-colors flex items-center gap-1"
          >
            ← Начать заново
          </button>
        )}
      </div>
    </header>
  )
}
