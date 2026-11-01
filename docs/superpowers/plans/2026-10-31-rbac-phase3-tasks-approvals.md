# RBAC Phase 3 — Tasks & Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `TaskAssignmentRule.assigned_group` from CharField to FK, add `Task.required_permission`, introduce `ApprovalPolicy` model, clean up the `candidate_group` JSON hack, fix group assignment notifications, and expose minimal frontend UI for the new fields.

**Architecture:** Four backend tasks (migration, model additions, service cleanup, new ViewSet) followed by one frontend task (show group on tasks + ApprovalPolicy settings panel). SoD (`forbid_self_approval`) is warn-only — it flags but never blocks `complete_task`.

**Tech Stack:** Django 5 + DRF, Next.js 16, TypeScript, Zod, react-hook-form, TanStack Query v5.

**Spec:** `docs/10-architecture/adr/0104-rbac-action-permissions-roles-teams.md` (Phase 3 section) + CLAUDE.md global invariants.

## Global Constraints

- Zero N+1: all new ViewSets must `select_related` / `prefetch_related` before serializing.
- Views ≤ 20 lines — business logic in `services.py`.
- SoD stays warn-only: `forbid_self_approval=True` raises a warning log/return value but never blocks.
- `action_permissions` must be declared on any ViewSet with custom actions.
- No raw Tailwind colors in frontend; semantic tokens only.
- Zero `any` in TypeScript.
- Run backend tests with: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/ -v` (from `backend/`).

## Review Focus

- `complete_task` with `required_permission` set: user without the permission should get `PermissionDenied`.
- `create_task` when rule has no `assigned_group` FK (null): task created with `assigned_group=None` and no `candidate_group` key in `data`.
- `TaskSelectorExt.get_queryset_for_user` after removal of `data__candidate_group` filter: pool tasks already migrated to FK are still visible to group members.
- `ApprovalPolicy.min_amount=None`: no amount check is performed (treat as always applicable).
- `forbid_self_approval=True`: `complete_task` by `task.created_by` logs a warn and returns the task with a `sod_warning` but does NOT raise `PermissionDenied`.

---

## File Map

**Backend — modify:**
- `backend/workflow/models.py` — `TaskAssignmentRule.assigned_group` CharField→FK; add `Task.required_permission`; add `ApprovalPolicy` model.
- `backend/workflow/services.py` — `create_task`: use FK; `complete_task`: check `required_permission` + SoD warn; `notify_group_assignment`: accept `Group` object.
- `backend/workflow/selectors.py` — remove `data__candidate_group__in` filter from `TaskSelectorExt`.
- `backend/workflow/serializers.py` — add `assigned_group_data` to `TaskAssignmentRuleSerializer`; add `ApprovalPolicySerializer`.
- `backend/workflow/views.py` — add `TaskAssignmentRuleViewSet.select_related("assigned_group")`; add `ApprovalPolicyViewSet`.
- `backend/workflow/urls.py` — register `ApprovalPolicyViewSet`.

**Backend — create:**
- `backend/workflow/migrations/0014_taskassignmentrule_assigned_group_fk.py` — schema migration for CharField→FK.
- `backend/workflow/migrations/0015_task_required_permission_approvalpolicy.py` — add `Task.required_permission` + `ApprovalPolicy` model.
- `backend/workflow/tests/test_phase3_tasks_approvals.py` — all Phase 3 tests.

**Frontend — modify:**
- `frontend/features/workflow/api/types.ts` — add `required_permission`, `assigned_group_name` already exists; add `ApprovalPolicy` type.
- `frontend/features/workflow/hooks/useWorkflow.ts` (or equivalent) — add `useApprovalPolicies`, `useSaveApprovalPolicy`.
- `frontend/features/settings/components/ApprovalPoliciesView.tsx` — settings panel for ApprovalPolicy CRUD.
- `frontend/features/settings/components/SettingsClientView.tsx` (or router file) — wire in `ApprovalPoliciesView`.

---

### Task 1: Migrate `TaskAssignmentRule.assigned_group` CharField → FK

**Files:**
- Modify: `backend/workflow/models.py:72-77`
- Create: `backend/workflow/migrations/0014_taskassignmentrule_assigned_group_fk.py`
- Modify: `backend/workflow/serializers.py:81-87`
- Modify: `backend/workflow/views.py:123`
- Test: `backend/workflow/tests/test_phase3_tasks_approvals.py`

**Interfaces:**
- Produces: `TaskAssignmentRule.assigned_group` as `FK(Group, null=True, blank=True, on_delete=SET_NULL, related_name="assignment_rules")`; `TaskAssignmentRuleSerializer` includes `assigned_group_data = GroupSerializer(source="assigned_group", read_only=True)` with fields `{id, name}`.

- [ ] **Step 1: Write failing test**

```python
# backend/workflow/tests/test_phase3_tasks_approvals.py
import pytest
from django.contrib.auth.models import Group
from workflow.models import TaskAssignmentRule

