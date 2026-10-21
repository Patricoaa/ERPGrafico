# Evaluación — editabilidad de documentos con derivados contables (2026-10-21)

> Origen: al editar el monto de un anticipo de sueldo ya pagado, ni el movimiento de tesorería ni el asiento se modifican, pero el anticipo se puede vincular a una liquidación con el monto nuevo → descuadre entre RRHH, tesorería y contabilidad.
> Conclusión: **no es un caso puntual**. Las reglas de edición están documentadas (`docs/20-contracts/state-map.md`) pero su cumplimiento en el backend es opcional por ViewSet. Varias entidades que generan asientos o movimientos de tesorería aceptan `PATCH`/`DELETE` sin mirar su estado; en algunas solo la interfaz lo impide.

Método: lectura de código (modelos, ViewSets, serializers, servicios, validadores). **No se ha reproducido aún contra el dev server**; los casos críticos (§3.2) deben confirmarse con un `PATCH` real antes de implementar.

## 1. Caso anticipo de sueldo

| Paso | Efecto |
|---|---|
| Crear anticipo con pago | `SalaryAdvanceService.create_advance_with_payment` crea `TreasuryMovement` (OUTBOUND) + asiento y guarda `advance.journal_entry` |
| Editar `amount` del anticipo | `SalaryAdvanceViewSet` es un `ModelViewSet` sin guard: el monto cambia; movimiento y asiento quedan con el monto original |
| Vincular a liquidación y contabilizar | `PayrollService.post_payroll` acredita `account_anticipos` por el monto **nuevo** → la cuenta de anticipos queda descuadrada respecto del egreso real |

Agravantes:
- `SalaryAdvance` **no tiene campo de estado** (solo `is_discounted` + FK `payroll` nullable) y **no figura en `state-map.md`**.
- Se puede desvincular (`PATCH payroll=null`) un anticipo de una liquidación ya `POSTED`. `validate_payroll` solo impide *vincular* a una liquidación contabilizada, no *desvincular*. La sección "Anticipos vinculados" de `PayrollDetailView` lo oculta en la UI, pero el backend lo acepta.

## 2. Estado del mecanismo de bloqueo

- **Contrato:** `state-map.md` declara restricciones de edición por entidad ("solo editable en `DRAFT`", campos inmutables) y el flujo correcto para asientos: reversa con `REVERSAL` vinculado vía `reversal_of`, original intacto.
- **Implementación:** no hay mecanismo común. Cuatro servicios repiten un `validate_editable(instance)` que su ViewSet invoca en `update`/`partial_update`. La clase base `core.models.abstracts.TransactionalDocument` no aporta nada sobre editabilidad, y los modelos que no la heredan (RRHH, tesorería, impuestos) no tienen nada.
- **Frontend:** varios drawers/vistas deciden `isReadOnly` por su cuenta (p. ej. `PayrollDetailView` con `isPosted`). Eso oculta los huecos del backend sin cerrarlos.

## 3. Matriz por entidad

Entidades con FK `journal_entry` (o que generan movimientos de tesorería), según el guard encontrado en el backend.

### 3.1 Protegidas

| Entidad | Guard | Ubicación |
|---|---|---|
| `Invoice` | `BillingService.validate_editable` (solo `DRAFT`) | `billing/views.py:83`, `billing/services.py:1496` |
| `SaleOrder` | `SalesService.validate_editable` | `sales/views.py:174` |
| `PurchaseOrder` | `PurchasingService.validate_editable` | `purchasing/views.py:131` |
| `JournalEntry` | `JournalEntryService.validate_editable`; borrado solo en `DRAFT` | `accounting/views.py:191` |
| `StockMove` | `ReadOnlyModelViewSet` | `inventory/views.py:420` |

### 3.2 Sin guard — riesgo alto

| Entidad | Hueco | Consecuencia |
|---|---|---|
| `TreasuryMovement` | `TreasuryMovementWriteSerializer` (usado en `update`/`partial_update`) deja escribibles `amount`, `account`, `from_account`, `to_account`, `date`, `contact`, `invoice`, `sale_order`, `purchase_order`, `bank_statement_line`… `perform_update` (`treasury/views.py:387`) guarda y recalcula el documento relacionado sin mirar estado. **Resuelto 2026-10-21 (EditPolicy).** | Se puede cambiar `amount`, cuentas o fecha de un movimiento con asiento `POSTED`: saldo de tesorería ≠ libro mayor. Además recalcula el saldo pendiente de facturas/OV/OC con el monto editado. |
| `Payroll` | `PayrollWriteSerializer` deja editables `base_salary`, `agreed_days`, `absent_days`, `worked_days`… `PayrollValidator` (`hr/validators.py`) no mira `status`. | Liquidación `POSTED` editable vía API; su asiento no cambia. **Resuelto 2026-10-21 (EditPolicy; también `recalculate`).** |
| `PayrollItem` | `PayrollItemViewSet` (`hr/views.py:320`) crea/edita/borra ítems y llama `recalculate_totals()` sin mirar el estado de la liquidación. | Totales de una liquidación contabilizada cambian; el asiento no. **Resuelto 2026-10-21.** |
| `SalaryAdvance` | Sin estado y sin guard (ver §1). | Descuadre de la cuenta de anticipos. **Resuelto 2026-10-21: `status` DRAFT/PAID/DISCOUNTED/CANCELLED (reemplaza `is_discounted`), EditPolicy, reglas de vínculo, `annul`.** |

