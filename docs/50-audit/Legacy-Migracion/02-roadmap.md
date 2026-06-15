# 02 — Roadmap de implementación (8 fases)

> 8 fases, 37 tasks atómicas. **Criterios de salida** explícitos por fase. Sin regresiones: cada fase termina con `pytest` verde y `npm run type-check` verde (cuando aplica).

## Vista global

```
Fase 1 (Foundation)        →  app `legacy` + 6 modelos + 1 data migration ruidosa + 3 permisos
Fase 2 (Contacts/Vendors)  →  import de clientes + vendedores + resolución de duplicados
Fase 3 (Sale Notes)        →  import de las 7.980 NVs (todas vivas; no hay anuladas)
Fase 4 (Work Orders)       →  builder de 7.980 OTs históricas finalizadas (sin create_manual; no bloqueadas)
Fase 5 (Payments)          →  import de 8.556 pagos históricos + endpoint de pago nuevo
Fase 6 (Unified API)       →  ?include=legacy, LegacySaleNoteSerializer, viewset dual-PK
Fase 7 (Frontend)          →  LegacyBadge + helper + 4 vistas/drawers + search global
Fase 8 (Validation)        →  ADR final, smoke scripts, reconciliación, deprecación doc
```

## Fases

### [Phase 1 — Foundation](phases/phase-1-foundation.md)
**Tasks**: T01, T02, T03, T04
**DoD**:
- `python manage.py migrate` aplica `legacy.0001` y `legacy.0002` sin error.
- Existe `Product` con `code='LEGACY-OT-PRODUCT'`.
- 3 permisos registrados y asignados a un grupo de admin.
- `pytest backend/legacy -v` corre (al menos 1 test pasa).

### [Phase 2 — Contacts & Vendors](phases/phase-2-contacts-and-vendors.md)
**Tasks**: T05, T06, T07
**DoD**:
- `python manage.py import_legacy_dump --stage=contacts --dry-run` lista 2.843 clientes y 137 vendedores.
- `python manage.py import_legacy_dump --stage=contacts` importa sin error; `Contact` count aumenta; `ContactLegacyOrigin` count = 2.843.
- Re-ejecutar el comando es **idempotente** (counts no cambian).

### [Phase 3 — Sale Notes](phases/phase-3-sale-notes.md)
**Tasks**: T08, T09, T10
**DoD**:
- `--stage=orders --dry-run` lista 7.980 NVs.
- Importa sin error; `LegacySaleNote` count = 7.980 (no hay anuladas que omitir).
- Mapeo vendor interno/externo funciona: un test de muestra verifica ambos casos.

### [Phase 4 — Work Orders](phases/phase-4-work-orders.md)
**Tasks**: T11, T14
**DoD**:
- Una OT por NV legacy, creada **directamente** en `status=FINISHED` + `current_stage=FINISHED` (sin `WorkOrderService.create_manual`, que rechaza productos SERVICE y generaría 7.980 tareas de workflow), con descripción que incluye `legacy_external_id`.
- **NO** hay OTs en estado bloqueado ni tareas de workflow nuevas generadas por el import.
- `pytest backend/production/tests` pasa (no regresiones).
- T14 valida: `WorkOrder.save()` asigna `number` y no dispara signals con efectos colaterales sobre OTs nacidas en `FINISHED`.

### [Phase 5 — Payments](phases/phase-5-payments.md)
**Tasks**: T15, T16, T17, T18
**DoD**:
- `LegacyPayment` count = 8.556.
- Endpoint `POST /api/legacy/sale-notes/<id>/register-payment/` requiere `legacy.pay_pending_legacy` AND `treasury.add_treasurymovement`; sin ambos → 403.
- Idempotency-Key en el endpoint (re-play con misma key → mismo resultado).
- `LegacyPaymentRegistration` NO aparece en `TreasuryMovement` ni en `journal_entry`.

### [Phase 6 — Unified API](phases/phase-6-unified-api.md)
**Tasks**: T19, T25
**DoD**:
- `GET /api/sales/orders/?include=legacy` devuelve la unión SaleOrder ∪ LegacySaleNote con shape compatible.
- `GET /api/sales/orders/?include=none` devuelve solo `SaleOrder` (default off en este caso).
- `GET /api/sales/orders/<pk>/` resuelve PK de `LegacySaleNote`.
- `GET /api/contacts/contacts/` incluye `is_legacy` en cada item.

### [Phase 7 — Frontend](phases/phase-7-frontend.md)
**Tasks**: T26, T35
**DoD**:
- `npm run type-check` y `npm run lint` pasan sin errores.
- `<LegacyBadge />` se muestra en `SalesOrdersView` y `ContactListView` solo para items legacy.
- `SaleOrderDrawer` y `ContactDrawer` entran en modo read-only cuando `is_legacy=true`.
- `RegisterPaymentDrawer` bifurcación funciona: NV legacy → endpoint `/api/legacy/...`.
- `useGlobalSearch` incluye NVs legacy y excluye contactos legacy.

### [Phase 8 — Validation](phases/phase-8-validation.md)
**Tasks**: T36, T37
**DoD**:
- ADR-0029 firmado y numerado.
- `scripts/smoke_legacy_import.sh` ejecuta los 3 stages y reporta conteos.
- `scripts/smoke_legacy_api.sh` ejecuta 5 curls y verifica shape.
- Reconciliación: 2.843 clientes + 137 vendedores + 7.980 NVs + 8.556 pagos + 7.980 OTs = 27.496 filas creadas.
- Reporte de riesgos: RUT inválido por confirmar (módulo 11) + 31 NVs sin pagos + 7 NVs sobrepagadas + 62 pagos no-efectivo (transferencia/tarjeta).

## Pre-flight por fase (antes de empezar)

Antes de cada fase, verifica:

- [ ] Tasks de la fase leídos.
- [ ] No hay migraciones sin commit en `backend/`.
- [ ] No hay PRs abiertos tocando los archivos enumerados en la fase.
- [ ] Si la fase toca un modelo vivo, hay un ADR de respaldo (o se está abriendo en este PR).

## Post-flight por fase (al terminar)

- [ ] `pytest backend/<modulo> -v` pasa.
- [ ] `npm run type-check` y `npm run lint` pasan (si frontend).
- [ ] El DoD de la fase está cumplimentado.
- [ ] No se introdujeron `any`, raw colors, ni cross-feature imports.
- [ ] Si cambió un contrato, se actualizó el doc correspondiente.

## Criterio de "fase terminada"

Una fase está terminada cuando:

1. **Todas sus tasks están completas** (cada `tasks/T-NN-*.md` tiene su DoD local ✅).
2. **El DoD de la fase** está cumplimentado.
3. **No hay deuda abierta** listada en `docs/50-audit/Legacy-Migracion/risks.md` (a crear si aparece alguno nuevo).

## Criterio de "proyecto terminado"

Cuando las 8 fases estén completas, el proyecto está cerrado si:

- ADR-0029 está firmado.
- Los 2 smoke scripts pasan.
- La reconciliación cuadra con la tabla §5 de `00-legacy-db-schema.md`.
- La búsqueda global incluye NVs legacy y excluye contactos legacy (verificado manualmente con 1 caso).
- La UI muestra el chip `LEGACY` en los lugares correctos (verificado con 1 caso).
- Un usuario de prueba puede registrar un pago nuevo sobre una NV legacy sin tocar nada del módulo de ventas.
