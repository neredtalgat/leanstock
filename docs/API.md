# LeanStock API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer {accessToken}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Optional message",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": []
}
```

## API Endpoints

### Authentication Endpoints

#### Register
**POST** `/auth/register`

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "STORE_ASSOCIATE",
  "tenantId": "uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "STORE_ASSOCIATE",
    "tenantId": "uuid"
  }
}
```

**Error Codes:**
- `400` - Validation failed
- `429` - Rate limit exceeded

---

#### Login
**POST** `/auth/login`

Authenticate user and get tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "tenantId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": "15m"
  }
}
```

**Error Codes:**
- `401` - Invalid credentials
- `429` - Rate limit exceeded

---

#### Refresh Token
**POST** `/auth/refresh`

Get a new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": "15m"
  }
}
```

**Error Codes:**
- `401` - Invalid or expired token

---

#### Logout
**POST** `/auth/logout`

Logout and revoke tokens.

**Headers:** `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Product Endpoints

#### Create Product
**POST** `/products`

Create a new product.

**Headers:**
- `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "name": "Laptop",
  "sku": "LAPTOP-001",
  "barcode": "1234567890123",
  "category": "Electronics",
  "price": 999.99,
  "costPrice": 500.00,
  "unit": "piece",
  "reorderPoint": 5,
  "status": "ACTIVE"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "product-id",
    "name": "Laptop",
    "sku": "LAPTOP-001",
    "price": 999.99,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
- `400` - Validation failed or SKU already exists
- `401` - Unauthorized
- `403` - Insufficient permissions

---

#### List Products
**GET** `/products`

List all products with pagination.

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `limit` (optional, default: 20) - Number of items per page (max 100)
- `cursor` (optional) - Pagination cursor
- `search` (optional) - Search by name, SKU, or barcode
- `status` (optional) - Filter by status (ACTIVE, INACTIVE, DISCONTINUED)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-id",
      "name": "Laptop",
      "sku": "LAPTOP-001",
      "price": 999.99,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "cursor-string",
    "hasMore": true
  }
}
```

---

#### Get Product
**GET** `/products/{productId}`

Get a specific product.

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "product-id",
    "name": "Laptop",
    "sku": "LAPTOP-001",
    "price": 999.99,
    "images": [],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
- `404` - Product not found
- `401` - Unauthorized

---

#### Update Product
**PATCH** `/products/{productId}`

Update product details.

**Headers:** `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "name": "Gaming Laptop",
  "price": 1299.99,
  "status": "ACTIVE"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "product-id",
    "name": "Gaming Laptop",
    "price": 1299.99,
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
- `404` - Product not found
- `400` - Validation failed
- `403` - Insufficient permissions

---

#### Delete Product
**DELETE** `/products/{productId}`

Delete a product.

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

**Error Codes:**
- `404` - Product not found
- `403` - Insufficient permissions

---

### Inventory Endpoints

#### Get Inventory
**GET** `/inventory`

Get inventory details for a product at a location.

**Headers:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
- `productId` (required) - Product ID
- `locationId` (required) - Location ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "inventory-id",
    "productId": "product-id",
    "locationId": "location-id",
    "quantity": 10,
    "reservedQuantity": 2,
    "availableQuantity": 8,
    "daysInInventory": 45
  }
}
```

---

#### Record Movement
**POST** `/inventory/movements`

Record an inventory movement.

**Headers:** `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "inventoryId": "inventory-id",
  "type": "IN",
  "quantity": 5,
  "reason": "Purchase order received",
  "referenceId": "PO-123"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "movement-id",
    "type": "IN",
    "quantity": 5,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### Check Low Stock
**GET** `/inventory/low-stock`

Get all low stock items.

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "inventory-id",
      "product": {
        "id": "product-id",
        "name": "Laptop",
        "reorderPoint": 5
      },
      "quantity": 3,
      "location": {
        "id": "location-id",
        "name": "Main Warehouse"
      }
    }
  ]
}
```

---

## Role-Based Permissions

| Permission | SUPER_ADMIN | TENANT_ADMIN | REGIONAL_MANAGER | STORE_MANAGER | STORE_ASSOCIATE | SUPPLIER |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| products:create | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| products:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| products:update | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| products:delete | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| inventory:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| inventory:update | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| users:create | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| users:read | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| users:update | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| reports:read | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |

---

## Error Codes Reference

| Code | Message | Description |
|------|---------|-------------|
| 400 | Validation failed | Request validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate SKU) |
| 429 | Too many requests | Rate limit exceeded |
| 500 | Internal server error | Server error |

---

## Rate Limiting

- **Auth endpoints**: 5 attempts per 15 minutes per IP
- **Other endpoints**: Standard rate limiting applied

---

## Testing

Test the API using curl:

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "tenantId": "tenant-uuid"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "tenantId": "tenant-uuid"
  }'

# Create Product
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "sku": "TEST-001",
    "price": 99.99
  }'
```
