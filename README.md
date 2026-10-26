# Transaction Execution API

REST API para ejecutar transacciones financieras `CREDIT` y `DEBIT` contra un proveedor externo, persistir su resultado y consultar el historial.

> Esta API no administra cuentas ni saldos. Eso lo hace el proveedor.

## Tech Stack

NestJS + TypeScript · PostgreSQL + TypeORM · class-validator · Axios · Swagger / OpenAPI · Jest · Docker Compose

Arquitectura hexagonal (ports / adapters).

---

## Architecture

Hexagonal para que el **dominio** no dependa de Nest, TypeORM ni Axios. Los casos de uso sí usan el DI de Nest (`@Injectable` / `@Inject`).

```text
src/
├── common/                  config, filtros, interceptors
└── transactions/
    ├── domain/              entidad, invariantes, errores, puerto del repositorio
    ├── application/         casos de uso + ProviderPort
    └── infrastructure/
        ├── http/            controller, DTOs, mapper
        ├── persistence/     TypeORM + cursor keyset
        └── provider/        adapter HTTP + circuit breaker
```

Reglas de negocio (`amount > 1.00`, DEBIT ≤ `10000.00`, solo `MXN`) viven en `Transaction.validatePayload`. El DTO solo valida forma. Si fallan, se responde `400` **sin** llamar al proveedor.

---



# Getting Started



## Option 1 — Docker Compose

```bash
docker compose up --build
```


