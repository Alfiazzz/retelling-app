import { Router } from 'express'

// Заготовка маршрутов авторизации.
// При добавлении регистрации — заполни эти обработчики.
// Рекомендуемые библиотеки: bcrypt (пароли) + jsonwebtoken (JWT) + PocketBase/Supabase (БД).

const router = Router()

// POST /api/auth/register
router.post('/register', (_req, res) => {
  res.status(501).json({ message: 'Регистрация пока не реализована (запланировано)' })
})

// POST /api/auth/login
router.post('/login', (_req, res) => {
  res.status(501).json({ message: 'Авторизация пока не реализована (запланировано)' })
})

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', (_req, res) => {
  // В будущем: верифицировать JWT и вернуть данные пользователя
  res.json({ user: null, plan: 'free' })
})

export default router
