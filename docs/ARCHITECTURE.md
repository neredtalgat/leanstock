# LeanStock Architecture Documentation

## 🏗️ System Architecture Overview

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Load Balancer (Nginx/ALB)                │
├─────────────────────────────────────────────────────────────────────────┤
│                     LeanStock API Cluster                     │
│  ┌─────────────┬─────────────┬─────────────┐        │
│  │   Node.js   │   Node.js   │   Node.js   │        │
│  │   Instance   │   Instance   │   Instance   │        │
│  │     #1      │     #2      │     #3      │        │
│  └─────────────┴─────────────┴─────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┬─────────────────┬─────────────────┐
│   PostgreSQL   │     Redis      │  BullMQ       │
│   (Primary)    │   (Cache)     │  (Jobs)       │
│   Cluster      │   Cluster      │  Cluster       │
└─────────────────┴─────────────────┴─────────────────┘
```

## 🔐 Security Architecture

### Multi-Tenant Security Model
```
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Security Middleware Stack              │   │
│  │  ┌─────────────┬─────────────┬─────────┐ │   │
│  │  │   Helmet     │   Rate Limit │  CORS   │ │   │
│  │  │   Headers    │   Middleware │  Config  │ │   │
│  │  └─────────────┴─────────────┴─────────┘ │   │
│  │  ┌─────────────────────────────────────────────┐ │   │
│  │  │        Request ID Tracing             │ │   │
│  │  │  ┌─────────┬─────────────────────────┐ │ │   │
│  │  │  │  UUID    │    Correlation ID    │ │ │   │
│  │  │  │  Gen     │     Propagation     │ │ │   │
│  │  │  └─────────┴─────────────────────────┘ │ │   │
│  │  └─────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Application Layer                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           RBAC & Tenant Isolation            │   │
│  │  ┌─────────────┬─────────────┬─────────┐ │   │
│  │  │  Permissions │    Roles     │ Tenants │ │   │
│  │  │  Matrix     │  Hierarchy  │ Isolation│ │   │
│  │  └─────────────┴─────────────┴─────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🗄️ Data Flow Architecture

### Request-Response Flow
```
Client Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Security Layer                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Authentication & Authorization              │   │
│  │  ┌─────────────┬─────────────────────────┐ │   │
│  │  │    JWT      │     RBAC            │ │   │
│  │  │  Validation  │  Permission Check    │ │   │
│  │  └─────────────┴─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                Business Logic                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Service Layer                      │   │
│  │  ┌─────────────┬─────────────┬─────────┐ │   │
│  │  │  Products    │  Inventory  │ Transfers│ │   │
│  │  │  Service     │  Service    │ Service  │ │   │
│  │  └─────────────┴─────────────┴─────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Data Layer                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Prisma ORM                        │   │
│  │  ┌─────────────┬─────────────────────────┐ │   │
│  │  │  PostgreSQL  │  Redis Cache & Queue │ │   │
│  │  │  Database   │  (BullMQ)              │ │   │
│  │  └─────────────┴─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
Response to Client
```

## 🔐 RBAC Matrix

