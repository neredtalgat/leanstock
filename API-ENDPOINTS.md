# LeanStock API Endpoints Documentation

## Overview
Complete list of all available API endpoints in the LeanStock inventory management system.

## Base URL
```
http://localhost:3000
```

## Authentication
All endpoints (except `/health` and auth endpoints) require:
- `Authorization: Bearer <access_token>` header
- Valid tenant context (automatically injected)

---

## 🏥 Health Check
### `GET /health`
- **Description**: Check if the API is running
- **Authentication**: None required
- **Response**: Server status and timestamp

---

## 🔐 Authentication
### `POST /auth/register`
- **Description**: Register a new user
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "STORE_MANAGER",
    "tenantId": "tenant-uuid"
  }
  ```

### `POST /auth/login`
- **Description**: Login user and get tokens
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "tenantId": "tenant-uuid"
  }
  ```

### `POST /auth/refresh`
- **Description**: Refresh access token using refresh token
- **Body**:
  ```json
  {
    "refreshToken": "refresh-token-here"
  }
  ```

### `POST /auth/logout`
- **Description**: Logout and invalidate refresh token
- **Body**:
  ```json
  {
    "refreshToken": "refresh-token-here"
  }
  ```

---

## 🏢 Tenants (SUPER_ADMIN only)
### `POST /tenants`
- **Description**: Create a new tenant
- **Authentication**: Super Admin required
- **Body**:
  ```json
  {
    "name": "New Company Ltd"
  }
  ```

---

## 📍 Locations
### `GET /locations`
- **Description**: List all locations for the tenant
- **Authentication**: Required

### `POST /locations`
- **Description**: Create a new location
- **Permission**: `locations:create`
- **Body**:
  ```json
  {
    "name": "Main Warehouse",
    "type": "warehouse",
    "address": "123 Storage St, City, State 12345"
  }
  ```

### `GET /locations/:id`
- **Description**: Get location by ID
- **Authentication**: Required

### `PUT /locations/:id`
- **Description**: Update location
- **Permission**: `locations:update`
- **Body**: Same as create

### `DELETE /locations/:id`
- **Description**: Delete location
- **Permission**: `locations:delete`

---

## 📦 Products
### `GET /products`
- **Description**: List products with pagination
- **Query Parameters**:
  - `limit`: Number of items per page (default: 20)
  - `cursor`: Pagination cursor
  - `search`: Search term

### `POST /products`
- **Description**: Create a new product
- **Permission**: `products:create`
- **Body**:
  ```json
  {
    "sku": "PROD-001",
    "name": "Product Name",
    "description": "Product description",
    "baseCost": 10.50,
    "retailPrice": 15.99,
    "weight": 0.5
  }
  ```

### `GET /products/:id`
- **Description**: Get product by ID

### `PUT /products/:id`
- **Description**: Update product
- **Permission**: `products:update`

### `DELETE /products/:id`
- **Description**: Delete product
- **Permission**: `products:delete`

### `POST /products/:id/images`
- **Description**: Upload product image
- **Permission**: `products:update`
- **Body**:
  ```json
  {
    "url": "https://example.com/image.jpg",
    "isPrimary": true
  }
  ```

---

## 📊 Inventory
### `GET /inventory`
- **Description**: List inventory with filters
- **Query Parameters**:
  - `productId`: Filter by product
  - `locationId`: Filter by location
  - `lowStock`: Show only low stock items

### `GET /inventory/:id`
- **Description**: Get inventory record by ID

### `POST /inventory`
- **Description**: Create inventory record
- **Permission**: `inventory:create`
- **Body**:
  ```json
  {
    "productId": "product-uuid",
    "locationId": "location-uuid",
    "quantity": 100,
    "reservedQuantity": 0
  }
  ```

### `PUT /inventory/:id`
- **Description**: Update inventory
- **Permission**: `inventory:update`

### `DELETE /inventory/:id`
- **Description**: Delete inventory
- **Permission**: `inventory:delete`

### `POST /inventory/adjust`
- **Description**: Adjust inventory quantity
- **Permission**: `inventory:adjust`
- **Body**:
  ```json
  {
    "productId": "product-uuid",
    "locationId": "location-uuid",
    "quantity": 5,
    "operation": "ADD|REMOVE",
    "reason": "Stock adjustment"
  }
  ```

### `GET /inventory/movements`
- **Description**: List inventory movements
- **Query Parameters**:
  - `productId`: Filter by product
  - `locationId`: Filter by location
  - `type`: Movement type (IN, OUT, ADJUSTMENT, etc.)

