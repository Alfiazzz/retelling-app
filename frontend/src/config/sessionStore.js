// Хранилище сессий.
// MVP: в памяти (теряется при перезагрузке).
// При добавлении бэкенда — замени реализацию на API-вызовы, интерфейс не меняй.

const sessions = []

export const sessionStore = {
  add(session) {
    sessions.unshift({
      id:        Date.now(),
      createdAt: new Date().toISOString(),
      ...session,
    })
    // Ограничиваем 100 сессиями в памяти
    if (sessions.length > 100) sessions.pop()
    return sessions[0]
  },

  getAll() {
    return [...sessions]
  },

  getById(id) {
    return sessions.find(s => s.id === id) ?? null
  },

  clear() {
    sessions.length = 0
  },
}