@pytest.mark.django_db
def test_task_assignment_rule_assigned_group_is_fk():
    group = Group.objects.create(name="Aprobadores")
    rule = TaskAssignmentRule.objects.create(
        task_type="TEST_APPROVAL",
        assigned_group=group,
    )
    rule.refresh_from_db()
    assert rule.assigned_group_id == group.pk
    assert rule.assigned_group.name == "Aprobadores"
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_task_assignment_rule_assigned_group_is_fk -v`
Expected: FAIL — `assigned_group` is a CharField, `assigned_group_id` does not exist.

- [ ] **Step 3: Change model field in `backend/workflow/models.py`**

Replace the `assigned_group = models.CharField(...)` block (lines 72-77) with:
```python
assigned_group = models.ForeignKey(
    Group,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="assignment_rules",
    verbose_name=_("Grupo Asignado"),
)
```
`Group` is already imported at line 1.

- [ ] **Step 4: Generate migration with data migration**

```bash
cd backend && python manage.py makemigrations workflow --name taskassignmentrule_assigned_group_fk
```

The auto-generated migration will produce an `AlterField`. Rename it `0014_taskassignmentrule_assigned_group_fk.py`. Verify it is a clean `AlterField` from CharField to FK — if Django cannot auto-detect the FK direction, write it manually.

- [ ] **Step 5: Add `assigned_group_data` to `TaskAssignmentRuleSerializer`**

In `backend/workflow/serializers.py`, change `TaskAssignmentRuleSerializer`:
```python
class _GroupMinSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()

class TaskAssignmentRuleSerializer(serializers.ModelSerializer):
    assigned_user_data = UserSerializer(source="assigned_user", read_only=True)
    assigned_group_data = _GroupMinSerializer(source="assigned_group", read_only=True)

    class Meta:
        model = TaskAssignmentRule
        fields = "__all__"
```

- [ ] **Step 6: Update `TaskAssignmentRuleViewSet` to select_related `assigned_group`**

In `backend/workflow/views.py`, change line 123:
```python
queryset = TaskAssignmentRule.objects.select_related("assigned_user", "assigned_group").all()
```

- [ ] **Step 7: Run test — expect PASS**

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_task_assignment_rule_assigned_group_is_fk -v`
Expected: PASS.

- [ ] **Step 8: Run migrate on dev server (via docker compose) to confirm no errors**

```bash
mutagen sync list  # confirm Connected: Yes
ssh pato@192.168.1.86 "cd ERPGrafico && docker compose exec backend python manage.py migrate workflow"
```
Expected: `Applying workflow.0014_taskassignmentrule_assigned_group_fk... OK`

- [ ] **Step 9: Commit**

```bash
git add backend/workflow/models.py backend/workflow/migrations/0014_* backend/workflow/serializers.py backend/workflow/views.py backend/workflow/tests/test_phase3_tasks_approvals.py
git commit -m "feat(workflow): migrate TaskAssignmentRule.assigned_group CharField→FK"
```

---

