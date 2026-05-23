import 'dotenv/config'
import express    from 'express'
import cors       from 'express'
import corsLib    from 'cors'
import rateLimit  from 'express-rate-limit'
import aiRoutes   from './routes/ai.js'
import reportRoutes from './routes/report.js'
import authRoutes from './routes/auth.js'

const app  = express()
const PORT = process.env.PORT ?? 3001

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(corsLib({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  methods: ['GET', 'POST'],
}))
app.use(express.json({ limit: '2mb' }))

// Rate limiting — защита от злоупотреблений
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 минута
  max:      30,           // 30 запросов в минуту с одного IP
  message:  { message: 'Слишком много запросов. Подожди немного.' },
})
app.use('/api', limiter)

// ─── Маршруты ────────────────────────────────────────────────────────────────
app.use('/api/ai',     aiRoutes)
app.use('/api/report', reportRoutes)
app.use('/api/auth',   authRoutes)   // заготовка — пока пустая

app.get('/health', (_req, res) => res.json({ ok: true }))

// ─── Глобальный обработчик ошибок ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: err.message ?? 'Внутренняя ошибка сервера' })
})

app.listen(PORT, () => console.log(`✅ Backend запущен на порту ${PORT}`))
