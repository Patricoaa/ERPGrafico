---
layer: 20-contracts
doc: deletion-policy
status: active
owner: core-team
last_review: 2026-06-11
stability: contract-changes-require-ADR
---

# Deletion Policy — Cancelación, Anulación, Archivo y Borrado

Cómo se "elimina" una entidad en ERPGrafico depende de qué tipo de entidad sea. NO existe ni se va a introducir `django-safedelete` ni un mixin global de soft-delete: tres patrones cubren el 100% de los casos y se eligen por categoría, no por preferencia del autor.

## Los cuatro patrones

| Patrón | Mecanismo | Reversible | Compliance fiscal | Acción de UI |
|--------|-----------|-----------|-------------------|--------------|
| **Cancelación** | `status = CANCELLED`. Sin reversos ni asientos de contra-partida. El JE se elimina si es DRAFT. | No — `CANCELLED` es terminal; si fue un error, crear un documento nuevo ([ADR-0048](../10-architecture/adr/0048-cancelled-terminal-no-reset-to-draft.md)) | No — el documento nunca salió de borrador | `cancel` ([row-actions](component-row-actions.md)) |
| **Anulación** | `status = CANCELLED`. Reversos contables / de stock según corresponda. | Solo vía nuevo documento (nota de crédito, contramovimiento) | Sí — el registro queda visible en libros con marca de anulado | `annul` ([row-actions](component-row-actions.md)) |
| **Archivo** | `is_active = False` | Sí — pareja `archive` / `restore` | No aplica | `archive` ↔ `restore` ([row-actions](component-row-actions.md)) |
| **Borrado** | `obj.delete()` (hard) | No | No aplica (no son fiscales) | `delete` ([row-actions](component-row-actions.md)) |

## Cómo elegir — árbol de decisión

```
1. ¿La entidad aparece en libros contables, fiscales o tiene FK desde JournalEntry / Invoice / Payment / StockMove?
   SÍ  → 1a. ¿Todo el árbol está en DRAFT (sin hijos CONFIRMED/POSTED/PAID)?
         SÍ  → Cancelación (status=CANCELLED). Sin reversos. JE se elimina.
         NO  → Anulación (status=CANCELLED). Reversos contables/de stock.
   NO  → 2.

2. ¿Es un dato maestro referenciado por entidades históricas (Bank usado por Movements pasados, ProductCategory usada por Products antiguos)?
   SÍ  → Archivo (is_active=False) + pareja restore. NO se borra nunca.
   NO  → 3.

3. ¿Es un draft, una autosave temporal o estado sin valor de negocio si desaparece (POSDraft, carrito, lock expirado)?
   SÍ  → Hard delete. Cualquier mecanismo: .delete(), DELETE endpoint, cleanup en cron.
   NO  → STOP. Plantea el caso en ADR antes de inventar un cuarto patrón.
```

## Mapeo por app (estado canónico)

> Esta tabla es **autoritativa**. Si un modelo nuevo se agrega, esta tabla debe actualizarse en el mismo PR. El test de arquitectura [`test_deletion_policy_consistency`](../../backend/core/tests/test_deletion_policy_consistency.py) la consume: agrega el modelo a `DELETION_POLICY` en el mismo PR.

