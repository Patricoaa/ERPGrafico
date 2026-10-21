---
layer: 20-contracts
doc: state-map
status: active
owner: core-team
last_review: 2026-05-27
stability: contract-changes-require-ADR
---

# Entity State Map

Single source of truth for every entity state. `StatusBadge` variants must match. `BUSINESS_STATES.md` is DEPRECATED.

## Conventions

- State identifiers: `UPPER_CASE` in backend TextChoices, `UPPER_CASE` in API responses.
- Every state maps to a semantic color intent via `STATUS_MAP` in `frontend/lib/badge-resolvers.ts`.
- No raw Tailwind color — always token.

## SaleOrder

| Status | DeliveryStatus | Intent | Transitions allowed to |
|--------|---------------|--------|------------------------|
| `DRAFT` | — | `info` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | — | `warning` | `PAYMENT_PENDING`, `CANCELLED` |
| `PAYMENT_PENDING` | — | `warning` | `CONFIRMED`, `CANCELLED` |
| `CANCELLED` | — | `destructive` | — |

> **ADR-0084:** el `status` es solo el ciclo del documento. Facturación (`invoicing_status`, ADR-0081), entrega (`delivery_status`) y pago (`payment_status`) son ejes independientes; `INVOICED`/`PAID` dejaron de ser estados de la OV (migración `sales/0019`).

**PaymentStatus** (derivado del saldo, ADR-0084 — nunca lo escribe tesorería en `status`):

| Value | Intent | Meaning |
|-------|--------|---------|
| `UNPAID` | `neutral` | Sin pagos |
| `PARTIAL` | `warning` | Pagos parciales |
| `PAID` | `success` | Sin saldo pendiente |

**DeliveryStatus** (independent tracking):

| Value | Intent | Meaning |
|-------|--------|---------|
| `PENDING` | `warning` | Sin despachos confirmados |
| `PARTIAL` | `warning` | Despachos parciales |
| `DELIVERED` | `success` | Todas las líneas despachadas |

**Edit restrictions:** Solo editable en `DRAFT`. Campos inmutables: `number`, `status`, `total_net`, `total_tax`, `total`, `journal_entry`.

**Edit policy (ADR-0091, `DRAFT_ONLY_DOCUMENT`):** editable solo en `DRAFT` sin asiento; bloqueado solo admite `notes` (API 422 `DOCUMENT_LOCKED`; antes 400 y bloqueaba también `notes`).

## PurchaseOrder

| Status | ReceivingStatus | Intent | Transitions allowed to |
|--------|----------------|--------|------------------------|
| `DRAFT` | — | `info` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | — | `warning` | `CANCELLED` |
| `CANCELLED` | — | `destructive` | — |

> **ADR-0084:** recepción (`receiving_status`), facturación (`invoicing_status`) y pago (`payment_status`, mismos valores que en OV) son ejes independientes; `RECEIVED`/`INVOICED`/`PAID` dejaron de ser estados de la OC (migración `purchasing/0014`). La OC que queda pagada avanza su suscripción (`on_fully_paid`).

**ReceivingStatus** (independent tracking):

| Value | Intent | Meaning |
|-------|--------|---------|
| `PENDING` | `warning` | Sin recepciones |
| `PARTIAL` | `warning` | Recepciones parciales |
| `RECEIVED` | `success` | Todas las líneas recibidas |

**Edit restrictions:** Solo editable en `DRAFT`. Campos inmutables: `id`, `number`, `status`, `receiving_status`, `total_net`, `total_tax`, `total`.

**Edit policy (ADR-0091, `DRAFT_ONLY_DOCUMENT`):** editable solo en `DRAFT` sin asiento; bloqueado solo admite `notes` (API 422 `DOCUMENT_LOCKED`; antes 400 y bloqueaba también `notes`).

## WorkOrder

### Status (top-level)

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `warning` | `FINISHED`, `CANCELLED` |
| `FINISHED` | `success` | — (terminal) |
| `CANCELLED` | `destructive` | — (terminal) |

### Stage (multi-stage pipeline)

