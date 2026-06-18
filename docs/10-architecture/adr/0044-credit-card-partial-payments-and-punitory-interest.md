---
id: 0044
title: Pagos parciales e interés punitorio de tarjeta de crédito propia
status: Accepted
date: 2026-06-05
author: core-team
supersedes: []
related: [0034-credit-card-statement-and-payment.md, 0042-credit-card-p0-accounting-close.md, 0043-credit-card-purchase-installments.md]
---

# 0044 — Pagos parciales e interés punitorio de tarjeta de crédito propia

## Context

El ciclo de tarjeta de crédito propia (ADR-0034, ADR-0042) modela
el estado de cuenta como un documento que se paga **íntegramente**
al vencimiento: `pay_statement` solo aceptaba pago total, el modelo
sólo guardaba un `payment_movement` (OneToOne), y no había gestión
de **mora**.

En la práctica, la operatoria real exige:

1. **Pagos parciales**: un cliente puede pagar el mínimo, un
   porcentaje, o un monto a cuenta. El sistema debe registrar cada
   pago, mantener el saldo impago (`outstanding_balance`), y dejar
   claro en el estado (`PARTIALLY_PAID`) cuánto falta.
2. **Múltiples pagos parciales**: un statement admite N pagos (no
   uno solo). La FK `payment_movement` debe ser de uno-a-muchos.
3. ~~**Interés punitorio**: cuando el saldo no se paga al
   vencimiento, el emisor cobra un interés adicional~~ *(Eliminado
   en migration 0030: los castigos se ejecutan manualmente, no hay
   cálculo automático)*.
4. **Truncamiento al saldo**: si el operador pasa un `amount` mayor
   al saldo impago, no debe fallar; truncar al saldo. Esto
   simplifica el flujo UI (el operador puede pasar "el total" sin
   calcular el outstanding antes).

## Decision

### D-1: nuevo campo `amount_paid` + status `PARTIALLY_PAID`

`CreditCardStatement` gana:

```python
amount_paid = DecimalField(default=0, max_digits=14, decimal_places=2)
```

Y `Status` gana el valor `PARTIALLY_PAID` (longitud 14). El nuevo
property `outstanding_balance = max(total_to_pay - amount_paid, 0)`
se calcula on-demand. `is_overdue` se extiende a
`status in (OPEN, PARTIALLY_PAID) AND due_date < today()` (un pago
parcial también cae en mora si vence sin saldarse).

### D-2: `payment_movement` pasa de OneToOne a ForeignKey

La FK cambia de `OneToOneField` a `ForeignKey` con
`related_name='card_statement_payments'`. El statement puede tener
N pagos; el campo apunta al **último** pago (conveniencia de UI),
y la lista completa está en `payment_movements.all()`.

**Inversión**: en `reverse_statement`, se itera
`statement.payment_movements.all()` para revertir el cargo y todos
los pagos. Se resetea `amount_paid = 0` en la reversa.

### D-3: `pay_statement` acepta `amount` opcional

```python
CardService.pay_statement(
    stmt, payment_account, *,
    amount=None,        # Onda 3: nuevo
    date=None, created_by=None,
)
```

- `amount=None` o `amount >= outstanding` → paga el total (status
  → `PAID`, retrocompatibilidad absoluta).
- `amount < outstanding` → pago parcial:
  - Crea un `TreasuryMovement` TRANSFER por `amount`.
  - `amount_paid += amount`.
  - Si `outstanding_balance == 0` → `PAID`, sino `PARTIALLY_PAID`.
- `amount > outstanding` → truncar al saldo.
- `amount <= 0` → `ValidationError`.
- `card_minimum_payment_block = True` rechaza pagos parciales
  con `ValidationError` (no aplica a pagos totales).

### D-4: settings `card_punitory_monthly_rate` + `card_minimum_payment_block`

`AccountingSettings` gana:

```python
card_punitory_monthly_rate = DecimalField(default=0, max_digits=5, decimal_places=4)
card_minimum_payment_block = BooleanField(default=False)
```

`card_punitory_monthly_rate` es **global** (no por tarjeta). Un
futuro refactor podría moverlo a `TreasuryAccount` (deuda por ADR).
`card_minimum_payment_block` opt-in (default False) para no romper
operadores que aceptan cualquier pago parcial.

### D-5: cálculo de interés punitorio

```python
def compute_punitory_interest(stmt, *, as_of_date=None) -> Decimal:
    if stmt.outstanding_balance <= 0: return 0
    if stmt.due_date >= as_of_date: return 0
    rate = settings.card_punitory_monthly_rate  # Decimal 0..1
    if rate <= 0: return 0
    months = max(1, (as_of_date - stmt.due_date).days // 30)
    return (outstanding * rate * months).quantize(0.01, ROUND_HALF_UP)
```

