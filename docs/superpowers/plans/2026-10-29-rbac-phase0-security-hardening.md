# RBAC Fase 0 — Endurecimiento de seguridad · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar todos los accesos verificados que hoy permiten a cualquier usuario autenticado (o anónimo) escalar privilegios, ejecutar operaciones contables o leer información sensible (C1, C2, C4, C5, C6, F1–F7, datos de la empresa), y dejar los permisos registrados de forma confiable y sincronizados automáticamente al desplegar.

**Architecture:** Correcciones dentro de los patrones actuales:

- un serializer restringido para `/me`;
- `StandardizedModelPermissions` en los ViewSets que hoy usan `IsAuthenticated`;
- una fábrica `require_perms()` para las vistas que no tienen modelo;
- un servicio que protege los roles del sistema;
- un `PermissionRegistry` corregido, que sincroniza en `post_migrate` sin quitar nada;
- un test de invariante que impide referenciar permisos inexistentes.

C3 (acciones de negocio) se resuelve en la Fase 1.

**Tech Stack:** Django 5, DRF, pytest-django.

**Spec:** [`docs/superpowers/specs/2026-10-29-rbac-design.md`](../specs/2026-10-29-rbac-design.md) §1.1–1.2.

## Global Constraints

- Comando de tests (local, sin Docker): `cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -v`.
- **Línea base:** antes de la Task 1, ejecutar la suite completa en `master` y guardar el resumen en el PR. "Sin fallos nuevos" significa: la misma lista de fallos que la línea base (ver §Línea base).
- Vistas ≤ 20 líneas por acción; la lógica va en `services.py` (invariante 10).
- No usar `is_staff` ni nombres de usuario para controlar acceso (playbook `add-role-permission.md`).
- Los permisos nuevos se registran con `PermissionRegistry.register` en `AppConfig.ready()` o en `Meta.permissions`, nunca en el admin de Django.
- Nombres de los roles del sistema: `Roles.ADMIN`, `Roles.MANAGER`, `Roles.OPERATOR`, `Roles.READ_ONLY` (`backend/core/permissions.py`).
- La plantilla `OPERATOR` de `sync_permissions` se ajusta **en la misma tarea** que cierra un endpoint que el operador usa. Estos ajustes son **provisorios**: la Fase 1 reemplaza los 4 roles antiguos por puestos compuestos de paquetes (spec §2.1). En esta fase no se rediseñan roles; solo se evita romper lo que hoy funciona.
- Ninguna tarea ejecuta `sync_permissions` en el servidor de desarrollo, porque hasta la Fase 1 hace `.set()` y pisa los roles. La sincronización se hace con `migrate` (Task 4).
- Rama: `fix/rbac-phase0-hardening` desde `master`.

## Línea base

Medida el 2026-10-29 sobre `fix/reopen-stages-governance`: ver la nota al final del documento. El ejecutor la vuelve a medir sobre `master` en el Step 0.

- [ ] **Step 0:** `cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest -q -p no:cacheprovider 2>&1 | tail -40 > /tmp/rbac-baseline.txt`. Guardar en el PR la lista de tests que fallan.

## Review Focus

- **PATCH a `/me` con campos prohibidos mezclados con `theme`:** el tema se guarda y `groups`/`is_active`/`username`/`contact` no cambian. Test en Task 1 (`test_me_patch_mixed_payload_only_applies_theme`).
- **Un ADMIN intenta borrar un rol del sistema:** se rechaza con 400, aunque tenga el permiso. Test en Task 2 (`test_admin_cannot_delete_system_role`).
- **Selector de grupos en pantallas de operador:** `GroupSelector` sigue funcionando para OPERATOR después de cerrar `GroupViewSet`. Test en Task 2 (`test_operator_template_can_list_groups`).
- **Despliegue sin pasos manuales:** después de `migrate`, los permisos nuevos (`sales.approve_credit`, `hr.view_dashboard_hr`, …) existen y el rol `ADMIN` los tiene, sin que se pierdan permisos agregados a mano en otros roles. Test en Task 4 (`test_post_migrate_sync_is_additive`).
- **Pantallas que leen configuración o el estado de períodos:** `GET /api/workflow/settings/current/` y `check_closed` siguen disponibles para cualquier usuario autenticado; solo la escritura y el acceso anónimo se cierran. Tests en Task 6.

---

### Task 1: `/me` no permite cambiar roles ni estado (C1)

