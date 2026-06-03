---
layer: 10-architecture
doc: adr/0035-checks-issued-endorsed
status: accepted
date: 2026-06-03
---

# ADR-0035: Cheques propios girados y endoso de cheques recibidos

## Contexto

El módulo de cheques (ADR-0032) soportaba solo cheques recibidos de terceros.
La Fase 4 de la auditoría de Bancos requiere:
- Cheques propios girados a proveedores (la empresa emite para pagar).
- Endoso de cheques recibidos a otros proveedores (pagar con cheque de tercero).
- Control de talonarios (chequeras) con folios correlativos.

## Decisión

### Cheques propios girados (direction=ISSUED)

Se extiende el modelo `Check` existente (no se crea uno nuevo) con:
- `direction=ISSUED` (enum existente, reservado previamente).
- `payment_account`: FK a la `TreasuryAccount` bancaria origen ( CHECKING ).
- `issued_check_account`: FK a la `TreasuryAccount` puente LIABILITY
  "Cheques Girados por Pagar" (tipo `ISSUED_CHECKS`, system-managed).

Flujo contable:
- `issue()`: OUTBOUND desde la cuenta puente LIABILITY salda al proveedor.
  El asiento: Debita gasto/proveedor, Credita pasivo ("Cheques Girados").
  No toca el banco directamente.
- `mark_cashed()`: TRANSFER pasivo → banco. Debita pasivo, acredita banco.
  El ciclo queda cerrado.
- `void()`: INBOUND reversa al pasivo (desde ISSUED).

Patrón: análogo a `CHECK_PORTFOLIO` pero en sentido inverso (LIABILITY en vez de ASSET).

### Endoso de cheques recibidos (endorse)

- `endorse(check, endorsed_to)`: OUTBOUND desde `CHECK_PORTFOLIO` salda al proveedor.
  Estado → `ENDORSED`. Transición válida solo desde `IN_PORTFOLIO`.
- Campo `endorsed_to`: FK a Contact (proveedor).
- Campo `endorsement_movement`: OneToOne a TreasuryMovement.

### Chequera (Checkbook)

- Model `Checkbook`: bank_account (CHECKING), bank, start_folio, end_folio,
  next_folio, status (ACTIVE/CLOSED/EXHAUSTED).
- `issue()` con checkbook: toma siguiente folio automáticamente, incrementa
  next_folio, marca EXHAUSTED si se agota.
- Validación: unicidad check_number por banco.
- Entity-registry ya tiene `treasury.check`.

### Alertas Celery

- Task `check_alerts`: diaria. Notifica cheques en cartera por vencer,
  depósitos en tránsito añejos (>10 días), y cheques propios por vencer.
- Deduplicación por (notification_type, check_id, target_date).

## Consecuencias

- Se añaden 4 campos al modelo Check: `checkbook`, `payment_account`,
  `issued_check_account`, `endorsed_to`, `endorsement_movement`.
- `Checkbook` es un modelo nuevo con FK a TreasuryAccount (CHECKING).
- `TreasuryAccount.Type.ISSUED_CHECKS` se añade a `_NON_CASH_EQUIVALENT_TYPES`.
- Transiciones de estado: `IN_PORTFOLIO` → {DEPOSITED, VOIDED, ENDORSED};
  `ISSUED` → {CLEARED, VOIDED}; VOIDED accesible desde IN_PORTFOLIO e ISSUED.
- 24 tests verdes (7 F4.1 + 4 F4.2 + 6 F4.3 + 7 existentes).
- Migraciones 0053 (fields) + 0054 (Checkbook).
