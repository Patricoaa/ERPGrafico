# 00 — Legacy DB Schema (`ordenes_dump`)

> Snapshot **verificado contra la BD real** el **2026-06-13** (vía MCP `postgres-ordenes` / `psql`). Reemplaza la versión anterior, que describía columnas y estados que **no existen** en `ordenes_dump`. Todos los conteos y nombres de columna de este documento están confirmados con queries.

## 0. Conexión (referencia)

| Parámetro | Valor |
|---|---|
| Engine | PostgreSQL (nativo del host, **no** el contenedor Docker del proyecto) |
| Host / Puerto | `127.0.0.1:5432` (el postgres de Docker del ERP va en `5433`) |
| Database | `ordenes_dump` |
| Credenciales | `postgres:postgres` |
| MCP | `postgres-ordenes` (read-only) — tools disponibles tras reiniciar Claude Code |
| psql | `PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d ordenes_dump` |
| Schemas | `public` |
| Encoding | UTF-8 |
| Timezone columnas | `timestamp without time zone` (naive; asumir `America/Santiago` al importar) |
| Moneda | CLP implícita; montos son `integer` (sin centavos) |

## 1. Tablas (13 total, 5 importadas)

Tablas en `public`: `alembic_version`, `attachments`, `categorias`, `clientes`, `company_config`, `descripciones`, `logs`, `notification_logs`, `ordenes`, `pagos`, `settings`, `usuarios`, `vendedores`.

Se importan **5**: `clientes`, `vendedores`, `categorias` (hardcodeada), `ordenes`, `pagos`. `descripciones` (24 filas) es catálogo y **no** se importa (la línea ya está en `ordenes.descripcion`). El resto (logs, sesiones, config, attachments) se ignora.

### 1.0 Columnas de auditoría comunes (TODAS las tablas)

Cada tabla del legacy incluye, además de sus columnas de negocio:

`uuid` (varchar, NOT NULL), `source` (varchar, NOT NULL, ∈ `{import, web}`), `version` (int, NOT NULL), `created_at` / `updated_at` (timestamp, NOT NULL), `created_by_id` / `updated_by_id` (int, NULL), **`deleted_at` (timestamp, NULL)**, `deleted_by_id` (int, NULL).

> ⚠️ **El legacy SÍ tiene soft-delete** (`deleted_at`). Hoy hay **0 filas borradas** en las 5 tablas, pero **todos los importers DEBEN filtrar `WHERE deleted_at IS NULL`** para ser correctos si en el futuro se reusa este dump. Esto corrige la afirmación previa ("el legacy no tenía soft-delete"), que era falsa a nivel de esquema.

### 1.1 `clientes` — 2.843 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | autoincrement legacy |
| `nombre` | varchar | NOT NULL | razón social / nombre |
| `rut` | varchar | NOT NULL | **sin puntos ni guión**, cuerpo+DV concatenado (ej. `113997664`, `11450498K`); DV puede ser `K` (262 casos); largo 8–9; puede traer ceros a la izquierda |
| `telefono` | varchar | NULL | formato libre |
| `correo` | varchar | NULL | **`correo`, no `email`**; 61 nulos |
| + auditoría (§1.0) | | | `source`: 2.777 `import`, 66 `web` |

> **NO existe columna `direccion`** en `clientes`. No hay dirección de cliente que migrar.

**Índices**: PK(`id`).

### 1.2 `vendedores` — 137 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | |
| `nombre` | varchar | NOT NULL | |
| `rut` | varchar | NOT NULL | algunos sintéticos (`100000001`, `100000003`…), otros reales |
| `telefono` | varchar | NULL | |
| `correo` | varchar | NULL | |
| `categoria` | varchar | NOT NULL | **`categoria`, no `category`**; **137/137 = `externo`** |
| + auditoría (§1.0) | | | |

> 122 RUTs de vendedores (normalizados) **colisionan** con RUTs de `clientes`. Relevante para cualquier estrategia que convierta un vendedor en `Contact` (ver §3.4 y nota en `04`).

### 1.3 `categorias` — 5 filas

| `id` | `nombre` (real, verificado) |
|---|---|
| 1 | Impresion Digital |
| 2 | Impresion Offset |
| 3 | Calendarios |
| 4 | Timbres |
| 5 | Fotocopias y encuadernado |

(Además: `icono_bootstrap`, auditoría.) Se **hardcodean** los 5 nombres en el importer por idempotencia. `ordenes.categoria_id` ∈ {1..5} en 7.980/7.980.

