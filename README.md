# Сервис проверки пересказа текста

Веб-приложение для проверки навыка пересказа у детей школьного возраста.

## Стек

- **Frontend**: React 18 + Vite + Tailwind CSS → деплой на Vercel (бесплатно)
- **Backend**: Node.js + Express → деплой на Render (бесплатно)
- **OCR**: Tesseract.js (бесплатно, без API)
- **STT**: Web Speech API (встроен в браузер, бесплатно)
- **AI-анализ**: Groq API или Google Gemini API (бесплатный tier)
- **TTS**: Web Speech API SpeechSynthesis (бесплатно)
- **Email**: Resend (бесплатно до 3000 писем/месяц)

## Структура проекта

```
retelling-app/
├── frontend/          # React-приложение
│   ├── src/
│   │   ├── components/    # UI-компоненты
│   │   ├── pages/         # Страницы приложения
│   │   ├── services/      # Сервисный слой (OCR, AI, Email)
│   │   ├── config/        # Конфиги, тарифы, контекст
│   │   ├── hooks/         # Кастомные хуки
│   │   └── styles/        # Глобальные стили
│   └── package.json
└── backend/           # Express API
    ├── src/
    │   ├── routes/        # API маршруты
    │   ├── services/      # Бизнес-логика
    │   └── middleware/    # Middleware
    └── package.json
```

## Быстрый старт

### 1. Получи API-ключи (все бесплатно)

- **Groq API**: https://console.groq.com → Sign up → API Keys → Create
- **Resend**: https://resend.com → Sign up → API Keys → Create
- *(опционально)* **Gemini API**: https://aistudio.google.com → Get API key

### 2. Настрой переменные окружения

```bash
# frontend/.env
VITE_API_URL=http://localhost:3001
VITE_AI_PROVIDER=groq   # или gemini
```

```bash
# backend/.env
PORT=3001
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
AI_PROVIDER=groq
FRONTEND_URL=http://localhost:5173
```

### 3. Установи зависимости и запусти

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (в новом терминале)
cd frontend
npm install
npm run dev
```

Открой http://localhost:5173

## Деплой

### Frontend → Vercel
1. Залей проект на GitHub
2. Зайди на vercel.com → New Project → выбери репозиторий
3. Root Directory: `frontend`
4. Добавь переменные окружения (VITE_API_URL = адрес твоего Render-бэкенда)
5. Deploy

### Backend → Render
1. На render.com → New → Web Service → подключи GitHub
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Добавь все переменные окружения из backend/.env
6. Deploy

## Расширение (регистрация и тарифы)

Архитектура уже подготовлена:
- `frontend/src/config/userContext.js` — контекст пользователя (сейчас guest)
- `frontend/src/config/planConfig.js` — лимиты тарифов (сейчас всё разрешено)
- `backend/src/middleware/auth.js` — заглушка для JWT-авторизации
- `backend/src/routes/auth.js` — заготовка маршрутов авторизации

Когда будешь добавлять авторизацию — подключи PocketBase или Supabase Pro
и заполни эти файлы без изменения остальной архитектуры.