### Task 2: Migrate `candidate_group` JSON → `Task.assigned_group` FK in services + selectors

**Files:**
- Modify: `backend/workflow/services.py` — `create_task`, `complete_task`, `notify_group_assignment`
- Modify: `backend/workflow/selectors.py` — `TaskSelectorExt.get_queryset_for_user`
- Test: `backend/workflow/tests/test_phase3_tasks_approvals.py`

**Interfaces:**
- Consumes: `TaskAssignmentRule.assigned_group` FK from Task 1.
- Produces: `WorkflowService.create_task` sets `task.assigned_group = group_fk` and does NOT put `candidate_group` in `task.data`; `notify_group_assignment` signature changed to `notify_group_assignment(task, group: Group)`.

- [ ] **Step 1: Write failing test — create_task stores group in FK, not in data**

```python
@pytest.mark.django_db
def test_create_task_uses_assigned_group_fk_not_data(group_with_user):
    """create_task stores pool group in Task.assigned_group FK, not task.data."""
    from django.contrib.auth.models import Group
    from workflow.models import Task, TaskAssignmentRule
    from workflow.services import WorkflowService

    group = Group.objects.create(name="Pool Group")
    TaskAssignmentRule.objects.create(task_type="POOL_TASK", assigned_group=group)

    task = WorkflowService.create_task(
        task_type="POOL_TASK",
        title="Test pool task",
        description="",
    )
    assert task.assigned_group == group
    assert "candidate_group" not in (task.data or {})
```

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_create_task_uses_assigned_group_fk_not_data -v`
Expected: FAIL — task.assigned_group is None, candidate_group is in data.

- [ ] **Step 2: Update `create_task` in `backend/workflow/services.py`**

In `create_task` (lines 48-93), change the pool assignment block:

Old (lines 69-75):
```python
if assignee_info:
    assigned_user = assignee_info.get("user")
    candidate_group = assignee_info.get("group")

task_data = data or {}
if candidate_group and not assigned_user:
    task_data = {**task_data, "candidate_group": candidate_group}
```

New:
```python
candidate_group = None
if assignee_info:
    assigned_user = assignee_info.get("user")
    candidate_group = assignee_info.get("group")  # now a Group FK object or None

task_data = data or {}
# No longer store candidate_group in data; use assigned_group FK directly
```

And in `Task.objects.create(...)` call, add `assigned_group=candidate_group`:
```python
task = Task.objects.create(
    ...
    assigned_to=assigned_user,
    assigned_group=candidate_group,   # ADD THIS
    content_object=content_object,
    data=task_data,
    ...
)
```

And change `notify_group_assignment` call (line 92):
```python
elif candidate_group:
    WorkflowService.notify_group_assignment(task, candidate_group)
```

- [ ] **Step 3: Update `complete_task` — remove `candidate_group` JSON check**

In `complete_task` (lines 139-151), remove the `candidate_group` block:

Delete lines 144-151:
```python
# Pool tasks (create_task) carry the group by name in data, not in assigned_group
candidate_group = (task.data or {}).get("candidate_group")
if (
    not task.assigned_to
    and candidate_group
    and not user.groups.filter(name=candidate_group).exists()
):
    raise PermissionDenied(f"No tienes permisos para completar esta tarea. Debes pertenecer al grupo '{candidate_group}'.")
```

The `task.assigned_group` FK check (lines 142-143) already handles this correctly.

- [ ] **Step 4: Update `notify_group_assignment` signature**

Change `notify_group_assignment(task, group_name)` to `notify_group_assignment(task, group)`:

```python
@staticmethod
def notify_group_assignment(task, group):
    """Notify all members of the assigned group about a new pool task."""
    for user in group.user_set.all():
        Notification.objects.create(
            user=user,
            title=f"Nueva tarea grupal: {task.title}",
            message=f"Se ha asignado una nueva tarea al grupo {group.name}: {task.description}",
            link=WorkflowService._get_link_for_task(task),
            type=Notification.Type.INFO,
            content_object=task,
            data={"task_id": task.id},
            notification_type="TASK_GROUP_ASSIGNMENT",
        )
