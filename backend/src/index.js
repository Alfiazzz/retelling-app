import 'dotenv/config'
import express   from 'express'
import cors      from 'cors'
import rateLimit from 'express-rate-limit'
import aiRoutes     from './routes/ai.js'
import reportRoutes from './routes/report.js'
import authRoutes   from './routes/auth.js'
import notifyRoutes from './routes/notify.js'
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
app.use('/api/notify', notifyRoutes)
app.get('/health', (_req, res) => res.json({ ok: true }))

app.use((err, _req, res, _next) => {
  // Полная информация — только в серверный лог. Наружу для непредвиденных
  // (500) ошибок отдаём нейтральное сообщение: технические детали (стек,
  // сырые ответы сторонних API и т.п.) не предназначены для пользователя
  // и не должны попадать в браузер. Ожидаемые ошибки (400 и т.п.) роуты
  // формируют сами через res.status(...).json(...) до того, как долетят сюда.
  console.error(err)
  res.status(500).json({ message: 'Что-то пошло не так. Попробуй ещё раз чуть позже.' })
})

app.listen(PORT, () => console.log(`✅ Backend запущен на порту ${PORT}`))
