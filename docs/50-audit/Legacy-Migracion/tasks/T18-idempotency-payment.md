# T18 — Idempotency on payment registration

> **Phase**: 5
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T17 cerrada.

## Archivos a tocar/crear

- `docs/20-contracts/idempotency.md` (extender lista cerrada de endpoints que requieren `Idempotency-Key`).
- `backend/legacy/views.py` (verificar implementación ya cubre el caso).

## 1. Documentar en `idempotency.md`

Agregar a la lista de endpoints que requieren `Idempotency-Key`:

```markdown
| `POST /api/legacy/sale-notes/<id>/register-payment/` | legacy | sí |
```

## 2. Verificación de la implementación

El endpoint ya implementado en T17:

- Lee `Idempotency-Key` del header (400 si falta).
- Pasa a `register_payment_legacy` que:
  - Si la key existe en BD, devuelve el `registration` existente con `created=False`.
  - Si no, crea uno nuevo.
- Devuelve 201 si `created=True`, 200 si `created=False`.

## Tests de cobertura

```python
def test_idempotency_key_vacia_se_rechaza(): ...
def test_idempotency_key_replay_devuelve_200(): ...
def test_idempotency_key_distinta_crea_nueva(): ...
def test_idempotency_key_unica_por_registro(): ...  # verifica UNIQUE constraint
```

## DoD

- [ ] `docs/20-contracts/idempotency.md` actualizado.
- [ ] `LegacyPaymentRegistration.idempotency_key` UNIQUE (ya está en el modelo).
- [ ] 3+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_api_register_payment.py -v
grep -A 3 "legacy/sale-notes" docs/20-contracts/idempotency.md
```

## Riesgos

- **Colisión de keys**: si dos requests con misma key llegan simultáneamente, una puede tener UNIQUE violation. Se loguea como error y se reintenta leyendo el existente.