### Role-Based Access Control
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           PERMISSION MATRIX                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ RESOURCE          │ SUPER_ADMIN │ TENANT_ADMIN │ REGIONAL_MGR │ STORE_MGR │ ASSOCIATE │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Tenants          │    ✓ ✓ ✓    │    ✗         │      ✗        │     ✗       │     ✗      │
│ Users            │    ✓ ✓ ✓    │    ✓ ✓       │      ✓        │     ✓       │     ✓      │
│ Products         │    ✓ ✓ ✓    │    ✓ ✓       │      ✓        │     ✓       │     ✓      │
│ Inventory        │    ✓ ✓ ✓    │    ✓ ✓       │      ✓        │     ✓       │     ✓      │
│ Transfers        │    ✓ ✓ ✓    │    ✓ ✓       │      ✓        │     ✓       │     ✓      │
│ Purchase Orders   │    ✓ ✓ ✓    │    ✓ ✓       │      ✓        │     ✓       │     ✓      │
│ Supplier Returns  │    ✓ ✓ ✓    │    ✓ ✓       │      ✓        │     ✓       │     ✓      │
│ Analytics        │    ✓ ✓ ✓    │    ✓ ✓       │      ✓        │     ✗       │     ✗      │
│ System Settings  │    ✓ ✓ ✓    │    ✓ ✓       │      ✗        │     ✗       │     ✗      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ✓ = Full Access    ✓ = Create/Read/Update/Delete    │
│ ○ = Limited Access  ○ = Read/Update Only              │
│ ✗ = No Access     ✗ = No Permissions                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Permission Levels
- **SUPER_ADMIN**: Full system access across all tenants
- **TENANT_ADMIN**: Full access within tenant scope
- **REGIONAL_MANAGER**: Multi-location management within tenant
- **STORE_MANAGER**: Single location full management
- **STORE_ASSOCIATE**: Basic operational permissions

## 🏢 Tenant Isolation Model

### Data Separation Strategy
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED INFRASTRUCTURE                  │   │
│  │  ┌─────────────┬─────────────┬─────────────────────────┐ │   │
│  │  │   API       │  BullMQ     │   Redis               │ │   │
│  │  │   Gateway   │  Workers     │   Cluster              │ │   │
│  │  └─────────────┴─────────────┴─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                  ISOLATED DATABASE LAYERS                 │   │
│  │  ┌─────────────┬─────────────┬─────────────────────────┐ │   │
│  │  │  Tenant A    │  Tenant B    │  Tenant C              │ │   │
│  │  │  Data        │  Data        │  Data                 │ │   │
│  │  │  (Schema)    │  (Schema)    │  (Schema)             │ │   │
│  │  └─────────────┴─────────────┴─────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │
│  │  │         PostgreSQL with Row-Level Security     │   │
│  │  │  tenant_id column in ALL tables              │   │
│  │  │  AsyncLocalStorage for context             │   │
│  │  │  Prisma extensions for filtering           │   │
│  │  └─────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## ⚡ Performance & Caching

### Caching Strategy
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                      CACHING ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    REDIS CLUSTER                             │   │
│  │  ┌─────────────┬─────────────┬─────────────────────────┐ │   │
│  │  │   Session    │   Rate Limit │   Background Jobs       │ │   │
│  │  │   Cache      │   Cache      │   (BullMQ)             │ │   │
│  │  │             │             │                         │ │   │
│  │  │  ┌─────────┬─────────┐ │  ┌─────────────────────┐ │   │
│  │  │  │  JWT     │  Auth   │ │  Email            │ │   │
│  │  │  │  Blacklist│  Tokens  │ │  Notifications     │ │   │
│  │  │  └─────────┴─────────┘ │  │  Inventory       │ │   │
│  │  │                       │  │  Checks          │ │   │
│  │  │                       │  │  Dead Stock       │ │   │
│  │  │                       │  │  Discounts        │ │   │
│  │  │                       │  └─────────────────────┘ │   │
│  │  └─────────────┴─────────────┴─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Background Job Processing

### BullMQ Job Architecture
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND JOB PROCESSING                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                      BULLMQ WORKER POOLS                 │   │
│  │  ┌─────────────┬─────────────┬─────────────────────────┐ │   │
│  │  │   Email     │  Inventory  │  System               │ │   │
│  │  │   Worker     │  Worker     │  Worker               │ │   │
│  │  └─────────────┴─────────────┴─────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │
│  │  │            JOB TYPES & SCHEDULES            │   │
│  │  │  ┌─────────────┬─────────────────────────┐ │   │
│  │  │  │  Immediate  │  Scheduled              │ │   │
│  │  │  │  (Email)    │  (Cron Jobs)          │ │   │
│  │  │  └─────────────┴─────────────────────────┘ │   │
│  │  │  ┌─────────┬─────────────────────────────┐ │   │
│  │  │  │  Email   │  Inventory              │ │   │
│  │  │  │  Queue  │  Processing             │ │   │
│  │  │  └─────────┴─────────────────────────────┘ │   │
│  │  │  ┌─────────────────────────────────────┐ │   │
│  │  │  │  Dead Stock & Reorder Checks   │ │   │
│  │  │  │  (Every 30 min / 2 hours)    │ │   │
│  │  │  └─────────────────────────────────────┘ │   │
│  │  └─────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Monitoring & Observability

