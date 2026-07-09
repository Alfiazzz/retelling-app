# Пересказка.ai — сервис проверки пересказа текста

Веб-приложение для проверки навыка пересказа у детей 4–16 лет. Ребёнок фотографирует страницу книги, пересказывает текст голосом, получает оценку от AI и отвечает на вопросы по тексту. Результат отправляется на e-mail родителю или учителю.

## Стек

**Frontend**
- React 18 + Vite
- React Router v6 (4 страницы: Текст → Пересказ → Вопросы → Отчёт)
- Tesseract.js — OCR прямо в браузере, без серверных запросов
- Web Speech API — распознавание речи и синтез (встроен в браузер)
- Яндекс.Метрика — аналитика

**Backend**
- Node.js + Express
- GigaChat API (Сбер) — анализ пересказа и проверка ответов
- RuSender — отправка email-отчётов
- express-rate-limit — защита от флуда

**Деплой**
- Frontend → shared-хостинг (статика после `npm run build`)
- Backend → Render.com

## Структура проекта

```
retelling-app/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── UploadPage.jsx      # Загрузка фото + OCR
│       │   ├── RetellPage.jsx      # Запись пересказа голосом
│       │   ├── ResultPage.jsx      # Ответы на вопросы
│       │   └── ReportPage.jsx      # Отчёт + отправка на email
│       ├── components/
│       │   ├── Header.jsx          # Шапка с прогресс-баром (4 шага)
│       │   ├── VoiceInput.jsx      # Поле ввода с кнопкой микрофона
│       │   └── ProgressBar.jsx     # Индикатор прогресса OCR
│       └── services/
│           ├── aiService.js        # Запросы к бэкенду (анализ, вопросы)
│           ├── ocrService.js       # Tesseract.js OCR
│           ├── speechService.js    # Web Speech API
│           ├── emailService.js     # Отправка отчёта
│           └── languageCheckService.js  # Определение языка текста
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── ai.js              # /api/ai/* — анализ и модерация
│       │   ├── report.js          # /api/report/send — отправка отчёта
│       │   ├── notify.js          # /api/notify/payment — уведомление владельца
│       │   └── auth.js            # /api/auth/* — заглушка авторизации
│       └── services/
│           ├── aiService.js       # Интеграция с GigaChat
│           ├── emailService.js    # Интеграция с RuSender
│           └── moderationService.js  # Словарная модерация контента
└── README.md
```

## Переменные окружения

### Backend (`backend/.env`)

```env
PORT=3001

# GigaChat API (Сбер) — анализ пересказа и проверка ответов
# https://developers.sber.ru/portal/products/gigachat
GIGACHAT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# RuSender — отправка email-отчётов родителям/учителям
# https://rusender.ru
RUSENDER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Адрес фронтенда (для CORS)
FRONTEND_URL=https://твой-домен.ru
```

### Frontend (`frontend/.env.production`)

```env
VITE_API_URL=https://твой-бэкенд.onrender.com
```

## Быстрый старт (локальная разработка)

```bash
# Backend
cd backend
npm install
cp .env.example .env   # заполни GIGACHAT_KEY и RUSENDER_API_KEY
npm run dev            # запускается на http://localhost:3001

# Frontend (в новом терминале)
cd frontend
npm install
npm run dev            # запускается на http://localhost:5173
```

## Деплой

### Frontend → shared-хостинг

```bash
cd frontend
npm run build
# Содержимое папки dist/ загрузи в public_html через cPanel/FTP
```

Добавь файл `.htaccess` в `public_html` для корректной работы React Router:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

### Backend → Render.com

1. Render.com → New → Web Service → подключи GitHub репозиторий
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Добавь переменные окружения: `GIGACHAT_KEY`, `RUSENDER_API_KEY`, `FRONTEND_URL`

## Безопасность

- Двухуровневая модерация контента: словарный фильтр (мат, суицид, насилие, наркотики, сексуальный контент, prompt injection) + проверка в промпте GigaChat
- Защита от XSS в HTML-письмах (экранирование пользовательских данных)
- Валидация типов и длины входных данных на бэкенде
- Rate limiting: 30 запросов/мин на `/api`, 5 запросов/час на `/api/notify/payment`
- Сырые ответы сторонних API не передаются клиенту

## Архитектурные решения

- **Автор и название произведения** извлекаются GigaChat из текста автоматически — пользователь ничего не вводит вручную
- **OCR работает в браузере** (Tesseract.js) — фотографии не передаются на сервер
- **Голосовой ввод** доступен как для пересказа, так и для ответов на вопросы (тап-старт / тап-стоп)
- **Определение языка** — эвристика по доле кириллицы, предупреждает если текст или пересказ не на русском
- **Модерация OCR-текста** — проверяется до перехода к пересказу; injection в тексте книги не блокируется