### 1.4 `ordenes` — 7.980 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | el identificador único real de la NV |
| `cliente_id` | int4 → `clientes.id` | NOT NULL | 0 huérfanos |
| `usuario_id` | int4 → `usuarios.id` | NOT NULL | **operador** que creó la NV (3 distintos); **≠ vendedor**. No se migra (o se mapea a `created_by`) |
| `fecha_ingreso` | **timestamp** | NOT NULL | fecha emisión NV (rango **2017-01-02 … 2026-05-28**); es la fecha "de la NV" |
| `descripcion` | varchar | NULL (0 nulos) | **la línea textual corta** de la NV (mapea al antiguo `descripcion_texto`) |
| `detalles` | text | NULL | notas largas; **7.379/7.980 tienen contenido** — preservar |
| `cantidad` | int4 | NULL (0 nulos) | ≥ 1 en la práctica |
| `precio_neto` | int4 | NOT NULL | CLP sin IVA |
| `iva` | int4 | NULL (0 nulos) | CLP IVA |
| `precio_total` | int4 | NOT NULL | `precio_neto + iva = precio_total` en 7.980/7.980 |
| `estado_trabajo` | varchar | NULL | **`terminado` (7.960)** / **`pendiente` (20)** — ver §3.1 |
| `estado_despachado` | varchar | NULL | **`despachado` (7.960)** / **`no despachado` (20)** — 1:1 con `estado_trabajo` |
| `folio` | varchar | NULL | número humano; **109 vacíos** y **NO único** (1.966 distintos de 7.871 no vacíos) → solo display, nunca clave |
| `archivo_link` | varchar | NULL | **siempre vacío** (0 con contenido) — ignorar |
| `fecha_entrega_estimada` | timestamp | NOT NULL | fecha entrega planificada |
| `categoria_id` | int4 → `categorias.id` | NULL (0 nulos) | ∈ {1..5} |
| `vendedor_id` | int4 → `vendedores.id` | NOT NULL | 0 huérfanos |
| + auditoría (§1.0) | | | `source`: 7.664 `import`, 316 `web` |

> **No existen** las columnas `numero`, `descripcion_texto`, `descripcion_id`, `fecha`, `estado`, `despachado`, `pendiente` que describía la versión anterior. **No existe ningún estado `anulada`** — las 7.980 NVs están vivas.

**Índices**: PK(`id`).

### 1.5 `pagos` — 8.556 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | |
| `orden_id` | int4 → `ordenes.id` | NULL (0 nulos, 0 huérfanos) | nullable en esquema, pero limpio en datos |
| `fecha` | timestamp | NOT NULL | rango 2017-01-30 … 2026-05-29 |
| `monto` | int4 | NOT NULL | **`monto`, no `abono`**; CLP |
| `metodo` | varchar | NOT NULL | **`metodo`, no `forma_pago`**; ∈ `{efectivo (8.494), transferencia (53), tarjeta (9)}` — **NO existe `cheque`** |
| `referencia` | varchar | NULL | nº de transferencia/comprobante |
| `notas` | text | NULL | |
| `usuario_id` | int4 → `usuarios.id` | NOT NULL | operador que registró el pago |
| + auditoría (§1.0) | | | |

**Distribución**: 31/7.980 NVs sin pagos; 607 NVs con múltiples pagos; **7 NVs sobrepagadas** (Σ`monto` > `precio_total`).

### 1.6 `descripciones` — 24 filas (NO importada)

Catálogo (`texto`, `categoria_id`). No se importa; `ordenes.descripcion` ya tiene el texto final. `ordenes` **no** tiene FK hacia esta tabla.

## 2. Reglas de validación verificadas (2026-06-13)

| Verificación | Resultado |
|---|---|
| `clientes` total / vivos (`deleted_at IS NULL`) | 2.843 / 2.843 |
| `clientes.rut` único y no vacío | 2.843 distintos, 0 vacíos |
| `vendedores` total / `categoria='externo'` | 137 / 137 |
| `categorias` | 5 (ids 1..5, nombres verificados) |
| `ordenes` total / vivas | 7.980 / 7.980 |
| `ordenes.cliente_id` / `vendedor_id` / `categoria_id` resolvibles | 7.980 / 7.980 cada uno |
| `ordenes.precio_neto + iva == precio_total` | 7.980 / 7.980 |
| `ordenes` con `estado='anulada'` | **0 (no existe ese estado)** |
| `pagos` total / `orden_id` resolvible | 8.556 / 8.556 (0 huérfanos, 0 nulos) |
| `pagos.metodo` | efectivo 8.494 / transferencia 53 / tarjeta 9 |
| NVs sin pagos | 31 |
| NVs sobrepagadas (Σ pagos > total) | **7** |
| Filas con `deleted_at IS NOT NULL` (cualquier tabla) | 0 (pero la columna existe) |

## 3. Semántica de negocio (legacy → ERPGrafico)

### 3.1 Estado de la NV (dos columnas, 1:1)

El legacy **no tiene un único campo `estado`**. Usa dos columnas que co-varían perfectamente:

