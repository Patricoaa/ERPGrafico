# 00 — Legacy DB Schema (`ordenes_dump`)

> Snapshot standalone del esquema legacy al **2026-06-02**. Sin dependencias de ERPGrafico. Pensado para que un agente pueda ejecutar la importación sin acceso live a la BD origen.

## 0. Conexión (referencia)

| Parámetro | Valor |
|---|---|
| Engine | PostgreSQL (live, vía MCP / `psql`) |
| Database | `ordenes_dump` |
| Schemas | `public` (por defecto) |
| Encoding | UTF-8 (verificado) |
| Timezone columnas | naive (asumir `America/Santiago` al importar) |
| Moneda | CLP implícita; sin columna de moneda |

## 1. Tablas relevantes (16 total, 5 usadas)

Solo se documentan las **5 tablas que se importan**; el resto (logs, sesiones, catálogos duplicados) se ignoran.

### 1.1 `clientes` — 2.843 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | autoincrement legacy |
| `rut` | varchar(20) | NOT NULL | **1/2.843** con formato inválido (no bloquea import) |
| `nombre` | varchar(120) | NOT NULL | "Razón social" / nombre comercial legacy |
| `direccion` | varchar(200) | NULL | dirección física, sin normalizar |
| `telefono` | varchar(40) | NULL | formato libre |
| `email` | varchar(120) | NULL | formato libre |
| `created_at` | timestamp | NOT NULL | naive |

**Índices**: PK(`id`), idx(`rut`).

### 1.2 `vendedores` — 137 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | autoincrement legacy |
| `nombre` | varchar(120) | NOT NULL | nombre del vendedor |
| `category` | varchar(20) | NOT NULL | **siempre `'externo'`** en este dataset (137/137) — pero el modelo debe soportar `'interno'` para futuro |
| `created_at` | timestamp | NOT NULL | naive |

**Decisión de modelado**: si la categoría futura `'interno'` apareciera, se documenta explícitamente en `03-backend-models.md`; por ahora todos los vendedores son `externo` → se mapean a `LegacyVendor` (no a `Contact`).

### 1.3 `categorias` — 5 filas (snapshot)

| `id` | `nombre` (canónico) | Notas |
|---|---|---|
| 1 | Impresion Digital | snapshot fijo al 2026-06-02 |
| 2 | Impresion Offset | snapshot fijo |
| 3 | Calendarios | snapshot fijo |
| 4 | Timbres | snapshot fijo |
| 5 | Fotocopias y encuadernado | snapshot fijo |

**Nota histórica**: existieron más categorías (ej. "Pendón Roller", "Displays") que se descartaron antes del 2015; en este dataset (2015–2026) las 5 categorías listadas son las únicas activas. Se **hardcodean** en el importer (no se consulta la tabla) para garantizar idempotencia ante cambios futuros del legacy.

### 1.4 `ordenes` — 7.980 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | autoincrement legacy |
| `numero` | varchar(20) | NOT NULL | número humano (ej. "12.345"); **no se usa como FK** |
| `cliente_id` | int4 FK→`clientes.id` | NOT NULL | siempre resolvible (0 huérfanos) |
| `vendedor_id` | int4 FK→`vendedores.id` | NOT NULL | siempre resolvible |
| `categoria_id` | int4 FK→`categorias.id` | NOT NULL | siempre 1..5 |
| `descripcion_id` | int4 FK→`descripciones.id` | NULL | ver §1.6 (NO se usa, es catálogo) |
| `descripcion_texto` | text | NOT NULL | **línea textual de la NV** (la "línea" del producto) |
| `cantidad` | int4 | NOT NULL | ≥ 1 |
| `precio_neto` | numeric(12,0) | NOT NULL | CLP sin IVA |
| `iva` | numeric(12,0) | NOT NULL | CLP IVA (19% de `precio_neto` en 99% de los casos) |
| `precio_total` | numeric(12,0) | NOT NULL | CLP con IVA; **consistente**: `precio_neto + iva = precio_total` en 7.980/7.980 |
| `despachado` | bool | NOT NULL | flag de despacho (ver §3.2) |
| `pendiente` | bool | NOT NULL | flag de pendiente (ver §3.2) |
| `fecha` | date | NOT NULL | fecha emisión NV (entre 2015-01-01 y 2026-06-02) |
| `estado` | varchar(20) | NOT NULL | ver §3.1 |
| `created_at` | timestamp | NOT NULL | naive |

**Índices**: PK(`id`), idx(`cliente_id`), idx(`vendedor_id`), idx(`categoria_id`), idx(`fecha`).

### 1.5 `pagos` — 8.556 filas

| Columna | Tipo | Nulos | Notas |
|---|---|---|---|
| `id` | int4 PK | NOT NULL | autoincrement legacy |
| `orden_id` | int4 FK→`ordenes.id` | NOT NULL | 0 huérfanos |
| `fecha` | date | NOT NULL | fecha del pago |
| `abono` | numeric(12,0) | NOT NULL | CLP, ≥ 0 |
| `forma_pago` | varchar(20) | NOT NULL | **99.4% `'efectivo'`**; resto: 'transferencia', 'cheque' |
| `created_at` | timestamp | NOT NULL | naive |

**Índices**: PK(`id`), idx(`orden_id`).

**Distribución**: 31/7.980 NVs sin pagos; 607 NVs con múltiples pagos. La suma de `abono` por NV es **consistente** con el `precio_total` original o menor (pagos parciales).