| App | Modelo | Patrón | Notas |
|-----|--------|--------|-------|
| `accounting` | `Account` (plan de cuentas) | Archivo | `is_active` filtra selectores; cuentas históricas siguen visibles en mayores |
| `accounting` | `JournalEntry` | Anulación | Reverso vía contramovimiento; status = `cancelled` |
| `billing` | `Invoice` | Cancelación / Anulación | Cancel si DRAFT (sin JE o JE DRAFT). Annul si emitida a SII (requiere Nota de Crédito). |
| `billing` | `CreditNote` / `DebitNote` | Anulación | Idem invoice — solo anulación (nunca DRAFT) |
| `contacts` | `Contact` | Archivo | `is_active=False` saca del selector pero preserva FKs en docs históricos |
| `core` | `User` | Archivo | `is_active=False`. Nunca borrar — preserva audit trail |
| `hr` | `Employee` | Archivo | Excepción: usa `status` `ACTIVE`/`INACTIVE` para ex-empleados (ver `ARCHIVO_EXEMPT`) |
| `inventory` | `Product` | Archivo | `is_active=False`; las líneas históricas siguen referenciándolo |
| `inventory` | `ProductCategory` | Archivo | |
| `inventory` | `UoM` / `UoMCategory` | Archivo | |
| `inventory` | `Warehouse` | Archivo | |
| `inventory` | `StockMove` | Anulación | Reverso vía contramovimiento |
| `production` | `WorkOrder` | Anulación | status = `cancelled`; preserva históricos de producción |
| `purchasing` | `PurchaseOrder` | Cancelación / Anulación | Cancel si DRAFT (tree DRAFT). Annul si CONFIRMED (con reversos). |
| `purchasing` | `PurchaseReceipt` | Cancelación / Anulación | Cancel si DRAFT. Annul si CONFIRMED (reverso de stock). |
| `sales` | `SaleOrder` | Cancelación / Anulación | Cancel si DRAFT (tree DRAFT). Annul si CONFIRMED (reversos). |
| `sales` | `SaleDelivery` | Anulación | Annul directo con reverso de stock. Además admite cancelación **en cascada**: la rama DRAFT de `cancel_sale_order` cancela deliveries DRAFT (no existe `cancel` directo sobre el delivery). |
| `sales` | `POSDraft` / `DraftCart` | Hard delete | Drafts sin valor fiscal — `.delete()` libre |
| `tax` | `TaxPeriod` | Archivo | Excepción: ciclo de vida vía `status` `OPEN`/`UNDER_REVIEW`/`CLOSED`; nunca se borra — afecta cálculos históricos |
| `treasury` | `Bank` | Archivo | |
| `treasury` | `TreasuryAccount` | Archivo | |
| `treasury` | `PaymentMethod` / `PaymentProvider` | Archivo | |
| `treasury` | `TreasuryMovement` | Cancelación / Anulación | Cancel si DRAFT (sin JE o JE DRAFT). Annul si JE POSTED (reverso). |
| `treasury` | `PaymentRequest` | Anulación | status; idempotency_key preserva trazabilidad |
| `treasury` | `BankStatementLine` | Anulación | No se borra; se marca `unmatched` o `discarded` |
| `treasury` | `BankLoan` | Cancelación / Anulación | Cancel si DRAFT (sin desembolso). Annul si ACTIVE (reversas contables del pasivo + cuotas CANCELED). Ver ADR-0033. |
| `treasury` | `LoanInstallment` | append-only (sistema) | Solo `LoanService` modifica el estado; nunca se borra manualmente. `CANCELED` es el estado terminal por `prepay` / `refinance`. |
| `treasury` | `CreditCardStatement` | Cancelación | Cancel si OPEN (sin pago). `CardService.cancel_statement()` es la única vía. Ver ADR-0034. |
| `treasury` | `CreditLine` | Archivo | `status=CANCELED` es terminal; no se borra. Ciclo de vida vía `CreditLineService`. Ver ADR-0049/0050. |
| `treasury` | `Checkbook` | Archivo | `status=CLOSED` / `EXHAUSTED` — nunca se borra; preserva trazabilidad de folios usados. |
| `workflow` | `Transition` | — (eliminado) | Sustituido por `django-simple-history` en todo el sistema. |

## Reglas operativas

### Para entidades de Cancelación

- El campo debe llamarse `status` (no `state`, no `cancelled`, no `is_cancelled`). Estados válidos en [state-map.md](state-map.md).
- La transición a `CANCELLED` se hace **siempre** vía servicio (`*.services.cancel_*(obj)`), nunca seteando el campo en el view.
- El servicio:
  1. Valida que todo el árbol del documento está en DRAFT.
  2. Marca `status=CANCELLED` sin generar reversos contables ni de stock.
  3. Elimina el Journal Entry si está en DRAFT (no deja basura).
  4. Propaga la cancelación en cadena a hijos (Invoice → TreasuryMovement).
  5. Es idempotente: `CANCELLED → CANCELLED` retorna el mismo objeto.
- `cancel_impact`: endpoint de solo lectura que devuelve el sub-árbol de documentos que serán cancelados.

### Para entidades de Anulación

- El campo debe llamarse `status` (no `state`, no `cancelled`, no `is_cancelled`). Estados válidos en [state-map.md](state-map.md).
- La transición a `cancelled` se hace **siempre** vía servicio (`*.services.annul_*(obj, reason)`), nunca seteando el campo en el view.
- El servicio:
  1. Valida que la transición está permitida desde el estado actual (ver state-map).
  2. Genera el reverso contable/inventario si aplica (en `transaction.atomic()`).
  3. Escribe a `django-simple-history` con el motivo (history reason).
- `obj.delete()` sobre estas entidades debe **fallar** o emitir warning explícito. Considerar override de `delete()` en `TransactionalDocument` para bloquearlo en prod.

### Para entidades de Archivo

- El campo se llama **siempre** `is_active` (Boolean, default `True`, `db_index=True`).
- Todos los `Selector` y queryset de UI filtran por `is_active=True` por defecto.
- `is_active=False` no oculta de listados administrativos; el listado debe mostrar el badge "Archivado" + acción `restore`.
- Pareja semántica obligatoria: si una entidad acepta `archive`, debe aceptar `restore`. Ambas viven en [row-actions registry](component-row-actions.md).
- El servicio de archive **no** elimina FKs; los registros históricos que apunten siguen funcionando.

