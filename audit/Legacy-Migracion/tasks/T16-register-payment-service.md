# T16 — Register payment service

> **Phase**: 5
> **Tiempo estimado**: 30 min
> **Complejidad**: baja

## Precondiciones

- [ ] T15 cerrada.

## Archivos a tocar/crear

- `backend/legacy/services/register_payment.py`.
- `backend/legacy/services/__init__.py` (export).
- `backend/legacy/tests/test_register_payment.py`.

## Implementación

```python
# backend/legacy/services/register_payment.py
from django.db import transaction
from legacy.models import LegacyPaymentRegistration, LegacySaleNote
from legacy.exceptions import LegacyPaymentError


def register_payment_legacy(*, sale_note: LegacySaleNote, paid_at, amount, method, registered_by, notes=None, idempotency_key=None):
    """Registra un pago nuevo sobre una NV legacy.
    Devuelve (registration, created). created=False si idempotency_key ya existía."""

    if amount <= 0:
        raise LegacyPaymentError('El monto debe ser positivo.')

    if idempotency_key:
        existing = LegacyPaymentRegistration.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing, False

    with transaction.atomic():
        reg = LegacyPaymentRegistration.objects.create(
            sale_note=sale_note,
            registered_by=registered_by,
            paid_at=paid_at,
            amount=amount,
            method=method,
            notes=notes,
            idempotency_key=idempotency_key,
        )
    return reg, True
```

## Tests

```python
# test_register_payment.py
import pytest
from decimal import Decimal
from legacy.services.register_payment import register_payment_legacy
from legacy.exceptions import LegacyPaymentError
from legacy.models import LegacyPaymentRegistration


def test_creates_registration(note, user):
    reg, created = register_payment_legacy(
        sale_note=note, paid_at=date(2026, 6, 2), amount=Decimal('5000'),
        method='efectivo', registered_by=user, idempotency_key='abc-123',
    )
    assert created is True
    assert reg.amount == Decimal('5000')


def test_idempotency_key_replays(note, user):
    reg1, _ = register_payment_legacy(sale_note=note, ..., idempotency_key='abc-123')
    reg2, created = register_payment_legacy(sale_note=note, ..., idempotency_key='abc-123')
    assert created is False
    assert reg1.id == reg2.id


def test_rechaza_monto_negativo(note, user):
    with pytest.raises(LegacyPaymentError):
        register_payment_legacy(sale_note=note, amount=Decimal('-100'), ...)


def test_rechaza_monto_cero(note, user):
    with pytest.raises(LegacyPaymentError):
        register_payment_legacy(sale_note=note, amount=Decimal('0'), ...)


def test_sin_idempotency_key_permite_duplicados(note, user):
    reg1, _ = register_payment_legacy(sale_note=note, ..., idempotency_key=None)
    reg2, created = register_payment_legacy(sale_note=note, ..., idempotency_key=None)
    assert created is True
    assert reg1.id != reg2.id
```

## DoD

- [ ] `register_payment_legacy` crea un `LegacyPaymentRegistration`.
- [ ] Re-ejecución con misma `idempotency_key` no duplica.
- [ ] Monto ≤ 0 lanza `LegacyPaymentError`.
- [ ] 5+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_register_payment.py -v
```

## Riesgos

- **Idempotency-Key NULL**: si dos requests llegan sin key, se crean dos registrations. Por eso el endpoint (T17) **requiere** la key.
