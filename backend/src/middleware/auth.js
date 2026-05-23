// Middleware авторизации — заглушка.
// При добавлении JWT: раскомментируй и заполни логику.

export function requireAuth(req, res, next) {
  // TODO: верифицировать JWT из заголовка Authorization
  // const token = req.headers.authorization?.split(' ')[1]
  // if (!token) return res.status(401).json({ message: 'Не авторизован' })
  // try {
  //   req.user = jwt.verify(token, process.env.JWT_SECRET)
  //   next()
  // } catch {
  //   res.status(401).json({ message: 'Недействительный токен' })
  // }

  // MVP: пропускаем всех
  req.user = { id: null, role: 'guest', plan: 'free' }
  next()
}

export function requirePlan(minPlan) {
  const PLAN_RANK = { free: 0, family: 1, teacher: 2 }
  return (req, res, next) => {
    const userRank = PLAN_RANK[req.user?.plan ?? 'free'] ?? 0
    const reqRank  = PLAN_RANK[minPlan] ?? 0
    if (userRank < reqRank) {
      return res.status(403).json({
        message: `Эта функция доступна на тарифе "${minPlan}". Обнови план.`
      })
    }
    next()
  }
}
