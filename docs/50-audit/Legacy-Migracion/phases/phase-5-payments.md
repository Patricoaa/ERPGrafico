# Phase 5 — Payments

> Importación de 8.556 pagos históricos + endpoint de pago nuevo. **NO** se usa `TreasuryMovement` ni `journal_entry` para pagos nuevos.

## Precondiciones

- [ ] Phase 1 cerrada.
- [ ] Phase 3 cerrada (`LegacySaleNote` poblada).
- [ ] Phase 4 cerrada (cada NV tiene una OT, aunque para los pagos no es estrictamente necesario).

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T15](../tasks/T15-payment-importer.md) | Importer de pagos | `backend/legacy/importers/payments.py` |
| [T16](../tasks/T16-register-payment-service.md) | Servicio de registro | `backend/legacy/services/register_payment.py` |
| [T17](../tasks/T17-payment-registration-model.md) | Serializer + endpoint | `LegacyPaymentRegistrationSerializer` + view |
| [T18](../tasks/T18-idempotency-payment.md) | Idempotency-Key | Header en endpoint + dedup por key |

## Entregables

- `backend/legacy/importers/payments.py` con `import_payments`.
- `backend/legacy/services/register_payment.py` con `register_payment_legacy`.
- `backend/legacy/serializers.py` con `LegacyPaymentRegistrationSerializer`.
- `backend/legacy/views.py` con `RegisterLegacyPaymentView` y `LegacyImportDetailView`.
- `backend/legacy/urls.py` con las 3 rutas.
- `backend/legacy/exceptions.py` con `LegacyPaymentError`.
- Tests: `test_payment_importer.py`, `test_register_payment.py`, `test_api_register_payment.py`.

## DoD de la fase

- [ ] `python manage.py import_legacy_dump --stage=payments --dsn=...` importa; `LegacyPayment.objects.count() == 8556`.
- [ ] Re-ejecutar el import es idempotente.
- [ ] `POST /api/legacy/sale-notes/<id>/register-payment/` con permisos OK → 201.
- [ ] Sin `legacy.pay_pending_legacy` → 403.
- [ ] Sin `treasury.add_treasurymovement` → 403.
- [ ] Mismo `Idempotency-Key` reenviado → 200 (no 201) y misma `LegacyPaymentRegistration`.
- [ ] `LegacyPaymentRegistration` NO aparece en `TreasuryMovement` ni en `JournalEntry`.
- [ ] `pytest backend/legacy/tests/test_payment_importer.py backend/legacy/tests/test_register_payment.py backend/legacy/tests/test_api_register_payment.py -v` pasa.

## Decisiones tomadas en esta fase

1. **`LegacyPayment`** es histórico (importado); **NO** se crea vía API, solo vía importer.
2. **`LegacyPaymentRegistration`** es nuevo (post-import); **SÍ** se crea vía API.
3. **NO** se usa `TreasuryMovement` para pagos nuevos legacy: el usuario fue explícito en que NO se concilie con bancos ni se cree `journal_entry`.
4. **Permisos compuestos**: `legacy.pay_pending_legacy` AND `treasury.add_treasurymovement`. Sin ambos → 403.
5. **Idempotency-Key** requerido en `POST /api/legacy/sale-notes/<id>/register-payment/`. Se guarda en `LegacyPaymentRegistration.idempotency_key` (UNIQUE).
6. **31 NVs sin pagos** se importan con 0 `LegacyPayment` (visible en UI como "Saldo pendiente").
7. **`forma_pago` mapping**: `'efectivo'`, `'transferencia'`, `'cheque'` se preservan tal cual (CharField choices).
8. **`abono` y `amount`** son `DecimalField(12, 0)` (CLP sin centavos).

## Mapeo legacy → ERPGrafico

| Legacy `pagos` | `LegacyPayment` | `LegacyPaymentRegistration` (nuevo) |
|---|---|---|
| `id` | `legacy_external_id` | — |
| `orden_id` | FK → `LegacySaleNote` (vía `legacy_external_id` lookup) | — |
| `fecha` | `paid_at` | `paid_at` |
| `abono` | `amount` | `amount` |
| `forma_pago` | `method` | `method` |
| `created_at` | (auto) | (auto) |
| — | — | `registered_by` (auth.User) |
| — | — | `idempotency_key` |
| — | — | `notes` (opcional) |