**Files:**
- Create: `backend/core/tests/rbac_factories.py`
- Create: `backend/core/tests/test_rbac_hardening.py`
- Modify: `backend/core/serializers/__init__.py` (agregar `MeSerializer` después de `UserSerializer`)
- Modify: `backend/core/views.py:74-96` (`CurrentUserView` usa `MeSerializer` en `get` y `patch`)

**Interfaces:**
- Produces: `make_user(username: str, *perms: str, groups: tuple[str, ...] = ()) -> User`. Los `perms` vienen en formato `"app_label.codename"`; la función crea los grupos que falten. Si un codename tiene más de un `Permission` (duplicados, ver Task 3), los asigna todos. La usan todas las tareas siguientes y la Fase 1.
- Produces: `MeSerializer(UserSerializer)`. Mismos campos y misma forma de respuesta (el frontend la consume en `authApi.getMe` y `ordersApi`); el único campo que se puede escribir es `theme`. La contraseña y el PIN tienen sus propios endpoints, y el frontend solo envía `{theme}` (`features/profile/api/profileApi.ts:20`).

- [ ] **Step 1: Write the failing tests** en `test_rbac_hardening.py`

```python
@pytest.mark.django_db
@pytest.mark.parametrize("url", ["/api/auth/user/", "/api/core/auth/me/"])
def test_me_patch_cannot_change_groups(url):
    Group.objects.get_or_create(name=Roles.ADMIN)
    user = make_user("op", groups=(Roles.OPERATOR,))
    client = APIClient(); client.force_authenticate(user)
    client.patch(url, {"groups": [Roles.ADMIN], "is_active": False}, format="json")
    user.refresh_from_db()
    assert list(user.groups.values_list("name", flat=True)) == [Roles.OPERATOR]
    assert user.is_active is True

@pytest.mark.django_db
def test_me_patch_mixed_payload_only_applies_theme():
    user = make_user("op", groups=(Roles.OPERATOR,))
    client = APIClient(); client.force_authenticate(user)
    r = client.patch("/api/core/auth/me/", {"theme": "dark", "username": "root", "groups": [Roles.ADMIN]}, format="json")
    user.refresh_from_db()
    assert r.status_code == 200
    assert (user.theme, user.username) == ("dark", "op")
    assert r.data["groups"] == [Roles.OPERATOR]
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_rbac_hardening.py -v` — Expected: FAIL; los casos parametrizados terminan con `groups == ['ADMIN']`.
- [ ] **Step 3: Implement `MeSerializer`** con `Meta(UserSerializer.Meta)` y `read_only_fields` igual a todos los campos menos `theme`. Cambiar `CurrentUserView` para que lo use.
- [ ] **Step 4: Run** — Expected: PASS (3 tests).
- [ ] **Step 5: Commit** — `fix(core): /auth/me solo permite editar el tema (cierra escalada de rol)`

---

### Task 2: Roles con permiso de modelo y roles del sistema protegidos (C2)

**Files:**
- Modify: `backend/core/views.py:206-214` (`GroupViewSet`: quitar `permission_classes`; `queryset = Group.objects.annotate(user_count=Count("user"))`; `perform_update` y `perform_destroy` llaman al servicio)
- Modify: `backend/core/serializers/__init__.py` (`GroupSerializer.user_count = IntegerField(read_only=True)` lee la anotación; hoy usa `source="user_set.count"`, que hace una consulta por grupo, lo que viola el invariante 14)
- Modify: `backend/core/services/__init__.py` (agregar la clase `GroupService`)
- Modify: `backend/core/management/commands/sync_permissions.py` (agregar `"view_group"` a `operator_codenames`)
- Test: `backend/core/tests/test_rbac_hardening.py`

**Interfaces:**
- Produces: `GroupService.SYSTEM_ROLES: frozenset[str]` = `{Roles.ADMIN, Roles.MANAGER, Roles.OPERATOR, Roles.READ_ONLY}`.
- Produces: `GroupService.validate_mutable(group: Group, new_name: str | None = None) -> None`. Lanza `rest_framework.exceptions.ValidationError` si `group.name` está en `SYSTEM_ROLES` y se intenta borrar el grupo (`new_name is None`) o cambiarle el nombre (`new_name != group.name`).

- [ ] **Step 1: Write the failing tests**