| Stage | Intent | Next stages |
|-------|--------|-------------|
| `MATERIAL_ASSIGNMENT` | `info` | `MATERIAL_APPROVAL`, `CANCELLED` |
| `MATERIAL_APPROVAL` | `warning` | `OUTSOURCING_ASSIGNMENT`, `PREPRESS`, `CANCELLED` |
| `OUTSOURCING_ASSIGNMENT` | `info` | `PREPRESS`, `CANCELLED` |
| `PREPRESS` | `info` | `PRESS`, `CANCELLED` |
| `PRESS` | `primary` | `POSTPRESS`, `CANCELLED` |
| `POSTPRESS` | `primary` | `OUTSOURCING_VERIFICATION`, `RECTIFICATION`, `CANCELLED` |
| `OUTSOURCING_VERIFICATION` | `info` | `RECTIFICATION`, `CANCELLED` |
| `RECTIFICATION` | `warning` | `FINISHED`, `CANCELLED` |
| `FINISHED` | `success` | — (terminal) |
| `CANCELLED` | `destructive` | — (terminal) |

**Stage rules:**
- Forward transitions governed by allowlist per stage.
- Backward moves to non-terminal stages permitted (resets approval tasks).
- Terminal stages (`FINISHED`, `CANCELLED`) cannot transition out.
- PREPRESS/PRESS/POSTPRESS only allowed if product enables them.
- Cancellation limit: typically PRESS (if available) or earlier.

**Edit restrictions:** Terminal stages (`FINISHED`, `CANCELLED`) block all edits. Identity fields (`product`, `sale_order`, `sale_line`) immutable post-creation. Campos inmutables: `id`, `number`, `status`, `current_stage`.

## Invoice

| DTEType | Status | Intent | Transitions allowed to |
|---------|--------|--------|------------------------|
| Any | `DRAFT` | `info` | `POSTED`, `CANCELLED` |
| Any | `POSTED` | `success` | `CANCELLED` |
| Any | `CANCELLED` | `destructive` | — |

> **ADR-0084:** `DRAFT` = folio pendiente (puede tener asiento y pagos); `POSTED` = emitida con folio. El pago es `payment_status` (`UNPAID` · `PARTIAL` · `PAID`, derivado del saldo) y **no** cambia el estado: una factura pagada sin folio sigue en `DRAFT`. `PAID` dejó de ser estado (migración `billing/0020`: con folio → `POSTED`, sin folio → `DRAFT`).

**DTEType** (document type, not status):
`FACTURA`, `FACTURA_EXENTA`, `BOLETA`, `BOLETA_EXENTA`, `PURCHASE_INV`, `NOTA_CREDITO`, `NOTA_DEBITO`, `COMPROBANTE_PAGO`

**Edit restrictions:** Solo editable en `DRAFT`. Campos inmutables: `id`, `number`, `status`, `total_net`, `total_tax`, `total`, `journal_entry`, `tax_period_closed`.

**Annul rules:** If folio assigned → requires Nota de Crédito. If confirmed deliveries/receipts exist → blocks. If posted payments exist → blocks (unless `force=True` cascades).

**Edit policy (ADR-0091, `DRAFT_ONLY_DOCUMENT`):** editable solo en `DRAFT` sin asiento; bloqueado solo admite `notes` (API 422 `DOCUMENT_LOCKED`; antes 400 y bloqueaba también `notes`).

## JournalEntry

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `POSTED`, `CANCELLED` |
| `POSTED` | `success` | `CLOSED` (period closed), — (creates `REVERSAL` linked via `reversal_of`, original unchanged) |
| `CLOSED` | `info` | `POSTED` (period reopened), — (creates `REVERSAL` linked via `reversal_of`, original unchanged) |
| `REVERSAL` | `primary` | — |
| `CANCELLED` | `destructive` | — |

**Balance-affecting statuses:** `POSTED`, `CLOSED`, `REVERSAL` — these filter into ledger, budget, and account balance calculations.

**Reversal flow:** When reversing a `POSTED` or `CLOSED` entry, a new `REVERSAL` entry is created with mirrored items. The original entry **remains unchanged** for audit trail. Double reversal is prevented by checking `reversal_of` FK existence.

**Edit restrictions:** Solo editable en `DRAFT`. Campos inmutables: `id`, `number`, `status`, `reversal_of`.

## SaleDelivery

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `warning` | `CANCELLED` |
| `CANCELLED` | `destructive` | — |

**Edit restrictions:** Campos inmutables: `id`, `number`, `status`.

