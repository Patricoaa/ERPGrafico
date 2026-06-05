---
id: 0043
title: Compras en tarjeta en cuotas (3/6/12) con interés explícito — `CardPurchaseGroup` + schedule francés
status: Accepted
date: 2026-06-05
author: core-team
supersedes: []
related: [0034-credit-card-statement-and-payment.md, 0042-credit-card-p0-accounting-close.md]
---

# 0043 — Compras en tarjeta en cuotas con interés explícito

## Context

El ADR-0034 establece que la tarjeta de crédito propia **no
tiene cuotas fijas como un préstamo; el pago es libre** (líneas
28-29, 130-131). Esta decisión era correcta para el caso general
— la tarjeta es revolving credit con pago total, mínimo o
parcial del statement.

Sin embargo, el caso real de uso en producción (Argentina/Chile)
es la **compra en 3/6/12 cuotas con interés explícito** (cuotas
"con interés" o "sin interés" según promoción). El merchant
cobra el total al cierre pero el emisor lo financia en N cuotas
mensuales con una TEA pactada, y cada cuota se factura en el
statement del mes correspondiente.

Antes de este ADR, una compra así se modelaba como un único
`TreasuryMovement(OUTBOUND, from_account=CREDIT_CARD)` por el
total, con todo el impacto en el mes de la compra. Esto
producía dos problemas:

1. **`billed_amount` inflado en el mes de compra**: el statement
   del mes de la compra veía $100k (o más, con interés) cuando
   la realidad financiera era $100k / 3 en ese mes.
2. **Sin trazabilidad de la estructura de cuotas**: no se podía
   preguntar "¿cuánto falta pagar de la compra XYZ?" ni "¿en
   qué mes cae la cuota 4?".

## Decision

### D-1. Las cuotas son N `TreasuryMovement` distribuidos en el tiempo (no un nuevo modelo "Purchase")

Cada cuota se modela como un `TreasuryMovement` real con su
propio `date`. El invariante "`billed_amount` = suma de
movimientos del periodo" (ADR-0042 D-3) se preserva: cada cuota
cae en su statement según su `date`.

- Compra de $100k en 3 cuotas con 1.5%/mes genera **3
  `OUTBOUND`** (uno por cuota de principal) más **3 `ADJUSTMENT`**
  (uno por cuota de interés) — 6 movimientos en total.
- Las fechas se distribuyen cada 30 días a partir de la fecha
  inicial (`date + 30 × i`).
- El asiento contable de cada movimiento es el estándar de
  `OUTBOUND` / `ADJUSTMENT` con la cuenta de tarjeta como
  origen: D=proveedor (configurado en `Contact.account_payable`)
  / H=pasivo tarjeta.

### D-2. `CardPurchaseGroup` como agrupador lógico

Nueva tabla ligera que agrupa las N cuotas de una misma compra:

- `uuid` (PK, UniqueConstraint): id externo para idempotencia.
- `card_account` (FK a `TreasuryAccount` con `account_type=CREDIT_CARD`).
- `partner` (FK opcional a `Contact`).
- `total_amount`, `installments` (1–36), `monthly_rate` (0 a 1).
- `principal_per_installment` (snapshot del cálculo).
- `first_installment_date`, `client_reference` (opcional,
  `UniqueConstraint` condicional), `notes`.

No es un documento contable. Es un agrupador consultable para
"¿cuánto falta pagar de esta compra?" o "¿cuántas cuotas
quedan?".

`TreasuryMovement` gana 3 campos:

- `card_purchase_group` (FK, nullable, `on_delete=SET_NULL`).
- `installment_number` (1..N).
- `is_installment_interest` (bool: True si es un ADJUSTMENT de
  interés, False si es un OUTBOUND de principal).

### D-3. Schedule de cuota francesa con redondeo bancario

El interés se calcula con la fórmula francesa (cuota decreciente
de interés, principal creciente):

```
balance = total_amount
for i in 1..N:
    interest_i = round(balance × monthly_rate, 2)
    principal_i = total_amount / N  # con residuo en la última
    balance -= principal_i
```

El principal por cuota se redondea a 2 decimales con
`ROUND_HALF_UP`; el residuo se asigna a la última cuota para
que `Σ principal = total_amount` exacto.

El interés se redondea a 2 decimales por cuota. La diferencia
acumulada de centavos por redondeo (si existe) queda en la
**última cuota de interés** — para mantener congruencia
contable, no se hacen ajustes retroactivos.

### D-4. Idempotencia por `client_reference`

`create_card_purchase(amount, card_account, *,
client_reference='...')` retorna el grupo existente si llega un
segundo POST con la misma `client_reference`. Esto permite
reintentos seguros desde el frontend (doble click, timeout, red).

`UniqueConstraint` parcial en
`CardPurchaseGroup.client_reference` (condicional a
`client_reference != ''`).

### D-5. API: `POST /api/treasury/movements/card-purchase/`

