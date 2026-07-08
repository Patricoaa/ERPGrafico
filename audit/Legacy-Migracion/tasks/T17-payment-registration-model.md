# T17 — Payment registration serializer + view

> **Phase**: 5
> **Tiempo estimado**: 30 min
> **Complejidad**: baja

## Precondiciones

- [ ] T16 cerrada.

## Archivos a tocar/crear

- `backend/legacy/serializers.py` (nuevo).
- `backend/legacy/views.py` (nuevo).
- `backend/legacy/urls.py` (nuevo).
- `backend/config/urls.py` (incluir `legacy.urls`).
- `backend/legacy/tests/test_api_register_payment.py`.

## 1. `serializers.py`

```python
from rest_framework import serializers
from legacy.models import LegacyPaymentRegistration


class LegacyPaymentRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegacyPaymentRegistration
        fields = ['id', 'sale_note', 'registered_by', 'paid_at', 'amount', 'method', 'notes', 'created_at']
        read_only_fields = ['id', 'sale_note', 'registered_by', 'created_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser positivo.')
        return value
```

## 2. `views.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from legacy.models import LegacySaleNote
from legacy.serializers import LegacyPaymentRegistrationSerializer
from legacy.services.register_payment import register_payment_legacy
from legacy.permissions import LegacyPayPendingPermission


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

## 3. `urls.py`

```python
from django.urls import path
from . import views

urlpatterns = [
    path('sale-notes/<int:pk>/register-payment/', views.RegisterLegacyPaymentView.as_view(), name='legacy-register-payment'),
]
```

## 4. `config/urls.py`

```python
urlpatterns = [
    # ... existentes ...
    path('api/legacy/', include('legacy.urls')),
]
```

## 5. Tests

```python
# test_api_register_payment.py
def test_creates_registration(api_client, admin_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.post(
        f'/api/legacy/sale-notes/{note.id}/register-payment/',
        data={'paid_at': '2026-06-02', 'amount': 5000, 'method': 'efectivo'},
        format='json',
        HTTP_IDEMPOTENCY_KEY='test-001',
    )
    assert r.status_code == 201
    assert r.data['amount'] == 5000

def test_requires_idempotency_key(api_client, admin_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.post(f'/api/legacy/sale-notes/{note.id}/register-payment/', data={...}, format='json')
    assert r.status_code == 400

def test_requires_both_permissions(api_client, user_with_only_legacy_perm):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(user_with_only_legacy_perm)
    r = api_client.post(...)
    assert r.status_code == 403

def test_idempotency_key_replay(api_client, admin_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    headers = {'HTTP_IDEMPOTENCY_KEY': 'test-001'}
    r1 = api_client.post(..., **headers)
    r2 = api_client.post(..., **headers)
    assert r1.status_code == 201
    assert r2.status_code == 200
    assert r1.data['id'] == r2.data['id']

def test_amount_negativo_rechazado(api_client, admin_user):
    note = LegacySaleNoteFactory()
    api_client.force_authenticate(admin_user)
    r = api_client.post(
        f'/api/legacy/sale-notes/{note.id}/register-payment/',
        data={'paid_at': '2026-06-02', 'amount': -100, 'method': 'efectivo'},
        format='json',
        HTTP_IDEMPOTENCY_KEY='test-002',
    )
    assert r.status_code == 400
```

## DoD

- [ ] Endpoint requiere `Idempotency-Key`.
- [ ] Endpoint requiere ambos permisos.
- [ ] Re-ejecución con misma key → 200.
- [ ] Monto negativo → 400.
- [ ] 5+ tests pasan.

## Comandos de verificación

```bash
pytest backend/legacy/tests/test_api_register_payment.py -v
# Manual:
curl -X POST http://localhost:8100/api/legacy/sale-notes/1/register-payment/ \
  -H "Authorization: Token $TOKEN" \
  -H "Idempotency-Key: test-001" \
  -H "Content-Type: application/json" \
  -d '{"paid_at": "2026-06-02", "amount": 5000, "method": "efectivo"}'
```

## Riesgos

- **`register-payment` aparece en docs OpenAPI con tag `legacy`**: T25 lo documenta.
