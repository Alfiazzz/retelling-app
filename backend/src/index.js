import 'dotenv/config'
import express   from 'express'
import cors      from 'cors'
import rateLimit from 'express-rate-limit'
import aiRoutes     from './routes/ai.js'
import reportRoutes from './routes/report.js'
import authRoutes   from './routes/auth.js'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.FRONTEND_URL ?? '*').split(',').map(s => s.trim())
    if (!origin || allowed.includes('*') || allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS: домен не разрешён'))
    }
  },
  methods: ['GET', 'POST'],
}))
app.use(express.json({ limit: '2mb' }))

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Слишком много запросов. Подожди немного.' },
  validate: { xForwardedForHeader: false },
})
app.use('/api', limiter)

app.use('/api/ai',     aiRoutes)
app.use('/api/report', reportRoutes)
app.use('/api/auth',   authRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: err.message ?? 'Внутренняя ошибка сервера' })
})

app.listen(PORT, () => console.log(`✅ Backend запущен на порту ${PORT}`))