```
This bypasses the `NotificationRule` lookup and directly notifies group members.

- [ ] **Step 5: Update `TaskSelectorExt.get_queryset_for_user` in `backend/workflow/selectors.py`**

Remove `Q(data__candidate_group__in=ug)` from the filter. The `Q(assigned_group__in=user.groups.all())` clause already covers pool tasks now:

```python
q = (
    Q(assigned_to=user)
    | Q(assigned_group__in=user.groups.all())
    | Q(category="TASK", assigned_to__isnull=True, assigned_group__isnull=True)
    | Q(created_by=user)
)
return qs.filter(q).distinct()
```
Also remove the `ug` variable (no longer needed).

- [ ] **Step 6: Run test — expect PASS**

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_create_task_uses_assigned_group_fk_not_data -v`
Expected: PASS.

- [ ] **Step 7: Write test for selector visibility**

```python
@pytest.mark.django_db
def test_pool_task_visible_to_group_member():
    from django.contrib.auth.models import Group
    from django.contrib.auth import get_user_model
    from workflow.models import Task, TaskAssignmentRule
    from workflow.services import WorkflowService
    from workflow.selectors import TaskSelectorExt

    User = get_user_model()
    group = Group.objects.create(name="Pool Selectors")
    user = User.objects.create_user(username="pool_member", password="x")
    user.groups.add(group)

    TaskAssignmentRule.objects.create(task_type="POOL_SEL_TASK", assigned_group=group)
    task = WorkflowService.create_task(task_type="POOL_SEL_TASK", title="Pool task", description="")

    qs = TaskSelectorExt.get_queryset_for_user(user)
    assert task in qs
```

Run it red first, then green (should already pass after Step 5):
Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_pool_task_visible_to_group_member -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/workflow/services.py backend/workflow/selectors.py backend/workflow/tests/test_phase3_tasks_approvals.py
git commit -m "refactor(workflow): migrate candidate_group JSON→Task.assigned_group FK, fix notify_group_assignment"
```

---

### Task 3: Add `Task.required_permission` + SoD warn in `complete_task`

**Files:**
- Modify: `backend/workflow/models.py` — add `Task.required_permission`
- Create: `backend/workflow/migrations/0015_task_required_permission_approvalpolicy.py`
- Modify: `backend/workflow/services.py` — `complete_task` checks `required_permission` and `forbid_self_approval`
- Test: `backend/workflow/tests/test_phase3_tasks_approvals.py`

**Interfaces:**
- Produces: `Task.required_permission = CharField(max_length=100, blank=True, default="")`; `complete_task` raises `PermissionDenied` if `task.required_permission` is set and user lacks the permission; returns `(task, sod_warnings: list[str])` tuple when `forbid_self_approval` check fires (warn-only).

Note: `complete_task` currently returns just `task`. Changing to a tuple is a breaking change for callers. Instead, attach `sod_warnings` to `task._sod_warnings` (transient attribute) — callers that care read it, others ignore it.

- [ ] **Step 1: Write failing test — required_permission check**

```python
@pytest.mark.django_db
def test_complete_task_requires_permission():
    from django.contrib.auth import get_user_model
    from rest_framework.exceptions import PermissionDenied
    from workflow.models import Task
    from workflow.services import WorkflowService

    User = get_user_model()
    user = User.objects.create_user(username="low_perm_user", password="x")
    task = Task.objects.create(
        title="Perm task",
        task_type="PERM_TASK",
        required_permission="sales.confirm_salesorder",
    )
    with pytest.raises(PermissionDenied):
        WorkflowService.complete_task(task, user)
```

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_complete_task_requires_permission -v`
Expected: FAIL — `Task` has no `required_permission` field.

- [ ] **Step 2: Add `required_permission` to `Task` model**

In `backend/workflow/models.py`, after `category` field (around line 152), add:
```python
required_permission = models.CharField(
    _("Permiso Requerido"),
    max_length=100,
    blank=True,
    default="",
    help_text="codename app_label.action_model — si se especifica, solo usuarios con este permiso pueden completar la tarea.",
)
```

