---
layer: 20-contracts
doc: deletion-policy
status: active
owner: core-team
last_review: 2026-05-21
stability: contract-changes-require-ADR
---

# Deletion Policy — Anulación, Archivo y Borrado

Cómo se "elimina" una entidad en ERPGrafico depende de qué tipo de entidad sea. NO existe ni se va a introducir `django-safedelete` ni un mixin global de soft-delete: tres patrones cubren el 100% de los casos y se eligen por categoría, no por preferencia del autor.

## Los tres patrones

| Patrón | Mecanismo | Reversible | Compliance fiscal | Acción de UI |
|--------|-----------|-----------|-------------------|--------------|
| **Anulación** | `status = CANCELLED` (o equivalente) | Solo vía nuevo documento (nota de crédito, contramovimiento) | Sí — el registro queda visible en libros con marca de anulado | `annul` ([row-actions](component-row-actions.md)) |
| **Archivo** | `is_active = False` | Sí — pareja `archive` / `restore` | No aplica | `archive` ↔ `restore` ([row-actions](component-row-actions.md)) |
| **Borrado** | `obj.delete()` (hard) | No | No aplica (no son fiscales) | `delete` ([row-actions](component-row-actions.md)) |

## Cómo elegir — árbol de decisión

```
1. ¿La entidad aparece en libros contables, fiscales o tiene FK desde JournalEntry / Invoice / Payment / StockMove?
   SÍ  → Anulación (status=CANCELLED). NO se borra nunca. Punto.
   NO  → 2.

2. ¿Es un dato maestro referenciado por entidades históricas (Bank usado por Movements pasados, ProductCategory usada por Products antiguos)?
   SÍ  → Archivo (is_active=False) + pareja restore. NO se borra nunca.
   NO  → 3.

3. ¿Es un draft, una autosave temporal o estado sin valor de negocio si desaparece (POSDraft, carrito, lock expirado)?
   SÍ  → Hard delete. Cualquier mecanismo: .delete(), DELETE endpoint, cleanup en cron.
   NO  → STOP. Plantea el caso en ADR antes de inventar un cuarto patrón.
```

## Mapeo por app (estado canónico)

> Esta tabla es **autoritativa**. Si un modelo nuevo se agrega, esta tabla debe actualizarse en el mismo PR. El test de arquitectura `test_deletion_policy_consistency` (a crear, T-pendiente) la consume.

| App | Modelo | Patrón | Notas |
|-----|--------|--------|-------|
| `accounting` | `Account` (plan de cuentas) | Archivo | `is_active` filtra selectores; cuentas históricas siguen visibles en mayores |
| `accounting` | `JournalEntry` | Anulación | Reverso vía contramovimiento; status = `cancelled` |
| `billing` | `Invoice` | Anulación | Si emitida a SII: requiere Nota de Crédito; status = `cancelled` |
| `billing` | `CreditNote` / `DebitNote` | Anulación | Idem invoice |
| `contacts` | `Contact` | Archivo | `is_active=False` saca del selector pero preserva FKs en docs históricos |
| `core` | `User` | Archivo | `is_active=False`. Nunca borrar — preserva audit trail |
| `hr` | `Employee` | Archivo | `is_active=False` para ex-empleados |
| `inventory` | `Product` | Archivo | `is_active=False`; las líneas históricas siguen referenciándolo |
| `inventory` | `ProductCategory` | Archivo | |
| `inventory` | `UoM` / `UoMCategory` | Archivo | |
| `inventory` | `Warehouse` | Archivo | |
| `inventory` | `StockMove` | Anulación | Reverso vía contramovimiento |
| `production` | `WorkOrder` | Anulación | status = `cancelled`; preserva históricos de producción |
| `purchasing` | `PurchaseOrder` | Anulación | status = `cancelled` |
| `purchasing` | `PurchaseReceipt` | Anulación | |
| `sales` | `SaleOrder` | Anulación | status = `cancelled` |
| `sales` | `SaleDelivery` | Anulación | |
| `sales` | `POSDraft` / `DraftCart` | Hard delete | Drafts sin valor fiscal — `.delete()` libre |
| `tax` | `TaxRate` / `FiscalPeriod` | Archivo | Nunca borrar — afecta cálculos históricos |
| `treasury` | `Bank` | Archivo | |
| `treasury` | `TreasuryAccount` | Archivo | |
| `treasury` | `PaymentMethod` / `PaymentProvider` | Archivo | |
| `treasury` | `TreasuryMovement` | Anulación | Reverso vía contramovimiento |
| `treasury` | `PaymentRequest` | Anulación | status; idempotency_key preserva trazabilidad |
| `treasury` | `BankStatementLine` | Anulación | No se borra; se marca `unmatched` o `discarded` |
| `workflow` | `Transition` | — (append-only) | Nunca se modifica ni se borra. Es el audit log |

