# Suite de regresión financiera (T-56)

Esta carpeta contiene la suite de tests de **caracterización contable** definida
por T-56 en [docs/50-audit/Arquitectura Django/20-task-list.md](../../../docs/50-audit/Arquitectura%20Django/20-task-list.md)
y la estrategia de [50-testing-strategy.md](../../../docs/50-audit/Arquitectura%20Django/50-testing-strategy.md).

## Qué congela esta suite

Cada test en `test_financial_baseline.py` corre un selector financiero contra
un dataset determinístico (`fixtures/financial_baseline.py`, seed=42) y compara
el output contra un snapshot JSON versionado en git (`snapshots/*.json`).

Reportes cubiertos (27 snapshots — **Fase 2 completa**):

| Snapshot | Selector | Acceptance T-56 | Fase |
|----------|----------|-----------------|------|
| `balance_sheet` | `FinanceService.get_balance_sheet` | ✅ | F2 |
| `income_statement` | `FinanceService.get_income_statement` | ✅ | F2 |
| `cash_flow` | `FinanceService.get_cash_flow` | ✅ | F2 |
| `trial_balance` | `FinanceService.get_trial_balance` | ✅ | F2 |
| `ledger_<code>` (~15) | `accounting.selectors.get_account_ledger` | ✅ | F2 |
| `financial_analysis` | `FinanceService.get_financial_analysis` | extra | F2 |
| `balance_sheet_q1..q3` | filtrado por fecha | extra | F2 |
| `income_statement_h1/h2` | filtrado por fecha | extra | F2 |
| `cash_flow_q4` | filtrado por fecha | extra | F2 |
| `customer_aging` | `contacts.selectors.customer_aging_report` | ✅ | **F6** |
| `supplier_aging` | `contacts.selectors.supplier_aging_report` | ✅ | **F6** |

Pendiente (Fase 3 — menor prioridad):

- F29 (libro IVA débito/crédito) — requiere selectors de `tax/`.
- Snapshots desde el commit pre-F2 (R-09 — verificar coherencia legacy↔post-refactor)

## Cómo correr la suite

```bash
# Una vez (CI / validación)
docker compose exec backend python manage.py test core.tests.test_financial_baseline

# Regenerar snapshots tras un cambio intencional
docker compose exec -e UPDATE_SNAPSHOTS=1 backend python manage.py test core.tests.test_financial_baseline
```

> **Importante:** `docker compose exec` **no** propaga env vars del shell host por defecto. Usa `-e UPDATE_SNAPSHOTS=1` (flag de docker), no el prefijo `UPDATE_SNAPSHOTS=1 docker compose ...` (que sólo afecta al shell del host, no al contenedor).

> **Modos de operación:**
>
> - `UPDATE_SNAPSHOTS=1`: escribe **todos** los snapshots silenciosamente, sin assert ni skip. Útil para regenerar de una pasada — incluye los ~15 snapshots de `ledger_*` que se generan dentro de un solo test method en loop.
> - Sin la variable y archivo NO existe: el test **falla** con mensaje pidiendo correr una vez con `UPDATE_SNAPSHOTS=1`. La primera generación es un acto deliberado.
> - Sin la variable y archivo existe: compara serialización exacta y falla en cualquier divergencia.

## Cuándo regenerar un snapshot

| Caso | Acción |
|------|--------|
| Cambié un cálculo y el test falla | **No** regenerar a ciegas. Investigar si el cambio es regresión. |
| Agregué un campo nuevo al reporte | Regenerar, revisar el diff JSON en el PR. |
| Refactor sin cambio funcional (ej: rename de key) | Regenerar, revisar el diff JSON. |
| Stakeholder financiero pidió un cambio de cálculo | Regenerar tras aprobación explícita; mencionar en el commit. |

## Determinismo

El dataset usa `random.Random(42)`. Toda la "aleatoriedad" (montos, fechas,
selección de cliente/proveedor) se deriva de esa semilla. Si necesitas más
variación cambia la semilla deliberadamente — pero sé consciente de que
**cualquier cambio de semilla regenera todos los snapshots**.

Las cabeceras (`Contact`, `SaleOrder`, `PurchaseOrder`, `Invoice`,
`TreasuryMovement`) usan `tax_id`/`number` deterministas, no aleatorios.

## Notas sobre IDs

`_normalise()` en `test_financial_baseline.py` reemplaza claves `id`,
`entry_id` y `contact_id` con el sentinel `<id>` antes de serializar. Esto
permite que los snapshots sean estables aunque el orden de inserción de filas
en la DB de tests varíe entre ejecuciones del runner.

Si un selector retorna IDs en otra clave (ej: `account_id`), agrega esa clave
a la blacklist de `_normalise`.

## R-09: snapshots desde el commit pre-F2

Para mitigar el riesgo de que la suite consagre el comportamiento *post*-refactor
en vez del legacy, hay que generar snapshots adicionales desde el commit
pre-F2 (`62cd4a34` o anterior) y exportarlos a `snapshots/legacy/`. Cada
divergencia entre `legacy/foo.json` y `foo.json` debe documentarse en un ADR
(p. ej. cambio de redondeo aceptado, cambio de signo intencional, etc.).

Tarea trackeada en T-56 acceptance criterion final.