- [ ] **Step 3: Add `ApprovalPolicy` model** (combined in this migration)

In `backend/workflow/models.py`, after `WorkflowSettings` class, add:
```python
class ApprovalPolicy(TimeStampedModel):
    """
    Regla de aprobación por tipo de documento y monto mínimo.
    forbid_self_approval es warn-only (nunca bloquea).
    """
    document_type = models.CharField(
        _("Tipo de Documento"),
        max_length=100,
        unique=True,
        help_text="Ej: SALE_ORDER, PURCHASE_ORDER, WORK_ORDER",
    )
    min_amount = models.DecimalField(
        _("Monto Mínimo"),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Si se especifica, la política aplica solo cuando el documento supera este monto.",
    )
    required_permission = models.CharField(
        _("Permiso Requerido"),
        max_length=100,
        blank=True,
        help_text="codename app_label.action_model para aprobar este tipo de documento.",
    )
    forbid_self_approval = models.BooleanField(
        _("Prohibir Auto-aprobación"),
        default=False,
        help_text="Si está activado, emite un aviso cuando el aprobador es el mismo que el creador (warn-only, no bloquea).",
    )
    approvals_required = models.PositiveIntegerField(
        _("Aprobaciones Requeridas"),
        default=1,
    )

    class Meta:
        verbose_name = _("Política de Aprobación")
        verbose_name_plural = _("Políticas de Aprobación")
        ordering = ["document_type"]

    def __str__(self):
        return f"ApprovalPolicy({self.document_type})"
```

`TimeStampedModel` is imported from `core.models` at line 8 already.

- [ ] **Step 4: Generate migration**

```bash
cd backend && python manage.py makemigrations workflow --name task_required_permission_approvalpolicy
```
Rename output to `0015_task_required_permission_approvalpolicy.py`.

- [ ] **Step 5: Add `required_permission` check to `complete_task`**

After the group/pool check block (after line 151), add:
```python
if task.required_permission and not user.has_perm(task.required_permission):
    raise PermissionDenied(
        f"Necesitas el permiso '{task.required_permission}' para completar esta tarea."
    )
```

- [ ] **Step 6: Add SoD warn for self-approval (warn-only)**

After the `required_permission` check, add:
```python
task._sod_warnings = []
if task.created_by and task.created_by == user:
    task._sod_warnings.append("self_approval")
    import logging
    logging.getLogger("workflow.sod").warning(
        "SoD: self-approval by user=%s on task=%s", user.pk, task.pk
    )
```

- [ ] **Step 7: Run test — expect PASS**

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_complete_task_requires_permission -v`
Expected: PASS.

- [ ] **Step 8: Write test — SoD self-approval is warn-only (does NOT raise)**

```python
@pytest.mark.django_db
def test_complete_task_self_approval_warns_not_blocks():
    from django.contrib.auth import get_user_model
    from workflow.models import Task
    from workflow.services import WorkflowService

    User = get_user_model()
    user = User.objects.create_user(username="creator_user", password="x", is_superuser=True)
    task = Task.objects.create(
        title="Self approval task",
        task_type="SELF_TASK",
        created_by=user,
    )
    # Should NOT raise — SoD is warn-only
    completed = WorkflowService.complete_task(task, user)
    assert completed.status == Task.Status.COMPLETED
    assert "self_approval" in getattr(completed, "_sod_warnings", [])
```

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_complete_task_self_approval_warns_not_blocks -v`
Expected: PASS.

- [ ] **Step 9: Run full workflow test suite**

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/ -v`
Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add backend/workflow/models.py backend/workflow/migrations/0015_* backend/workflow/services.py backend/workflow/tests/test_phase3_tasks_approvals.py
git commit -m "feat(workflow): Task.required_permission, ApprovalPolicy model, SoD warn-only in complete_task"
```

---

### Task 4: `ApprovalPolicy` serializer, ViewSet, and URL