### `GET /inventory/movements/:id`
- **Description**: Get movement by ID

---

## 🚚 Transfers
### `GET /transfers`
- **Description**: List all transfer orders

### `POST /transfers`
- **Description**: Create new transfer order (atomic operation)
- **Permission**: `orders:create`
- **Body**:
  ```json
  {
    "fromLocationId": "location-uuid",
    "toLocationId": "location-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 10
      }
    ],
    "notes": "Transfer notes"
  }
  ```

### `POST /transfers/:id/approve`
- **Description**: Approve transfer order
- **Permission**: `orders:approve`
- **Body**:
  ```json
  {
    "approved": true,
    "notes": "Approval notes"
  }
  ```

### `POST /transfers/:id/ship`
- **Description**: Mark transfer as shipped
- **Permission**: `orders:update`
- **Body**:
  ```json
  {
    "carrier": "FedEx",
    "trackingNumber": "1234567890",
    "notes": "Shipping notes"
  }
  ```

### `POST /transfers/:id/receive`
- **Description**: Receive transferred items
- **Permission**: `orders:update`
- **Body**:
  ```json
  {
    "items": [
      {
        "productId": "product-uuid",
        "receivedQuantity": 10
      }
    ],
    "notes": "Receiving notes"
  }
  ```

---

## 🏭 Suppliers
### `GET /suppliers`
- **Description**: List all suppliers

### `POST /suppliers`
- **Description**: Create new supplier
- **Permission**: `suppliers:create`
- **Body**:
  ```json
  {
    "name": "ABC Supplier",
    "email": "contact@supplier.com",
    "phone": "+1-555-0123",
    "address": "123 Supplier St, City, State 12345"
  }
  ```

### `GET /suppliers/:id`
- **Description**: Get supplier by ID (includes products)

### `PUT /suppliers/:id`
- **Description**: Update supplier
- **Permission**: `suppliers:update`

### `DELETE /suppliers/:id`
- **Description**: Delete supplier
- **Permission**: `suppliers:delete`

### `GET /suppliers/:id/products`
- **Description**: Get supplier's products

### `POST /suppliers/:id/products`
- **Description**: Add product to supplier
- **Permission**: `suppliers:update`
- **Body**:
  ```json
  {
    "productId": "product-uuid",
    "supplierSku": "SUP-001",
    "price": 12.50,
    "leadTimeDays": 7
  }
  ```

### `DELETE /suppliers/:id/products/:productId`
- **Description**: Remove product from supplier
- **Permission**: `suppliers:update`

---

## 📋 Purchase Orders
### `GET /purchase-orders`
- **Description**: List all purchase orders
- **Query Parameters**:
  - `status`: Filter by status (DRAFT, SUBMITTED, CONFIRMED, etc.)
  - `supplierId`: Filter by supplier

### `POST /purchase-orders`
- **Description**: Create new purchase order
- **Permission**: `purchase_orders:create`
- **Body**:
  ```json
  {
    "supplierId": "supplier-uuid",
    "expectedDeliveryDate": "2024-02-15T00:00:00.000Z",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 50,
        "unitPrice": 12.50
      }
    ]
  }
  ```

### `PUT /purchase-orders/:id`
- **Description**: Update purchase order
- **Permission**: `purchase_orders:update`
- **Body**:
  ```json
  {
    "status": "CONFIRMED",
    "expectedDeliveryDate": "2024-02-20T00:00:00.000Z"
  }
  ```

### `POST /purchase-orders/:id/receive`
- **Description**: Receive items from purchase order
- **Permission**: `purchase_orders:receive`
- **Body**:
  ```json
  {
    "items": [
      {
        "productId": "product-uuid",
        "receivedQuantity": 48
      }
    ],
    "notes": "Received with 2 units damaged"
  }
  ```

---

## 🔄 Supplier Returns
### `GET /supplier-returns`
- **Description**: List all supplier returns

### `POST /supplier-returns`
- **Description**: Create new supplier return
- **Permission**: `suppliers:update` (implied)
- **Body**:
  ```json
  {
    "supplierId": "supplier-uuid",
    "locationId": "location-uuid",
    "reason": "Defective items",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 5,
        "unitPrice": 12.50,
        "reason": "Quality issues"
      }
    ]
  }
  ```

---

