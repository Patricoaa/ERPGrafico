---
layer: 30-playbooks
doc: add-endpoint
task: "Add new REST endpoint"
triggers: ["new endpoint", "expose API", "new route", "REST"]
preconditions:
  - 10-architecture/backend-apps.md
  - 20-contracts/api-contracts.md
  - 40-quality/security.md
validation:
  - pytest apps/[app]/tests
  - python manage.py check
  - python manage.py makemigrations --dry-run --check
forbidden:
  - business logic inside views
  - exposing integer PKs
  - hardcoded money (must be cents)
  - skipping permission class
status: active
owner: backend-team
last_review: 2026-04-23
---

# Playbook — Add REST endpoint

## When

New resource or action not covered by existing viewset.

## Steps

### 1. Decide route

- Resource-oriented: `/api/[app]/[resource]/` — use `ModelViewSet`.
- Action on resource: `@action(detail=True, methods=['post'])` — e.g. `/orders/{id}/transition/`.

### 2. Model (if new entity)

```python
# apps/[app]/models.py
class Foo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # fields …
    class Meta:
        indexes = [models.Index(fields=['created_at'])]
```

Then migration — see [add-migration.md](add-migration.md).

### 3. Serializer

- Separate read vs write serializers if shapes differ.
- Nest related entities via `source=` or custom `SerializerMethodField`.
- Document fields — feeds OpenAPI.

### 4. Service (business logic)

```python
# apps/[app]/services.py
from django.db import transaction

@transaction.atomic
def create(*, user, **kwargs) -> Foo:
    # validation beyond serializer
    # side effects (enqueue celery)
    # return entity
```

### 5. View — thin

```python
class FooViewSet(ModelViewSet):
    queryset = Foo.objects.all()
    serializer_class = FooSerializer
    permission_classes = [IsAuthenticated, HasFooPermission]

    def create(self, request):
        s = FooCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        entity = foo_service.create(user=request.user, **s.validated_data)
        return Response(FooSerializer(entity).data, status=201)
```

### 6. Permission class

```python
class HasFooPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user.has_perm('[app].view_foo')
    def has_object_permission(self, request, view, obj):
        # object-level checks
```

Never skip. Security team review required if role model changes.

### 7. URL wiring

```python
# apps/[app]/urls.py
router = DefaultRouter()
router.register(r'foos', FooViewSet, basename='foo')
urlpatterns = router.urls
```

Mounted automatically via `config/urls.py`.

### 8. OpenAPI annotation

```python
from drf_spectacular.utils import extend_schema

class FooViewSet(ModelViewSet):
    @extend_schema(request=FooCreateSerializer, responses=FooSerializer)
    def create(self, request): ...
```

### 9. Tests

```python
# apps/[app]/tests/test_views.py
@pytest.mark.django_db
def test_create_foo_happy_path(client, user):
    client.force_authenticate(user)
    resp = client.post('/api/[app]/foos/', {...}, format='json')
    assert resp.status_code == 201

def test_create_foo_requires_auth(client):
    resp = client.post('/api/[app]/foos/', {}, format='json')
    assert resp.status_code == 401

def test_create_foo_validation(client, user):
    ...
```

Minimum: 1 happy path, 1 auth-missing, 1 validation-fail, 1 permission-denied.

### 10. Update contract doc

Edit `20-contracts/api-contracts.md` — add resource under its app section with request/response shapes.

### 11. Coordinate frontend

- Notify frontend owner.
- Zod schema in feature must mirror serializer.
- Prefer same feature PR to avoid contract drift window.

## Validation

```bash
pytest apps/[app]/tests -v
python manage.py check --deploy
python manage.py spectacular --file /tmp/schema.yml && echo ok
```

## Definition of done

- [ ] ViewSet ≤20 lines per action; logic in service.
- [ ] Permission class set, tested.
- [ ] Atomic transactions on multi-table writes.
- [ ] Serializers documented, OpenAPI schema regenerates.
- [ ] All status codes from api-contracts.md honored.
- [ ] Contract doc updated.
- [ ] Frontend hook + Zod schema in sync.
- [ ] Rate limit tier confirmed.
- [ ] Celery tasks (if any) idempotent.
