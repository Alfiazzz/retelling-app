import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './config/userContext.jsx'
import UploadPage  from './pages/UploadPage.jsx'
import RetellPage  from './pages/RetellPage.jsx'
import ResultPage  from './pages/ResultPage.jsx'
import Header      from './components/Header.jsx'

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 container mx-auto max-w-2xl px-4 py-6">
            <Routes>
              <Route path="/"        element={<UploadPage />} />
              <Route path="/retell"  element={<RetellPage />} />
              <Route path="/result"  element={<ResultPage />} />
              <Route path="*"        element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </UserProvider>
  )
}