## Servicio `register_payment_legacy`

```python
def register_payment_legacy(*, sale_note, paid_at, amount, method, registered_by, notes=None, idempotency_key=None):
    if amount <= 0:
        raise LegacyPaymentError('El monto debe ser positivo.')

    if idempotency_key:
        existing = LegacyPaymentRegistration.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing, False  # no creado

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

## Endpoint

```python
class RegisterLegacyPaymentView(APIView):
    permission_classes = [IsAuthenticated, LegacyPayPendingPermission]

    def post(self, request, pk):
        idempotency_key = request.headers.get('Idempotency-Key')
        if not idempotency_key:
            return Response({'detail': 'Idempotency-Key header requerido.'}, status=400)

        note = get_object_or_404(LegacySaleNote, pk=pk)
        serializer = LegacyPaymentRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reg, created = register_payment_legacy(
            sale_note=note,
            paid_at=serializer.validated_data['paid_at'],
            amount=serializer.validated_data['amount'],
            method=serializer.validated_data['method'],
            notes=serializer.validated_data.get('notes'),
            registered_by=request.user,
            idempotency_key=idempotency_key,
        )

        return Response(
            LegacyPaymentRegistrationSerializer(reg).data,
            status=201 if created else 200,
        )
```

## Serializer

```python
class LegacyPaymentRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegacyPaymentRegistration
        fields = ['id', 'sale_note', 'registered_by', 'paid_at', 'amount', 'method', 'notes', 'created_at']
        read_only_fields = ['id', 'sale_note', 'registered_by', 'created_at']
```

## Tests de muestra

```python
# test_payment_importer.py
def test_imports_all_payments():
    # 3 pagos legacy → 3 LegacyPayment
    ...

def test_idempotente():
    ...

# test_register_payment.py
def test_creates_registration():
    ...

def test_rechaza_monto_negativo():
    ...

# test_api_register_payment.py
def test_requires_both_permissions(api_client, regular_user):
    regular_user.user_permissions.add(Permission.objects.get(codename='legacy.pay_pending_legacy'))
    # sin treasury.add_treasurymovement → 403
    ...

def test_idempotency_key(api_client, admin_user):
    headers = {'HTTP_IDEMPOTENCY_KEY': 'abc-123'}
    r1 = api_client.post(url, data, format='json', **headers)
    r2 = api_client.post(url, data, format='json', **headers)
    assert r1.status_code == 201
    assert r2.status_code == 200
    assert r1.data['id'] == r2.data['id']
```

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| `Idempotency-Key` no enviado | 400 con mensaje claro |
| Monto ≤ 0 | 400 (validación en serializer) |
| NV no existe | 404 (get_object_or_404) |
| `idempotency_key` colisión con otros registros | UNIQUE constraint + verificación previa |
| Performance: 8.556 inserts | ~30s en bulk; acceptable |
| Pago con `orden_id` que no se importó (anulada) | Filtro `WHERE orden_id IN (LegacySaleNote)` en el importer |

## Comandos de verificación rápida

```bash
# 1. Import
python manage.py import_legacy_dump --stage=payments --dsn="$LEGACY_DSN"

# 2. Verificar
python manage.py shell <<'PY'
from legacy.models import LegacyPayment, LegacyPaymentRegistration
print('LegacyPayment:', LegacyPayment.objects.count())
print('Métodos:', LegacyPayment.objects.values_list('method', flat=True).distinct())
PY

# 3. Test API
curl -X POST http://localhost:8100/api/legacy/sale-notes/1/register-payment/ \
  -H "Authorization: Token $TOKEN" \
  -H "Idempotency-Key: test-001" \
  -H "Content-Type: application/json" \
  -d '{"paid_at": "2026-06-02", "amount": 5000, "method": "efectivo"}'

# 4. Tests
pytest backend/legacy/tests/test_payment_importer.py backend/legacy/tests/test_register_payment.py backend/legacy/tests/test_api_register_payment.py -v
```

## Salida para la Phase 6

Al cerrar Phase 5, ya se puede:
- Exponer la API unificada (Phase 6) — los modelos están listos.
- Construir el frontend (Phase 7) — los datos están disponibles.

**No** se puede aún:
- Listar NVs en la UI (falta el serializer unificado y el viewset).
