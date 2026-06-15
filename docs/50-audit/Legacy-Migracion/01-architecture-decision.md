# 01 — Architecture Decision Record (ADR-0029 draft)

> **Título**: Migración de notas de venta legacy (`ordenes_dump`) como app `legacy` con shape unificado en `SaleOrder` y `Contact`.
>
> **Estado**: PROPOSED → **DRAFT** (a aprobar en phase 8 T36)
>
> **Fecha**: 2026-06-02
>
> **Decisores**: mantenedores ERPGrafico + equipo de migración

## Contexto

ERPGrafico necesita importar **7.980 notas de venta** (**2017–2026**) desde un sistema legacy de imprenta. Los usuarios quieren:

- Buscar NVs legacy en el mismo listado que NVs nuevas.
- Ver una NV legacy (read-only) en el mismo drawer que NVs nuevas.
- Registrar **pagos nuevos** sobre NVs legacy.
- Mantener trazabilidad: saber qué vino del legacy.
- No queremos un fork del módulo de ventas ni vistas paralelas.

El sistema legacy **sí tiene `deleted_at`** (soft-delete, hoy 0 filas borradas), no tiene historial, no tiene categorías dinámicas, y tiene un modelo de datos muy chato (1 NV = 1 línea `descripcion` + `detalles`).

## Decisión

Se crea una **app backend `legacy`** con 6 modelos y un *serializer de salida* dedicado (`LegacySaleNoteSerializer`, que emite el mismo shape JSON que `SaleOrderSerializer`). El frontend **no** tiene `features/legacy/`; solo se modifica `features/sales` y `features/contacts` para reconocer el flag `is_legacy` y mostrar 1 chip + modo read-only en el drawer.

### Backend

| Modelo | Tabla | Propósito |
|---|---|---|
| `ContactLegacyOrigin` | `legacy_contact_origin` | 1:1 con `Contact`; guarda `raw_tax_id` + `tax_id_exception` |
| `LegacyVendor` | `legacy_vendor` | Vendedores del legacy (no son `Contact`) |
| `LegacySaleNote` | `legacy_sale_note` | Cabecera de NV legacy con snapshot de precio y descripción |
| `LegacyPayment` | `legacy_payment` | Pagos históricos importados |
| `LegacyPaymentRegistration` | `legacy_payment_registration` | Pagos **nuevos** sobre NV legacy (no son `TreasuryMovement`) |
| `LegacyImport` | `legacy_import` | Run log del import batch |

### Frontend

- 1 shared component: `<LegacyBadge />` (chip semántico, color ámbar).
- 1 helper: `lib/legacy.ts` (`isLegacyContact`, `isLegacySaleOrder`, `formatLegacyId`).
- Modificaciones (NO archivos nuevos): `SaleOrderDrawer`, `SalesOrdersView`, `ContactDrawer`, `ContactListView`, `RegisterPaymentDrawer`, `useGlobalSearch`, tipos Zod.

### API

- `?include=legacy` (default-on) en `SaleOrderViewSet.list` y `.retrieve` → devuelve también `LegacySaleNote`.
- `SaleOrderSerializer` agrega `is_legacy` (default `False`) y `legacy_external_id` (default `None`).
- `ContactSerializer` agrega `is_legacy` (default `False`).
- `SaleOrderViewSet.retrieve` resuelve tanto PK `SaleOrder` como PK `LegacySaleNote` (try/except).
- 2 endpoints exclusivos del import: `POST /api/legacy/imports/commit/` (con `Idempotency-Key`) y `POST /api/legacy/sale-notes/<id>/register-payment/`.

## Trade-offs considerados

### Opción A: importar como `SaleOrder` real (RECHAZADA)

Crear `SaleOrder` por cada NV legacy, usando un producto genérico y forzando `state='DISPATCHED'`.

**Problemas**:
- `SaleOrder` exige `line_items` (al menos 1); el legacy tiene 1 línea textual → hay que inventar un producto.
- El legacy no tiene `tax` real (es numérico pre-calculado); `SaleOrder` lo deriva → habría que saltarse la derivación.
- El estado `DISPATCHED` requiere un flujo de transición que el legacy no siguió.
- El usuario quiere **trazabilidad de origen** clara (chip "LEGACY") que en `SaleOrder` no se puede expresar sin agregar campos.

### Opción B: app `legacy` con tabla paralela (ELEGIDA)

Ventajas:
- Aísla el riesgo de import.
- Preserva 100% de los datos legacy sin perder fidelidad.
- Permite pagos nuevos sin tocar `TreasuryMovement`.
- `?include=legacy` mantiene la **forma** unificada sin acoplar datos.

Desventajas:
- Más código que la opción A.
- Hay que mantener el serializer de salida (`LegacySaleNoteSerializer`) en sync con el shape de `SaleOrderSerializer`.