Endpoint dedicado (no discriminado en `create`) que delega a
`TreasuryService.create_card_purchase`:

- Valida que `from_account.account_type == CREDIT_CARD` (400 si
  no).
- Convierte `date` string → `date` object.
- Devuelve `{ group: {...}, installments: [...] }` con el
  detalle del grupo y los N movimientos generados.

No se modifica `POST /api/treasury/movements/` (la ruta de
movimientos genérica). Esto mantiene retrocompatibilidad
absoluta con clientes existentes que no usan cuotas.

### D-6. Compatibilidad con Onda 1

- **`billed_amount`**: sigue calculándose como `Σ OUTBOUNDs +
  Σ ADJUSTMENTs del periodo` (ADR-0042 D-3). Las cuotas se
  imputan al statement del mes que les corresponde por su
  `date`. Sin cambios.
- **Gastos financieros**: el interés de cada cuota es un
  `ADJUSTMENT` contra el pasivo de la tarjeta (D=proveedor /
  H=pasivo). Si el operador quiere separar el interés en una
  cuenta de gasto explícita, debe usar el mecanismo estándar
  de ADJUSTMENT + configuración de cuentas (ADR-0042 D-1); el
  flujo de cuotas no introduce un atajo nuevo.
- **Validación de fondos**: el `OUTBOUND` de la tarjeta **no
  chequea `credit_limit`**. Esto es pre-existente (gap conocido)
  y se mantiene fuera de scope de Onda 2. La deuda puede
  superar el límite sin tope.

## Consequences

### Positivas

- El statement del mes de compra ve solo la cuota de ese mes,
  no el total de la compra. Lectura contable correcta.
- La trazabilidad "¿en qué mes cae la cuota K de la compra X?"
  es directa: `CardPurchaseGroup.movements.filter(installment_number=K)`.
- La idempotencia por `client_reference` permite reintentos
  seguros y elimina duplicaciones accidentales.
- La separación `principal` (OUTBOUND) / `interest`
  (ADJUSTMENT) permite reportar gastos financieros por cuota
  sin confundirlos con el interés punitorio del emisor.
- No se introduce un modelo "Purchase" paralelo: se reusan
  `TreasuryMovement` y `JournalEntry`. Cero impacto en
  asientos contables existentes.

### Negativas

- El modelo `CardPurchaseGroup` no es un documento contable;
  es un agrupador de movimientos. No tiene `JournalEntry`
  propio ni se filtra en reportes de cuenta por pagar. Si el
  operador quiere "una factura de la compra en cuotas", debe
  seguir usando la factura de proveedor y referenciarla en cada
  cuota vía `invoice` o `purchase_order`.
- El redondeo del interés puede dejar una diferencia de
  centavos entre el interés teórico y el interés cobrado. La
  diferencia queda en la última cuota. No hay ajuste a favor
  del cliente.
- El endpoint es dedicado (`card-purchase/`) y NO discriminado
  en `POST /api/treasury/movements/`. Esto obliga a los
  clientes que quieren cuotas a usar la URL específica.

### Neutrales

- El schedule de cuotas es "cuota francesa" (interés
  decreciente). Si el mercado requiere "cuota fija" (cuota
  constante mensual: cuota_total = principal × factor), se
  puede agregar como flag en el grupo en una onda futura.
- Las fechas se distribuyen cada 30 días exactos (no según el
  día del mes de la compra). Esto simplifica el cálculo; en
  producción real se debería ajustar al cutoff del statement
  del mes (futuro improvement).

## Alternatives considered

- **Modelo `CreditCardPurchase` con campos propios (status,
  next_installment_date, etc.)**: rechazado, duplica
  `TreasuryMovement` y rompe el invariante "`billed_amount` =
  suma de movimientos del periodo". El agrupador es más limpio.
- **1 OUTBOUND total + atributo `installments=N` + spread on
  read**: rechazado, requiere reescribir
  `recalculate_billed_amount` para entender el atributo y
  mantener la consistencia en otros lugares (conciliación,
  reportes). El approach de N movimientos es más explícito y
  reutilizable.
- **Soporte de "cuota fija" en lugar de "cuota francesa"**:
  rechazado para Onda 2, queda como mejora futura. La fórmula
  francesa es la más común en producción real.

## References

- ADR-0034: Estado de cuenta y pago de tarjeta de crédito
  corporativa (modelo base, "no hay cuotas fijas como un
  préstamo").
- ADR-0042: Cierre P0 contable de tarjeta (`billed_amount`
  desde movimientos, cargos reales, reversa transaccional).
- Migration: `0069_historicaltreasurymovement_installment_number_and_more.py`.
- Source: `backend/treasury/models.py` (`CardPurchaseGroup`),
  `backend/treasury/services.py` (`create_card_purchase`),
  `backend/treasury/views.py` (`card_purchase` action).
- Tests: `test_card_purchase_installments.py` (13 service
  tests), `test_card_purchase_api.py` (5 API tests).
- API: `POST /api/treasury/movements/card-purchase/`.