**No se imputa en meses parciales** (`days // 30` redondea hacia
abajo), pero un solo día de mora ya cuenta como 1 mes (mínimo).
**No capitaliza** (no se suma al saldo para el próximo mes; queda
registrado en `interest_charged` para que el operador lo
visualice, y en el JE como gasto).

### D-6: imputación idempotente por mes

```python
def apply_punitory_interest(stmt, *, as_of_date=None, ...) -> tuple[Decimal, Movement]:
    if stmt.status in (PAID, CANCELED): return (0, None)
    interest = compute_punitory_interest(stmt, as_of_date=as_of_date)
    if interest <= 0: return (0, None)
    reference = f"INT-PUN-{stmt.display_id}-{YYYY-MM}"
    existing = TreasuryMovement.objects.filter(
        reference=reference, movement_type=ADJUSTMENT,
    ).first()
    if existing: return (interest, existing)  # idempotente
    # Crear ADJUSTMENT: D=interest_expense_account / H=liability
    # Sumar a interest_charged. Si ya hay cargo aplicado, re-aplicarlo.
```

Idempotencia: la `reference` con mes (`YYYY-MM`) garantiza que un
segundo llamado al mismo mes **no duplica** el ADJUSTMENT. No
necesita FK.

### D-7: task Celery mensual

```python
@shared_task
def compute_overdue_card_interest():
    qs = CreditCardStatement.objects.filter(
        status__in=(OPEN, OVERDUE, PARTIALLY_PAID),
        due_date__lt=today(),
    )
    for stmt in qs:
        CardService.apply_punitory_interest(stmt, as_of_date=today())
```

Beat schedule: `crontab(day_of_month=1, hour=9, minute=0)`. Si
`card_punitory_monthly_rate == 0`, `apply_punitory_interest`
devuelve `(0, None)` y no crea nada — no-op limpio. La task no
reporta error si el setting está en 0 (sólo loguea
`processed=0`).

### D-8: endpoint `pay` acepta `amount`

`PayStatementActionSerializer` agrega `amount` (Decimal, opcional).
El view pasa `v.get('amount')` al servicio. **Retrocompatibilidad
absoluta**: clientes que no envían `amount` siguen pagando el
total.

## Consequences

### Positivas

- Operador puede pagar un statement en N cuotas sin reabrir el
  documento. El estado `PARTIALLY_PAID` refleja la realidad
  operativa.
- Mora se imputa automáticamente cada mes; no se requiere
  intervención manual.
- La mora usa la cuenta de gasto financiero configurada en
  `AccountingSettings.interest_expense_account` (reutiliza la
  misma cuenta que el interés corriente), simplificando
  configuración.
- Idempotencia del cálculo mensual evita duplicación por reintentos
  de beat.

### Negativas / Trade-offs

- `outstanding_balance` es on-demand; no se indexa. Queries que
  filtren por saldo impago no escalan (mitigación: filtro por
  `status__in=(OVERDUE, PARTIALLY_PAID) AND due_date__lt=today`
  cubre el 99% de los casos).
- `card_punitory_monthly_rate` es global; emisores distintos
  tienen tasas distintas. ADR-future: mover a `TreasuryAccount`.
- El cálculo `days // 30` no es exacto (algunos meses son 31); un
  cálculo "por mes calendario" sería más correcto pero más
  complejo. Se acepta la simplificación.
- La FK `payment_movement` ahora apunta al **último** pago (no al
  primero); UI debe mostrar `payment_movements.all()` para la lista
  completa.

## Alternatives Considered

- **A-1: Truncar outstanding como `card.outstanding_balance`
  mensual (no total)**. Descartado: el interés punitorio se
  calcula sobre el saldo del statement (no sobre el saldo global
  de la tarjeta). Más simple de explicar y auditar.
- **A-2: FK `punitory_interest_movement` (no por `reference`)**.
  Descartado: complica el modelo para un caso de uso simple (N
  ADJUSTMENTs al mes, no 1). La `reference` es suficiente y se
  mantiene limpia la tabla de statements.
- **A-3: `payment_movement` mantener OneToOne + lista
  `payment_movements` en JSON**. Descartado: rompe la primera
  forma normal; FK es la solución correcta.
- **A-4: Calcular mora sólo en el pago (no en task mensual)**.
  Descartado: el operador puede tardar días en pagar, perdiendo
  la imputación mensual del interés.

## Migration

- `accounting/0024_accountingsettings_card_minimum_payment_block_and_more.py`
  — AddField `card_punitory_monthly_rate` + AddField
  `card_minimum_payment_block`.
- `treasury/0071_creditcardstatement_amount_paid_and_more.py` —
  AddField `amount_paid` + AlterField `payment_movement`
  (OneToOne → FK) + AlterField `status` (max_length 10 → 14).