> **Excepciones documentadas.** `Employee` (status `ACTIVE`/`INACTIVE`) y `TaxPeriod`
> (status `OPEN`/`UNDER_REVIEW`/`CLOSED`) gobiernan su ciclo de vida con un enum `status`
> existente; un `is_active` paralelo crearía dos fuentes de verdad. Están declaradas en
> `ARCHIVO_EXEMPT` dentro de
> [`test_deletion_policy_consistency`](../../backend/core/tests/test_deletion_policy_consistency.py).
>
> **Nombre del campo en la API.** El campo de modelo es `is_active` en todos los casos
> (rename 2026-06-11). El alias de compatibilidad `active` que cubrió la transición se
> **retiró el mismo día** (fase 2 del [2-phase de add-migration.md](../30-playbooks/add-migration.md)):
> serializers, filtros y query params de Product/UoM aceptan únicamente `is_active`.
> Nota: `BillOfMaterials.active` y `PricingRule.active` conservan su nombre — no son
> entidades del patrón Archivo y están fuera de este contrato.

### Para entidades de Hard delete

- Se permiten en `.delete()` directo, DELETE endpoint REST y cleanup por cron.
- Si la entidad podría adquirir relevancia fiscal en el futuro: **NO** uses hard delete; usa archivo por defecto.
- Drafts con cleanup: cron Celery beat los borra después de N horas/días de inactividad. Documentar la TTL en el modelo.

## ROW_ACTIONS — semántica autorizada

[Registro canónico](component-row-actions.md) y el código en [frontend/lib/row-actions.ts](../../frontend/lib/row-actions.ts):

| Acción | Aplica a | Resultado en backend |
|--------|----------|----------------------|
| `cancel` | Cancelación únicamente | Service call → `status = cancelled`, JE borrado si DRAFT. Sin reversos. |
| `annul` | Anulación únicamente | Service call → `status = cancelled` + reversos contables/de stock |
| `archive` | Archivo únicamente | `is_active = False` |
| `restore` | Archivo únicamente | `is_active = True` |
| `delete` | Hard delete únicamente | `obj.delete()` |

**Prohibido:**
- Mostrar `delete` en una entidad de categoría 1 o 2.
- Mostrar `archive` sin pareja `restore`.
- Inventar acciones tipo `soft-delete`, `discard`, `remove` que no mapeen a uno de los cuatro patrones.

## Permisos (RBAC)

- Las acciones `cancel` / `annul` de UI se gatean con el permiso `delete_<model>` **de la
  app y entidad propias** (`sales.delete_saleorder`, `purchasing.delete_purchaseorder`,
  `billing.delete_invoice`, `treasury.delete_treasurymovement`, `production.delete_workorder`,
  `sales.delete_saledelivery`, `purchasing.delete_purchasereceipt`), declarado vía
  `requiredPermissions` en los registries de acciones y en los botones inline de fase del HUB.
- Nunca gatear con el permiso de otra app (anti-patrón corregido en G-10: `cancel-order`
  gateado con `billing.delete_invoice`).
- En backend los ViewSets usan `StandardizedModelPermissions`
  ([core/api/permissions.py](../../backend/core/api/permissions.py)), y los servicios
  cancel/annul reciben `user`/`reason` y los registran en el audit trail (`django-simple-history`).

## Migrations: cambio de patrón

Si una entidad cambia de categoría (e.g. lo que era draft se vuelve fiscal):
1. ADR obligatorio.
2. Migration de DB añade campos necesarios (`status` enum o `is_active`).
3. Backfill: status inicial coherente con el estado actual de los registros.
4. Service de eliminación se modifica para el nuevo patrón.
5. Test de arquitectura actualizado.

## Test de consistencia

```python
# backend/core/tests/test_deletion_policy_consistency.py
# Verifica contra el registry de Django:
# - anulacion/cancelacion → status con valor CANCELLED, salvo mecanismos especiales
#   declarados en STATUS_EXEMPT (StockMove: contramovimiento; BankStatementLine:
#   reconciliation_status)
# - archivo → is_active BooleanField; gaps actuales fijados en ARCHIVO_KNOWN_GAPS
#   (fallan si crecen o si una entrada ya migrada no se retira de la lista)
# - cancelacion → service method registrado en CANCEL_SERVICE_MAP existe y es callable
# - Todos los modelos referenciados en DELETION_POLICY existen en el backend
```

## Referencias

- Acciones de UI: [component-row-actions.md](component-row-actions.md)
- Estados válidos por entidad: [state-map.md](state-map.md)
- Audit / history vía signals: [../10-architecture/backend-apps.md](../10-architecture/backend-apps.md#auditing-history)