```python
def test_operator_cannot_create_rename_or_delete_groups():  # 403, 403, 403; ADMIN sigue existiendo
def test_admin_cannot_delete_system_role():                  # usuario con auth.delete_group → DELETE ADMIN == 400
def test_admin_cannot_rename_system_role():                  # PATCH name="X" sobre OPERATOR == 400
def test_admin_can_create_and_delete_team_group():           # POST "Imprenta" == 201; DELETE == 204
def test_operator_template_can_list_groups():                # call_command("sync_permissions"); OPERATOR → GET /api/core/groups/ == 200
def test_group_list_query_count():                           # 10 grupos → GET con django_assert_max_num_queries(3)
```

El usuario "admin" de estos tests tiene `auth.add_group`, `auth.change_group`, `auth.delete_group` y `auth.view_group`, sin ser superusuario.

- [ ] **Step 2: Run** `... -k group -v` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS (6 tests).
- [ ] **Step 5: Commit** — `fix(core): roles exigen permisos auth.*_group; roles del sistema inmutables; sin N+1 en user_count`

---

### Task 3: `PermissionRegistry` confiable: sin duplicados y con permisos de apps sin modelos (F6)

**Problema verificado:**

- `PermissionRegistry.sync_to_db` cuelga cada permiso del content type del "modelo settings, o el primero de la app". Si la app no tiene modelos, usa el de `User` (app `core`). Por eso `finances.view_dashboard_finances` se guarda como **`core.`**`view_dashboard_finances`, nunca se cumple, y **el módulo Finanzas queda oculto para quien no es ADMIN** (en desarrollo: el permiso registrado no está en la base).
- `tax/apps.py` vuelve a registrar los permisos por defecto de `TaxPeriod` y `AccountingPeriod` sobre otro content type. En desarrollo hay **6 permisos `tax.*_accountingperiod` duplicados**.

**Files:**
- Modify: `backend/core/permissions.py` (`sync_to_db`)
- Create: `backend/finances/models.py` → modelo `FinancesPermissions` (`managed=False`, `default_permissions=()`, `Meta.permissions=[("view_dashboard_finances", "Can view finances dashboard")]`); `backend/finances/migrations/0003_financespermissions.py`
- Modify: `backend/finances/apps.py` (quitar el registro, que ahora vive en `Meta.permissions`)
- Modify: `backend/tax/apps.py:15-31` (quitar los 12 registros: todos existen como permisos por defecto o en `Meta.permissions` de `tax/models.py:59,141`)
- Create: `backend/core/migrations/0014_merge_duplicate_permissions.py` (`RunPython`: para cada `(app_label, codename)` repetido, conservar el `Permission` del content type del modelo correspondiente, pasar a él las relaciones de `Group.permissions` y `User.user_permissions`, y borrar el resto; reversa: noop)
- Test: `backend/core/tests/test_permission_registry.py`

**Interfaces:**
- Produces: `PermissionRegistry.sync_to_db() -> int`. Si ya existe un `Permission` con ese `content_type__app_label` y `codename`, no crea otro. Si la app no tiene modelos, lanza `ImproperlyConfigured("{app}: usa un modelo de permisos (managed=False) en vez de PermissionRegistry")`.

- [ ] **Step 1: Write the failing tests**

```python
def test_registry_does_not_duplicate_model_permissions():  # registrar ("view_taxperiod",...) en "tax" + sync → Permission.objects.filter(content_type__app_label="tax", codename="view_taxperiod").count() == 1
def test_finances_dashboard_permission_has_finances_label():  # user con ese Permission → has_perm("finances.view_dashboard_finances") True
def test_merge_duplicates_keeps_group_assignments():          # MigrationExecutor: crear duplicado asignado a un grupo → tras migrar, 1 Permission y el grupo conserva has_perm
def test_registry_rejects_app_without_models():               # app sin modelos → ImproperlyConfigured
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_permission_registry.py -v` — Expected: FAIL.
- [ ] **Step 3: Implement.** Agregar `python manage.py makemigrations finances` y la migración de datos de `core` (dependencias: la última de `tax`, la de `finances` y `auth`).
- [ ] **Step 4: Run** el archivo, más `makemigrations --check --dry-run` → "No changes detected". Expected: PASS.
- [ ] **Step 5: Commit** — `fix(rbac): PermissionRegistry sin duplicados; permiso de Finanzas con su app correcta`

---

### Task 4: Sincronización automática y aditiva al migrar (F7)