| `estado_trabajo` | `estado_despachado` | Filas | `status` propuesto | `is_pending` | `dispatched_at` |
|---|---|---|---|---|---|
| `terminado` | `despachado` | 7.960 | `DISPATCHED` | False | `fecha_ingreso` |
| `pendiente` | `no despachado` | 20 | `PENDING` | True | NULL |

Solo existen **estos 2 combos**. No hay `IN_PRODUCTION`, `no_despachado` (con guión bajo) ni `anulada`. El mapeo correcto deriva de `estado_trabajo` (o equivalentemente de `estado_despachado`, son redundantes).

### 3.2 Descripción / detalles

- `descripcion` (varchar): la **línea** corta de la NV → `LegacySaleNote.description`.
- `detalles` (text, 7.379 con contenido): notas largas → preservar en un campo aparte (`LegacySaleNote.notes` o concatenado). No descartar.

### 3.3 Mapeo categoría → producto

Las 5 categorías se consolidan en un único producto servicio `LEGACY-OT-PRODUCT`. La categoría se preserva como texto en `LegacySaleNote.category_snapshot` (CharField), **no** FK. (Nombres en §1.3.)

### 3.4 Vendedor / usuario / cliente

- `vendedor_id` → `LegacyVendor` (137, todos `externo`). Tienen `rut` (parcialmente sintético; 122 colisionan con `clientes.rut`).
- `usuario_id` → operador (`usuarios`, 5 filas: admin, Admin, Karen, Julio, Jose). **No se migra como entidad** (opcional: mapear a `created_by`).
- `cliente_id` → `Contact` vivo + `ContactLegacyOrigin`.

> ⚠️ **Decisión a revisar** (ver `04` §4.1): el plan previo, para vendedor `externo`, convertía al vendedor en el `customer` del `Contact` y degradaba al cliente real a `related_contact`. Como **137/137 son externo**, eso dejaría a **ninguna** NV con su cliente real como `customer`, contradiciendo "los clientes legacy SÍ se mapean a Contact". Recomendación: `customer = cliente real` siempre; `vendor = LegacyVendor` como referencia.

## 4. Decisiones de importación (resumen)

1. Una NV legacy = 1 línea textual (`descripcion`); `detalles` se preserva aparte.
2. Una NV legacy = 1 WorkOrder histórica finalizada (ver `04` §7 — **no** vía `create_manual`).
3. Una NV legacy = N `LegacyPayment` históricos.
4. Pagos nuevos sobre NV legacy NO se importan; se registran post-import vía UI.
5. `vendedores` → `LegacyVendor` (no `Contact`).
6. `clientes` → `Contact` vivo + `ContactLegacyOrigin`.
7. Filtrar siempre `deleted_at IS NULL`.

## 5. Salida esperada del import

| Tabla destino | Filas |
|---|---|
| `contacts` (clientes) | ≥ 2.843 (pueden mergearse duplicados por RUT normalizado) |
| `legacy.ContactLegacyOrigin` | 2.843 |
| `legacy.LegacyVendor` | 137 |
| `legacy.LegacySaleNote` | **7.980** (todas vivas — **no hay anuladas que excluir**) |
| `legacy.LegacyPayment` | 8.556 |
| `production.WorkOrder` (histórica, finalizada) | 7.980 |
| `legacy.LegacyImport` | 1 por corrida |

**Reconciliación**: 2.843 + 137 + 7.980 + 8.556 + 7.980 = **27.496** filas creadas (+ orígenes de contacto).

## 6. Riesgos de datos (verificados)

- **RUT**: formato sin puntos/guión; el normalizador debe aceptar cuerpo+DV concatenado, DV `K`, y ceros a la izquierda. (La afirmación previa "1 RUT inválido por módulo 11" no se pudo confirmar; todos los RUTs son únicos y no vacíos — validar módulo 11 al importar y marcar `tax_id_exception` en los que fallen.)
- **`Contact.tax_id` es `UNIQUE` + `NOT NULL`** en ERPGrafico → la estrategia de duplicados/excepción **no puede** usar `tax_id=''` ni `None` (ver `04` §2).
- **7 NVs sobrepagadas** → la UI debe tolerar saldo pendiente negativo (o mostrar 0).
- **`folio` no único y con 109 vacíos** → nunca usar como clave; solo display.
- **Métodos de pago**: incluir `tarjeta` en los choices (no `cheque`).
- **Soft-delete**: filtrar `deleted_at IS NULL` aunque hoy sea 0.

## 7. Lo que **no** se preserva

- `folio` (número humano): se guarda como `legacy_number` (string, no único) solo para mostrar.
- `usuario_id` (operador), `archivo_link` (vacío), `source`, `version`, `uuid`: no se migran.
- Auditoría legacy (`created_by_id`, etc.): no se migra (salvo decisión de mapear operador a `created_by`).
- Los `id` legacy se preservan como `legacy_external_id`; ERPGrafico asigna PKs nuevos.
