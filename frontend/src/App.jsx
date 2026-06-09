import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './config/userContext.jsx'
import UploadPage from './pages/UploadPage.jsx'
import RetellPage from './pages/RetellPage.jsx'
import ResultPage from './pages/ResultPage.jsx'
import Header     from './components/Header.jsx'
// Новый дизайн подключается через src/styles/index.css

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <div className="app-container">
          <Header />
          <Routes>
            <Route path="/"       element={<UploadPage />} />
            <Route path="/retell" element={<RetellPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="*"       element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </UserProvider>
  )
}
