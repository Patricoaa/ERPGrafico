---
id: 0046
title: Compra con TC propia — uso = 1 movimiento/asiento + cuotas vía cronograma facturado en statement
status: Accepted
date: 2026-06-08
author: core-team
supersedes: [0043-credit-card-purchase-installments.md]
related: [0042-credit-card-p0-accounting-close.md, 0043-credit-card-purchase-installments.md, 0044-credit-card-partial-payments-and-punitory-interest.md]
---

# 0046 — Compra con TC propia: uso único + cuotas en cronograma

## Context

El ADR-0043 D-1 modeló una compra en N cuotas como **N `TreasuryMovement`
`OUTBOUND`** (uno por cuota de principal), fechados cada 30 días, cada uno
posteando su asiento `D=proveedor / H=pasivo tarjeta` en el momento de la
compra. La idea era preservar el invariante de ADR-0042 D-3 (`billed_amount =
Σ movimientos del período`) repartiendo las cuotas por su `date`.

Sobre ese diseño, una iteración posterior (Onda 4, "facturación de cargos TC
con desglose por grupo") agregó `CardService.bill_unbilled_charges` →
`_create_billing_entry`, que **barre los movimientos `is_billed=False` y postea
otro asiento** `D=gasto / H=pasivo tarjeta` por el total facturado. El problema:
los `OUTBOUND` de `create_card_purchase` **ya posteaban** su asiento al crearse y
quedaban `is_billed=False`, así que el barrido los toma y vuelve a acreditar el
pasivo. Resultado:

1. **Doble contabilización del pasivo** — la deuda de la TC termina en ~2× el
   monto real, con un débito espurio a `bank_commission_account`.
2. **Fragmentación del uso** — el pasivo y la liquidación del proveedor se
   reconocen de a pedazos a +30/+60 días, cuando económicamente la compra (y el
   pago al merchant por parte del emisor) ocurre completa en la fecha de compra.
3. **Ruido en tesorería** — N movimientos donde el evento de tesorería (usar la
   tarjeta) es uno solo.

La causa de fondo es que ADR-0043 hizo que el *cronograma de cuotas* y el
*movimiento de tesorería* fueran el mismo objeto (`TreasuryMovement`). El uso de
la TC y el calendario de facturación son dos cosas distintas y deben separarse.

## Decision

> Supersede ADR-0043 **D-1** y **D-6**. Revisa ADR-0042 **D-3** para grupos de
> compra en cuotas (el `billed_amount` deja de derivar de movimientos y pasa a
> derivar del cronograma). El resto de ADR-0043 (`CardPurchaseGroup` como
> agrupador, idempotencia por `client_reference`, endpoint dedicado) se mantiene.

### D-1. El uso de la TC es **1 `TreasuryMovement` + 1 asiento** por el total

`create_card_purchase` genera **un solo `OUTBOUND`** por `amount`, en la fecha de
compra, posteado con el asiento estándar `D=proveedor (Contact.account_payable) /
H=pasivo tarjeta` por el total. El pasivo queda reconocido una sola vez, completo,
el día de la compra. El movimiento se marca `is_billed=True` (es el uso, no un
cargo pendiente de facturar) y se vincula a su `CardPurchaseGroup`.

### D-2. Las cuotas son **cronograma**, no movimientos de tesorería

Nuevo modelo `CardPurchaseInstallment` (filas de cronograma, **sin contabilidad
ni `JournalEntry`**), una por cuota:

- `card_purchase_group` (FK, `related_name='schedule'`; el campo contador
  `CardPurchaseGroup.installments` ya ocupa ese nombre).
- `number` (1..N), `due_date`, `principal_amount`.
- `is_billed` (default False, index), `billed_in_statement` (FK a
  `CreditCardStatement`, `SET_NULL`).

Las `due_date` se distribuyen por **mes calendario** (`date + relativedelta(months=i)`),
no por 30 días fijos. El principal por cuota usa el mismo cálculo con residuo en
la última cuota que ya existía (`Σ principal = total_amount` exacto).

### D-3. El statement factura cuotas del cronograma, **sin asiento de principal**

`bill_unbilled_charges`, para grupos con cronograma, toma las
`CardPurchaseInstallment` con `is_billed=False` y `due_date <= cut_off_date`, suma
su `principal_amount` en `billed_amount`, las marca facturadas y las vincula al
statement. **No postea asiento de principal** (el pasivo ya se reconoció en D-1).
`_create_billing_entry` deja de acreditar el pasivo por principal — con esto
muere el doble conteo. El interés/comisiones reales del emisor siguen por
`apply_charges` (D-1/D-3 de ADR-0042), que es un mecanismo aparte y legítimo.

### D-4. El pago de cada cuota es un movimiento separado

Sin cambios respecto de ADR-0034/0044: `pay_statement` genera un `TRANSFER`
banco→TC (`D=pasivo / H=banco`) por la cuota facturada. Son los N movimientos de
pago. El pasivo neto vuelve a 0 al pagar todas las cuotas.

### D-5. Sin interés en esta onda

Solo se soporta `monthly_rate = 0`. `create_card_purchase` y el endpoint
`card-purchase` rechazan `monthly_rate > 0` con `ValidationError` ("no soportado
por ahora"). El checkout de compras/ventas ya pasa `monthly_rate = 0`. La ruta de
interés (devengo por período sobre el cronograma) queda diferida a una onda
futura, donde se reconocerá el interés en el statement del mes que corresponda
(no upfront).

### D-6. Alcance de datos: solo de aquí en adelante

No se migran los `CardPurchaseGroup` históricos (que tienen N movimientos
posteados). El código nuevo detecta el modelo por presencia de filas
`CardPurchaseInstallment`: grupos nuevos → ruta de cronograma; grupos legacy →
ruta de barrido por movimientos (compatibilidad). El doble conteo histórico no se
corrige automáticamente.

## Consequences

### Positivas
- Una compra en cuotas produce **1 movimiento + 1 asiento**: lectura contable
  correcta, pasivo completo en la fecha de compra, proveedor liquidado en el acto.
- Desaparece el doble conteo del pasivo y el débito espurio a comisiones.
- Separación limpia entre *uso* (movimiento de tesorería) y *calendario de
  facturación* (cronograma consultable).
- El cronograma soporta de forma natural el desglose por cuota del statement y
  futuras extensiones (interés por período, refinanciación).

### Negativas
- Se rompe el invariante ADR-0042 D-3 para grupos de cuotas: `billed_amount`
  pasa a derivar del cronograma, no de la suma de movimientos del período. La
  conciliación bancaria de estos grupos concilia el `OUTBOUND` único (uso) y los
  `TRANSFER` de pago, no las cuotas.
- Coexisten dos rutas (cronograma / legacy) en la facturación hasta que los
  grupos legacy se extingan.

### Neutrales
- `CardPurchaseGroup` y sus campos snapshot (`principal_per_installment`,
  `first_installment_date`) se conservan; las cuotas se materializan ahora en
  `CardPurchaseInstallment`.
- Los campos `installment_number` / `is_installment_interest` de
  `TreasuryMovement` quedan solo para data legacy.

## Alternatives considered
- **Mantener N movimientos y solo quitar `_create_billing_entry`**: evita el
  doble conteo pero no resuelve la fragmentación del uso ni el ruido en
  tesorería; el usuario pidió explícitamente 1 movimiento para el uso.
- **1 OUTBOUND total + "spread on read" sin tabla** (la alternativa que ADR-0043
  rechazó): adoptamos el espíritu pero con una tabla de cronograma explícita, que
  es más robusta ante pagos parciales, reversas y facturación fuera de orden.
- **Pre-crear N pagos programados banco→TC al comprar**: rechazado, pre-registra
  salidas de banco futuras y duplica el seguimiento con los statements.

## References
- ADR-0042: cierre P0 contable de tarjeta (cargos reales, reversa).
- ADR-0043: compras en cuotas con `CardPurchaseGroup` (superseded D-1/D-6).
- ADR-0044: pagos parciales e interés punitorio.
- Source: `backend/treasury/models.py` (`CardPurchaseInstallment`),
  `backend/treasury/services.py` (`create_card_purchase`),
  `backend/treasury/card_service.py` (`bill_unbilled_charges`,
  `_create_billing_entry`).
- Tests: `test_card_purchase_installments.py`, `test_card_statements_*.py`.
- API: `POST /api/treasury/movements/card-purchase/`.
