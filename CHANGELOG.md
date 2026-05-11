# Changelog

## Architectural Decisions & Deviations from Blueprint

### 1. Environment Validation
**Decision:** Используем Zod вместо Pydantic (FastAPI vs Express)
- **Причина:** Express.js экосистема
- **Реализация:** `src/config/env.ts` — валидация при старте, приложение не запускается без критических переменных

### 2. Database Schema
**Deviation:** `ReorderPoint` модель дополнена связью с `Product`
- **Blueprint:** Простая таблица min/max
- **Реализация:** Добавлен `include: { product: true }` для удобства API
- **Причина:** UX — клиенту нужно имя продукта, не только ID

### 3. API Structure
**Deviation:** Inventory Movement read-only
- **Blueprint:** Предполагался CRUD
- **Реализация:** Только `GET` эндпоинты, создание через `InventoryService.adjust()` и другие бизнес-операции
- **Причина:** Движения создаются атомарно в рамках бизнес-транзакций, не напрямую

### 4. RBAC Implementation
**Decision:** Permission-based вместо чисто Role-based
- **Blueprint:** Роли определяют доступ
- **Реализация:** `requirePermission('suppliers:create')` — гранулярные пермишены
- **Причина:** Более гибкая система для мульти-тенантности

## Implemented Endpoints

### Auth (4)
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`

### Products (5+)
- CRUD `/products`
- Upload images

### Inventory (3)
- GET `/inventory` (фильтры, lowStock)
- POST `/inventory/adjust`
- GET `/inventory/movements`

### Transfers (3+)
- POST `/transfers` — atomic с `SELECT FOR UPDATE`
- GET `/transfers/:id`
- PUT `/transfers/:id/approve`

### Suppliers (8)
- Full CRUD
- Products linkage (`/suppliers/:id/products`)

### Reorder Points (5)
- Full CRUD
- `GET /reorder-points?lowStock=true` — dead stock alerts

### Locations, Audit Logs, Reports — read-only

## Testing

### Unit Tests
- `tests/unit/auth.service.test.ts` — bcrypt, JWT generation

### Integration Tests
- `tests/integration/auth.test.ts` — full auth flow

### To Add
- Supplier CRUD integration
- Reorder point calculations
- Inventory transfer atomicity