**Edit policy (ADR-0091, `DRAFT_ONLY_DOCUMENT`):** editable solo en `DRAFT` sin asiento; bloqueado solo admite `notes`; nunca hard delete (API 405): `DRAFT` se cancela, `CONFIRMED` se anula.

## SaleReturn

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `warning` | `CANCELLED` |
| `CANCELLED` | `destructive` | — |

**Edit restrictions:** Campos inmutables: `id`, `number`, `status`.

**Edit policy (ADR-0091, `DRAFT_ONLY_DOCUMENT`):** editable solo en `DRAFT` sin asiento; bloqueado solo admite `notes`; nunca hard delete (API 405): `DRAFT` se cancela, `CONFIRMED` se anula.

## PurchaseReceipt

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `warning` | `CANCELLED` |
| `CANCELLED` | `destructive` | — |

**Edit restrictions:** Campos inmutables: `id`, `number`, `status`.

**Edit policy (ADR-0091, `DRAFT_ONLY_DOCUMENT`):** editable solo en `DRAFT` sin asiento; bloqueado solo admite `notes`; nunca hard delete (API 405): `DRAFT` se cancela, `CONFIRMED` se anula.

## PurchaseReturn

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `warning` | `CANCELLED` |
| `CANCELLED` | `destructive` | — |

**Edit restrictions:** Campos inmutables: `id`, `number`, `status`.

**Edit policy (ADR-0091, `DRAFT_ONLY_DOCUMENT`):** editable solo en `DRAFT` sin asiento; bloqueado solo admite `notes`; nunca hard delete (API 405): `DRAFT` se cancela, `CONFIRMED` se anula.

## Payroll

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `POSTED` |
| `POSTED` | `success` | — |

**Edit restrictions:** Campos inmutables: `id`, `number`, `display_id`, `status`, `total_haberes`, `total_descuentos`, `net_salary`, `journal_entry`.

**Edit policy (ADR-0091):** `Payroll` editable/eliminable solo en `DRAFT` (`POSTED`: solo `notes`; `recalculate` rechazado). `PayrollItem` bloqueado si la liquidación no está en `DRAFT` (crear/editar/borrar). `PayrollPayment` (`POSTED` → `CANCELLED`): API de solo lectura; se crea solo vía `pay_salary`/`pay_previred` y queda bloqueado al tener asiento. Se corrige con `POST /hr/payroll-payments/{id}/annul/` (motivo obligatorio): reversa su movimiento y libera el saldo pendiente.

## SalaryAdvance (Anticipo de Sueldo)

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `PAID` (pago registrado en tesorería) |
| `PAID` | `success` | `DISCOUNTED` (al contabilizar la liquidación vinculada), `CANCELLED` (vía `annul`) |
| `DISCOUNTED` | `success` | — (terminal) |
| `CANCELLED` | `destructive` | — (terminal) |

**Edit policy (ADR-0091, `SalaryAdvance.edit_policy`):** editable y eliminable solo en `DRAFT`. Desde `PAID` solo `notes` y el vínculo `payroll`. `status` y `journal_entry` read-only.

**Payroll link:** solo un anticipo `PAID`; la liquidación de origen y la de destino deben estar en `DRAFT` y ser del mismo empleado; no se vincula al crear. `post_payroll` rechaza anticipos vinculados que no estén `PAID`.

**Annul (`POST /hr/advances/{id}/annul/`, motivo obligatorio):** solo `PAID` sin liquidación; anula el `TreasuryMovement` (asiento `REVERSAL`) y deja `CANCELLED`. Corregir un monto = anular + registrar uno nuevo.

## BankStatement

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `success` | `CANCELLED` |
| `CANCELLED` | `destructive` | — |

**Edit restrictions:** Campos inmutables: `id`, `status`. Lines locked when CONFIRMED.

## BankStatementLine

| ReconciliationStatus | Intent | Transitions allowed to |
|---------------------|--------|------------------------|
| `UNRECONCILED` | `info` | `MATCHED`, `EXCLUDED` |
| `MATCHED` | `info` | `RECONCILED`, `UNRECONCILED` |
| `RECONCILED` | `success` | — |
| `DISPUTED` | `destructive` | `MATCHED`, `EXCLUDED` |
| `EXCLUDED` | `neutral` | `UNRECONCILED` |