**Problema verificado:** `sync_permissions` no se ejecuta en `entrypoint.sh` (solo `migrate`), y lo único que lo llama es `setup_demo_data`. Los permisos que se registran con `PermissionRegistry` **no llegan a la base** al desplegar. Este plan y la Fase 1 agregan decenas de ellos; sin esta tarea, solo el superusuario podría usarlos.

**Files:**
- Modify: `backend/core/signals.py` (nuevo receptor `post_migrate`)
- Test: `backend/core/tests/test_permission_registry.py`

**Interfaces:**
- Produces: un receptor `sync_registered_permissions(sender, **kwargs)` que se ejecuta una vez por `migrate` (solo cuando `sender.name == "core"`). Llama a `PermissionRegistry.sync_to_db()` y luego `Group.objects.get(name=Roles.ADMIN).permissions.add(*Permission.objects.all())` si el grupo existe. **No quita nada** ni toca otros roles.

- [ ] **Step 1: Write the failing tests**

```python
def test_post_migrate_creates_registered_permissions():  # call_command("migrate", verbosity=0) → Permission sales.approve_credit existe (depende de la Task 5; mientras tanto usar un registro de prueba)
def test_post_migrate_sync_is_additive():                # OPERATOR con permiso extra manual; migrate → lo conserva; ADMIN recibe el nuevo
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(rbac): sincronizar permisos registrados en post_migrate (aditivo)`

---

### Task 5: Ningún permiso referenciado sin existir (F2, F3, F4)

**Files:**
- Create: `backend/core/tests/test_permission_references.py`
- Modify: `backend/sales/apps.py:12-19` (registrar `("approve_credit", "Puede aprobar crédito directo en caja")`)
- Modify: `backend/hr/apps.py` (agregar `PermissionRegistry.register("hr", [("view_dashboard_hr", "Can view HR dashboard")])` con el mismo `try/except ImportError` que las demás apps)
- Modify: `backend/treasury/apps.py:12-17` (registrar `("purge_treasurymovement", "Puede purgar movimientos anulados")`)
- Modify: `backend/treasury/views.py:387-393` (cambiar `request.user.is_staff` por `request.user.has_perm("treasury.purge_treasurymovement")`)
- Modify: `backend/core/management/commands/sync_permissions.py` (quitar `view_tax`, `view_pricelist` y `view_cashbox`; corregir `view_employeconceptamount` a `view_employeeconceptamount`)
- Modify: `frontend/features/orders/__tests__/orderSheet.test.ts` (cambiar `treasury.add_payment` por `treasury.add_treasurymovement`)
- Modify: `docs/20-contracts/deletion-policy.md`, si menciona `is_staff` para purgar

**Interfaces:**
- Consumes: el registro corregido (Task 3).
- Produces: `permission_catalog() -> set[str]` en `test_permission_references.py`, con formato `"app_label.codename"`. Se construye con `apps.get_models()` (permisos por defecto más `Meta.permissions`) y `PermissionRegistry.get_registered_permissions()`, sin consultar la base. Como la Task 3 rechaza apps sin modelos, la etiqueta del registro coincide con la real. La Fase 1 lo traslada a `core/rbac/catalog.py`.

- [ ] **Step 1: Write the failing tests**

```python
def test_backend_has_perm_literals_exist():          # has_perm\(["']([\w.]+)["'] sobre backend/**/*.py (excluye venv, migrations, tests, scripts)
def test_registry_permission_literals_exist():       # permission=["']...["'] en SearchableEntity/registros (hoy 39, todos válidos: congela el estado)
def test_operator_template_codenames_exist():        # operator_codenames (ast sobre sync_permissions.py; la Fase 1 Task 4 lo cambia a templates.py)
def test_frontend_permission_literals_exist():       # ['"]([a-z_]+\.(?:view|add|change|delete|approve|override|can|annul|confirm|purge|cancel|close|reopen|post|pay|export|write_off|dispatch|receive)_[a-z_]+)['"] sobre frontend/{app,features,components,lib,hooks,contexts}/**/*.{ts,tsx}, incluidos los tests
def test_no_is_staff_access_checks():                # ningún "is_staff" en backend/*/views.py ni */services.py
```

Las rutas al frontend se resuelven desde `settings.BASE_DIR.parent / "frontend"`, como en `test_search_routes_match_app_router`.

