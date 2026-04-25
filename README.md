# Sistema de Gestión de Pagos

Sistema de pagos con arquitectura de microservicios construido como prueba técnica. Incluye un API Gateway en Express.js, un servicio de pagos en NestJS, un servicio de notificaciones orientado a eventos y una base de datos PostgreSQL. La comunicación asíncrona entre servicios se maneja con BullMQ sobre Redis.

## Tabla de contenidos

- [Requisitos previos](#requisitos-previos)
- [Cómo levantar el proyecto](#cómo-levantar-el-proyecto)
- [Variables de entorno](#variables-de-entorno)
- [Arquitectura](#arquitectura)
- [Autenticación](#autenticación)
- [Endpoints](#endpoints)
- [Partes implementadas](#partes-implementadas)

---

## Requisitos previos

- Node.js 20 o superior
- Docker y Docker Compose
- npm

---

## Cómo levantar el proyecto

### Con Docker (recomendado para el core del sistema)

El docker-compose levanta PostgreSQL, el payment-service y el API Gateway con un solo comando:

```bash
git clone https://github.com/devDiego17/prueba-tecnica-backend.git
cd prueba-tecnica-backend
docker-compose up --build
```

Una vez que los tres servicios están corriendo el sistema ya acepta requests en `http://localhost:3000`.

### Servicios adicionales (BullMQ y notification-service)

El notification-service y Redis requieren configuración adicional. Primero levanta Redis:

```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

Luego corre el notification-service en una terminal separada:

```bash
cd notification-service
npm install
npm run start:dev
```

### Sin Docker (desarrollo local completo)

Si prefieres correr todo localmente sin contenedores, necesitas cuatro terminales:

```bash
# Terminal 1 - Base de datos
docker-compose up payment_db

# Terminal 2 - Payment Service
cd payment-service
npm install
npm run start:dev

# Terminal 3 - Notification Service
cd notification-service
npm install
npm run start:dev

# Terminal 4 - API Gateway
cd api-gateway
npm install
npm run start:dev
```

---

## Variables de entorno

Cada servicio tiene su propio archivo `.env`. Crea estos archivos antes de correr en modo local.

**payment-service/.env**
```
DATABASE_URL="postgresql://user:password@localhost:5432/payments_db?schema=public"
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
```

**notification-service/.env**
```
DATABASE_URL="postgresql://user:password@localhost:5432/payments_db?schema=public"
PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379
```

**api-gateway/.env** (opcional, estos son los valores por defecto)
```
PORT=3000
PAYMENT_SERVICE_URL=http://localhost:3001
NOTIFICATION_SERVICE_URL=http://localhost:3002
```

Cuando corres con Docker, las variables de los servicios se configuran directamente en `docker-compose.yaml` y no necesitas los archivos `.env`.

---

## Arquitectura

El sistema tiene tres servicios principales que se comunican entre sí:

El **API Gateway** (puerto 3000) es el único punto de entrada. Recibe todos los requests, valida la autenticación, aplica rate limiting, ejecuta el circuit breaker y redirige al payment-service. Los health checks son la única excepción: no requieren autenticación y el gateway los resuelve de forma interna consultando a los demás servicios.

El **Payment Service** (puerto 3001) contiene toda la lógica de negocio. Gestiona merchants, transacciones y liquidaciones. Cada vez que cambia el estado de una transacción publica un evento en Redis usando BullMQ, sin esperar a que el notification-service lo procese.

El **Notification Service** (puerto 3002) es un consumidor de cola. Escucha los eventos publicados por el payment-service y los procesa de forma independiente. Si está caído cuando se publica un evento, el job queda en Redis y se procesa en cuanto el servicio vuelve a estar disponible.

Para más detalle sobre las decisiones de arquitectura y el diagrama completo, ver [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Autenticación

Todos los endpoints requieren autenticación, excepto `POST /api/v1/merchants` y `GET /api/v1/health`.

El gateway acepta dos métodos y valida uno u otro, no ambos a la vez:

**API Key** — la forma más directa. Se obtiene al crear un merchant y se envía en el header `x-api-key`:
```
x-api-key: b12ee2e0-62b9-461a-a3b1-3ce22356bac9
```

**JWT** — útil para integraciones donde se generan tokens programáticamente. El token debe estar firmado con la clave `PRUEBA_TECNICA_SECRET_KEY`:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Endpoints

La base de todas las rutas es `http://localhost:3000/api/v1`.

### Health

**GET /api/v1/health**

No requiere autenticación. Consulta el estado de todos los servicios en paralelo y devuelve un resumen. Si algún servicio está caído, el status general cambia a `degraded` pero el endpoint siempre responde con 200.

```json
{
  "status": "ok",
  "services": {
    "payment-service": {
      "status": "ok",
      "database": "connected",
      "uptime": 3600
    },
    "notification-service": {
      "status": "ok",
      "database": "connected",
      "uptime": 1800
    }
  },
  "timestamp": "2026-04-25T10:30:00.000Z"
}
```

---

### Merchants

**POST /api/v1/merchants** — No requiere autenticación

Crea un nuevo merchant y genera su API key automáticamente. Si el email ya existe devuelve `409 Conflict`.

```json
// Request
{
  "name": "Mi Comercio",
  "email": "comercio@ejemplo.com"
}

// Response 201
{
  "id": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "name": "Mi Comercio",
  "email": "comercio@ejemplo.com",
  "api_key": "b12ee2e0-62b9-461a-a3b1-3ce22356bac9",
  "status": "active",
  "createdAt": "2026-04-25T00:00:00.000Z",
  "updatedAt": "2026-04-25T00:00:00.000Z"
}
```

---

### Transactions

**POST /api/v1/transactions**

El merchant se identifica a partir del header `x-api-key`, no hace falta enviar `merchant_id` en el body.

Valores válidos para `currency`: `GTQ`, `COP`, `USD`
Valores válidos para `type`: `payin`, `payout`

```json
// Request
{
  "amount": 100.50,
  "currency": "USD",
  "type": "payin"
}

// Response 201
{
  "id": "5dd89d1b-6d14-4b69-9d2c-232b0812c845",
  "merchantId": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "amount": "100.50",
  "currency": "USD",
  "type": "payin",
  "status": "pending",
  "reference": "TXN-20260425-DRTZ95",
  "metadata": null,
  "createdAt": "2026-04-25T02:12:41.638Z",
  "updatedAt": "2026-04-25T02:12:41.638Z"
}
```

---

**GET /api/v1/transactions**

Soporta paginación y filtros por query params:

| Param | Default | Descripción |
|---|---|---|
| `page` | 1 | Número de página |
| `limit` | 20 | Items por página (máximo 100) |
| `status` | — | Filtrar por status |
| `type` | — | Filtrar por tipo |
| `date_from` | — | Fecha inicio (ISO 8601) |
| `date_to` | — | Fecha fin (ISO 8601) |

```json
// Response 200
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

---

**GET /api/v1/transactions/:id**

Devuelve el detalle de una transacción por su UUID.

---

**PATCH /api/v1/transactions/:id/status**

Actualiza el estado de una transacción. Solo se permiten ciertas transiciones:

- `pending` puede cambiar a `approved`, `rejected` o `failed`
- `approved` puede cambiar a `completed` o `failed`
- Cualquier otra transición devuelve `422 Unprocessable Entity`

```json
// Request
{
  "status": "approved"
}
```

Al completarse, el sistema publica un evento en la cola para que el notification-service lo procese.

---

### Settlements

**POST /api/v1/settlements/generate**

Agrupa todas las transacciones con status `approved` del merchant en el rango de fechas indicado y crea una liquidación. Una transacción solo puede pertenecer a una liquidación. Si no hay transacciones elegibles devuelve `404`.

```json
// Request
{
  "merchant_id": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "period_start": "2026-04-01T00:00:00Z",
  "period_end": "2026-04-30T23:59:59Z"
}

// Response 201
{
  "id": "f875cb6b-29f0-44c4-9ce2-3e1debbccb6e",
  "merchantId": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "totalAmount": "750.00",
  "transactionCount": 3,
  "status": "pending",
  "periodStart": "2026-04-01T00:00:00.000Z",
  "periodEnd": "2026-04-30T23:59:59.000Z",
  "createdAt": "2026-04-25T04:17:07.700Z"
}
```

---

**GET /api/v1/settlements/:id**

Devuelve el detalle de una liquidación con todas las transacciones asociadas.

---

## Partes implementadas

- Parte 1 — Modelado de base de datos con Prisma y migraciones
- Parte 2 — Payment Service con NestJS (merchants, transactions, settlements)
- Parte 3 — API Gateway con Express.js (proxy, auth, rate limiting)
- Parte 4 — Docker, Dockerfiles y docker-compose
- Parte 5.1 — Notification Service con comunicación event-driven via BullMQ
- Parte 5.2 — Circuit Breaker en el API Gateway
- Parte 5.3 — Health Checks en los tres servicios
- Parte 5.4 — ARCHITECTURE.md con diagramas y decisiones de diseño

---
---

# Payment Management System

A payment system built with a microservices architecture as a technical assessment. It includes an Express.js API Gateway, a NestJS payment service, an event-driven notification service, and a PostgreSQL database. Asynchronous communication between services is handled by BullMQ on top of Redis.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Running the project](#running-the-project)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Authentication](#authentication)
- [Endpoints](#endpoints-1)
- [What's implemented](#whats-implemented)

---

## Prerequisites

- Node.js 20 or higher
- Docker and Docker Compose
- npm

---

## Running the project

### With Docker (recommended for the core system)

The docker-compose file starts PostgreSQL, the payment-service, and the API Gateway with a single command:

```bash
git clone https://github.com/devDiego17/prueba-tecnica-backend.git
cd prueba-tecnica-backend
docker-compose up --build
```

Once all three services are running the system is ready to accept requests at `http://localhost:3000`.

### Additional services (BullMQ and notification-service)

The notification-service and Redis require additional setup. Start Redis first:

```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

Then run the notification-service in a separate terminal:

```bash
cd notification-service
npm install
npm run start:dev
```

### Without Docker (full local development)

If you prefer to run everything locally without containers, you will need four terminals:

```bash
# Terminal 1 - Database
docker-compose up payment_db

# Terminal 2 - Payment Service
cd payment-service
npm install
npm run start:dev

# Terminal 3 - Notification Service
cd notification-service
npm install
npm run start:dev

# Terminal 4 - API Gateway
cd api-gateway
npm install
npm run start:dev
```

---

## Environment variables

Each service has its own `.env` file. Create these files before running in local mode.

**payment-service/.env**
```
DATABASE_URL="postgresql://user:password@localhost:5432/payments_db?schema=public"
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
```

**notification-service/.env**
```
DATABASE_URL="postgresql://user:password@localhost:5432/payments_db?schema=public"
PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379
```

**api-gateway/.env** (optional — these are the default values)
```
PORT=3000
PAYMENT_SERVICE_URL=http://localhost:3001
NOTIFICATION_SERVICE_URL=http://localhost:3002
```

When running with Docker, service variables are configured directly in `docker-compose.yaml` and the `.env` files are not needed.

---

## Architecture

The system has three main services that communicate with each other.

The **API Gateway** (port 3000) is the single entry point. It receives all requests, validates authentication, applies rate limiting, runs the circuit breaker, and proxies to the payment-service. Health checks are the only exception: they require no authentication and the gateway resolves them internally by querying the other services.

The **Payment Service** (port 3001) holds all the business logic. It manages merchants, transactions, and settlements. Every time a transaction status changes it publishes an event to Redis using BullMQ, without waiting for the notification-service to process it.

The **Notification Service** (port 3002) is a queue consumer. It listens for events published by the payment-service and processes them independently. If it is down when an event is published, the job stays in Redis and is processed as soon as the service comes back up.

For more detail on architecture decisions and the full diagram, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Authentication

All endpoints require authentication, except `POST /api/v1/merchants` and `GET /api/v1/health`.

The gateway accepts two methods and validates one or the other, not both at the same time:

**API Key** — the most straightforward approach. You get one when creating a merchant and send it in the `x-api-key` header:
```
x-api-key: b12ee2e0-62b9-461a-a3b1-3ce22356bac9
```

**JWT** — useful for integrations where tokens are generated programmatically. The token must be signed with the key `PRUEBA_TECNICA_SECRET_KEY`:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Endpoints

The base path for all routes is `http://localhost:3000/api/v1`.

### Health

**GET /api/v1/health**

No authentication required. Queries the status of all services in parallel and returns a summary. If a service is down, the overall status changes to `degraded` but the endpoint always responds with 200.

```json
{
  "status": "ok",
  "services": {
    "payment-service": {
      "status": "ok",
      "database": "connected",
      "uptime": 3600
    },
    "notification-service": {
      "status": "ok",
      "database": "connected",
      "uptime": 1800
    }
  },
  "timestamp": "2026-04-25T10:30:00.000Z"
}
```

---

### Merchants

**POST /api/v1/merchants** — No authentication required

Creates a new merchant and generates its API key automatically. Returns `409 Conflict` if the email is already registered.

```json
// Request
{
  "name": "My Store",
  "email": "store@example.com"
}

// Response 201
{
  "id": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "name": "My Store",
  "email": "store@example.com",
  "api_key": "b12ee2e0-62b9-461a-a3b1-3ce22356bac9",
  "status": "active",
  "createdAt": "2026-04-25T00:00:00.000Z",
  "updatedAt": "2026-04-25T00:00:00.000Z"
}
```

---

### Transactions

**POST /api/v1/transactions**

The merchant is identified from the `x-api-key` header — there is no need to send `merchant_id` in the body.

Valid values for `currency`: `GTQ`, `COP`, `USD`
Valid values for `type`: `payin`, `payout`

```json
// Request
{
  "amount": 100.50,
  "currency": "USD",
  "type": "payin"
}

// Response 201
{
  "id": "5dd89d1b-6d14-4b69-9d2c-232b0812c845",
  "merchantId": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "amount": "100.50",
  "currency": "USD",
  "type": "payin",
  "status": "pending",
  "reference": "TXN-20260425-DRTZ95",
  "metadata": null,
  "createdAt": "2026-04-25T02:12:41.638Z",
  "updatedAt": "2026-04-25T02:12:41.638Z"
}
```

---

**GET /api/v1/transactions**

Supports pagination and filtering via query params:

| Param | Default | Description |
|---|---|---|
| `page` | 1 | Page number |
| `limit` | 20 | Items per page (maximum 100) |
| `status` | — | Filter by status |
| `type` | — | Filter by type |
| `date_from` | — | Start date (ISO 8601) |
| `date_to` | — | End date (ISO 8601) |

```json
// Response 200
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

---

**GET /api/v1/transactions/:id**

Returns the detail of a transaction by its UUID.

---

**PATCH /api/v1/transactions/:id/status**

Updates the status of a transaction. Only certain transitions are allowed:

- `pending` can move to `approved`, `rejected`, or `failed`
- `approved` can move to `completed` or `failed`
- Any other transition returns `422 Unprocessable Entity`

```json
// Request
{
  "status": "approved"
}
```

Once completed, the system publishes an event to the queue for the notification-service to process.

---

### Settlements

**POST /api/v1/settlements/generate**

Groups all `approved` transactions for the merchant within the specified date range and creates a settlement. A transaction can only belong to one settlement. Returns `404` if there are no eligible transactions.

```json
// Request
{
  "merchant_id": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "period_start": "2026-04-01T00:00:00Z",
  "period_end": "2026-04-30T23:59:59Z"
}

// Response 201
{
  "id": "f875cb6b-29f0-44c4-9ce2-3e1debbccb6e",
  "merchantId": "6e34996e-1b8c-4b1f-8133-cfb9d8cf8ba6",
  "totalAmount": "750.00",
  "transactionCount": 3,
  "status": "pending",
  "periodStart": "2026-04-01T00:00:00.000Z",
  "periodEnd": "2026-04-30T23:59:59.000Z",
  "createdAt": "2026-04-25T04:17:07.700Z"
}
```

---

**GET /api/v1/settlements/:id**

Returns the detail of a settlement with all its associated transactions.

---

## What's implemented

- Part 1 — Database modeling with Prisma and migrations
- Part 2 — Payment Service with NestJS (merchants, transactions, settlements)
- Part 3 — API Gateway with Express.js (proxy, auth, rate limiting)
- Part 4 — Docker, Dockerfiles, and docker-compose
- Part 5.1 — Notification Service with event-driven communication via BullMQ
- Part 5.2 — Circuit Breaker in the API Gateway
- Part 5.3 — Health Checks across all three services
- Part 5.4 — ARCHITECTURE.md with diagrams and design decisions