## TreasuryMovement

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `DRAFT` | `info` | `POSTED`, `CANCELLED` |
| `POSTED` | `success` | `CANCELLED` (vía annul: reverso contable) |
| `CANCELLED` | `destructive` | — |

**Edit restrictions:** If `is_reconciled == True` → bloquea cancelación. Si tiene `journal_entry.status == POSTED` → solo annul vía reverso. Movimientos en período contable cerrado se bloquean.

**Edit policy (ADR-0091, `TreasuryMovement.edit_policy`):** editable solo en `DRAFT` **y sin asiento** (cualquier asiento, aun borrador, deriva de sus campos). Bloqueado: solo `notes` y `justify_reason` editables; la API responde 422 `DOCUMENT_LOCKED`. Hard delete solo de `CANCELLED` sin asiento (purga admin). `is_editable` expuesto en el detalle. **Movimientos con documento dueño** (anticipo, pago de liquidación, pago F29): `cancel`/`annul` directos se rechazan; se anulan desde el documento (`TreasuryService.assert_not_owned`).

**Edit policy (ADR-0091):** bloqueada si está `MATCHED`/`RECONCILED` o tiene `difference_journal_entry` (solo `notes`); no se elimina. Campos del sistema (`reconciliation_match`, `reconciled_*`, `difference_*`, `statement`, `line_number`, `has_warning`) read-only. `PATCH` solo cambia el estado a `EXCLUDED`/`UNRECONCILED`; conciliar va por acciones.

## POSSession

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `OPEN` | `success` | `CLOSED` |
| `CLOSED` | `info` | — |

**Terminal como fuente de verdad (ADR-0063):** la sesión se abre siempre con un `terminal`;
`treasury_account` es un snapshot inmutable de `terminal.default_treasury_account` capturado
al abrir. La API expone `treasury_account_name` con fallback al default del terminal.
Campos no editables: `treasury_account` (snapshot).

**Edit policy (ADR-0091):** `POSSessionAudit` (arqueo) es inmutable una vez contabilizado; sin escritura por API.

## TerminalBatch

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `PENDING` | `warning` | `SETTLED` |
| `SETTLED` | `success` | `RECONCILED`, `INVOICED` |
| `RECONCILED` | `success` | — |
| `INVOICED` | `info` | — |

**Edit restrictions:** Campos inmutables: `settlement_journal_entry`, `bank_statement_line`, `supplier_invoice`.

## Check (Cheques Recibidos y Propios Girados)

Cheque de tercero (cliente u otro pagador) en cartera, o cheque propio girado a proveedor.
Backend: `treasury.Check`. Lifecycle gobernado por `treasury.check_service.CheckService` (ADR-0032, ADR-0035, ADR-0039).

| Status | Intent | Transitions allowed to | Acción de servicio |
|--------|--------|------------------------|--------------------|
| `IN_PORTFOLIO` | `info` | `DEPOSITED`, `VOIDED` | `receive()` (entrada) |
| `DEPOSITED` | `warning` | `CLEARED`, `BOUNCED` | `deposit()` |
| `CLEARED` | `success` | — (terminal) | `clear()` |
| `BOUNCED` | `destructive` | — (terminal) | `bounce()` (con reversas contables) |
| `VOIDED` | `destructive` | — (terminal) | `void()` (desde `IN_PORTFOLIO` o `ISSUED`) |
| `ISSUED` | `info` | `CLEARED`, `VOIDED` | `issue()` (cheque propio girado) |

> **ADR-0039** removió el endoso de cheques recibidos (estado `ENDORSED`,
> campos `endorsed_to` / `endorsement_movement`, servicio `endorse()`).
> Ver `docs/10-architecture/adr/0039-removal-of-check-endorsement.md`
> para el fundamento técnico. La parte de cheques girados de ADR-0035 sigue
> vigente (cheques propios, F4.1).

> **ADR-0040** (superado en este punto por ADR-0084): protestar o anular un cheque ya no
> "demueve" estados — el pago no escribe el estado del documento y `payment_status` se
> recalcula solo desde el saldo (matemática firmada de `PaymentSelector`).
> `_recompute_invoice_status()` queda como no-op. La
> lógica vive en `CheckService` (no en `TreasuryService.update_related_document_status`)
> para preservar el comportamiento de pagos no-cheque. Ver
> `docs/10-architecture/adr/0040-check-bounce-void-invoice-demotion.md`.

