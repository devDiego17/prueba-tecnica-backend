# Prueba Tecnica - Backend Developer

Bienvenido/a a la prueba tecnica para la posicion de **Backend Developer**. Esta prueba evalua tus habilidades en Node.js, TypeScript, NestJS, Express.js, PostgreSQL, Docker y arquitectura de microservicios.

## Como empezar

1. Haz un **fork** de este repositorio a tu cuenta de GitHub.
2. Clona tu fork localmente.
3. Lee [docs/01-requisitos-perfil.md](docs/01-requisitos-perfil.md) para entender el perfil esperado.
4. Lee [docs/02-prueba-practica.md](docs/02-prueba-practica.md) para las instrucciones completas de la prueba.
5. Lee [docs/03-instrucciones-entrega.md](docs/03-instrucciones-entrega.md) para saber como entregar tu solucion.

## Tiempo Limite

**8 horas** desde el momento en que se comparte este repositorio con el candidato.

Exitos.
 
 Parte 1 — Incremento de el modulo 1, Modelado de Base de Datos y Merchants;

Configuración de Prisma v7 con PostgreSQL vía Docker
Schema relacional con las entidades merchants, transactions, settlements y settlement_transactions
Enums para MerchantStatus, Currency, TransactionType, TransactionStatus y SettlementStatus
Índices en campos de búsqueda frecuente (merchant_id, status, created_at)
Migración inicial aplicada con prisma migrate dev
Módulo merchants con endpoint POST /merchants para registro de comercios
Generación automática de api_key con UUID v4
Validación de duplicados por email con respuesta 409 Conflict
Validación de payload con class-validator y ValidationPipe global


Parte 2.1 — Módulo de Transacciones

Endpoint POST /transactions para crear transacciones con validación de merchant existente
Generación automática de referencia única con formato TXN-{YYYYMMDD}-{random6chars}
Endpoint GET /transactions con paginación offset y filtros por status, type, date_from, date_to
Endpoint GET /transactions/:id para obtener detalle de una transacción
Endpoint PATCH /transactions/:id/status con máquina de estados:

pending → approved, rejected, failed
approved → completed, failed
Cualquier otra transición retorna 422 Unprocessable Entity


Validaciones con class-validator en todos los endpoints
Transformación automática de query params con class-transformer

Parte 2.2 — Módulo de Liquidaciones (Settlements)

Endpoint POST /settlements/generate para generar liquidaciones de un merchant en un rango de fechas
Solo agrupa transacciones con status approved que no pertenezcan a una liquidación previa
Calcula total_amount y transaction_count automáticamente
Creación atómica usando transacción de base de datos (prisma.$transaction)
Retorna 404 si no hay transacciones elegibles en el periodo
Endpoint GET /settlements/:id que retorna el detalle de la liquidación con sus transacciones asociadas


Parte 2.3 — Guard de Autenticación por API Key

Guard ApiKeyGuard que lee el header x-api-key y valida el merchant en la DB
Retorna 401 Unauthorized si la API key no existe
Retorna 403 Forbidden si el merchant está inactivo
Inyecta el objeto merchant en el request automáticamente
Decorador @CurrentMerchant() para extraer el merchant en controllers
El merchant_id se inyecta automáticamente desde la API key — no es necesario enviarlo en el body