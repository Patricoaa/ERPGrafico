---
layer: 50-audit
doc: bancos/fase-3-tarjeta-credito
status: active
owner: core-team
last_review: 2026-06-02
kind: roadmap
---

# Fase 3 — Tarjeta de crédito propia: estado de cuenta + pago

## Objetivo de la fase
Cerrar el ciclo de la tarjeta de crédito propia sobre la base ya entregada (la cuenta
`CREDIT_CARD` es un **pasivo**, ADR-0031): gastar con la tarjeta aumenta la deuda, llega el
estado de cuenta, y se paga desde el banco. Esfuerzo: L.

> **Contratos:** registrar `CreditCardStatement` en `ENTITY_REGISTRY`; estados en
> `state-map.md` + `STATUS_MAP`; montos `DecimalField` + `MoneyDisplay`; ADR-0034 al cierre.

**Patrón base:** la `TreasuryAccount` `CREDIT_CARD` (LIABILITY) es la deuda. No se mueve
al banco al gastar; sólo al pagar el estado de cuenta. Todo vía `TreasuryService.create_movement`.

---

### F3.1 · Gasto con tarjeta de crédito (compra)
- **Objetivo:** registrar una compra pagada con la tarjeta como un OUTBOUND que **aumenta**
  el pasivo (no baja el banco).
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/services.py` (verificar el flujo OUTBOUND desde una
  cuenta LIABILITY), integración con compras (`PaymentMethod` `CREDIT_CARD` ya existe y es
  `allow_for_purchases`).
- **Cambios esperados:**
  - Al pagar una compra/factura con el método `CREDIT_CARD`, el OUTBOUND tiene
    `from_account` = la cuenta de la tarjeta (LIABILITY): asiento **acredita** el pasivo
    (sube deuda) y **debita** gasto/proveedor. Confirmar que `_create_accounting_entry`
    produce el asiento correcto con origen LIABILITY (probable que ya funcione; agregar test).
- **DoD:** test: compra con tarjeta sube el saldo (deuda) de la cuenta `CREDIT_CARD` y no
  toca el banco.

### F3.2 · Modelo `CreditCardStatement` (estado de cuenta)
- **Objetivo:** el ciclo de facturación de la tarjeta.
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/models.py`, migración.
- **Cambios esperados:** `CreditCardStatement(card_account FK TreasuryAccount CREDIT_CARD,
  period_year, period_month, cut_off_date, due_date, billed_amount, minimum_payment,
  interest_charged, fees_charged, status [OPEN|PAID|OVERDUE], notes, audit)`. Campo
  `credit_limit` (cupo) en `TreasuryAccount` o en el statement.
- **DoD:** migración; índice por `(card_account, period_year, period_month)` unique.

### F3.3 · Intereses y comisiones de la tarjeta
- **Objetivo:** registrar intereses/comisiones que la tarjeta cobra (aumentan la deuda y
  son gasto financiero).
- **Dificultad:** S
- **Precondiciones:** Fase 5 F5.1 (cuentas de gasto financiero) o parámetro temporal.
- **Cambios esperados:** al cargar un statement con `interest_charged`/`fees_charged`,
  generar ADJUSTMENT/asiento que sube el pasivo y debita gasto financiero.
- **DoD:** test: cargar interés en el statement sube la deuda y registra el gasto.

### F3.4 · Pago del estado de cuenta
- **Objetivo:** pagar (total o mínimo) desde una cuenta bancaria.
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/card_service.py` (nuevo) o extender un service.
- **Cambios esperados:** `TreasuryMovement` TRANSFER banco → cuenta tarjeta (LIABILITY):
  **debita** el pasivo (baja deuda), **acredita** el banco. Marcar `CreditCardStatement`
  PAID si se paga el total.
- **DoD:** test: pagar el statement baja la deuda de la cuenta `CREDIT_CARD` por el monto y
  baja el saldo del banco; statement → PAID.

### F3.5 · API + Frontend
- **Dificultad:** L
- **Archivos clave:** `backend/treasury/serializers.py`/`views.py`/`urls.py`;
  `frontend/features/treasury/cards/*` (o integrar en la vista de cuentas), página/sección,
  `STATUS_MAP`.
- **Cambios esperados:**
  - Backend: viewset de statements + acción `pay`.
  - Frontend: en la ficha de la cuenta `CREDIT_CARD`, ver deuda actual (saldo del pasivo),
    cupo disponible, lista de estados de cuenta, y acción "Pagar".
- **DoD:** flujo manual: ver deuda → cargar/abrir statement → pagar → deuda baja.

### F3.6 · Docs + tests + ADR
- **Dificultad:** S
- **Cambios esperados:** `test_credit_card_statement.py`; ADR-0034 "Tarjeta de crédito —
  estado de cuenta y pago". Actualizar este archivo a ✅.
- **DoD:** suite verde en Postgres real; ADR creado.

---

## Commits de la fase

> Secuencia atómica. Cierra con `Co-Authored-By`.

1. `feat(treasury): gasto con tarjeta de crédito aumenta el pasivo` — F3.1
2. `feat(treasury): modelo CreditCardStatement + entity-registry` — F3.2
3. `feat(treasury): intereses y comisiones de tarjeta` — F3.3
4. `feat(treasury): pago del estado de cuenta de tarjeta` — F3.4
5. `feat(treasury): API + UI estado de cuenta de tarjeta` — F3.5
6. `docs(treasury): ADR-0034 tarjeta de crédito estado/pago + tests` — F3.6

---

## Verificación de la fase
- Tests verdes (local `--no-migrations` + Postgres real, con rollback).
- `makemigrations --check` limpio; `npm run type-check`/ESLint sin errores.
- Manual: comprar con tarjeta (sube deuda) → cargar statement con interés → pagar desde
  banco (baja deuda y banco).