**Contabilidad — Cheques recibidos:**
- `receive()`: INBOUND a la `TreasuryAccount` puente `CHECK_PORTFOLIO`
  (auto-provisionada desde `AccountingSettings.check_portfolio_account`).
- `deposit()`: TRANSFER puente → cuenta bancaria.
- `bounce()`: revierte depósito y recepción (2 movimientos OUTBOUND/TRANSFER) y
  reinstala el documento original como impago.
- `void()`: revierte solo la recepción.

**Contabilidad — Cheques propios girados:**
- `issue()`: OUTBOUND desde `TreasuryAccount` puente `ISSUED_CHECKS`
  (LIABILITY, auto-provisionada) salda al proveedor. No toca banco.
- `mark_cashed()`: TRANSFER pasivo "Cheques Girados" → banco; `CLEARED`.
- `void()`: INBOUND reversa al pasivo (desde `ISSUED`).

**Chequera (Checkbook):**
- Model `treasury.Checkbook` con `bank_account` (CHECKING), `start_folio`, `end_folio`,
  `next_folio`, `status` (ACTIVE/CLOSED/EXHAUSTED).
- `issue()` toma siguiente folio automáticamente si check_number es None.
- Validación: unicidad check_number por banco.

**Edit restrictions:** Cheque inmutable salvo `notes` y campos de auditoría
(`deposited_at`/`cleared_at`/`bounced_at`); cambios de estado pasan exclusivamente
por `CheckService`.

## CreditLine (Línea de Crédito — Sobregiro)

Backend: `treasury.CreditLine`. Sobregiro asociado a una cuenta corriente
(`TreasuryAccount` con `account_type=CHECKING`). Independiente de `BankLoan`.

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `ACTIVE` | `success` | `EXPIRED`, `SUSPENDED`, `CANCELED` |
| `EXPIRED` | `warning` | `ACTIVE` (si se renueva) |
| `SUSPENDED` | `neutral` | `ACTIVE` |
| `CANCELED` | `neutral` | — (terminal) |

**Propiedades calculadas (no campos DB) — ver ADR-0050:**
- `used_amount` = `SUM(CREDIT_LINE_DRAW) - SUM(CREDIT_LINE_REPAY)` vía TreasuryMovement.
- `available_amount` = `max(credit_limit - used_amount, 0)`.
- `utilization_rate` = `(used_amount / credit_limit) * 100` (None si credit_limit = 0).
- `TreasuryAccount.available_liquidity` = `balance + credit_line.available_amount`.

## BankLoan (Crédito Bancario)

Crédito / préstamo bancario (CLP o UF). Backend: `treasury.BankLoan`.
Lifecycle gobernado por `treasury.loan_service.LoanService` (ADR-0033).

| Status | Intent | Transitions allowed to | Acción de servicio |
|--------|--------|------------------------|--------------------|
| `DRAFT` | `info` | `ACTIVE` | `disburse()` (desembolso: INBOUND al banco + nace pasivo) |
| `ACTIVE` | `success` | `PAID`, `REFINANCED` | `pay_installment()` (pago cuota), `prepay()` (pago total), `refinance()` |
| `PAID` | `success` | — (terminal) | Al pagar última cuota o prepago |
| `REFINANCED` | `info` | — (terminal) | `refinance()` (cuotas pendientes → CANCELED) |
| `DEFAULTED` | `destructive` | — (terminal) | Marca manual (futuro) |

**Contabilidad:**
- `disburse()`: `TreasuryMovement` INBOUND a `disbursement_account` con origen
  contable = `liability_account` (crédito al pasivo). Idempotente.
- `pay_installment()`: `TreasuryMovement` OUTBOUND desde `payment_account`;
  JE custom con desglose Debe `liability_account` (capital) + Debe
  `interest_expense_account` + Debe `insurance_expense_account` (si configuradas)
  / Haber `payment_account`. Construido con `is_pending_registration=True` para
  evitar que el flujo estándar borre el asiento.
- `prepay()`: un único movimiento OUTBOUND por saldo + interés prorrateado
  (1/30 por día del mes en curso). Cuotas pendientes → CANCELED, loan → PAID.