### 3.3 Sin guard — riesgo medio (confirmar)

| Entidad | Observación |
|---|---|
| `PayrollPayment` | `ModelViewSet` sin override; `amount` editable; solo `id`/fechas read-only. Admite `DELETE`. Además `POST` directo creaba un "pago" sin movimiento ni asiento. **Resuelto 2026-10-21: API de solo lectura (los pagos nacen de `pay_salary`/`pay_previred`) + EditPolicy.** |
| `F29Declaration` | `F29DeclarationWriteSerializer` sin `validate` de estado; no se encontró chequeo de período tributario cerrado en la edición. Más grave: `POST /tax/declarations/` (`create_or_update_declaration`) hacía `update_or_create` y **sobrescribía los montos de una declaración ya registrada**. **Resuelto 2026-10-21: EditPolicy (registrada → solo `notes`/`document`) aplicada en API y en el servicio.** |
| `F29Payment` | `ModelViewSet` sin override de edición; solo `journal_entry` read-only. Además el `queryset` hacía `select_related("payment_method")` sobre un `CharField`: **toda lectura por API respondía 500**. **Resuelto 2026-10-21 (EditPolicy + queryset).** |
| `SaleDelivery`, `SaleReturn` | Solo `id`/`number`/`status` read-only. **Sin `NoDestroyModelMixin`**: aceptan `DELETE` por defecto aunque tengan stock moves y asiento (contradice `deletion-policy.md`). **Resuelto 2026-10-21: `DRAFT_ONLY_DOCUMENT` (editable solo en DRAFT sin asiento; `notes` siempre) + `NoDestroyModelMixin`.** |
| `PurchaseReceipt`, `PurchaseReturn` | Solo `id`/`number`/`status` read-only; tienen `NoDestroyModelMixin` y `annul`, pero no guard de edición. **Resuelto 2026-10-21: `DRAFT_ONLY_DOCUMENT` (editable solo en DRAFT sin asiento; `notes` siempre) + `NoDestroyModelMixin`.** |

### 3.4 No revisadas en detalle

`CardPendingCharge`, `BankStatementLine`, `TerminalBatch`, `POSSessionAudit`, `Check` (este último declara en `state-map.md` "inmutable salvo `notes`"; su serializer marca varios campos read-only, falta verificar que cubra los económicos).

## 4. Causa raíz

1. **El bloqueo es opt-in por ViewSet.** Cada entidad nueva depende de que quien la implementa recuerde copiar `validate_editable`. No hay test que lo exija.
2. **Ningún principio explícito sobre derivados.** No está escrito qué pasa con un documento cuando ya generó asiento o movimiento: ¿se bloquea, se propaga la edición o se anula y se recrea? Cada flujo improvisa.
3. **La UI decide la editabilidad.** El backend no expone si un registro es editable; cada drawer lo deduce, y los huecos del backend quedan ocultos.
4. **Edición y borrado comparten el problema.** Los mismos documentos sin guard de edición suelen admitir `DELETE` por defecto.

## 5. Propuesta (pendiente de decisión)

### 5.1 Principio — inmutabilidad económica (requiere ADR)

Cuando un documento tiene derivados contabilizados (asiento `POSTED` o movimiento de tesorería), sus **campos económicos** (monto, fecha, contraparte, cuentas, líneas) son inmutables. Solo siguen editables los campos descriptivos (`notes`, adjuntos). Para corregir: **anular** (asiento `REVERSAL` + movimiento inverso, según `state-map.md`) y **recrear**.

Se descarta propagar ediciones a los derivados: es frágil (cada documento tiene derivados distintos), rompe la traza de auditoría y contradice el modelo de reversas que el sistema ya usa.

### 5.2 Mecanismo único en el backend

