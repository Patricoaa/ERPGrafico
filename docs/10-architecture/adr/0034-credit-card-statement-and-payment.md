---
id: 0034
title: Tarjeta de crédito propia — estado de cuenta y pago
status: Accepted
date: 2026-06-03
author: core-team
---

# 0034 — Tarjeta de crédito propia — estado de cuenta y pago

## Context

La tarjeta de crédito propia (CREDIT_CARD / LIABILITY, ADR-0031) ya permite
registrar compras (OUTBOUND que aumentan el pasivo), pero el ciclo de
facturación queda incompleto: no hay modelo para el estado de cuenta
mensual, ni para imputar intereses/comisiones, ni para pagar el saldo
desde una cuenta bancaria.

Requerimientos detectados en la auditoría de Fase 1:

- Modelar el **estado de cuenta mensual** de la tarjeta (cierre, vencimiento,
  monto facturado, pago mínimo, intereses, comisiones).
- Los **intereses y comisiones** deben subir la deuda y registrarse como
  gasto financiero (DEBIT expense, CREDIT liability).
- El **pago** del estado de cuenta debe ser una TRANSFER desde una cuenta
  bancaria (CHECKING/CASH) hacia la tarjeta (LIABILITY): DEBIT liability
  (baja deuda), CREDIT bank (baja saldo).
- La tarjeta no tiene cuotas fijas como un préstamo; el pago es libre
  (total, mínimo, o parcial).

## Decision

Modelar `CreditCardStatement` como entidad de primera clase dentro de
`treasury`, con ciclo de vida propio y servicio `CardService` que orquesta
los movimientos y asientos contables.

### Modelo `CreditCardStatement`

```python
class CreditCardStatement(models.Model):
    class Status(models.TextChoices):
        OPEN     = 'OPEN'
        PAID     = 'PAID'
        OVERDUE  = 'OVERDUE'
        CANCELED = 'CANCELED'

    card_account  # FK TreasuryAccount (CREDIT_CARD)
    period_year   # PositiveIntegerField
    period_month  # PositiveIntegerField (1-12, check constraint)
    cut_off_date  # DateField — fecha de cierre del período
    due_date      # DateField — fecha de vencimiento del pago
    billed_amount # DecimalField — total facturado
    minimum_payment # DecimalField — pago mínimo
    interest_charged # DecimalField — intereses del período
    fees_charged   # DecimalField — comisiones del período
    credit_limit   # DecimalField (nullable) — snapshot del cupo
    status         # CharField (OPEN/PAID/OVERDUE/CANCELED)
    paid_at        # DateTimeField
    payment_movement # OneToOne FK TreasuryMovement
    payment_account  # FK TreasuryAccount (origen del pago)
```

Constraint único: `(card_account, period_year, period_month)`.
Display ID: `EST-{id}`.

### `CardService`

| Método | Descripción |
|--------|-------------|
| `open_statement()` | Crea el statement del período con status OPEN |
| `apply_charges()` | Imputa interés + comisiones como gasto financiero (ADJUSTMENT + JE custom) |
| `pay_statement()` | Paga el total desde una cuenta bancaria (TRANSFER, usa `TreasuryService.create_movement`) |
| `cancel_statement()` | Anula un statement OPEN |

**Patrón de asiento para cargos financieros:**

```
Debe  gasto_financiero (interest_expense_account / fees_expense_account)
Haber liability_account (card_account.account — sube la deuda)
```

Si no hay cuentas de gasto configuradas (pendiente F5.1), el Debe va a
la misma `liability_account` como workaround (preserva D=C, neto = 0).

**Patrón de asiento para pago:**

La TRANSFER estándar de `TreasuryService._create_accounting_entry` genera:

```
Debe  liability_account (card_account — baja deuda)
Haber asset_account    (bank — baja saldo)
```

Esto es correcto para LIABILITIES: el Debit baja la deuda, el Credit
baja el saldo del banco.

### API REST

```
GET    /api/treasury/card-statements/                    list
POST   /api/treasury/card-statements/                    create (OPEN)
GET    /api/treasury/card-statements/{id}/               detail
PATCH  /api/treasury/card-statements/{id}/               update
POST   /api/treasury/card-statements/{id}/pay/           action — pagar (payload: payment_account, date?)
POST   /api/treasury/card-statements/{id}/apply-charges/ action — imputar interés/comisiones
POST   /api/treasury/card-statements/{id}/cancel/        action — anular (payload: notes?)
```

### Frontend

Feature `treasury/card-statements/` con:
- `StatementsView` — KPIs + DataTable con filtros
- `StatementDetailModal` — detalle + acciones lifecycle
- `PayStatementModal` — selección de cuenta bancaria + confirmación

### Entidad en Entity Registry

```ts
'treasury.creditcardstatement': {
    label: 'treasury.creditcardstatement',
    title: 'Estado de Cuenta Tarjeta',
    icon: CreditCard,
    shortTemplate: 'EST-{id}',
    listUrl: '/treasury/credit-card-statements',
}
```

## Consequences

- El pago es **libre** (total, mínimo, parcial); no hay cuotas fijas como
  un préstamo.
- Los intereses/comisiones se imputan al momento de cargar el statement
  (manual o vía importación futura).
- El `billed_amount` es metadata del statement; el saldo real de la tarjeta
  viene de los `JournalItem` en la cuenta `LIABILITY`.
- Pendiente: F5.1 agregará `interest_expense_account` y
  `fees_expense_account` a `AccountingSettings` para no tener que pasarlas
  como parámetro.
- 45 tests verdes cubren: modelo, servicio, API, y flujos de lifecycle.

## References

- ADR-0031: Cuenta CREDIT_CARD como LIABILITY
- ADR-0033: Créditos bancarios (patrón base de `is_pending_registration`)
- `docs/50-audit/bancos/fase-3-tarjeta-credito.md`
- `backend/treasury/card_service.py`
- `backend/treasury/tests/test_card_service.py` (17 tests)
- `backend/treasury/tests/test_card_statements_api.py` (15 tests)