- `refinance()`: solo cambia estado + cancela pendientes; no paga.

**Conversión UF→CLP:** Las cuotas se almacenan en UF; al pagar, se consulta
`finances.IndicatorValue.get_value('UF', pay_date)` y se persiste el valor
usado en `installment.uf_value_used` para trazabilidad.

**Edit restrictions:** `status` y `installments` inmutables salvo por las
acciones de `LoanService`. `principal`/`interest_rate`/`term_months` no son
editables tras la creación (regenerar la tabla requiere nuevo crédito).

## LoanInstallment (Cuota de Crédito)

Una fila por mes del calendario de amortización. Backend: `treasury.LoanInstallment`.

| Status | Intent | Transitions allowed to | Acción de servicio |
|--------|--------|------------------------|--------------------|
| `PENDING` | `warning` | `PAID`, `OVERDUE`, `CANCELED` | (inicial) |
| `PAID` | `success` | — (terminal) | `pay_installment()` |
| `OVERDUE` | `destructive` | `PAID`, `CANCELED` | `mark_overdue_loan_installments` (BEAT diario) |
| `PARTIAL` | `warning` | `PAID`, `CANCELED` | (futuro: pagos parciales) |
| `CANCELED` | `neutral` | — (terminal) | `prepay()` / `refinance()` sobre el préstamo |

**Notificaciones:** Cuotas próximas a vencer (horizonte 5 días) generan
`Notification` tipo `LOAN_INSTALLMENT_UPCOMING` a superusuarios activos.
Dedup por día vía `Notification.data.target_date` (ISO).

**Edit policy (ADR-0091):** `TerminalBatch` editable solo en `PENDING` sin asiento de liquidación; `status`, `settlement_*` y `reconciliation_match` read-only; no se elimina.

## CreditCardStatement (Estado de Cuenta Tarjeta de Crédito)

Estado de cuenta mensual de la tarjeta de crédito propia.
Backend: `treasury.CreditCardStatement`. Lifecycle gobernado por
`treasury.card_service.CardService` (ADR-0034).

| Status | Intent | Transitions allowed to | Acción de servicio |
|--------|--------|------------------------|--------------------|
| `OPEN` | `success` | `PAID`, `OVERDUE`, `CANCELED` | (inicial tras crear el statement) |
| `PAID` | `success` | — (terminal) | `pay_statement()` (TRANSFER banco→tarjeta) |
| `OVERDUE` | `destructive` | `PAID`, `CANCELED` | `mark_overdue_card_statements` (BEAT diario, F3.7 futuro) |
| `CANCELED` | `neutral` | — (terminal) | Cancelación manual del statement |

**Contabilidad:**
- Las **compras con tarjeta** se modelan como `TreasuryMovement` OUTBOUND
  desde la `card_account` (LIABILITY): **acredita** el pasivo (sube la
  deuda) + **debita** el proveedor/gasto. Ver F3.1.
- El **pago del estado de cuenta** es un `TreasuryMovement` TRANSFER desde
  la cuenta bancaria (CHECKING/CASH) hacia la `card_account`:
  **debita** el pasivo (baja la deuda) + **acredita** el banco. F3.4.
- Los **intereses y comisiones** del statement se imputan con un
  `TreasuryMovement` ADJUSTMENT que sube el pasivo y debita el gasto
  financiero (cuenta configurable en `AccountingSettings`, F5.1). F3.3.

**Conversión UF→CLP:** Por ahora el statement se carga en CLP directo
(el cargo de la tarjeta en CLP). La conversión UF se hereda del lado
de la compra (F2.7), no del statement.

**Edit restrictions:** `status` y `payment_movement`/`payment_account`/
`paid_at` inmutables salvo por `CardService`. `billed_amount` y los
cargos (`interest_charged`/`fees_charged`) solo editables mientras el
statement esté en `OPEN` (no pagado, no anulado).


**Edit policy (ADR-0091):** `CardPendingCharge` facturado (`is_billed`) no se edita ni elimina.
## Subscription

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `ACTIVE` | `success` | `PAUSED`, `CANCELLED`, `EXPIRED` |
| `PAUSED` | `warning` | `ACTIVE`, `CANCELLED` |
| `CANCELLED` | `destructive` | — |
| `EXPIRED` | `warning` | — |