| Servicio      | URL                                                                                    |
| ------------- | -------------------------------------------------------------------------------------- |
| API           | [http://localhost:3000](http://localhost:3000)                                         |
| Swagger UI    | [http://localhost:3000/docs](http://localhost:3000/docs)                               |
| Mock provider | [http://localhost:3001/provider/v1/execute](http://localhost:3001/provider/v1/execute) |
| PostgreSQL    | localhost:5432                                                                         |


Schema: TypeORM `synchronize` cuando `NODE_ENV !== production`. No hay migraciones en este repo para mantener el entorno local simple y reproducible. En un despliegue productivo lo reemplazaría por migraciones versionadas.

---



## Option 2 — Local (sin Docker)

```bash
cp .env.example .env
npm install
```

Hace falta Postgres y un mock provider corriendo. Las variables requeridas son `DATABASE_URL` y `PROVIDER_BASE_URL`; `NODE_ENV`, `PORT` y `PROVIDER_TIMEOUT_MS` están en `.env.example` como configuración de entorno.

```bash
npm run start:mock        # :3001
npm run start:dev         # :3000
```

---



# Decisiones de diseño

- **PostgreSQL** — el enunciado pide persistir y consultar con filtros. Una base relacional con índices en `account_id`, `status`, `type` y `(created_at, id)` cubre ese acceso de datos sin agregar infraestructura innecesaria. No incluí pruebas de carga, por lo que el README no presenta cifras de throughput.
- **Montos en** `DECIMAL(18,2)` — en Postgres, para no guardar plata como float. En JSON salen como `number` porque este servicio no suma saldos. El dominio también usa `number`.
- **Paginación cursor** — el PDF sugiere `page` / `limit`. Acá es `cursor` + `limit` + `nextCursor` (keyset sobre `(created_at, id)`). `OFFSET` se degrada con el volumen que describe el enunciado. No se expone `total`: un `COUNT(*)` recorrería el filtro entero.
- **Proveedor** — puerto + adapter HTTP. Timeout 3s por intento (`PROVIDER_TIMEOUT_MS`). Hasta 3 intentos con backoff + jitter, solo timeout / red / `5xx`. Un `4xx` de negocio no se reintenta.
- **Circuit breaker** — in-memory, alrededor del adapter. 5 `execute()` retryable → abre 10s → half-open. Cada `execute()` ya puede haber hecho hasta 3 HTTP. Sirve en un proceso; no se comparte entre réplicas. En producción iría una lib con estado compartido.
- **Idempotencia** — header opcional `Idempotency-Key`, para no cambiar el body del enunciado. En un sistema real debería ser obligatoria.

---



# API


| Método | Path            | Descripción                                                 |
| ------ | --------------- | ----------------------------------------------------------- |
| POST   | `/transactions` | Ejecuta una transacción (header opcional `Idempotency-Key`) |
| GET    | `/transactions` | Filtros `accountId` / `status` / `type` + paginación cursor |




## POST `/transactions`

```http
POST /transactions
Content-Type: application/json
Idempotency-Key: optional-key-123
```

```json
{
  "accountId": "acc-123456",
  "type": "CREDIT",
  "amount": 1500.0,
  "currency": "MXN",
  "description": "Transferencia recibida"
}
```



### Mapeo del proveedor


| Proveedor                                       | Persistido                                             | HTTP al cliente |
| ----------------------------------------------- | ------------------------------------------------------ | --------------- |
| `200` + `APPROVED`                              | `EXECUTED` + `providerTransactionId` + `balanceAfter`  | `201`           |
| `4xx` + `{ status: "REJECTED", code, message }` | `REJECTED`; `failureReason` = `message` (no el `code`) | `201`           |
| Timeout, red, `5xx`, circuit abierto            | `FAILED` + `failureReason`, y se relanza               | `503`           |
| `4xx` que no es rechazo de negocio              | `FAILED`                                               | `502`           |


Un tope de dominio (monto, DEBIT, moneda) no llega al proveedor: `400`.

### HTTP status codes


| Status | Caso                                                                    |
| ------ | ----------------------------------------------------------------------- |
| `201`  | Ejecutada o rechazada por negocio del proveedor                         |
| `400`  | Request inválido o regla de negocio local                               |
| `409`  | Misma `Idempotency-Key` con otro body, o colisión unique en una carrera |
| `502`  | El proveedor respondió un `4xx` que no es rechazo de negocio            |
| `503`  | Timeout, red, `5xx` o circuit breaker abierto                           |


---



# Idempotency

Header opcional:

```http
Idempotency-Key: <5-36 characters>
```

Si no viene, cada POST es un intento nuevo.

Si viene:

- `EXECUTED` / `REJECTED` con el mismo body → se devuelve la fila (201).
- Mismo header, otro body → `409`.
- Registro `FAILED` → `503` **sin** volver a llamar al proveedor. Es una limitación conocida: esa key conserva el estado fallido hasta que el cliente use otra.
- Dos POST en paralelo con la misma key pueden pegar el unique y responder `409` aunque el body coincida. No se relee la fila.

---



# GET `/transactions`

```http
GET /transactions?accountId=acc-123456&status=EXECUTED&type=CREDIT&limit=10&cursor=<cursor>
```

Filtros y paginación, todos opcionales: `accountId`, `status`, `type`, `limit`, `cursor`.


| Parámetro | Default | Máximo |
| --------- | ------- | ------ |
| `limit`   | 10      | 100    |


```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "accountId": "acc-123456",
      "type": "CREDIT",
      "amount": 1500.0,
      "currency": "MXN",
      "description": "Transferencia recibida",
      "status": "EXECUTED",
      "providerTransactionId": "txn-789",
      "balanceAfter": 5500.0,
      "failureReason": null,
      "createdAt": "2025-03-15T10:30:00.000Z"
    }
  ],
  "nextCursor": "MjAyNS0wMy0xNVQxMDozMDowMC4wMDBafDU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMA"
}
```

`nextCursor` es opaco: base64url de `{createdAt ISO}|{id}`. `null` si no hay más página. La API valida la estructura básica del cursor; no está pensado para que el cliente lo construya manualmente.

---



# Provider Mock

`mock-provider/` es una app Nest mínima, aparte del servicio.

Saldo inicial simulado: `$10,000 MXN` por request (no por cuenta).


| Operación en el mock | El mock respondería             | Lo que ve la API                        |
| -------------------- | ------------------------------- | --------------------------------------- |
| `CREDIT`             | `APPROVED`                      | `EXECUTED`                              |
| `DEBIT ≤ 10,000`     | `APPROVED`                      | `EXECUTED`                              |
| `DEBIT > 10,000`     | `REJECTED / INSUFFICIENT_FUNDS` | **No llega:** el dominio responde `400` |


El tope de DEBIT del enunciado y el saldo del mock son el mismo número. Por HTTP no se ejerce un `REJECTED` del proveedor. Ese mapeo está cubierto en unitarios mockeando el puerto.

---



# Testing

```bash
npm test          # unitarios (dominio, casos de uso, adapter HTTP, circuit breaker)
npm run test:e2e  # AppModule real: necesita Postgres + mock en PROVIDER_BASE_URL
```

Los e2e no mockean el módulo principal: levantan `AppModule` y esperan dependencias reales disponibles. Por eso no levantan Postgres ni el mock provider por sí solos; esos servicios se pueden iniciar con Docker Compose o manualmente antes de correrlos.

---



# Uso de IA

Usé Cursor como herramienta de productividad durante el desarrollo. Lo usé principalmente para acelerar tareas repetitivas, generar primeras versiones de código y revisar consistencia contra el enunciado.

El criterio de diseño y los recortes del alcance no los delegué: revisé el código, ajusté las decisiones y mantuve solo lo que puedo explicar y defender.

**Uso concreto**

- Boilerplate: Nest hexagonal, Docker, mock del proveedor, TypeORM, DTOs.
- Primera pasada de tests y de este README.
- Automatización de corridas de test y revisiones contra el enunciado. Esa automatización vive **fuera** de este repositorio y no forma parte de la entrega.

**Qué decidí yo**

- Invariantes en el dominio (`Transaction.validatePayload`), no en el DTO.
- Cursor en lugar de `page`/`limit` del PDF.
- Timeout + retry en el adapter; breaker in-memory, sin librería extra.
- Idempotencia por header opcional, sin tocar el contract del body.
- `FAILED` + 503 en fallo técnico; `REJECTED` de negocio se persiste y sale 201.

**Limitaciones conocidas**

- Un `FAILED` con la misma `Idempotency-Key` no reintenta al proveedor.
- El breaker no se comparte entre réplicas.
- `synchronize` no reemplaza migraciones.
- El cursor se trata como valor opaco; se valida su estructura básica, no se expone como contrato para ser generado por clientes.
- El mock no demuestra `REJECTED` por HTTP; eso está en unitarios.

