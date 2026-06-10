---
id: 0041
title: Tipo de cuenta de tesorería dedicado para préstamos (LOAN)
status: Accepted
date: 2026-06-05
author: core-team
supersedes-partial: 0033
---

# 0041 — Tipo de cuenta de tesorería dedicado para préstamos (`LOAN`)

## Context

ADR-0033 modeló la deuda de un `BankLoan` reutilizando el tipo de tesorería
`CREDIT_CARD` para su `liability_account`, porque era el único `TreasuryAccount.Type`
mapeado a `AccountType.LIABILITY`. La decisión preservaba la convención "1 tipo de
tesorería ↔ 1 `AccountType`" a costa de mezclar dos pasivos de naturaleza distinta.

En la práctica esto rompe la **segmentación**:

- `BankCenterViewSet.overview` (`backend/treasury/views.py`) calcula
  `card_accounts = accounts.filter(account_type=CREDIT_CARD)`. Como la cuenta-pasivo
  de un préstamo también es `CREDIT_CARD`, queda **contada como tarjeta** (`card_count`),
  se le buscan `CreditCardStatement` inexistentes, y la tabla "Cuentas de Tesorería"
  la etiqueta como *"Tarjeta de Crédito (Cta. Propia)"*.
- Cualquier reporte/badge/filtro que discrimine por `account_type` confunde deuda de
  préstamo con deuda rotativa de tarjeta.
- El formulario de registro de crédito (`LoanRegisterDrawer`) ofrece como
  `liability_account` cualquier cuenta `CREDIT_CARD`, mezclando tarjetas con préstamos.

## Decision

Añadir un tipo de tesorería dedicado **`TreasuryAccount.Type.LOAN`** que **también**
mapea a `AccountType.LIABILITY`. Esto **rompe deliberadamente** la convención
"1 tipo ↔ 1 `AccountType`" de ADR-0033 (ahora `CREDIT_CARD` y `LOAN` son ambos
`LIABILITY`), porque la segmentación correcta del pasivo pesa más que la convención.

- `TreasuryAccount.clean()`: una cuenta `LOAN` debe vincularse a una cuenta contable
  `AccountType.LIABILITY` (misma regla que `CREDIT_CARD`). No entra en el check de
  prefijo `1.1.01` (no es efectivo) ni en `_NON_CASH_EQUIVALENT_TYPES` (se gestiona
  como las tarjetas: editable/eliminable).
- `BankLoan.clean()` y `BankLoanWriteSerializer.validate`: la `liability_account`
  debe ser tipo `LOAN` (antes `CREDIT_CARD`); `disbursement_account` no puede ser
  `LOAN`.
- **Migración de datos** (`0067`): toda `TreasuryAccount` usada como
  `BankLoan.liability_account` (reverse FK `loans_as_liability`) pasa de `CREDIT_CARD`
  a `LOAN`. Identificación inequívoca; idempotente; con reverso.

## Consequences

**Positivas:**
- La deuda de préstamos queda segmentada de las tarjetas en toda la app sin band-aids
  por-vista. El Centro de Bancos cuenta y etiqueta correctamente.
- Base limpia para reportería de pasivos financieros por instrumento.

**Trade-offs aceptados:**
- Se abandona la invariante "1 tipo de tesorería ↔ 1 `AccountType`". A partir de aquí,
  `account_type` de tesorería es una clasificación funcional (ubicación/instrumento),
  no un alias del `AccountType` contable. Documentado aquí para futuros tipos.

**Alcance del cambio:**
- Backend: `TreasuryAccount.Type`, `clean()` (×2 modelos), serializer, migraciones
  `0066` (schema/choices) + `0067` (datos).
- Frontend: unión `TreasuryAccountType`, label en `TreasuryAccountsView`, filtro en
  `LoanRegisterDrawer`, card de creación en `TreasuryAccountWizard`, y demás
  enumeraciones de tipos.

## References

- Supersede parcialmente `docs/10-architecture/adr/0033-bank-loans-liabilidad-y-uf.md`
  (sección "Deuda como pasivo (taxonomía vigente)").
- `docs/10-architecture/adr/0031-treasury-account-vs-payment-method-taxonomy.md`.
- `backend/treasury/models.py` (`TreasuryAccount.Type`, `clean`, `BankLoan.clean`).
- `backend/treasury/migrations/0066_*`, `0067_*`.