- [ ] **Step 2: Run** `... -m pytest core/tests/test_permission_references.py -v`. Expected: FAIL, con `missing` igual a:
  - backend: `{'sales.approve_credit'}`;
  - operador: `{'view_tax','view_pricelist','view_cashbox','view_employeconceptamount','view_dashboard_hr'}`;
  - frontend: `{'hr.view_dashboard_hr','sales.approve_credit','treasury.add_payment'}`;
  - una aparición de `is_staff`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el archivo y `cd frontend && npm run test -- features/orders/__tests__/orderSheet.test.ts` (Node 24 vía nvm). Expected: PASS.
- [ ] **Step 5: Commit** — `fix(rbac): registrar permisos referenciados y test de referencias`

---

### Task 6: Permisos en `tax` y en la configuración de workflow; reparar la lista de reglas (F1, F5)

**Files:**
- Modify: `backend/tax/views.py:36,88,171,210` (quitar `permission_classes=[IsAuthenticated]`); `:76,:256` (`check_closed`: de `AllowAny` a `IsAuthenticated`)
- Modify: `backend/workflow/views.py`:
  - `:114-117`: `select_related("assigned_user")` y quitar `permission_classes`;
  - `:120-145`: en `WorkflowSettingsViewSet.get_permissions`, un GET de `current` solo exige `IsAuthenticated` y el resto usa el valor por defecto, igual que `SalesSettingsViewSet.get_permissions` en `backend/sales/views.py:31`;
  - `:147-156`: quitar `permission_classes`.
- Modify: `backend/core/management/commands/sync_permissions.py` (operador: `view_taxperiod`, `view_accountingperiod`)
- Test: `backend/workflow/tests/test_workflow_config_permissions.py`, `backend/tax/tests/test_tax_permissions.py`

**Interfaces:**
- `TaskViewSet` y `NotificationViewSet` **se mantienen** con `IsAuthenticated`: son la bandeja personal, filtrada por fila. Se deja el comentario `# Personal inbox: row-level filtering in selector (ADR-0104)`.
- Las fixtures de `tax/tests/conftest.py` usan un superusuario, así que no se ven afectadas. `workflow/tests/conftest.py` y `tax/tests/test_documents.py` usan `create_user` sin permisos: si fallan, se les agrega el permiso de modelo en la fixture.

- [ ] **Step 1: Write the failing tests**

```python
def test_assignment_rules_list_returns_200_for_authorized_user():   # con workflow.view_taskassignmentrule → 200 (hoy: 500)
def test_operator_cannot_modify_assignment_or_notification_rules(): # POST/PATCH → 403
def test_workflow_settings_current_get_open_write_guarded():        # GET sin permisos → 200; PATCH → 403; con change_workflowsettings → 200
def test_f29_declaration_requires_model_permission():               # sin tax.view_f29declaration → 403
def test_check_closed_requires_authentication():                    # anónimo → 401; autenticado → 200
```

- [ ] **Step 2: Run** `... -m pytest workflow/tests/test_workflow_config_permissions.py tax/tests/test_tax_permissions.py -v` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `... -m pytest workflow tax core -q` — Expected: PASS, sin fallos nuevos respecto de la línea base.
- [ ] **Step 5: Commit** — `fix(rbac): permisos de modelo en tax y en la configuración de workflow; reparar la lista de reglas`

---

### Task 7: Eliminar el endpoint genérico de acciones documentales (C5)

**Problema verificado:** `POST /api/core/documents/<content_type_id>/<object_id>/<action>/` (`backend/core/api/document.py`):

- solo exige `IsAuthenticated`;
- resuelve el método **por nombre**, con `getattr(service, action)`;
- reenvía `request.data` como argumentos.

Con eso, cualquier usuario puede **confirmar o cancelar órdenes de venta y de compra**, incluidos sus asientos contables (`SaleOrderService`, `PurchaseOrderService`). Además, si el objeto no existe responde 404 y si existe responde 400, lo que permite saber qué documentos existen. **Nada lo usa**: no hay referencias en el frontend, en tests ni en los docs.

**Files:**
- Delete: `backend/core/api/document.py`
- Modify: `backend/core/urls.py:4,54-58` (quitar el import y la ruta `document-action`)
- Test: `backend/core/tests/test_rbac_hardening.py`

