# Legacy-Migracion — Índice ejecutivo

> **Migración de notas de venta legacy (BD `ordenes_dump` → ERPGrafico) sin código paralelo y sin vistas frontend nuevas.**

Este paquete documenta la importación, normalización y exposición unificada de **7.980 notas de venta** (años 2015–2026) desde un sistema legacy de imprenta hacia ERPGrafico, preservando consulta, registro de pagos nuevos y trazabilidad de origen sin necesidad de un fork del módulo de ventas.

## Decisión (TL;DR)

| Aspecto | Decisión |
|---|---|
| Aislamiento | App backend **`legacy`**, 6 modelos, una sola migración ruidosa; frontend **no** tiene `features/legacy/` |
| Modelo de venta unificado | `?include=legacy` (default-on) en `SaleOrderViewSet` devuelve también `LegacySaleNote`; serializer expone `is_legacy` + `legacy_external_id` |
| Clientes legacy | Mapeados a `Contact` vivo + `ContactLegacyOrigin` (1:1, con `raw_tax_id` y flag `tax_id_exception`) |
| Vendedores | `LegacyVendor` (modelo aparte); solo se asocian a `SaleOrder` cuando `category='externo'` |
| Pagos | Históricos → `LegacyPayment`; **nuevos** sobre NV legacy → `LegacyPaymentRegistration` (NO `TreasuryMovement`, NO `journal_entry`) |
| Work orders | Una OT por NV legacy: `is_manual=True`, `current_stage=FINISHED`, descripción incluye `legacy_external_id`; **NO bloqueada** |
| Frontend | Solo 1 shared component (`LegacyBadge`) + 1 helper (`lib/legacy.ts`); 4 vistas/drawers existentes modificadas |
| Import | Solo backend, vía management command `import_legacy_dump` + endpoint `POST /api/legacy/imports/commit/` con `Idempotency-Key` |
| Search global | Incluye NVs legacy; **excluye** contactos y vendedores legacy |

## Capas

```
docs/50-audit/Legacy-Migracion/
├── README.md                            ← este archivo
├── 00-legacy-db-schema.md               ← schema del legacy (standalone)
├── 01-architecture-decision.md          ← ADR-0029 in-nuce + trade-offs
├── 02-roadmap.md                        ← 8 fases, criterios de salida
├── 03-backend-models.md                 ← 6 modelos + ER + data migration
├── 04-backend-import-pipeline.md        ← importer + RUT + WO builder
├── 05-backend-api.md                    ← endpoints + adapter
├── 06-frontend-unified-ui.md            ← modificaciones UI (4 archivos)
├── 07-permissions.md                    ← 3 permisos + seed
├── 08-testing-and-validation.md         ← DoD + smoke + reconciliación
├── phases/
│   ├── phase-1-foundation.md
│   ├── phase-2-contacts-and-vendors.md
│   ├── phase-3-sale-notes.md
│   ├── phase-4-work-orders.md
│   ├── phase-5-payments.md
│   ├── phase-6-unified-api.md
│   ├── phase-7-frontend.md
│   └── phase-8-validation.md
└── tasks/
    ├── T01..T04   ← Phase 1
    ├── T05..T07   ← Phase 2
    ├── T08..T10   ← Phase 3
    ├── T11..T14   ← Phase 4
    ├── T15..T18   ← Phase 5
    ├── T19..T25   ← Phase 6
    ├── T26..T35   ← Phase 7
    └── T36..T37   ← Phase 8
```

## Cómo leer este paquete

1. **Empieza por [01-architecture-decision.md](01-architecture-decision.md)** si quieres el "por qué".
2. Si vas a ejecutar, sigue el orden de [02-roadmap.md](02-roadmap.md) y abre el phase doc + sus tasks asociadas.
3. Cada `tasks/T-NN-*.md` es **atómico e independiente**: precondición → archivos a tocar → DoD → comandos de verificación.

## Convenciones

- **Montos legacy**: `precio_neto`, `precio_total`, `abono` son `DecimalField(decimal_places=0)` (CLP sin centavos; respeta ADR-0014).
- **Moneda**: `CLP` (default del sistema).
- **Timezone**: legacy se importa como `America/Santiago` (las fechas ya vienen sin TZ; se asume naive local).
- **Soft-delete**: el legacy no tenía; por lo tanto ningún modelo legacy lo usa.
- **Historial**: `simple_history` **no** se instala (no aporta valor: el snapshot ya congela la información).
- **`is_legacy`**: flag opt-in para UI; viene del serializer, no del modelo `SaleOrder` (sino habría que añadir `null=True` solo para esto).

## Lo que este paquete **NO** hace

- No agrega endpoints `/api/legacy/...` visibles a la UI más allá de `imports/commit/` y `sale-notes/<id>/register-payment/`.
- No introduce `features/legacy/` en frontend.
- No modifica `lib/api` ni los hooks globales.
- No reescribe `SaleOrder`, `Contact`, `WorkOrder`, `TreasuryMovement`. Solo agrega nuevos modelos y *adapter* de salida.
- No usa `simple_history`, ni migraciones no-op.
- No usa `pkg_transaction.atomic` en el import batch; cada fila se procesa en su propia transacción para evitar rollback total.

## Riesgos vivos (rastreados)

| Riesgo | Mitigación |
|---|---|
| `WorkOrderService.transition_to(FINISHED)` puede fallar si requiere condiciones | Fallback `needs_manual_finalize=True` en la OT + reporte al final del batch |
| 1/2.843 RUT con formato inválido | `tax_id_exception=True` + `raw_tax_id` en `ContactLegacyOrigin`; no bloquea import |
| Data migration `0002` requiere UoM y Warehouse no nulos | Falla ruidosamente con instrucción explícita si no existen |
| Conciliación bancaria muestra registros nuevos | Por eso NO se usa `TreasuryMovement`; `LegacyPaymentRegistration` no aparece en flujos contables |
| Búsqueda global filtra contactos legacy | `useGlobalSearch` ya excluye con `include_legacy=false` (decisión explícita) |
| `RegisterPaymentDrawer` debe bifurcarse | Parámetro `isLegacy` en props; usa endpoint distinto y oculta flujos que no aplican |

## Estado

- **Borrador completo** — pendiente revisión de mantenedores.
- Implementación se autoriza solo después de aprobación de ADR-0029 y de la fase 1.