### 1.6 `descripciones` — 24 filas (NO importada)

Catálogo de plantillas de descripción. **No se importa**; el campo `descripcion_texto` de cada `ordenes` ya contiene el texto final.

## 2. Reglas de validación verificadas (snapshot 2026-06-02)

| Verificación | Resultado |
|---|---|
| `clientes.rut` único | 2.843/2.843 únicos |
| `clientes.rut` formato válido (módulo 11) | 2.842/2.843 (1 inválido) |
| `ordenes.cliente_id` resolvible | 7.980/7.980 |
| `ordenes.vendedor_id` resolvible | 7.980/7.980 |
| `ordenes.categoria_id` ∈ {1..5} | 7.980/7.980 |
| `ordenes.precio_neto + iva == precio_total` | 7.980/7.980 |
| `pagos.orden_id` resolvible | 8.556/8.556 |
| Suma `pagos.abono ≤ ordenes.precio_total` | 8.556/8.556 |
| Soft-deletes (`deleted_at IS NOT NULL`) | 0/0 (legacy no usaba soft-delete) |
| `vendedores.category == 'externo'` | 137/137 |

## 3. Semántica de negocio (legacy → ERPGrafico)

### 3.1 Estados de NV (`ordenes.estado`)

| Valor legacy | Significado | Acción en import |
|---|---|---|
| `despachado` | Entregada al cliente | `LegacySaleNote.status='DISPATCHED'` |
| `no_despachado` | En taller | `LegacySaleNote.status='IN_PRODUCTION'` |
| `pendiente` | Esperando confirmación | `LegacySaleNote.status='PENDING'` (20 NVs) |
| `anulada` | Cancelada | **NO se importa** (filtro en importer) |

**NVs en este dataset**: 7.740 `despachado` + 200 `no_despachado` + 20 `pendiente` + **20 `anulada`** (se omiten) = 7.960 que se importan.

### 3.2 Flags `despachado` / `pendiente`

- `despachado=True` se mapea al campo `dispatched_at` de `LegacySaleNote` (date — sin hora).
- `pendiente=True` se preserva como `LegacySaleNote.is_pending=True` para que la UI lo muestre con un chip adicional.

### 3.3 Mapeo categoría → tipo de producto

| `categoria_id` | `category_name` | Tipo de producto en ERPGrafico |
|---|---|---|
| 1 | Impresion Digital | Servicio (`Product.type='SERVICE'`) — usa `LEGACY-OT-PRODUCT` |
| 2 | Impresion Offset | Servicio — usa `LEGACY-OT-PRODUCT` |
| 3 | Calendarios | Servicio — usa `LEGACY-OT-PRODUCT` |
| 4 | Timbres | Servicio — usa `LEGACY-OT-PRODUCT` |
| 5 | Fotocopias y encuadernado | Servicio — usa `LEGACY-OT-PRODUCT` |

**Decisión clave**: todas las NVs legacy se consolidan en un único producto servicio `LEGACY-OT-PRODUCT` (creado en data migration 0002). Las **categorías se preservan en `LegacySaleNote.category_snapshot`** (CharField 64) — campo auditable, no es FK.

## 4. Decisiones de importación (resumen)

1. **Una NV legacy = 1 línea textual** (no se intenta "expandir" `descripcion_texto` en productos del catálogo).
2. **Una NV legacy = 1 WorkOrder** manual finalizada.
3. **Una NV legacy = N pagos** históricos (`LegacyPayment`).
4. **Pagos nuevos** sobre NV legacy NO se importan al import inicial — se registran *post-import* a través de la UI.
5. **Vendedores internos** (futuro) NO se mapean a `Contact` — se mantienen en `LegacyVendor` separado.
6. **Clientes legacy** SÍ se mapean a `Contact` vivo (es la única forma de reusar `ContactDrawer` y `ContactListView`).

## 5. Salida esperada del import (7.960 NVs vivas)

| Tabla destino | Filas |
|---|---|
| `contacts` (clientes) | ≤ 2.843 (puede haber duplicados normalizados: pre-import debe detectar y mergear) |
| `legacy.ContactLegacyOrigin` | 2.843 |
| `legacy.LegacyVendor` | 137 |
| `legacy.LegacySaleNote` | 7.960 |
| `legacy.LegacyPayment` | 8.556 (excluyendo pagos de NVs anuladas) |
| `production.WorkOrder` | 7.960 |
| `legacy.LegacyImport` | 1 (la corrida) |

## 6. Riesgos de datos

- **1 RUT inválido** → `tax_id_exception=True`, importado con `raw_tax_id` original.
- **20 NVs `anulada`** → se omiten y se reportan en el log del import.
- **Categorías dinámicas** → hardcodeadas; si el legacy agrega categoría 6, el import falla ruidosamente (preferible a importar mal).
- **Pagos duplicados** (mismo `orden_id` + `fecha` + `abono`): actualmente 0; si apareciera, se loguea como warning pero se inserta (idempotencia manejada por `(legacy_external_id, fecha, abono)`).

## 7. Lo que **no** se preserva

- Número humano (`ordenes.numero`): se guarda como `LegacySaleNote.legacy_external_id` (string) y se muestra en UI.
- Soft-delete: no aplica.
- Auditoría: el legacy no tenía `updated_at`/`updated_by`.
- IDs de inserción: ERPGrafico asigna PKs nuevos; el legacy `id` se preserva como `legacy_external_id`.