- Cada modelo declara su política: estados editables y campos editables tras contabilizar (p. ej. `EDITABLE_STATUSES = {"DRAFT"}`, `POST_LOCK_MUTABLE_FIELDS = {"notes"}`).
- Un mixin común de ViewSet la aplica en `update`, `partial_update` y `destroy`, y un helper la aplica en endpoints anidados (ítems de liquidación, vinculación de anticipos).
- Los `validate_editable` actuales de `BillingService`, `SalesService`, `PurchasingService` y `JournalEntryService` pasan a usar ese mecanismo.

### 5.3 Evaluación transversal — test de contrato (ratchet)

Test que recorre todos los modelos con FK a `accounting.JournalEntry` o relación con `treasury.TreasuryMovement` y falla si alguno no declara política de bloqueo. Excepciones explícitas en una baseline que solo puede decrecer, igual que los ratchets existentes. Esto responde "¿cómo lo evaluamos para todas las entidades?": deja de ser una revisión manual.

### 5.4 Frontend

Los serializers exponen `is_editable` (y opcionalmente `editable_fields`). Los drawers derivan `mode`/`readOnly` de ese dato en lugar de deducirlo localmente.

### 5.5 Anticipo de sueldo

- Estado: `DRAFT` (registrado sin pago) → `PAID` (con movimiento + asiento) → `DISCOUNTED` (incluido en liquidación `POSTED`) · `CANCELLED` (anulado con reversa del movimiento).
- `amount`, `date`, `employee` inmutables desde `PAID`.
- Vincular/desvincular solo con liquidación en `DRAFT`; `DISCOUNTED` es terminal.
- Agregar la entidad a `state-map.md`.

## 6. Prioridad sugerida

| Orden | Entidad | Motivo |
|---|---|---|
| 1 | `TreasuryMovement` | Afecta caja, libro mayor y saldos de facturas/OV/OC a la vez |
| 2 | `Payroll` + `PayrollItem` | Liquidación contabilizada editable vía API |
| 3 | `SalaryAdvance` | Caso de origen; requiere estado nuevo + migración |
| 4 | `PayrollPayment`, `F29Declaration`, `F29Payment` | Derivados contables sin guard |
| 5 | `SaleDelivery`, `SaleReturn` (borrado), recepciones/devoluciones de compra | Stock y asiento |
| 6 | §3.4 | Completar revisión |

Antes de cualquier migración: respaldo del dev server y conteo de registros ya inconsistentes (p. ej. anticipos cuyo `amount` ≠ monto de su movimiento de tesorería; movimientos cuyo `amount` ≠ total de su asiento).

## 7. Decisiones (2026-10-21) — registradas en ADR-0091

1. **Principio §5.1 aprobado:** inmutabilidad económica; corrección por anular + recrear, sin propagación.
2. **Mecanismo (evaluado por mejor práctica):** política declarada en el modelo (`EditPolicy`) y aplicada en los bordes de escritura — mixin de ViewSet para la API y `assert_editable` en servicios y endpoints anidados. Se descarta `Model.save()` (bloquea transiciones legítimas de los servicios y `QuerySet.update()` lo evita) y se descarta dejarlo solo en serializers (es el patrón opt-in que falló).
3. **Primero el mecanismo común**, sin parches ad-hoc previos en `TreasuryMovement`.

## 8. Alcance — extensión a todas las entidades

Sí, pero estratificado y forzado por el test de contrato (§5.3), que exige clasificar **todos** los modelos concretos:

| Clase | Qué se evalúa | Ejemplos |
|---|---|---|
| A. Documentos con derivados (asiento, tesorería, stock) | `EditPolicy` completa + flujo de anulación | Este informe §3 |
| B. Documentos con ciclo de estados sin derivados | Bloqueo por estado terminal | `WorkOrder`, `Task`, `Subscription`, `InventoryCount` |
| C. Maestros referenciados por documentos contabilizados | Qué campos no pueden cambiar si hay historia (tipo de cuenta con movimientos, UoM de producto con stock, cuenta de un método de pago usado) | `Account`, `Product`, `UoM`, `PaymentMethod`, `TreasuryAccount`, `Contact` |
| D. Config / logs / hijos | Clasificación explícita; los logs son append-only; los hijos heredan el bloqueo del padre | settings, auditoría, líneas |

La clase C es un problema distinto (integridad histórica de referencias, no editabilidad del documento) y merece su propia evaluación después de A.

## 9. Pendientes surgidos en la implementación

- **Ruta de corrección para `PayrollPayment` y `F29Payment`:** ya no se editan, pero tampoco tienen anulación propia. Anular su `TreasuryMovement` desde Tesorería deja el pago vivo (cuenta como pagado en la liquidación / el F29). Requiere un `annul` por entidad, como el del anticipo.
- **`TreasuryMovement` anulado con documento de RRHH/impuestos vinculado:** `annul_movement` no avisa al documento dueño. Evaluar que tesorería rechace anular movimientos con dueño y derive al `annul` del documento.