- [ ] **Step 1: Write the failing test** — `test_generic_document_action_endpoint_removed`: `reverse("document-action", ...)` lanza `NoReverseMatch`, y `POST /api/core/documents/1/1/confirm/` responde 404.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** el borrado, siguiendo `docs/30-playbooks/deprecate-feature.md` (sin consumidores, se borra directamente).
- [ ] **Step 4: Run** `... -m pytest core -q` — Expected: PASS.
- [ ] **Step 5: Commit** — `fix(core): eliminar el endpoint genérico de acciones documentales (sin control de permisos)`

---

### Task 8: Permisos en las vistas sin modelo (C6)

**Problema verificado:** en las vistas sin `queryset`, `StandardizedModelPermissions` y `IsAuthenticated` solo exigen sesión. Hoy cualquier usuario autenticado puede:

| Vista | Qué expone | Permiso requerido |
|---|---|---|
| `GlobalAuditLogView` (`core/views.py:258`) | bitácora global de todos los módulos | `core.view_actionlog` |
| `finances/views.py`: `get_balance_sheet_data`, `get_income_statement_data`, `get_trial_balance_data`, `get_cash_flow_data`, `get_financial_analysis_data`, `get_bi_analytics_data`, `get_report_status_data` | estados financieros completos | `finances.view_dashboard_finances` |
| `GlobalHRSettingsViewSet` (`hr/views.py:50`) | lectura **y escritura** de los parámetros previsionales globales | GET: `hr.view_globalhrsettings`; PATCH: `hr.change_globalhrsettings` |
| `TreasuryDashboardViewSet` (`treasury/views.py:1030`) | `list`, `stats`, `accounts`, `future_maturities`; **`register_transfer` (POST, mueve dinero)** | lectura: `treasury.view_dashboard_treasury`; `register_transfer`: `treasury.add_treasurymovement` |

Las demás vistas sin modelo (`CurrentUserView`, `MyProfile*`, `ChangePassword/Pin`, `UserPreferenceView`, `universal_search` y `document_ref`/`document_relations`, que filtran por permiso, `server_time`, `system_status`, `entity_prefixes`, `entity_config`, `logout_view` y `PricingViewSet.effective_sale_price`, que usa el POS) son personales o públicas para usuarios autenticados, **y así se mantienen**.

**Files:**
- Modify: `backend/core/api/permissions.py` (agregar `require_perms`; borrar `HasActionPermission`, que deja pasar a todos cuando no hay permiso declarado y no tiene consumidores, y su mención en el playbook)
- Modify: las vistas de la tabla (`permission_classes = [require_perms(...)]`; los ViewSets con permisos distintos por acción sobrescriben `get_permissions`)
- Sin cambios en la plantilla del operador: ya tiene `view_dashboard_treasury` y `view_globalhrsettings`, y **no** recibe `view_dashboard_finances` ni `core.view_actionlog`.
- Test: `backend/core/tests/test_modelless_view_permissions.py`

**Interfaces:**
- Produces: `require_perms(*perms: str) -> type[BasePermission]`. Devuelve una clase cuya `has_permission` es `request.user.is_authenticated and request.user.has_perms(perms)`. Se usa como `permission_classes = [require_perms("core.view_actionlog")]` o `@permission_classes([require_perms(...)])`. La Fase 1 la reutiliza.

- [ ] **Step 1: Write the failing tests**

```python
@pytest.mark.parametrize("method, url", MODEL_LESS_GUARDED)   # cada fila de la tabla (finanzas con sus URLs reales de finances/urls.py)
def test_modelless_view_denies_user_without_permission(method, url):   # usuario autenticado sin permisos → 403
def test_modelless_view_allows_user_with_permission():                 # muestra: audit log con core.view_actionlog → 200
def test_treasury_transfer_requires_add_movement():                    # POST register_transfer sin permiso → 403
def test_hr_global_settings_patch_requires_change():                   # con view → GET 200, PATCH 403
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_modelless_view_permissions.py -v` — Expected: FAIL (hoy 200 o 400 por validación).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `... -m pytest core finances hr treasury -q` — Expected: sin fallos nuevos respecto de la línea base.
- [ ] **Step 5: Commit** — `fix(rbac): exigir permisos en reportes, bitácora, parámetros RRHH y dashboard de tesorería`

---

### Task 9: Sin sesión, solo nombre y logo de la empresa

**Problema verificado:** `CompanySettingsViewSet.get_permissions` (`backend/core/views.py:238`) usa `AllowAny` para `GET /api/core/company/current/`, con `CompanySettingsSerializer` (`fields="__all__"`). Así, **sin sesión** se obtienen RUT, dirección, teléfono, email, actividad económica y contacto. La marca solo necesita `name`, `trade_name` y `logo`: la usan `BrandingProvider` en el login, las páginas 404, la barra lateral, la búsqueda, los recibos POS y `BankAccountsSection`.