## Reglas operativas

### Para entidades de Anulación

- El campo debe llamarse `status` (no `state`, no `cancelled`, no `is_cancelled`). Estados válidos en [state-map.md](state-map.md).
- La transición a `cancelled` se hace **siempre** vía servicio (`*.services.annul_order(obj, reason)`), nunca seteando el campo en el view.
- El servicio:
  1. Valida que la transición está permitida desde el estado actual (ver state-map).
  2. Genera el reverso contable/inventario si aplica (en `transaction.atomic()`).
  3. Escribe a `workflow.Transition` con el motivo.
- `obj.delete()` sobre estas entidades debe **fallar** o emitir warning explícito. Considerar override de `delete()` en `TransactionalDocument` para bloquearlo en prod.

### Para entidades de Archivo

- El campo se llama **siempre** `is_active` (Boolean, default `True`, `db_index=True`).
- Todos los `Selector` y queryset de UI filtran por `is_active=True` por defecto.
- `is_active=False` no oculta de listados administrativos; el listado debe mostrar el badge "Archivado" + acción `restore`.
- Pareja semántica obligatoria: si una entidad acepta `archive`, debe aceptar `restore`. Ambas viven en [row-actions registry](component-row-actions.md).
- El servicio de archive **no** elimina FKs; los registros históricos que apunten siguen funcionando.

### Para entidades de Hard delete

- Se permiten en `.delete()` directo, DELETE endpoint REST y cleanup por cron.
- Si la entidad podría adquirir relevancia fiscal en el futuro: **NO** uses hard delete; usa archivo por defecto.
- Drafts con cleanup: cron Celery beat los borra después de N horas/días de inactividad. Documentar la TTL en el modelo.

## ROW_ACTIONS — semántica autorizada

[Registro canónico](component-row-actions.md) y el código en [frontend/lib/row-actions.ts](../../frontend/lib/row-actions.ts):

| Acción | Aplica a | Resultado en backend |
|--------|----------|----------------------|
| `annul` | Anulación únicamente | Service call → `status = cancelled` + reverso |
| `archive` | Archivo únicamente | `is_active = False` |
| `restore` | Archivo únicamente | `is_active = True` |
| `delete` | Hard delete únicamente | `obj.delete()` |

**Prohibido:**
- Mostrar `delete` en una entidad de categoría 1 o 2.
- Mostrar `archive` sin pareja `restore`.
- Inventar acciones tipo `soft-delete`, `discard`, `remove` que no mapeen a uno de los tres patrones.

## Migrations: cambio de patrón

Si una entidad cambia de categoría (e.g. lo que era draft se vuelve fiscal):
1. ADR obligatorio.
2. Migration de DB añade campos necesarios (`status` enum o `is_active`).
3. Backfill: status inicial coherente con el estado actual de los registros.
4. Service de eliminación se modifica para el nuevo patrón.
5. Test de arquitectura actualizado.

## Test de consistencia (a crear)

```python
# backend/core/tests/test_deletion_policy.py
def test_models_match_deletion_policy_table():
    """
    Cada modelo registrado en las apps Django debe coincidir con su patrón
    declarado en docs/20-contracts/deletion-policy.md.
    """
    # Parsea la tabla del MD, introspecciona modelos via Django apps registry,
    # verifica: si patrón=Anulación → modelo tiene `status` con `cancelled`;
    #          si patrón=Archivo → modelo tiene `is_active` indexado;
    #          si patrón=Hard delete → modelo NO tiene `is_active` ni `status` enum.
```

## Referencias

- Acciones de UI: [component-row-actions.md](component-row-actions.md)
- Estados válidos por entidad: [state-map.md](state-map.md)
- Audit / history vía signals: [../10-architecture/backend-apps.md](../10-architecture/backend-apps.md#auditing-history)