### Opción C: `feature_flags` + branch en `SaleOrder` (RECHAZADA)

- Confunde a mantenedores futuros: "qué es una NV con `is_legacy=True`?"
- Difícil razonar sobre el ORM.

## Decisiones derivadas

1. **`is_legacy` se calcula en el serializer**, no se guarda en el modelo `SaleOrder` (mantiene `SaleOrder` puro).
2. **Mapeo de pagos nuevos**: `LegacyPaymentRegistration` (no `TreasuryMovement`) — el usuario fue explícito: NO conciliar, NO afectar contabilidad.
3. **WorkOrder por NV legacy**: `is_manual=True` + `current_stage=FINISHED` (no se ejecuta flujo de producción, es histórico).
4. **Vendedores no se mezclan con `Contact`**: viven en `LegacyVendor` porque semánticamente son proveedores externos y reutilizar `Contact` aquí sería sobrecargar el modelo.
5. **Categorías hardcodeadas** (5 fijas): más simple, más auditables, no hay sorpresa si el legacy cambia.
6. **Idempotencia del import**: `unique_together(source_table, legacy_external_id)` en `ContactLegacyOrigin` + por PK legacy en `LegacySaleNote`/`LegacyPayment`. Permitido re-correr el comando (es idempotente).
7. **Search global**: **incluye** NVs legacy, **excluye** contactos y vendedores legacy. Decisión de UX: el usuario busca "NV 12345" o "cliente Pérez"; "vendedor García" no es una búsqueda frecuente.
8. **Sin `simple_history`**: el snapshot ya congela; agregar historial sería ruido.
9. **Una sola migración ruidosa** (`0002`): crea `UoM` y `Warehouse` mínimos + `LEGACY-OT-PRODUCT`. Falla ruidosamente si ya existen con otro nombre.

## Consecuencias

### Positivas

- El usuario ve una sola lista, un solo drawer, un solo flujo de pago nuevo.
- El equipo de ventas no necesita entrenamiento especial.
- La importación es idempotente y se puede re-ejecutar.
- El serializer de salida es < 100 LOC.
- El frontend no se ramifica: solo se añaden 1 prop y 1 chip.

### Negativas

- Hay que mantener `LegacySaleNote` en sync con `SaleOrder` cuando el modelo de ventas evolucione (e.g., agregar `project_id`).
- El serializer es un punto único de cambio: cualquier nueva propiedad en `SaleOrderSerializer` requiere decisión: ¿se replica en `LegacySaleNoteSerializer` o se omite?
- La búsqueda global es asimétrica (NVs sí, contactos no).

## Compliance con invariants globales

| Invariant | Cumplido |
|---|---|
| Zero `any` en TypeScript | sí (todo via Zod) |
| No raw Tailwind colors | sí (chip usa `bg-amber-100 text-amber-800` que es excepción semántica; ver `06-frontend-unified-ui.md`) |
| No cross-feature imports | sí (frontend no importa de `legacy/`) |
| No `lib/api` en components | sí (solo en hooks y services) |
| `useQuery` solo en hooks | sí |
| Shared components via barrel | sí (`LegacyBadge` exportado desde `components/shared`) |
| `StatusBadge` es el único status renderer | sí (LegacyBadge es **identidad**, no status) |
| Loading/empty/error | sí (todas las vistas existentes ya lo cumplen) |
| Forms con RHF + zod | N/A (no se crean forms nuevos) |
| Views ≤ 20 líneas | sí |
| Naming conventions | sí (`LegacySaleNote`, `LegacyBadge`, etc.) |
| Cambiar contrato → ADR | **este ADR es la prueba** |

## Plan de revocación

Si en el futuro se decide re-importar todo como `SaleOrder` real:
1. Marcar `ContactLegacyOrigin.migrated_at` por cada `Contact` (nueva columna nullable).
2. Re-importar usando los hooks existentes.
3. Switch del flag `?include=legacy` → `?include=none` en el frontend.
4. Deprecar app `legacy` (sigue el playbook `deprecate-feature.md`).
5. Mantener `LegacyPaymentRegistration` para auditoría de pagos nuevos históricos.

## Aprobación

Requiere:
- [ ] Mantenedor backend (revisor A)
- [ ] Mantenedor frontend (revisor B)
- [ ] PO del módulo de ventas
- [ ] ADR-0029 firmado y numerado

## Referencias

- [02-roadmap.md](02-roadmap.md) — fases de implementación.
- [03-backend-models.md](03-backend-models.md) — detalle de los 6 modelos.
- [05-backend-api.md](05-backend-api.md) — detalle de endpoints y `LegacySaleNoteSerializer`.
- [06-frontend-unified-ui.md](06-frontend-unified-ui.md) — detalle de cambios UI.
- ADR-0014: DecimalField con `decimal_places=0` para CLP.