**Files:**
- Modify: `backend/workflow/serializers.py` — add `ApprovalPolicySerializer`
- Modify: `backend/workflow/views.py` — add `ApprovalPolicyViewSet`
- Modify: `backend/workflow/urls.py` — register router
- Test: `backend/workflow/tests/test_phase3_tasks_approvals.py`

**Interfaces:**
- Produces: `GET/POST /api/workflow/approval-policies/` (`auth.view_group` to read, `auth.change_group` to write — reusing group-admin permission as proxy for workflow config); `ApprovalPolicySerializer` exposes all model fields.

- [ ] **Step 1: Write failing test**

```python
@pytest.mark.django_db
def test_approval_policy_api_crud(admin_client):
    from django.urls import reverse
    url = "/api/workflow/approval-policies/"
    res = admin_client.post(url, {
        "document_type": "PURCHASE_ORDER",
        "min_amount": "50000.00",
        "required_permission": "purchasing.approve_purchaseorder",
        "forbid_self_approval": True,
        "approvals_required": 2,
    }, content_type="application/json")
    assert res.status_code == 201
    assert res.json()["document_type"] == "PURCHASE_ORDER"
```

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_approval_policy_api_crud -v`
Expected: FAIL — URL does not exist.

- [ ] **Step 2: Add `ApprovalPolicySerializer` to `backend/workflow/serializers.py`**

```python
from .models import ApprovalPolicy  # add to imports block

class ApprovalPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalPolicy
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]
```

- [ ] **Step 3: Add `ApprovalPolicyViewSet` to `backend/workflow/views.py`**

Add import: `from .models import ApprovalPolicy` and `from .serializers import ApprovalPolicySerializer`.

```python
class ApprovalPolicyViewSet(viewsets.ModelViewSet):
    queryset = ApprovalPolicy.objects.all()
    serializer_class = ApprovalPolicySerializer
    pagination_class = None

    action_permissions: dict = {}
```

- [ ] **Step 4: Register in `backend/workflow/urls.py`**

Find the router registrations and add:
```python
router.register(r"approval-policies", ApprovalPolicyViewSet, basename="approval-policy")
```

- [ ] **Step 5: Run test — expect PASS**

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/test_phase3_tasks_approvals.py::test_approval_policy_api_crud -v`
Expected: PASS.

- [ ] **Step 6: Run full workflow tests**

