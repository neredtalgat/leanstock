# Инструкция по запуску LeanStock

## Требования

- **Podman** + **podman-compose** (или Docker + docker-compose)
- **Node.js** 20+
- **npm**

## Проверка наличия инструментов

```bash
podman --version
podman-compose --version
node --version
npm --version
```

---

## Шаг 1. Запуск инфраструктуры (PostgreSQL + Redis)

```bash
podman-compose up -d postgres redis
```

Проверка статуса:
```bash
podman ps
```

Должны быть запущены:
- `leanstock-postgres` — порт **5433** (внутри контейнера 5432)
- `leanstock-redis` — порт **6379**

---

## Шаг 2. Настройка переменных окружения

Основной файл для локальной разработки — `.env.development` (уже настроен).

Если нужно создать заново, скопируйте `.env.example`:
```bash
cp .env.example .env.development
```

Ключевые переменные (уже прописаны):
```env
DATABASE_URL=postgresql://leanstock:password@localhost:5433/leanstock
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-min-32-characters-long-please
JWT_REFRESH_SECRET_KEY=your-refresh-secret-key-min-32-chars
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-asanalitalgat.16@gmail.com
SMTP_PASS=lhanfjsozuxyubto
EMAIL_FROM=asanalitalgat.16@gmail.com
FRONTEND_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
```

---

## Шаг 3. Установка зависимостей

```bash
npm install
```

---

## Шаг 4. Применение миграций Prisma

```bash
# Генерация Prisma Client
npx prisma generate

# Применение миграций к основной БД
DATABASE_URL="postgresql://leanstock:password@localhost:5433/leanstock" npx prisma migrate deploy

# (Опционально) Заполнение тестовыми данными
DATABASE_URL="postgresql://leanstock:password@localhost:5433/leanstock" npx prisma db seed
```

---

## Шаг 5. Сборка TypeScript

```bash
npm run build
```

Должно собраться без ошибок (проверка типов пройдена).

---

## Шаг 6. Запуск бэкенда (локально, без контейнера)

Для разработки:
```bash
npm run dev
```

Или для production-режима:
```bash
NODE_ENV=production npm start
```

Бэкенд будет доступен на: **http://localhost:3000**

---

## Шаг 7. Запуск фронтенда

### Через Podman (рекомендуется):
```bash
podman-compose up -d --build frontend
```

Фронтенд будет доступен на: **http://localhost:3001**

### Локально (для разработки):
```bash
cd frontend
# Не открывайте index.html через file:// (браузер заблокирует API по CORS).
# Поднимите любой статический сервер, например:
npx serve . -p 3001
```

---

## Шаг 8. Проверка работоспособности

### Health-check бэкенда:
```bash
curl http://localhost:3000/health
```
Ожидаемый ответ:
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "workers": { "status": "healthy" }
  }
}
```

### Readiness-check:
```bash
curl http://localhost:3000/ready
```
Ожидаемый ответ:
```json
{"ready": true}
```

### Swagger / API Docs:
Откройте в браузере: **http://localhost:3000/api-docs**

### Фронтенд:
Откройте в браузере: **http://localhost:3001**

---

## Запуск ВСЕГО стека одной командой

```bash
podman-compose up -d --build
```

Это запустит:
- PostgreSQL (5433)
- Redis (6379)
- Backend (3000)
- Frontend (3001)

---

## Остановка

```bash
# Остановить всё
podman-compose down

# Или остановить только приложение
podman-compose stop app frontend

# Остановить только инфраструктуру
podman-compose stop postgres redis
```

---

## Перезапуск

```bash
podman-compose restart app frontend
```

Если менялся код — пересобрать:
```bash
podman-compose up -d --build app frontend
```

---

## Запуск тестов

```bash
# Запуск всех тестов
DATABASE_URL="postgresql://leanstock:password@localhost:5433/leanstock" \
REDIS_URL="redis://localhost:6379" \
JWT_SECRET="test-secret-key-at-least-32-characters-long" \
npm test
```

---

## Порты и URL

| Сервис | URL | Порт |
|--------|-----|------|
| Backend API | http://localhost:3000 | 3000 |
| Frontend Demo | http://localhost:3001 | 3001 |
| Swagger UI | http://localhost:3000/api-docs | 3000 |
| PostgreSQL | localhost | 5433 |
| Redis | localhost | 6379 |

---

## Устранение неполадок

### Проблема: "port is already allocated"
```bash
podman-compose down
podman-compose up -d
```

### Проблема: "database does not exist"
```bash
podman exec leanstock-postgres psql -U leanstock -d postgres -c "CREATE DATABASE leanstock;"
```

### Проблема: "Prisma Client is not generated"
```bash
npx prisma generate
```

### Проблема: миграции не применились
```bash
DATABASE_URL="postgresql://leanstock:password@localhost:5433/leanstock" npx prisma migrate deploy
```

### Полный сброс (удалить всё и начать заново)
```bash
podman-compose down -v
podman-compose up -d postgres redis
DATABASE_URL="postgresql://leanstock:password@localhost:5433/leanstock" npx prisma migrate deploy
podman-compose up -d --build app frontend
```