**Decisión del usuario (2026-10-29):** sin sesión, solo nombre y logo.

**Files:**
- Modify: `backend/core/serializers/__init__.py` (agregar `PublicCompanyBrandingSerializer` con `fields = ["name", "trade_name", "logo", "logo_url"]`)
- Modify: `backend/core/views.py` (`CompanySettingsViewSet`: nueva acción `@action(detail=False, methods=["get"], url_path="branding", permission_classes=[AllowAny]) branding`; `current` deja de usar `AllowAny`: GET con `IsAuthenticated`, escritura con permisos de modelo)
- Modify: `frontend/features/settings/api/settingsApi.ts` (agregar `getCompanyBranding()` → `GET /core/company/branding/` con el tipo `CompanyBranding`) y `frontend/contexts/BrandingProvider.tsx` (usa `getCompanyBranding`, a través de un hook `useCompanyBranding` en `features/settings/hooks/`, con query key propia)
- Test: `backend/core/tests/test_rbac_hardening.py`, `frontend/contexts/__tests__/BrandingProvider.test.tsx`

**Interfaces:**
- Produces: `GET /api/core/company/branding/` → `{"name": str, "trade_name": str, "logo": str | null, "logo_url": str}`, sin autenticación.
- `GET /api/core/company/current/` exige sesión. `CompanySettingsView` (configuración) lo sigue usando con `useCompanySettings`.

- [ ] **Step 1: Write the failing tests**

```python
def test_branding_is_public_and_minimal():          # anónimo → 200; set(r.data) == {"name","trade_name","logo","logo_url"}
def test_company_current_requires_authentication():  # anónimo → 401; autenticado → 200 con tax_id
```

Y en el frontend: `BrandingProvider` solicita `/core/company/branding/` (mock de `settingsApi.getCompanyBranding`) y expone `company.name` y `logo`.

- [ ] **Step 2: Run** `... -m pytest core/tests/test_rbac_hardening.py -k "branding or company_current" -v` y `cd frontend && npm run test -- contexts` — Expected: FAIL.
- [ ] **Step 3: Implement.** El tipo `company` que expone `useBranding()` pasa a ser `CompanyBranding`. Si `type-check` muestra algún consumidor que lee otro campo, ese consumidor cambia a `useCompanySettings` (hoy no hay ninguno).
- [ ] **Step 4: Run** los tests, `npm run type-check` y `npm run lint`. Expected: PASS. En el servidor de desarrollo, la pantalla de login muestra nombre y logo, y la pestaña Network muestra que no se pidió `company/current`.
- [ ] **Step 5: Commit** — `fix(core): sin sesión solo se exponen nombre y logo de la empresa`

---

## Cierre de fase

- [ ] `cd backend && venv/bin/ruff check .` sin errores nuevos.
- [ ] Suite completa: sin fallos nuevos respecto de la línea base.
- [ ] En el servidor de desarrollo (Mutagen `Connected: Yes`): `docker compose exec -T backend python manage.py migrate`. Con un usuario OPERATOR, verificar en el navegador:
  - RRHH y Finanzas visibles **solo si** el rol tiene el permiso del módulo;
  - la bandeja de tareas, la facturación (`check_closed`) y el selector de grupos sin errores 403 ni 500;
  - la bitácora global devuelve 403.
- [ ] PR `fix/rbac-phase0-hardening` → `master` que referencie #188. C1, C2 y C5 se describen sin incluir payloads explotables.

---

## Nota: línea base medida al escribir el plan

Ejecución local del 2026-10-29 sobre la rama `fix/reopen-stages-governance`: **14 failed, 900 passed, 3 skipped** (4 min 17 s). Ninguno de los fallos está relacionado con permisos:

- `core`: `test_views_under_20_lines`, `test_all_business_models_inherit_timestampedmodel`, `TestProductionNPlusOne::test_work_order_list`
- `production/tests/test_edit_in_place.py`: 2 (`update_mfg_section_*_blocked_when_started`)
- `production/tests/test_flow_audit_regressions.py`: 4
- `production/tests/test_serializers.py`: 5

Hay que volver a medir sobre `master` (Step 0): esta rama tiene trabajo de producción en curso que puede explicar los fallos de `production`.
