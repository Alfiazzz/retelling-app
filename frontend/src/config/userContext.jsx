import { createContext, useContext, useState } from 'react'

// Контекст пользователя — сейчас guest, в будущем авторизованный аккаунт.
// При добавлении авторизации: заполни user данными из JWT/сессии.
export const UserContext = createContext(null)

export const ROLES = {
  GUEST:   'guest',
  PARENT:  'parent',
  TEACHER: 'teacher',
}

const GUEST_USER = {
  id:    null,
  email: null,
  role:  ROLES.GUEST,
  plan:  'free',  // 'free' | 'family' | 'teacher'
  name:  'Гость',
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(GUEST_USER)

  // login / logout — заглушки для будущей авторизации
  const login  = (userData) => setUser({ ...GUEST_USER, ...userData })
  const logout = () => setUser(GUEST_USER)

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