## Task (Workflow)

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `PENDING` | `warning` | `IN_PROGRESS`, `COMPLETED`, `REJECTED`, `CANCELLED` |
| `IN_PROGRESS` | `warning` | `COMPLETED`, `REJECTED`, `CANCELLED` |
| `COMPLETED` | `success` | — |
| `REJECTED` | `destructive` | `PENDING` (reassign) |
| `CANCELLED` | `destructive` | — |

## F29Declaration / F29Payment

**Edit policy (ADR-0091):** `F29Declaration` registrada (con `journal_entry`) solo admite `notes` y `document`; no se elimina; `create_or_update_declaration` rechaza recalcular un período ya registrado. `F29Payment` (`POSTED` → `CANCELLED`) con asiento es inmutable y no se elimina; se corrige con `POST /tax/payments/{id}/annul/`. Los pagos anulados no cuentan como pagados.

## TaxPeriod / AccountingPeriod

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `OPEN` | `success` | `UNDER_REVIEW`, `CLOSED` |
| `UNDER_REVIEW` | `warning` | `CLOSED`, `OPEN` (reopen) |
| `CLOSED` | `info` | `OPEN` (reopen, requires permission) |

**Permissions:** `can_close_accounting_period`, `can_reopen_accounting_period`.

## FiscalYear

| Status | Intent | Transitions allowed to |
|--------|--------|------------------------|
| `OPEN` | `success` | `CLOSING`, `CLOSED` |
| `CLOSING` | `warning` | `CLOSED` |
| `CLOSED` | `info` | — |

**Edit restrictions:** Campos inmutables: `status`, `closing_entry`, `opening_entry`, `net_result`, `closed_at`, `closed_by`.

## Employee

| Status | Intent |
|--------|--------|
| `ACTIVE` | `primary` |
| `INACTIVE` | `neutral` |

## NoteWorkflow (Billing Note Creation)

| Stage | Intent | Next |
|-------|--------|------|
| `DRAFT` | `info` | `INVOICE_SELECTED` |
| `INVOICE_SELECTED` | `info` | `ITEMS_SELECTED` |
| `ITEMS_SELECTED` | `warning` | `LOGISTICS_PENDING` |
| `LOGISTICS_PENDING` | `warning` | `LOGISTICS_COMPLETED` |
| `LOGISTICS_COMPLETED` | `info` | `REGISTRATION_PENDING` |
| `REGISTRATION_PENDING` | `warning` | `PAYMENT_PENDING` |
| `PAYMENT_PENDING` | `warning` | `COMPLETED` |
| `COMPLETED` | `success` | — |
| `CANCELLED` | `destructive` | — |

## Entities without status (Master/Config)

These entities do not have lifecycle states. They use `is_active` (archive pattern) or are immutable configuration:

| Entity | Pattern | Notes |
|--------|---------|-------|
| Product | Archive (`is_active`) | `is_active=False` for archived products |
| Contact | Archive (`is_active`) | Roles are dynamic, not states |
| Account | Archive (`is_active`) | Leaf accounts only |
| UoM / UoMCategory | Archive | — |
| Warehouse | Archive | — |
| ProductCategory | Archive | — |
| PricingRule | Date-based | `valid_from` / `valid_to` |
| Budget / BudgetItem | None | Planning entities |
| PayrollConcept | None | Config formulas |
| AFP | None | Reference table |
| Notification | Read flag | `read` boolean |
| TaskAssignmentRule | None | Routing config |
| Comment | Append-only | Never modified nor deleted |

## Workflow transition invariants

- Transitions forbidden outside table above are rejected with HTTP 400.
- Every state change is automatically audited via `django-simple-history` (`HistoricalRecords`), capturing the user, timestamp, and field deltas. This immutable audit log is exposed via `/api/core/audit/global/` and consumed by the `ActivitySidebar` and `AuditPage` in the frontend.
- Some transitions require permission (e.g. fiscal year close requires `can_close_fiscal_year`).

## Frontend enforcement

```ts
// Entity states are defined in:
// - frontend/lib/badge-resolvers.ts (STATUS_MAP)
// - frontend/lib/entity-registry.ts (ENTITY_REGISTRY)
//
// Backend mirror: enums in each app's models.py TextChoices.
// If diverged → bug. Test: test_state_map_consistency.
```