### Logging & Tracing Architecture
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                   OBSERVABILITY STACK                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                   STRUCTURED LOGGING                    │   │
│  │  ┌─────────────┬─────────────┬─────────────────────────┐ │   │
│  │  │   Pino     │   Request   │   Error               │ │   │
│  │  │   Logger    │   ID Tracing│  Handling             │ │   │
│  │  └─────────────┴─────────────┴─────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │
│  │  │            LOG FORMATS                      │   │
│  │  │  ┌─────────────┬─────────────────────────┐ │   │
│  │  │  │   JSON      │  Correlation ID       │ │   │
│  │  │  │   Structured│  Propagation          │ │   │
│  │  │  └─────────────┴─────────────────────────┘ │   │
│  │  │  ┌─────────────────────────────────────┐ │   │
│  │  │  │  Performance & Security Events   │ │   │
│  │  │  └─────────────────────────────────────┘ │   │
│  │  └─────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Deployment Architecture

### Container Orchestration
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                  KUBERNETES CLUSTER                           │   │
│  │  ┌─────────────┬─────────────┬─────────────────────────┐ │   │
│  │  │   API Pods  │  Worker Pods │  Infrastructure          │ │   │
│  │  │  (3x Rep)  │  (2x Rep)   │  Services              │   │
│  │  └─────────────┴─────────────┴─────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │
│  │  │            LOAD BALANCING & INGRESS            │   │
│  │  │  ┌─────────────┬─────────────────────────────┐ │   │
│  │  │  │  Nginx/    │  SSL Termination        │ │   │
│  │  │  │  ALB        │  Health Checks          │ │   │
│  │  │  └─────────────┴─────────────────────────────┘ │   │
│  │  └─────────────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 🔒 Security Best Practices

### Defense in Depth
1. **Network Layer**: WAF, DDoS Protection, Rate Limiting
2. **Application Layer**: JWT, RBAC, Input Validation, CORS
3. **Data Layer**: Row-Level Security, Encryption, Backups
4. **Infrastructure Layer**: Container Security, Secrets Management
5. **Monitoring Layer**: Audit Logs, Anomaly Detection, Alerts

### Compliance Standards
- **OWASP Top 10**: Full protection implementation
- **GDPR**: Data privacy and right to deletion
- **SOC 2**: Audit trails and access controls
- **ISO 27001**: Information security management

---

## 📚 Technology Rationale

### Why These Technologies?

**Node.js + TypeScript**
- Type safety for enterprise applications
- Rich ecosystem and community support
- Async/await for scalable I/O operations
- Excellent performance for I/O-bound workloads

**PostgreSQL**
- ACID compliance for financial data
- Advanced row-level security features
- Excellent JSON support
- Proven scalability and reliability

**Prisma ORM**
- Type-safe database access
- Automatic migrations and schema management
- Built-in connection pooling
- Excellent multi-tenant support

**Redis + BullMQ**
- In-memory caching for performance
- Reliable job queue with persistence
- Pub/sub for real-time features
- Horizontal scaling capabilities

**Express.js**
- Mature and battle-tested framework
- Rich middleware ecosystem
- Excellent TypeScript support
- Performance-optimized routing

This architecture ensures **scalability**, **security**, **maintainability**, and **production-readiness** for enterprise inventory management.