Run: `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/ -v`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add backend/workflow/serializers.py backend/workflow/views.py backend/workflow/urls.py backend/workflow/tests/test_phase3_tasks_approvals.py
git commit -m "feat(workflow): ApprovalPolicy ViewSet + API endpoint"
```

---

### Task 5: Frontend — Show assigned group on tasks + ApprovalPolicy settings panel

**Files:**
- Modify: `frontend/features/workflow/api/types.ts` — add `ApprovalPolicy` type
- Create: `frontend/features/workflow/api/approvalPolicies.ts` — API calls
- Create: `frontend/features/workflow/hooks/useApprovalPolicies.ts` — TanStack Query hooks
- Create: `frontend/features/settings/components/ApprovalPoliciesView.tsx` — settings panel

**Interfaces:**
- Consumes: `GET /api/workflow/approval-policies/` → `ApprovalPolicy[]`; `PUT/PATCH /api/workflow/approval-policies/{id}/` for edits; `POST` for creation.
- Produces: `useApprovalPolicies()` → `{ data: ApprovalPolicy[] | undefined, isLoading, error }`; `useSaveApprovalPolicy()` → TanStack mutation.

- [ ] **Step 1: Add `ApprovalPolicy` type to `frontend/features/workflow/api/types.ts`**

```typescript
export interface ApprovalPolicy {
  id: number
  document_type: string
  min_amount: string | null
  required_permission: string
  forbid_self_approval: boolean
  approvals_required: number
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Create `frontend/features/workflow/api/approvalPolicies.ts`**

```typescript
import api from "@/lib/api"
import type { ApprovalPolicy } from "./types"

export async function getApprovalPolicies(): Promise<ApprovalPolicy[]> {
  const { data } = await api.get("/workflow/approval-policies/")
  return data
}

export async function saveApprovalPolicy(
  payload: Partial<ApprovalPolicy> & { id?: number }
): Promise<ApprovalPolicy> {
  if (payload.id) {
    const { data } = await api.patch(`/workflow/approval-policies/${payload.id}/`, payload)
    return data
  }
  const { data } = await api.post("/workflow/approval-policies/", payload)
  return data
}

export async function deleteApprovalPolicy(id: number): Promise<void> {
  await api.delete(`/workflow/approval-policies/${id}/`)
}
```

- [ ] **Step 3: Create hooks in `frontend/features/workflow/hooks/useApprovalPolicies.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getApprovalPolicies,
  saveApprovalPolicy,
  deleteApprovalPolicy,
} from "../api/approvalPolicies"

export const APPROVAL_POLICIES_KEY = ["approval-policies"] as const

export function useApprovalPolicies() {
  return useQuery({ queryKey: APPROVAL_POLICIES_KEY, queryFn: getApprovalPolicies })
}

export function useSaveApprovalPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveApprovalPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: APPROVAL_POLICIES_KEY }),
  })
}

export function useDeleteApprovalPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteApprovalPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: APPROVAL_POLICIES_KEY }),
  })
}
```

- [ ] **Step 4: Create `frontend/features/settings/components/ApprovalPoliciesView.tsx`**

A simple list + inline form. Key pieces:
- Table of existing `ApprovalPolicy` rows: `document_type`, `approvals_required`, `forbid_self_approval`, `required_permission`.
- "Nueva política" button → opens a `<Dialog>` with a `<Form>` (react-hook-form + zodResolver).
- Schema in `ApprovalPoliciesView.schema.ts` (or inline):
  ```typescript
  const approvalPolicySchema = z.object({
    document_type: z.string().min(1, "Requerido"),
    min_amount: z.string().optional(),
    required_permission: z.string().default(""),
    forbid_self_approval: z.boolean().default(false),
    approvals_required: z.number().int().min(1).default(1),
  })
  ```
- `Can permission="auth.change_group"` wraps add/edit/delete actions.
- Use `useApprovalPolicies`, `useSaveApprovalPolicy`, `useDeleteApprovalPolicy`.
- Table uses `<Table>` from `@/components/ui/table`; empty state uses `<EmptyState>` from `@/components/shared`.

The panel shows a `loading` skeleton, `error` state, and `empty` state.

- [ ] **Step 5: Export hooks + types from workflow feature barrel**

In `frontend/features/workflow/index.ts` (or equivalent barrel), add exports for `useApprovalPolicies`, `useSaveApprovalPolicy`, `useDeleteApprovalPolicy`, `ApprovalPolicy` type.

- [ ] **Step 6: Wire panel into settings**

Find where settings tabs are defined (likely `frontend/features/settings/` or `frontend/app/(dashboard)/settings/`). Add an "Aprobaciones" tab or section that renders `<ApprovalPoliciesView />`. Use `Can permission="auth.change_group"` to guard the settings entry.

- [ ] **Step 7: Type-check and lint**

Run: `cd frontend && npm run type-check`
Expected: 0 errors.

Run: `cd frontend && npm run lint`
Expected: 0 new errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/features/workflow/ frontend/features/settings/
git commit -m "feat(frontend): ApprovalPolicy settings panel + workflow types"
```

---

## Completion Contract

Before marking this plan complete:
- All 5 tasks committed to `master` (or current branch).
- `CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest backend/workflow/tests/ -v` — all pass.
- `cd frontend && npm run type-check` — 0 errors.
- Migration chain `0014` → `0015` runs cleanly on the dev server.
- `TaskAssignmentRule.assigned_group` is now a FK, no `candidate_group` in `task.data` for new tasks.
- `ApprovalPolicy` is accessible at `/api/workflow/approval-policies/`.
