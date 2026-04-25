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