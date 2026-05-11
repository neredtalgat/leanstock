# LeanStock API - Defense Guide

## 📁 Файлы для защиты

| Файл | Назначение |
|------|-----------|
| `leanstock-postman-collection.json` | Импорт в Postman (все эндпоинты) |
| `leanstock-postman-environment.json` | Переменные окружения для Postman |

## 🚀 Подготовка к защите

### 1. Запуск сервера
```bash
npm run dev
```

### 2. Проверка работы
```bash
curl http://localhost:3000/health
```
→ Должен вернуть `{"status":"OK"}`

### 3. Swagger UI
Открыть: http://localhost:3000/api-docs

---

## 📥 Импорт в Postman

### Шаг 1: Импорт коллекции
1. Postman → Import → Upload Files
2. Выбрать `leanstock-postman-collection.json`

### Шаг 2: Импорт Environment
1. Postman → Environments → Import
2. Выбрать `leanstock-postman-environment.json`

### Шаг 3: Выбрать окружение
В правом верхнем углу Postman выбрать "LeanStock Local"

---

## 🔄 Defense Flow (пошагово)

### 🔐 Этап 1: Auth Flow
**Папка:** `🔄 1. AUTH FLOW`

1. **1.1 Register User** → Создаём пользователя
2. **1.2 Login** → Получаем токены (автоматически сохраняются в переменные)
3. **1.3 Access Protected** → Проверяем доступ к защищённому endpoint
4. **1.4 Refresh Token** → Обновляем access token
5. **1.5 Logout** → Завершаем сессию

**Что показывать:**
- После Login показать сохранённые токены (Environment → переменные)
- Показать что без токена (удалить {{accessToken}}) — получаем 401

---

### 📊 Этап 2: Super Admin Features
**Папки:** `📊 SUPER ADMIN - Analytics`, `⚙️ SUPER ADMIN - System Settings`

**Ключевые эндпоинты:**
- `GET /analytics/cross-tenant` — аналитика по всем tenants
- `GET /analytics/system-metrics` — системные метрики
- `GET /system/limits` — глобальные лимиты
- `PUT /system/limits` — обновление лимитов

**Что показывать:**
- Только SUPER_ADMIN имеет доступ
- Другие роли получают 403 Forbidden

---

### 💼 Этап 3: Business Logic (Core Transaction)
**Папка:** `🚚 Transfers` или `↩️ Supplier Returns`

**Рекомендуемый сценарий (Transfers):**
1. **Create Transfer** с суммой >$1000
   - Автоматически создаётся статус `PENDING_APPROVAL`
   - Показать в ответе `"requiresApproval": true`
   
2. **Approve Transfer**
   - Regional Manager / Admin вызывает approve
   - Статус меняется на `APPROVED`

**Альтернативный сценарий (Supplier Returns):**
1. **Create Return** → статус `DRAFT`
2. **Ship Return** → статус `SHIPPED`, инвентарь уменьшается

---

### 📱 Этап 4: Notifications (NEW Feature)
**Папка:** `🔔 Notifications`

- `GET /notifications/unread-count` — показать счётчик
- `GET /notifications` — список уведомлений
- `POST /notifications/{id}/read` — отметить прочитанным

---

## 🧪 Тесты (Jest)

### Запуск тестов
```bash
# Все тесты
npm test

# С покрытием
npm run test:coverage

# В watch режиме
npm run test:watch
```

### Структура тестов
```
tests/
├── integration/
│   └── auth.test.ts          # Интеграционные тесты
├── unit/
│   └── auth.service.test.ts  # Unit тесты
├── setup.ts                  # Настройка
└── teardown.ts               # Очистка
```

---

## 🎯 Чеклист для защиты

- [ ] Сервер запущен на порту 3000
- [ ] Health check работает
- [ ] Swagger UI открывается
- [ ] Postman коллекция импортирована
- [ ] Auth flow пройден (получены токены)
- [ ] Показан защищённый endpoint с/без токена
- [ ] Показан core business transaction
- [ ] Тесты запущены и проходят
- [ ] Показана ролевая модель (RBAC)

---

## 🆘 Troubleshooting

**401 Unauthorized:**
- Токен истёк → вызвать Refresh Token
- Нет токена → вызвать Login

**403 Forbidden:**
- У пользователя недостаточно прав
- Нужна роль SUPER_ADMIN или TENANT_ADMIN

**500 Internal Server:**
- Проверить подключение к PostgreSQL
- Проверить подключение к Redis
