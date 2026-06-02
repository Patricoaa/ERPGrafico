---
id: 0032
title: Cheques recibidos — cartera con cuenta puente
status: Accepted
date: 2026-06-02
author: core-team
---

# 0032 — Cheques recibidos — cartera con cuenta puente

## Context

No existía entidad `Check` en el sistema: el método de pago `CHECK` caía a `Method.OTHER`
y no había seguimiento de la cartera, vencimientos, estados ni el cuadre clásico de
conciliación bancaria (cheques en cartera / depósitos en tránsito).

## Decision

Modelar la cartera de cheques recibidos con una **cuenta puente "Cheques en Cartera"**
(`TreasuryAccount.Type.CHECK_PORTFOLIO`), reutilizando `TreasuryMovement` para todos los
movimientos de tesorería.

### Flujo de estados

```
Recibir → IN_PORTFOLIO → DEPOSITED → CLEARED
                       → BOUNCED
          IN_PORTFOLIO → VOIDED
```

- **Recibir:** `TreasuryMovement` INBOUND a la cuenta puente. Salda factura/orden vía
  `TreasuryService.update_related_document_status`.
- **Depositar:** `TreasuryMovement` TRANSFER puente→banco.
- **Cobrar:** estado `CLEARED` (cobrado definitivamente).
- **Protestar:** reversas contables de depósito y recepción → reinstala el documento.
- **Anular:** reversa OUTBOUND desde cartera.

### Componentes

- **Backend:** `treasury.Check` (modelo + `HistoricalRecords`) · `TreasuryAccount.Type.CHECK_PORTFOLIO`
  (system-managed, en `_NON_CASH_EQUIVALENT_TYPES`) · `AccountingSettings.check_portfolio_account`
  (cuenta contable configurable) · `CheckService` · `CheckViewSet` · ruta `/treasury/checks/`.
- **Frontend:** `features/treasury/checks/` (tipos, api, hooks TanStack Query, `ChecksView`,
  `CheckRegisterDrawer`, `CheckDepositModal`) · pestaña "Cheques" en `TreasuryHeader` ·
  estados de cheque añadidos a `STATUS_MAP` (`badge-resolvers.ts`).

## Consequences

**Positivas:**
- La cuenta puente materializa contablemente los cheques en tránsito, permitiendo el cuadre
  clásico bancario.
- Sin código contable nuevo: reutiliza `TreasuryService.create_movement` y los asientos.
- Los cheques son conciliables como cualquier movimiento de tesorería.

**Fuera de alcance (siguientes fases):**
- Cheques propios girados (`direction=ISSUED`).
- Endoso de cheques.
- Importación masiva de cartera.

## References

- Backend: `backend/treasury/models.py` (Check, CHECK_PORTFOLIO), `check_service.py`.
- Tests: `backend/treasury/tests/test_checks.py` (7 tests, verificados en Postgres).
- Frontend: `frontend/features/treasury/checks/`, `frontend/lib/badge-resolvers.ts`.
- Migración: `treasury/0049`, `accounting/0020`.
