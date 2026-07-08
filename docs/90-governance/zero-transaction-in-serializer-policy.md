# Zero-Transaction-In-Serializer Policy

**Status:** Active  
**Enforced by:** `pytest backend/core/tests/test_architectural_invariants.py::TestArchitecturalInvariants::test_no_transaction_atomic_in_serializers` + `test_no_direct_orm_in_serializer_create_update`  
**Lint script:** `python backend/scripts/lint_serializer_atomics.py`

---

## Rule

> **No DRF Serializer class may contain `transaction.atomic`, inline `import transaction`, or direct ORM calls (`Model.objects.*`) inside its `create()` or `update()` methods.**

This is an extension of the global invariant: _"Views ≤ 20 lines — business logic goes in `services.py`"_. The same principle applies to serializers.

---

## Why this matters

DRF serializers expose `create()` and `update()` as convenient hooks, making it tempting to place business logic there. The result is:

| Problem | Impact |
|---|---|
| Transactions scoped to the serializer | Logic cannot be reused from Celery tasks, management commands, or other services without instantiating a serializer |
| Partial failures leave DB inconsistent | If row 2 of 3 fails, row 1 is already committed |
| ORM calls scattered in serializers | Impossible to enforce N+1 guards — prefetch in the ViewSet has no effect on new queries issued inside the serializer |
| Pattern replication | New developers copy the antipattern because the codebase teaches it |

---

## Antipattern (❌ PROHIBITED)

```python
# hr/serializers.py — BEFORE (antipattern)

class EmployeeSerializer(serializers.ModelSerializer):

    def _handle_concept_amounts(self, employee, concept_amounts_data):
        # Direct ORM inside serializer ← Rule C violation
        EmployeeConceptAmount.objects.update_or_create(...)
        EmployeeConceptAmount.objects.filter(...).delete()

    def create(self, validated_data):
        from django.db import transaction        # ← Rule A violation (inline import)
        concept_amounts_data = validated_data.pop("concept_amounts", None)
        with transaction.atomic():              # ← Rule B violation (atomic in serializer)
            employee = super().create(validated_data)
            self._handle_concept_amounts(employee, concept_amounts_data)
        return employee
```

**Why it's wrong:**
- Transaction boundary is owned by the serializer — unreusable from Celery/management commands
- ORM calls inside `_handle_concept_amounts` execute outside the ViewSet's `prefetch_related` scope
- If called from a test or a service, a new serializer instance must be created just to save data

---

## Correct pattern (✅ REQUIRED)

```python
# hr/services.py — AFTER (correct pattern)

class EmployeeService:

    @staticmethod
    @transaction.atomic                      # ← atomic lives HERE, in the service
    def create_employee(validated_data: dict) -> Employee:
        concept_amounts_data = validated_data.pop("concept_amounts", None)
        employee = Employee.objects.create(**validated_data)
        EmployeeService._sync_concept_amounts(employee, concept_amounts_data)
        return employee

    @staticmethod
    @transaction.atomic
    def update_employee(instance: Employee, validated_data: dict) -> Employee:
        concept_amounts_data = validated_data.pop("concept_amounts", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        EmployeeService._sync_concept_amounts(instance, concept_amounts_data)
        return instance

    @staticmethod
    def _sync_concept_amounts(employee, concept_amounts_data) -> None:
        if concept_amounts_data is None:
            return
        existing_ids = []
        for item_data in concept_amounts_data:
            obj, _ = EmployeeConceptAmount.objects.update_or_create(
                employee=employee,
                concept=item_data["concept"],
                defaults={"amount": item_data["amount"]},
            )
            existing_ids.append(obj.id)
        EmployeeConceptAmount.objects.filter(employee=employee).exclude(
            id__in=existing_ids
        ).delete()


# hr/serializers.py — AFTER (thin delegation)

class EmployeeSerializer(serializers.ModelSerializer):

    def create(self, validated_data):
        from .services import EmployeeService   # late import to avoid circular
        return EmployeeService.create_employee(validated_data)

    def update(self, instance, validated_data):
        from .services import EmployeeService
        return EmployeeService.update_employee(instance, validated_data)
```

**Why it's correct:**
- `EmployeeService.create_employee()` can be called from Celery tasks, scripts, or other services without touching the serializer
- `@transaction.atomic` is visible at the service level — any caller knows it runs atomically
- Prefetch defined in the ViewSet is not bypassed

---

## Detection rules

Three rules are enforced by the architecture test and the lint script:

| Rule | Pattern | Tool |
|---|---|---|
| **A** | `from django.db import transaction` inside a Serializer method | AST test + lint script |
| **B** | `with transaction.atomic():` or `@transaction.atomic` inside a Serializer class | AST test + lint script |
| **C** | `Model.objects.<create\|get\|filter\|...>()` inside a Serializer `create()` or `update()` | AST test + lint script |

---

## How to run the lint script manually

```bash
# From project root — scans all backend serializers.py
python backend/scripts/lint_serializer_atomics.py

# Scan a specific directory
python backend/scripts/lint_serializer_atomics.py backend/hr/
```

Exit code `0` = no violations. Exit code `1` = violations found (CI blocks).

---

## Legitimate exceptions

There are **no legitimate exceptions** for Rules A and B inside serializer methods.  
For Rule C: `super().create()` and `super().update()` are allowed (they delegate to DRF's default save, not a raw ORM call directly on a Manager).

If you believe you have a case that requires an exception, open a discussion in the PR and tag a senior engineer. Do not disable the test.
