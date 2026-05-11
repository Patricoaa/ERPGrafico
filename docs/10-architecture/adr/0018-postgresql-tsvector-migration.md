# ADR 0018: Migración a PostgreSQL tsvector para UniversalSearch

## Estado
Implementado — 2026-05-10

## Contexto
El `UniversalRegistry` introducido en el refactor de auditoría (T-03) unificó el catálogo de entidades mediante duck-typing y configuración dinámica, eliminando dependencias circulares. Sin embargo, su mecanismo de búsqueda dependía de consultas iterativas utilizando `field__icontains`, lo cual se traduce en SQL como `ILIKE '%query%'`.

El benchmark realizado en la T-64 (`docs/40-quality/benchmarks/2026-05-search-baseline.md`) con 150.000 registros demostró que el p95 de latencia supera los 1.2 segundos, rompiendo nuestro SLA de interfaz de 300ms. Esto se debe a que `ILIKE` anula el uso de índices B-Tree estándar, provocando Full Table Scans secuenciales.

## Decisión
Se migra el backend del `UniversalRegistry` a **PostgreSQL Full-Text Search (FTS)** con índices GIN, sin dependencias externas (ElasticSearch, Meilisearch).

### Enfoque implementado: SearchVector on-the-fly + GIN sobre columnas raw

A diferencia de la propuesta original (columna `SearchVectorField` almacenada + triggers), se eligió el enfoque más simple:

1. **Índices GIN sobre columnas existentes** — `CREATE INDEX CONCURRENTLY … USING gin(to_tsvector('simple', …))` sobre los campos de texto de cada modelo. Sin cambios en modelos, sin triggers, sin signals.
2. **`SearchVector` como anotación en query** — `UniversalRegistry._build_fts_query()` anota el queryset con `SearchVector(*fts_fields, config='simple')` en tiempo de ejecución. PostgreSQL usa el índice GIN automáticamente cuando la expresión coincide.
3. **`_build_icontains_filter` preservado** para entidades Tier 3 (tienen `tax_id`/`rut`) donde la normalización de RUT es incompatible con tokenización FTS.

Este enfoque fue preferido al de `SearchVectorField` porque:
- No requiere cambios en modelos ni en AppConfig
- No introduce triggers PostgreSQL ni signals Django
- Las migraciones son idempotentes (`IF NOT EXISTS`) y no bloquean tablas (`CONCURRENTLY`)
- El costo en query-time es aceptable dado que los índices GIN son consultados, no recorridos

### Clasificación de entidades

| Tier | Criterio | Path en `_build_fts_query` |
|------|----------|---------------------------|
| **1 — FTS puro** | Campos directos, sin `tax_id` ni FK | `SearchVector(*fts_fields)` + GIN index |
| **2 — FTS mixto** | Campos directos + FK traversal (`__`), sin `tax_id` | FTS en campos directos OR `icontains` en FK (query combinada) |
| **3 — icontains** | Tiene `tax_id`/`rut`/`identification` | `_build_icontains_filter` preservado con normalización RUT |

**Por qué Tier 3 conserva icontains:** `to_tsvector('simple', '12.345.678-9')` genera tokens `12|345|678|9`. El usuario que busca `123456789` envía un token único que no coincide. La normalización existente en `_build_icontains_filter` resuelve esto; FTS no puede sin lógica ad-hoc.

### Índices GIN creados (14 en 10 apps)

| Índice | Tabla | Campos |
|--------|-------|--------|
| `accounting_account_fts_gin` | `accounting_account` | `code, name` |
| `accounting_journalentry_fts_gin` | `accounting_journalentry` | `number, description` |
| `billing_invoice_fts_gin` | `billing_invoice` | `number` |
| `contacts_contact_fts_gin` | `contacts_contact` | `name, contact_name, code` |
| `core_user_fts_gin` | `core_user` | `first_name, last_name, email` |
| `hr_payroll_fts_gin` | `hr_payroll` | `number` |
| `inventory_product_fts_gin` | `inventory_product` | `name, code, internal_code` |
| `inventory_stockmove_fts_gin` | `inventory_stockmove` | `description, adjustment_reason` |
| `production_workorder_fts_gin` | `production_workorder` | `number, description` |
| `purchasing_purchaseorder_fts_gin` | `purchasing_purchaseorder` | `number` |
| `sales_saledelivery_fts_gin` | `sales_saledelivery` | `number` |
| `sales_saleorder_fts_gin` | `sales_saleorder` | `number` |
| `sales_salereturn_fts_gin` | `sales_salereturn` | `number` |
| `treasury_treasuryaccount_fts_gin` | `treasury_treasuryaccount` | `name, account_number` |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/config/settings.py` | `'django.contrib.postgres'` en `INSTALLED_APPS` |
| `backend/core/registry.py` | `_is_postgres()`, `_TAX_INDICATORS`, `_build_fts_query()`; loop `search()` usa `_build_fts_query` |
| `backend/production/apps.py` | `search_fields`: `contact__name` → `related_contact__name` (bug preexistente) |
| `backend/<app>/migrations/<N>_fts_gin_index.py` × 10 | Migraciones GIN con `atomic = False` |

## Consecuencias
- **Positivas:**
  - Latencia p95 medida post-implementación: 22–72 ms (objetivo: ≤ 300 ms; línea base: ~1 200 ms).
  - Sin infraestructura adicional ni cambios de esquema en modelos.
  - Migraciones idempotentes y non-blocking.
  - Tier 3 preserva búsqueda por RUT sin regresión.
- **Negativas:**
  - `SearchVector` se recalcula en cada query (vs. columna pre-computada). Aceptable dado que los índices GIN evitan el scan completo.
  - Campos FK (`customer__name`, `employee__contact__name`) de entidades Tier 2 se buscan vía `icontains` dentro de la misma query — no benefician del GIN.
  - Acoplamiento a PostgreSQL (ya definido en ADRs anteriores; SQLite cae a `icontains` automáticamente vía `_is_postgres()`).