## 🎯 Reorder Points
### `GET /reorder-points`
- **Description**: List all reorder points
- **Query Parameters**:
  - `productId`: Filter by product
  - `locationId`: Filter by location

### `POST /reorder-points`
- **Description**: Create reorder point
- **Permission**: `reorder-points:create`
- **Body**:
  ```json
  {
    "productId": "product-uuid",
    "locationId": "location-uuid",
    "minQuantity": 20,
    "maxQuantity": 100
  }
  ```

### `GET /reorder-points/:id`
- **Description**: Get reorder point by ID

### `PUT /reorder-points/:id`
- **Description**: Update reorder point
- **Permission**: `reorder-points:update`

### `DELETE /reorder-points/:id`
- **Description**: Delete reorder point
- **Permission**: `reorder-points:delete`

---

## 🔔 Notifications
### `GET /notifications`
- **Description**: List user notifications
- **Permission**: `notifications:read`

### `GET /notifications/unread-count`
- **Description**: Get count of unread notifications

### `POST /notifications/:id/read`
- **Description**: Mark notification as read
- **Body**: `{}`

### `POST /notifications/mark-all-read`
- **Description**: Mark all notifications as read
- **Body**: `{}`

### `DELETE /notifications/:id`
- **Description**: Delete notification

### `POST /notifications` (Admin only)
- **Description**: Create notification (Admin only)
- **Permission**: Tenant Admin role
- **Body**:
  ```json
  {
    "type": "INFO",
    "message": "System maintenance scheduled",
    "userId": "user-uuid",
    "metadata": {"scheduledDate": "2024-02-15T02:00:00.000Z"}
  }
  ```

### `POST /notifications/cleanup` (Admin only)
- **Description**: Clean up old notifications
- **Permission**: Tenant Admin role
- **Body**:
  ```json
  {
    "daysOld": 30
  }
  ```

---

## 📈 Analytics & Reports
### `GET /analytics/inventory`
- **Description**: Get inventory analytics
- **Permission**: `analytics:read`

### `GET /analytics/sales`
- **Description**: Get sales analytics
- **Permission**: `analytics:read`

### `GET /reports/inventory`
- **Description**: Generate inventory report
- **Permission**: `reports:read`

### `GET /reports/sales`
- **Description**: Generate sales report
- **Permission**: `reports:read`

---

## 📝 Audit Logs
### `GET /audit-logs`
- **Description**: List audit logs
- **Permission**: `audit:read`
- **Query Parameters**:
  - `userId`: Filter by user
  - `action`: Filter by action
  - `resource`: Filter by resource
  - `fromDate`: Filter from date
  - `toDate`: Filter to date

---

## ⚙️ System Settings
### `GET /system/settings`
- **Description**: List system settings
- **Permission**: Varies by setting

### `PUT /system/settings`
- **Description**: Update system setting
- **Permission**: Varies by setting
- **Body**:
  ```json
  {
    "key": "setting_key",
    "value": "setting_value",
    "description": "Setting description"
  }
  ```

### `GET /system/status` (Super Admin only)
- **Description**: Get system status
- **Authentication**: Super Admin required

### `GET /analytics/cross-tenant` (Super Admin only)
- **Description**: Get cross-tenant analytics
- **Authentication**: Super Admin required

---

## 🔑 Role-Based Permissions

### User Roles (Hierarchy):
1. **SUPER_ADMIN** (100) - Full system access
2. **TENANT_ADMIN** (90) - Full tenant access
3. **REGIONAL_MANAGER** (70) - Read-only access to multiple locations
4. **STORE_MANAGER** (50) - Store operations
5. **STORE_ASSOCIATE** (30) - Basic operations
6. **SUPPLIER** (10) - Limited supplier access

### Permission Format: `resource:action`
- `create`, `read`, `update`, `delete`, `approve`, `adjust`, `receive`

---

## 📝 Error Responses

All endpoints return consistent error format:
```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "details": {} // Optional additional details
}
```

Common error codes:
- `UNAUTHORIZED` - Authentication required/failed
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input data
- `INTERNAL_ERROR` - Server error

---

## 🚀 Usage Instructions

1. **Import Collection**: Use `leanstock-complete-postman-collection.json`
2. **Set Environment**: Configure baseUrl and authentication tokens
3. **Register/Login**: Get access tokens first
4. **Create Resources**: Start with locations and products
5. **Test Workflows**: Try complete transfer/purchase order flows

The collection includes automatic variable setting for IDs returned from create operations.
