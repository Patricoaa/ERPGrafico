# RBAC Fase 1 — Base del backend · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada acción de negocio exija un permiso explícito (C3), reemplazar los 4 roles antiguos por puestos de trabajo compuestos de paquetes de acceso (spec §2.1), y que el backend exponga el catálogo y la edición de roles que consumirá la Fase 2.

**Architecture:**

- `StandardizedModelPermissions` lee un mapa `action_permissions` en cada ViewSet. Un test de cobertura con lista de excepciones obliga a declararlo para toda acción de escritura nueva.
- El paquete `core/rbac/` concentra:
  - el catálogo de permisos;
  - los **paquetes de acceso** (definidos en código: niveles por módulo y capacidades sensibles);
  - los **puestos sembrados** y el servicio de roles.
- `GroupProfile` marca cada `Group` como `ROLE` o `TEAM` y guarda la **composición** del rol (paquetes, permisos agregados y excluidos). `Group.permissions` es solo el resultado materializado de esa composición, y se recalcula en cada migración.
- Los endpoints nuevos se montan sobre `GroupViewSet` y en `core/api/rbac.py`.
- Un ajuste mínimo del frontend (Task 8) deja de depender de los nombres de los roles antiguos.

**Tech Stack:** Django 5, DRF, pytest-django.

**Spec:** [`docs/superpowers/specs/2026-10-29-rbac-design.md`](../specs/2026-10-29-rbac-design.md) §2 (decisiones) y §2.1 (modelo de roles).

**Entrega:** la Fase 1 se mergea en un solo PR. Entre la Task 3 y la Task 6, los roles antiguos no reciben los permisos de negocio nuevos (por ejemplo, `OPERATOR` no puede confirmar), y eso solo es aceptable porque nada de la fase se despliega por separado.

**Prerrequisito:** la Fase 0 está mergeada. Usa de ella `make_user`, `GroupService`, `permission_catalog()`, `require_perms()`, el `PermissionRegistry` corregido y la sincronización en `post_migrate`.

## Global Constraints

- Comando de tests: `cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -v`.
- Verbos de negocio cerrados: `confirm`, `annul`, `cancel`, `post`, `reverse`, `pay`, `write_off`, `dispatch`, `receive`, `close`, `reopen`, `approve`, `override`, `purge`, `export`. Codename: `{verbo}_{model_name}`.
- Al cerrar la fase, **toda** acción de escritura declara `action_permissions`. La lista de excepciones de la Task 2 es temporal y la Task 3c la elimina.
- Los permisos de negocio se registran con `PermissionRegistry` (sin migraciones) y llegan a la base al ejecutar `migrate` (Fase 0, Task 4). Los de `tax` y `accounting` que ya existen en `Meta.permissions` se reutilizan, no se duplican.
- **Ningún usuario puede otorgar permisos que no tiene** (regla de no escalada): asignar un rol a un usuario o editar los permisos de un rol exige que el actor tenga todos los permisos involucrados, salvo que sea superusuario. Nadie puede cambiar sus propios roles.
- Cada tarea que cambia el permiso de una acción alinea en el mismo PR el `requiredPermissions` del registro de acciones del frontend (Task 3d). Así no aparecen botones que terminan en 403.
- Las migraciones de `core` de esta fase van después de `0014_merge_duplicate_permissions` (Fase 0).
- Cambiar un contrato exige un ADR (invariante 12). El ADR-0104 se escribe en la Task 9, antes del PR.
- Las migraciones siguen `docs/30-playbooks/add-migration.md`.
- Vistas ≤ 20 líneas; la lógica va en `core/rbac/services.py`.
- Cada cambio de permisos de un rol o de roles de un usuario genera `ActionLog(action_type=ActionLog.Type.SECURITY)` con `metadata={"added": [...], "removed": [...]}`.

## Review Focus

- **Un permiso nuevo que se agrega en una versión futura** (por ejemplo, un `export_*`) llega automáticamente a los puestos que tienen el paquete correspondiente al ejecutar `migrate`, sin pasos manuales. Además, CI falla si queda un permiso sin paquete. Tests en Task 4 (`test_every_curated_permission_belongs_to_a_bundle`) y Task 5 (`test_new_permission_flows_to_roles_on_migrate`).
- **Un puesto editado por el usuario** (paquetes agregados, permisos sueltos agregados o excluidos) no se pierde al migrar ni al volver a sembrar los puestos. Test en Task 5 (`test_materialization_preserves_role_customization`).
- **Grupos de desarrollo con nombres arbitrarios** ("Pre-Prensa", "Administración"): la migración los clasifica como `TEAM` si no tienen permisos, sin perder nada. Test en Task 5 (`test_backfill_classifies_existing_groups`).
- **Usuarios con roles antiguos (`ADMIN`/`MANAGER`/`OPERATOR`/`READ_ONLY`):** `rbac_migrate_legacy_roles --plan` propone un puesto para cada uno sin modificar nada, y `--apply` no deja a ningún usuario activo sin rol. Test en Task 6 (`test_apply_leaves_no_active_user_without_role`).
- **Asignar permisos a un `TEAM` o editar el puesto del sistema:** se rechaza con 400 y un mensaje claro. Test en Task 7 (`test_cannot_edit_team_or_system_role_permissions`).
- **Payload con un paquete o código inexistente o de ruido** (`core.view_historicaluser`): se rechaza con 400 y la respuesta enumera los inválidos. Test en Task 7 (`test_put_rejects_unknown_bundles_or_codes`).
- **Un usuario con `core.change_user` intenta darse a sí mismo o a otro un puesto con permisos que no tiene:** 403. Test en Task 7 (`test_user_cannot_grant_permissions_they_lack`).
- **Asignar a una persona dos puestos incompatibles** (por ejemplo Compras y pagos de Tesorería): se permite, pero la respuesta incluye `sod_warnings` y queda un `ActionLog` SECURITY. Test en Task 7 (`test_sod_conflict_warns_and_audits`).
- **Grupos creados fuera de la API** (`setup_demo_data`, admin, `get_or_create` en servicios): tienen un perfil `TEAM` por defecto y el código no falla por `Group.profile` inexistente. Test en Task 5 (`test_group_created_outside_api_gets_team_profile`).

---

### Task 1: `action_permissions` en el permiso por defecto

**Files:**
- Modify: `backend/core/api/permissions.py` (`StandardizedModelPermissions.has_permission`)
- Test: `backend/core/tests/test_action_permissions.py`

**Interfaces:**
- Produces: un atributo de clase en el ViewSet, `action_permissions: dict[str, str | tuple[str, ...] | None]`.
  - `str` o `tuple`: el usuario debe tener **todos** los permisos indicados (`user.has_perms`), en vez del mapeo por método HTTP.
  - `None`: acción revisada; se aplica el mapeo por método HTTP (por ejemplo `current` PUT → `change_*`).
  - Si la acción no figura en el mapa, se mantiene el comportamiento actual.
- Las acciones mapeadas se evalúan **antes** de la rama "sin queryset", así que también funcionan en `ViewSet` sin modelo.

- [ ] **Step 1: Write the failing tests**

```python
def test_mapped_action_requires_declared_permission():      # action_permissions={"annul": "billing.annul_invoice"}; usuario con add_invoice → False
def test_mapped_action_allows_with_declared_permission():   # usuario con billing.annul_invoice (sin add) → True
def test_tuple_requires_all_permissions():                  # ("a.x","a.y"); solo a.x → False
def test_none_mapping_falls_back_to_method_map():           # {"current": None}, PATCH, con change_* → True; sin change_* → False
def test_unmapped_action_keeps_method_behaviour():          # sin entrada; POST con add_* → True
def test_mapped_action_denies_anonymous():                  # AnonymousUser → False
```

Usar `APIRequestFactory` y una instancia de `InvoiceViewSet` con `view.action` asignado, como la sonda del diagnóstico. Los permisos se registran en la base con `Permission.objects.create` sobre el content type de `Invoice`.

- [ ] **Step 2: Run** `... -m pytest core/tests/test_action_permissions.py -v` — Expected: FAIL en los tests 1, 2 y 3.
- [ ] **Step 3: Implement** la lectura de `getattr(view, "action_permissions", {})` al inicio de `has_permission`.
- [ ] **Step 4: Run** — Expected: PASS (6 tests).
- [ ] **Step 5: Commit** — `feat(rbac): action_permissions en StandardizedModelPermissions`

---

### Task 2: Test de cobertura de acciones con lista de excepciones

**Files:**
- Create: `backend/core/tests/test_rbac_action_coverage.py`
- Create: `backend/core/tests/rbac_action_baseline.py`

**Interfaces:**
- Produces: `UNMAPPED_WRITE_ACTIONS: frozenset[str]` en `rbac_action_baseline.py`, con claves `"{cls.__module__}.{cls.__name__}.{action_name}"`. Lleva un comentario de cabecera: "Solo se reduce. Agregar aquí requiere justificar en el PR; ADR-0104".
- Recorrido: igual que `_viewset_classes()` en `core/tests/test_edit_policy.py:53`. Por cada clase con `get_extra_actions`, una acción es de escritura si `set(action.mapping) & {"post", "put", "patch", "delete"}`.
- Produces: `AUTHENTICATED_ONLY_VIEWS: frozenset[str]` (en el mismo archivo de baseline, pero **permanente**, no se vacía). Es la lista cerrada de vistas personales o públicas para autenticados que se definió en la Fase 0, Task 8 (`CurrentUserView`, `MyProfileView`, …, `PricingViewSet`).
- Cobertura de **vistas sin modelo**: se recorren todos los `url_patterns`, incluidas las vistas de función (`callback.cls` es la `WrappedAPIView`). Una vista sin `queryset`/`get_queryset` debe cumplir una de estas condiciones: usar `require_perms(...)`, declarar `action_permissions` para todas sus acciones, o figurar en `AUTHENTICATED_ONLY_VIEWS`. Así se detecta el próximo reporte que se publique solo con `IsAuthenticated`.

- [ ] **Step 1: Write the tests**

```python
def test_every_write_action_declares_permission():
    missing = {key for key in write_actions() if name not in cls.action_permissions and key not in UNMAPPED_WRITE_ACTIONS}
    assert missing == set(), "Declara action_permissions (ADR-0104)"
def test_baseline_has_no_stale_entries():
    stale = {key for key in UNMAPPED_WRITE_ACTIONS if key not in write_actions() or name in cls.action_permissions}
    assert stale == set(), "Quita estas entradas del baseline"
def test_action_permissions_reference_existing_permissions():
    # cada str/tuple de cada action_permissions ∈ permission_catalog()  (importado de test_permission_references)
def test_modelless_views_declare_permissions():
    # toda vista sin modelo usa require_perms, declara action_permissions completo o está en AUTHENTICATED_ONLY_VIEWS
def test_authenticated_only_views_still_exist():
    # cada entrada de AUTHENTICATED_ONLY_VIEWS corresponde a una vista existente (evita entradas huérfanas)
```

- [ ] **Step 2: Generate the baseline.** Ejecutar el primer test con un baseline vacío, copiar el conjunto `missing` (se esperan unas 150 entradas) a `rbac_action_baseline.py`, ordenado.
- [ ] **Step 3: Run** `... -m pytest core/tests/test_rbac_action_coverage.py -v` — Expected: PASS (3 tests).
- [ ] **Step 4: Commit** — `test(rbac): exigir action_permissions en acciones de escritura (con baseline)`

---

### Task 3: Verbos de negocio, primera tanda (documentos con efecto económico)

**Files:**
- Modify: `backend/{billing,sales,purchasing,accounting,treasury,hr,production,tax}/apps.py` (registrar los codenames de la tabla, salvo los de `tax`, que ya existen)
- Modify: los ViewSets de la tabla (agregar `action_permissions`)
- Modify: `backend/core/tests/rbac_action_baseline.py` (quitar las entradas que se mapean)
- Test: `backend/core/tests/test_business_action_permissions.py`

| ViewSet (archivo) | acción → permiso |
|---|---|
| `InvoiceViewSet` (`billing/views.py`) | `confirm`→`billing.confirm_invoice`, `annul`→`billing.annul_invoice`, `cancel`→`billing.cancel_invoice` |
| `SaleOrderViewSet` (`sales/views.py`) | `confirm`→`sales.confirm_saleorder`, `cancel`→`sales.cancel_saleorder`, `annul`→`sales.annul_saleorder`, `write_off`→`sales.write_off_saleorder` |
| `SaleDeliveryViewSet` / `SaleReturnViewSet` | `annul`→`sales.annul_saledelivery` / `sales.annul_salereturn` |
| `PurchaseOrderViewSet` (`purchasing/views.py`) | `confirm`→`purchasing.confirm_purchaseorder`, `cancel`→`purchasing.cancel_purchaseorder`, `annul`→`purchasing.annul_purchaseorder` |
| `PurchaseReceiptViewSet` / `PurchaseReturnViewSet` | `annul`→`purchasing.annul_purchasereceipt` / `purchasing.annul_purchasereturn` |
| `JournalEntryViewSet` (`accounting/views.py`) | `post_entry`→`accounting.post_journalentry`, `reverse_entry`→`accounting.reverse_journalentry` |
| `TreasuryMovementViewSet` (`treasury/views.py`) | `cancel`→`treasury.cancel_treasurymovement`, `annul`→`treasury.annul_treasurymovement` |
| `BankStatementViewSet` | `confirm`→`treasury.confirm_bankstatement` |
| `PayrollViewSet` (`hr/views.py`) | `post_payroll`→`hr.post_payroll`, `pay_salary` y `pay_previred`→`hr.pay_payroll` |
| `SalaryAdvanceViewSet` / `PayrollPaymentViewSet` | `annul`→`hr.annul_salaryadvance` / `hr.annul_payrollpayment` |
| `WorkOrderViewSet` (`production/views.py`) | `annul`→`production.annul_workorder` |
| `TaxPeriodViewSet` (`tax/views.py`) | `close`→`tax.can_close_tax_period`, `reopen`→`tax.can_reopen_tax_period` |
| `AccountingPeriodViewSet` | `close`→`tax.can_close_accounting_period`, `reopen`→`tax.can_reopen_accounting_period` |
| `F29PaymentViewSet` | `annul`→`tax.annul_f29payment` |

**Interfaces:**
- Consumes: `action_permissions` (Task 1) y la lista de excepciones (Task 2).
- Los codenames de esta tabla son los que la Fase 2 usará en los registros de acciones del frontend (`features/*/actions.tsx`).

- [ ] **Step 1: Write the failing tests**

```python
@pytest.mark.parametrize("viewset, action, perm", WAVE_1)   # WAVE_1 = la tabla anterior como lista de tuplas
def test_wave1_action_requires_business_permission(viewset, action, perm):
    # usuario con add_/change_ del modelo pero sin perm → has_permission False; con perm → True
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_business_action_permissions.py -v` — Expected: FAIL.
- [ ] **Step 3: Implement** los registros, los mapas y el ajuste del baseline.
- [ ] **Step 4: Run** `... -m pytest core/tests/test_business_action_permissions.py core/tests/test_rbac_action_coverage.py core/tests/test_permission_references.py -v`, y después la suite completa con `-q`. Expected: PASS y sin fallos nuevos. Si un test existente usaba un usuario que solo tenía `add_*` para anular, se le agrega el permiso de negocio; no se toca el mapa.
- [ ] **Step 5: Commit** — `feat(rbac): permisos explícitos para confirmar/anular/contabilizar/pagar/cerrar (primera tanda)`

---

### Task 3b: Verbos de negocio, segunda tanda (operaciones, logística, tesorería, socios)

Son acciones que **mueven stock, dinero o patrimonio** pero no entraron en la primera tanda. Hoy un `POST` a cualquiera de ellas solo exige `add_<modelo>`. (`TreasuryDashboardViewSet.register_transfer` se corrige en la Fase 0, Task 8.)

**Files:**
- Modify: `backend/{sales,purchasing,inventory,production,treasury,contacts,tax,billing}/apps.py` (registrar los codenames nuevos de la tabla)
- Modify: los ViewSets de la tabla y `rbac_action_baseline.py`
- Test: `backend/core/tests/test_business_action_permissions.py` (agregar `WAVE_2`)

| ViewSet | acción → permiso |
|---|---|
| `SaleOrderViewSet` | `dispatch_order`, `partial_dispatch`→`sales.dispatch_saleorder`; `register_merchandise_return`→`sales.add_salereturn`; `register_note`→`billing.add_invoice` |
| `InvoiceViewSet` | `process_logistics`→`sales.dispatch_saleorder` |
| `NoteWorkflowViewSet` (`billing/note_views.py`) | `checkout`→`billing.add_invoice`, `complete`→`billing.confirm_invoice` |
| `PurchaseOrderViewSet` | `receive`, `partial_receive`→`purchasing.receive_purchaseorder`; `partial_return`→`purchasing.add_purchasereturn`; `register_note`→`billing.add_invoice` |
| `InventoryDocumentViewSet` | `confirm`→`inventory.confirm_inventorydocument`, `annul`→`inventory.annul_inventorydocument` |
| `InventoryCountViewSet` | `apply`→`inventory.post_inventorycount` |
| `SubscriptionViewSet` | `cancel`→`inventory.cancel_subscription` |
| `WorkOrderViewSet` | `rectify`, `restart`→`production.reopen_workorder` |
| `ContactViewSet` | `unblock_credit`→`sales.override_credit_limit` (ya registrado); `write_off_debt`, `recover_written_off_debt`→`contacts.write_off_contact`; `promote_partner`, `demote_partner`, `setup_partner`, `initial_setup`, `equity_subscription`, `equity_transfer`, `individual_dividend_payment`, `partner_transactions`, `mass_mobilize_retained_earnings`→`contacts.post_partnertransaction` |
| `ProfitDistributionResolutionViewSet` | `approve`→`contacts.approve_profitdistributionresolution`; `execute`, `mass_payment`→`contacts.pay_profitdistributionresolution` |
| `TerminalBatchViewSet` | `generate_invoice`→`billing.add_invoice` |
| `POSSessionViewSet` | `close_session`→`treasury.close_possession` |
| `BankStatementLineViewSet` | `confirm`→`treasury.confirm_bankstatement` |
| `CheckViewSet` | `bounce`, `void`→`treasury.annul_check` |
| `BankLoanViewSet` | `disburse`→`treasury.post_bankloan`; `prepay`→`treasury.pay_loaninstallment` |
| `LoanInstallmentViewSet` | `pay`→`treasury.pay_loaninstallment` |
| `CreditCardStatementViewSet` | `pay`→`treasury.pay_creditcardstatement`, `cancel`→`treasury.cancel_creditcardstatement`, `reverse`→`treasury.reverse_creditcardstatement` |
| `F29DeclarationViewSet` | `register`→`tax.post_f29declaration` |
| `AccountViewSet` | `populate_ifrs`→`accounting.override_account` (reemplaza el plan de cuentas; solo para administración) |

- [ ] **Step 1: Write the failing tests.** Agregar `WAVE_2` (la tabla como tuplas) al `parametrize` de `test_wave1_action_requires_business_permission`, renombrado a `test_business_action_requires_permission`.
- [ ] **Step 2: Run** `... -m pytest core/tests/test_business_action_permissions.py -v` — Expected: FAIL en las filas de `WAVE_2`.
- [ ] **Step 3: Implement** los registros, los mapas, las plantillas y el ajuste del baseline.
- [ ] **Step 4: Run** el archivo, `test_rbac_action_coverage.py` y la suite completa con `-q`. Expected: PASS, sin fallos nuevos.
- [ ] **Step 5: Commit** — `feat(rbac): permisos de negocio para logística, inventario, tesorería y socios (segunda tanda)`

---

### Task 3c: Declarar el resto y vaciar la lista de excepciones

Las acciones que quedan **no** necesitan un verbo de negocio, pero hoy el mapeo por método HTTP les asigna un permiso **incorrecto**. Un `POST` exige `add_*`, así que:

- las ediciones (agregar material a una OT, cargar líneas de un conteo) exigen "crear" en vez de "modificar";
- las consultas por `POST` (verificar disponibilidad, vista previa de una cartola, marcar favorito) exigen "crear" cuando solo deberían exigir "ver".

Esta tarea las declara todas de forma explícita. Al terminar, la lista de excepciones queda **vacía** y se elimina.

**Files:**
- Modify: los ViewSets de la tabla
- Delete: `backend/core/tests/rbac_action_baseline.py`
- Modify: `backend/core/tests/test_rbac_action_coverage.py` (sin lista de excepciones; se elimina `test_baseline_has_no_stale_entries`)

| Clase | Acciones | Declaración |
|---|---|---|
| **Consulta vía POST → `view_*`** | `ProductViewSet.check_availability`, `ProductViewSet.toggle_favorite` (preferencia personal) | `inventory.view_product` |
| | `BankStatementViewSet.dry_run`, `BankStatementViewSet.preview` | `treasury.view_bankstatement` |
| | `WorkOrderViewSet.bulk_print` | `production.view_workorder` |
| | `WorkOrderViewSet.comments`, `SaleOrderViewSet.comments` | `production.view_workorder` / `sales.view_saleorder` (comentar no edita el documento) |
| | `F29DeclarationViewSet.calculate` | `tax.view_f29declaration` (calcula sin guardar; si persiste, `change`) |
| **Edición vía POST → `change_*`** | `WorkOrderViewSet`: `update_section`, `add_material`, `update_material`, `remove_material`, `remove_attachment`, `transition`, `bulk_transition` | `production.change_workorder` (en la Fase 3, las transiciones por etapa pasan a `ApprovalPolicy`) |
| | `InventoryCountViewSet.save_lines` | `inventory.change_inventorycount` |
| | `ProductViewSet`: `sync_variant_prices`, `bulk_set_surcharge` | `inventory.change_product` |
| | `SubscriptionViewSet`: `pause`, `resume`, `trigger_inspection` | `inventory.change_subscription` |
| | `BudgetViewSet.set_items` | `accounting.change_budget` |
| | `PayrollViewSet`: `recalculate`, `generate_proforma` | `hr.change_payroll` |
| | `F29DeclarationViewSet.attach_document` | `tax.change_f29declaration` |
| | `ProfitDistributionResolutionViewSet`: `update_destinations`, `recalculate` | `contacts.change_profitdistributionresolution` |
| | `TreasuryMovementViewSet.allocate` | `treasury.change_treasurymovement` |
| | `BankStatementViewSet.auto_match`; `BankStatementLineViewSet`: `match`, `match_group`, `unmatch`, `bulk_exclude` | `treasury.change_bankstatementline` |
| | `CheckViewSet`: `deposit`, `clear` | `treasury.change_check` |
| | `CreditCardStatementViewSet`: `apply_charges`, `reapply_charges`, `recalculate`, `add_charge`, `update_charge`, `delete_charge`, `bill_charges` | `treasury.change_creditcardstatement` |
| | `BankViewSet`: `archive`, `restore` | `treasury.change_bank` |
| | `DraftCartViewSet`: `restore`, `lock`, `unlock`, `heartbeat`, `withdraw` | `sales.change_draftcart` |
| **Creación → `None`** (el `add_*` por método es correcto) | `InvoiceViewSet`: `create_from_order`, `from_lines`, `pos_checkout`, `request_credit`; `PurchaseOrderViewSet.purchase_checkout`; `WorkOrderViewSet`: `duplicate`, `create_manual`; `ProductViewSet.generate_variants`; `ProductViewSet.bulk_clone_bom`→`production.add_billofmaterials`; `PayrollViewSet.create_draft_payrolls`; `BankStatementViewSet.import_statement`; `TreasuryMovementViewSet`: `register_movement`, `card_purchase`, `register_return`; `TreasuryAccountViewSet.provision`; `POSSessionViewSet`: `open_session`, `register_manual_movement` | `None`, salvo `bulk_clone_bom`, que va con su permiso explícito |
| **Configuración `current` → `None`** | `current` de `AccountingSettings`, `CompanySettings`, `GlobalHRSettings`, `SalesSettings`, `WorkflowSettings` | `None` (PUT/PATCH → `change_*`) |
| **Bandeja personal → `None`** | `TaskViewSet.complete`, `NotificationViewSet.mark_read`, `NotificationViewSet.mark_all_read` | `None` (el filtro por fila está en el selector y en `WorkflowService.complete_task`; la Fase 3 agrega `required_permission`) |

- [ ] **Step 1: Write the failing test.** Con la lista de excepciones vaciada (`UNMAPPED_WRITE_ACTIONS = frozenset()`), `test_every_write_action_declares_permission` debe fallar listando solo estas acciones. Agregar también:

```python
def test_read_like_post_actions_only_need_view():   # usuario con solo inventory.view_product → check_availability y toggle_favorite permitidos
def test_edit_post_actions_need_change_not_add():   # usuario con production.add_workorder (sin change) → add_material denegado; con change → permitido
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_rbac_action_coverage.py core/tests/test_business_action_permissions.py -v` — Expected: FAIL.
- [ ] **Step 3: Implement** las declaraciones; borrar `rbac_action_baseline.py` y la lógica de excepciones del test.
- [ ] **Step 4: Run** la suite completa con `-q`. Expected: sin fallos nuevos. Los tests que usan un usuario con solo `add_*` para ejecutar acciones ahora mapeadas a `change_*` o `view_*` reciben el permiso correcto en su fixture.
- [ ] **Step 5: Commit** — `feat(rbac): todas las acciones de escritura declaran su permiso; se elimina la lista de excepciones`

---

### Task 3d: Alinear los registros de acciones del frontend

**Problema verificado:** el frontend controla los botones con permisos aproximados. Por ejemplo, anular un pago usa `treasury.delete_treasurymovement` (`features/treasury/paymentActions.ts:27,50`, `hooks/useCashMovementActions.tsx:74`, `orders/hooks/useOrderRelatedActions.tsx:105`), y las acciones de factura en ventas y compras usan `billing.change_invoice` (`features/sales/actions.tsx:52`, `features/purchasing/actions.tsx:50`). Después de las Tasks 3–3c, el backend exige otro permiso: el botón aparece y la acción responde 403, o desaparece para quien sí puede usarla.

**Files:**
- Modify: los registros y hooks del frontend que ejecutan una acción de las tablas de las Tasks 3, 3b y 3c (localizarlos con `grep -rn "requiredPermissions\|can('" frontend/features`, y por endpoint con `grep -rn "/annul/\|/cancel/\|/confirm/\|/post_entry/" frontend/features/*/api`)
- Test: el test de la Fase 0 `test_frontend_permission_literals_exist` (garantiza que existen) más un test nuevo en el backend

**Interfaces:**
- Produces: `ENDPOINT_PERMISSION_MAP` en `backend/core/tests/test_frontend_action_alignment.py`. Es una lista de tuplas `(archivo_frontend, id_de_acción, permiso_esperado)` para cada botón que llama a una acción mapeada; el test lee el archivo y verifica que `requiredPermissions` (o el `can('…')` del hook) contenga el permiso esperado. La Fase 2 lo reemplaza por tipos generados.

- [ ] **Step 1: Write the failing test** — `test_frontend_actions_use_backend_permission` con las filas de anular/confirmar/cancelar de factura, venta, compra, asiento, movimiento de tesorería, nómina y OT. Expected: FAIL.
- [ ] **Step 2: Implement** el cambio de literales. Respetar la semántica `some` de `resolveRegistryActions`.
- [ ] **Step 3: Run** el test, `cd frontend && npm run type-check && npm run lint && npm run test -- features/orders features/treasury features/sales features/purchasing` (Node 24). Expected: PASS.
- [ ] **Step 4: Commit** — `fix(frontend): requiredPermissions alineados con los permisos de negocio del backend`

---

### Task 3e: Autorización en las suscripciones en tiempo real

**Problema verificado:**

- `EntityBusConsumer.receive_json` (`core/consumers.py:47`) acepta `subscribe` a cualquier tema `{app}.{model}` sin revisar permisos. El payload solo trae `id`, `op` y `actor_id`, pero eso revela actividad (por ejemplo, cuándo se modifican nóminas).
- `POSDraftConsumer` (`sales/consumers.py:6`) une a cualquier usuario autenticado al grupo `pos_session_{id}` de cualquier sesión de caja.

**Files:**
- Modify: `backend/core/consumers.py` (antes de `group_add`, `await database_sync_to_async(user.has_perm)(f"{app}.view_{model}")`; sin permiso, `_send_error("forbidden", …)`)
- Modify: `backend/sales/consumers.py` (exigir `sales.view_draftcart`; si no, `close(code=4003)`)
- Test: `backend/core/tests/test_entity_bus_authz.py`, `backend/sales/tests/test_pos_consumer_authz.py` (`channels.testing.WebsocketCommunicator`, con `CHANNEL_BACKEND=locmem`)

- [ ] **Step 1: Write the failing tests** — `test_subscribe_requires_view_permission` (sin `hr.view_payroll` → evento `error` con code `forbidden`); `test_subscribe_allowed_with_permission`; `test_pos_session_requires_view_draftcart`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `fix(realtime): autorizar suscripciones del entity bus y de sesiones POS por permiso`

---

### Task 4: Paquetes de acceso (niveles por módulo y capacidades sensibles)

**Files:**
- Create: `backend/core/rbac/__init__.py`, `backend/core/rbac/catalog.py`, `backend/core/rbac/bundles.py`
- Modify: `backend/core/tests/test_permission_references.py` (importar `permission_catalog` desde `core.rbac.catalog`; quitar `test_operator_template_codenames_exist`, que se reemplaza por los tests de esta tarea)
- Test: `backend/core/tests/test_rbac_bundles.py`

**Interfaces:**
- Produces: en `core/rbac/catalog.py`:
  - `permission_catalog() -> set[str]`, igual al de la Fase 0;
  - `HIDDEN_APPS = {"admin","contenttypes","sessions","django_celery_beat","socialaccount","account"}`;
  - `curated_catalog() -> list[CatalogApp]`, que excluye `HIDDEN_APPS` y los modelos `historical*`;
  - los `TypedDict` `CatalogApp` `{"app", "label", "permissions": list[CatalogPermission]}` y `CatalogPermission` `{"code", "name", "model": str | None, "kind": Literal["module","view","add","change","delete","business"], "bundles": list[str]}`.
- Produces: en `core/rbac/bundles.py`:
  - `Bundle = TypedDict({"key": str, "label": str, "description": str, "sensitive": bool})`;
  - `BUNDLES: dict[str, Bundle]`;
  - `expand(bundle_keys: Iterable[str]) -> set[str]`, que devuelve códigos `app.codename` según las reglas del spec §2.1. Las capacidades sensibles **se restan** de los niveles de módulo, porque un nivel nunca otorga un permiso sensible;
  - `bundles_of(code: str) -> list[str]`.

- [ ] **Step 1: Write the failing tests**

```python
def test_levels_are_cumulative():                          # expand(["sales.read"]) ⊂ expand(["sales.operate"]) ⊂ expand(["sales.manage"])
def test_read_level_only_views():                          # todo código de *.read empieza por view_ (incluye view_dashboard_*)
def test_operate_excludes_destructive_verbs():             # sales.operate no contiene annul_/cancel_/delete_/reverse_/write_off_
def test_manage_includes_annul_and_delete():               # billing.annul_invoice, billing.delete_invoice ∈ expand(["billing.manage"])
def test_sensitive_permissions_not_in_levels():            # hr.view_payroll ∉ expand(["hr.manage"]); ∈ expand(["hr.payroll"]); treasury.pay_* ∉ treasury.manage
def test_every_curated_permission_belongs_to_a_bundle():   # para todo code del catálogo curado: bundles_of(code) != [] (sin lista de excepciones)
def test_security_bundle_contains_user_and_group_admin():  # core.change_user, auth.change_group, core.view_actionlog ∈ expand(["core.security"])
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_rbac_bundles.py -v` — Expected: FAIL (error de importación).
- [ ] **Step 3: Implement** las reglas por verbo y las tablas de capacidades sensibles del spec §2.1. Las clasificaciones que la regla general no resuelve se fijan en un diccionario `OVERRIDES` en `bundles.py`.
- [ ] **Step 4: Run** — Expected: PASS. Si `test_every_curated_permission_belongs_to_a_bundle` lista permisos huérfanos, clasificarlos (no se admiten excepciones).
- [ ] **Step 5: Commit** — `feat(rbac): paquetes de acceso por módulo y capacidades sensibles`

---

### Task 5: `GroupProfile`: equipos, composición de roles y materialización

**Files:**
- Create: `backend/core/models/rbac.py` (exportar desde `core/models/__init__.py`)
- Create: `backend/core/migrations/0015_groupprofile.py` (esquema más `RunPython` que clasifica los grupos existentes; depende de `0014_merge_duplicate_permissions`)
- Create: `backend/core/rbac/services.py` (`RoleService`)
- Modify: `backend/core/signals.py`:
  - receptor `post_save` de `Group`: si se creó sin perfil, crea `GroupProfile(kind=TEAM)`;
  - el receptor `post_migrate` de la Fase 0 llama a `RoleService.materialize_all()` después de `sync_to_db`, en lugar de dar todo a `ADMIN`.
- Modify: `backend/core/serializers/__init__.py` (`GroupSerializer` agrega `kind`, `is_system`, `description`; `kind` solo se puede escribir al crear)
- Modify: `backend/core/services/__init__.py` (`GroupService.create(name, kind, description)` en `@transaction.atomic`; `validate_mutable` usa `profile.is_system` en vez de `SYSTEM_ROLES`)
- Modify: `backend/core/views.py` (`GroupViewSet`: `select_related("profile")`, filtro `?kind=ROLE|TEAM`)
- Test: `backend/core/tests/test_group_profile.py`

**Interfaces:**
- Produces: `GroupProfile` con estos campos:
  - `group`: `OneToOne[Group]`, `related_name="profile"`;
  - `kind`: `"ROLE" | "TEAM"`;
  - `is_system: bool = False`;
  - `description: str = ""`;
  - `bundles: JSONField[list[str]] = []`;
  - `extra_permissions: JSONField[list[str]] = []`;
  - `excluded_permissions: JSONField[list[str]] = []`.

  Se valida en `clean()`: los paquetes deben existir en `BUNDLES` y los códigos en `permission_catalog()`. Un `TEAM` no puede tener paquetes ni permisos.
- Produces: `RoleService.materialize(group: Group) -> None`, que hace `group.permissions.set(Permission(s) de expand(bundles) ∪ extra − excluded)`. También `RoleService.materialize_all() -> int`, para todos los grupos `ROLE`.
- Relleno inicial: los 4 grupos antiguos (`ADMIN`, `MANAGER`, `OPERATOR`, `READ_ONLY`) quedan como `ROLE` **sin paquetes** y con `extra_permissions` igual a sus permisos actuales, de modo que la materialización no cambia nada (la Task 6 los reemplaza); los demás pasan a `TEAM`. **Excepción:** si un grupo que no es de los 4 tiene permisos, pasa a `ROLE` con `extra_permissions`.

- [ ] **Step 1: Write the failing tests**

```python
def test_backfill_classifies_existing_groups():                # MigrationExecutor: ADMIN(748 perms) → ROLE con extra==sus perms; "Pre-Prensa"(0) → TEAM
def test_materialize_expands_bundles_extra_and_excluded():     # bundles=["sales.read"], extra=["billing.view_invoice"], excluded=["sales.view_saleline"]
def test_materialization_preserves_role_customization():       # rol con extra/excluded; materialize_all() dos veces → mismo conjunto
def test_new_permission_flows_to_roles_on_migrate():           # registrar sales.export_saleorder; migrate → rol con sales.manage lo tiene; rol con sales.operate no
def test_team_cannot_have_bundles():                           # full_clean() → ValidationError
def test_group_created_outside_api_gets_team_profile():        # Group.objects.create(name="X") → X.profile.kind == TEAM
def test_list_filters_by_kind():                               # ?kind=TEAM; django_assert_max_num_queries(3)
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_group_profile.py -v` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run**; después `makemigrations --check --dry-run` → "No changes detected". Expected: PASS.
- [ ] **Step 5: Commit** — `feat(rbac): GroupProfile con composición de roles y materialización en post_migrate`

---

### Task 6: Puestos sembrados y migración de los roles antiguos

**Files:**
- Create: `backend/core/rbac/seed.py` (`SEEDED_ROLES`)
- Rewrite: `backend/core/management/commands/sync_permissions.py`: crea los puestos sembrados **que falten** (nunca modifica los existentes) y llama a `RoleService.materialize_all()`. Se eliminan la lista `operator_codenames` y los `.set()`.
- Create: `backend/core/management/commands/rbac_migrate_legacy_roles.py`
- Modify: `backend/core/permissions.py` (`Roles` pasa a `SYSTEM_ADMIN = "Administrador del sistema"`; se borran `ADMIN/MANAGER/OPERATOR/READ_ONLY` y sus usos, incluidos `make_user` y los tests de la Fase 0)
- Modify: `backend/core/management/commands/setup_demo_data.py` (asignar los puestos nuevos a los usuarios de demo)
- Test: `backend/core/tests/test_rbac_seed.py`

**Interfaces:**
- Produces: `SEEDED_ROLES: dict[str, SeededRole]`, con `SeededRole = TypedDict({"name", "description", "bundles": list[str], "is_system": bool})`. Contiene los 11 puestos de la tabla del spec §2.1 y solo «Administrador del sistema» tiene `is_system=True`.
- Produces: `rbac_migrate_legacy_roles [--plan | --apply]`.
  - `--plan` (por defecto): imprime una tabla `usuario | roles antiguos | equipos | puestos propuestos` y no escribe nada.
  - Correspondencia de los roles antiguos: `ADMIN` → Administrador del sistema + Gerencia; `MANAGER` → Gerencia; `READ_ONLY` → Auditor.
  - Correspondencia por equipo (para `OPERATOR`): Ventas → Ventas; Bodega/Despacho → Bodega y Despacho; Diseño/Pre-Prensa/Taller/Terminaciones → Producción; Supervisor → Jefatura de Producción; Administración → Administración y Finanzas. Un operador sin equipo queda «sin propuesta» y se informa.
  - `--apply`: aplica la propuesta en `@transaction.atomic`, registra un `ActionLog` SECURITY por usuario y **borra los 4 grupos antiguos**. Aborta sin cambios si algún usuario activo quedaría sin puesto, salvo que se pase `--allow-unassigned`.

- [ ] **Step 1: Write the failing tests**

```python
def test_seed_creates_missing_roles_only():                # puesto existente editado (bundles distintos) → sync_permissions no lo toca
def test_seeded_roles_match_spec():                        # parametrize por puesto: permisos clave presentes/ausentes según spec §2.1 (p.ej. Ventas: confirm_saleorder sí, annul_invoice no, view_payroll no)
def test_only_system_admin_is_system():                    # is_system solo en "Administrador del sistema"
def test_auditor_reads_finances_but_not_payroll_or_security(): # finances.view_dashboard_finances sí; hr.view_payroll no; core.change_user no
def test_plan_does_not_write():                            # --plan → 0 cambios en user.groups
def test_apply_maps_legacy_roles_and_teams():              # ADMIN→SysAdmin+Gerencia; OPERATOR en "Taller"→Producción; grupos antiguos borrados
def test_apply_leaves_no_active_user_without_role():       # OPERATOR sin equipo → aborta con mensaje; con --allow-unassigned aplica
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_rbac_seed.py -v` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el archivo y la suite completa con `-q`. Expected: sin fallos nuevos (los tests que usaban `Roles.OPERATOR` u otros roles antiguos pasan a usar puestos o permisos explícitos).
- [ ] **Step 5: Commit** — `feat(rbac): puestos de trabajo sembrados y migración de los roles antiguos`

---

### Task 7: Catálogo, edición de roles, no escalada, SoD y auditoría

**Files:**
- Create: `backend/core/rbac/sod.py` (`SOD_RULES`)
- Create: `backend/core/api/rbac.py`
- Modify: `backend/core/urls.py` (`path("permissions/catalog/", ...)`, `path("permissions/bundles/", ...)`)
- Modify: `backend/core/views.py`:
  - `GroupViewSet`: `@action(detail=True, methods=["get", "put"], url_path="composition") role_composition`, con `action_permissions = {"role_composition": None}`;
  - `UserViewSet.perform_create` y `perform_update` llaman a `RoleService.validate_role_assignment` y luego a `RoleService.log_user_roles_change`.
- Modify: `backend/core/rbac/services.py`
- Test: `backend/core/tests/test_role_permissions_api.py`

**Interfaces:**
- Produces: `GET /api/core/permissions/catalog/` → `list[CatalogApp]` y `GET /api/core/permissions/bundles/` → `list[Bundle & {"permissions": list[str]}]`. Ambos requieren `auth.view_group`.
- Produces: `GET /api/core/groups/{id}/composition/` → `{"bundles", "extra_permissions", "excluded_permissions", "effective_permissions": list[str]}`. `PUT` recibe los tres primeros y requiere `auth.change_group`. Responde 400 si es un `TEAM`, si `is_system`, o si algún paquete o código no existe (`{"invalid": [...]}`). Materializa el resultado y devuelve `sod_warnings` si algún usuario del rol queda en conflicto.
- Produces: `RoleService.set_role_composition(group, bundles, extra, excluded, actor, request) -> list[SodWarning]`, en `@transaction.atomic` y con `ActionLog` SECURITY (`added`/`removed` de los permisos efectivos).
- Produces: `RoleService.validate_role_assignment(actor: User, target: User, new_groups: set[Group]) -> list[SodWarning]`. Lanza `PermissionDenied` si `actor == target` y cambian los grupos, o si los permisos efectivos de algún grupo que se agrega o se quita no están en `actor.get_all_permissions()`. El superusuario queda exento. Devuelve los conflictos de SoD de `target` con el conjunto final.
- Produces: `RoleService.log_user_roles_change(user, before: set[str], after: set[str], actor, request) -> None` (sin log si no hubo cambios; si hay conflictos de SoD, se incluyen en `metadata`).
- Produces: `SOD_RULES: list[SodRule]`, con `SodRule = TypedDict({"key", "label", "bundles": tuple[str, str], "mode": Literal["warn","block"]})`. Contiene las 4 reglas del spec §2.1, todas `warn`. En modo `block` se responde 400.

- [ ] **Step 1: Write the failing tests**

```python
def test_catalog_hides_noise_and_lists_bundles():            # sin "historical"/"contenttypes"; billing.annul_invoice.bundles == ["billing.manage"]
def test_put_composition_materializes_and_audits():          # PUT bundles=["sales.read"] → effective == expand; ActionLog SECURITY added/removed
def test_cannot_edit_team_or_system_role_permissions():      # TEAM → 400; "Administrador del sistema" → 400
def test_put_rejects_unknown_bundles_or_codes():             # ["x.read"], extra ["core.view_historicaluser"] → 400 con invalid
def test_user_cannot_grant_permissions_they_lack():          # actor con core.change_user sin hr.payroll asigna puesto RRHH → 403
def test_user_cannot_change_own_roles():                     # PATCH /users/{self}/ groups → 403
def test_role_editor_cannot_add_bundles_they_lack():         # actor con auth.change_group sin treasury.payments → PUT con ese paquete → 403
def test_sod_conflict_warns_and_audits():                    # asignar Compras + Administración y Finanzas → 200, sod_warnings no vacío, ActionLog con conflicto
def test_composition_endpoint_query_count():                 # ≤ 4 consultas (invariante 14)
```

- [ ] **Step 2: Run** `... -m pytest core/tests/test_role_permissions_api.py -v` — Expected: FAIL.
- [ ] **Step 3: Implement.** Las vistas delegan en `RoleService` (≤ 20 líneas). `UserSerializer` expone `sod_warnings` como dato de solo lectura en la respuesta de create/update.
- [ ] **Step 4: Run** el archivo y `core/tests -q`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(rbac): catálogo, composición de roles, no escalada, SoD en modo aviso y auditoría`

---

### Task 8: Frontend mínimo para el nuevo modelo de roles

**Problema verificado:** el frontend tiene los roles antiguos escritos en el código y asume **un solo rol principal**:

- `features/users/components/UserDrawer.tsx:67,103` (`systemRoles` y `primaryRole || "OPERATOR"`);
- `features/profile/components/ProfileSidePanel.tsx:91`;
- `features/settings/entity-view/user.entity.ts:4`;
- `features/settings/components/UsersSettingsClientView.tsx:30-33` (filtro por rol);
- `contexts/AuthContext.tsx:127` (`groups.includes('ADMIN')` da acceso total).

Cuando la Task 6 borra los grupos antiguos, esas pantallas fallan o muestran datos incorrectos. La matriz de edición de roles queda para la Fase 2.

**Files:**
- Modify: los 5 archivos anteriores
- Modify: `frontend/features/users/api/usersApi.ts` (`getGroups({kind})`) y el schema Zod del formulario de usuario (`schema.ts` del feature, invariante 9)
- Test: `frontend/features/users/components/__tests__/UserDrawer.test.tsx` (crear o extender)

**Interfaces:**
- Consumes: `GET /api/core/groups/?kind=ROLE|TEAM`, más `kind`/`is_system` en `GroupSerializer` (Task 5) y `sod_warnings` en la respuesta de usuario (Task 7).
- El formulario de usuario cambia `primary_role: string` + `functional_groups: string[]` por `roles: string[]` (multi-selección de grupos `ROLE`, mínimo 1) + `teams: string[]` (grupos `TEAM`). Al guardar envía `groups = [...roles, ...teams]` y muestra `sod_warnings` como aviso no bloqueante.
- `hasPermission` queda como `is_superuser || permissions.includes(p)`, sin ningún nombre de grupo.

- [ ] **Step 1: Write the failing tests** — `renders roles and teams from kind` (dos multiselect alimentados por `?kind=`), `requires at least one role`, `shows sod warnings after save`, y en `AuthContext` `does not grant by group name` (un usuario con `groups:['ADMIN']` y sin permisos → `hasPermission('x.y') === false`).
- [ ] **Step 2: Run** `cd frontend && npm run test -- features/users contexts` (Node 24) — Expected: FAIL.
- [ ] **Step 3: Implement**; quitar todas las listas `['ADMIN','MANAGER','OPERATOR','READ_ONLY']` y usar `GroupSelector` (`@/components/selectors`) donde ya aplique.
- [ ] **Step 4: Run** los tests, `npm run type-check` y `npm run lint`. Además, `grep -rn "'OPERATOR'\|'READ_ONLY'\|'MANAGER'\|includes('ADMIN')" frontend/{app,features,components,contexts,lib}` no devuelve resultados. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(users): asignación de múltiples puestos y equipos; sin roles antiguos en el código`

---

### Task 9: ADR-0104 y actualización de contratos y playbook

**Files:**
- Create: `docs/10-architecture/adr/0104-rbac-action-permissions-roles-teams.md` (formato del ADR-0103: front-matter `id/title/status/date/author`; secciones Context, Decision, Consequences)
- Modify: `docs/10-architecture/adr/README.md` (índice)
- Modify: `docs/30-playbooks/add-role-permission.md`: reescritura. Cubre `action_permissions`, los verbos cerrados, cómo se clasifica un permiso nuevo en un paquete (y el test que lo obliga), puestos y equipos, la composición con su materialización, la regla de no escalada y SoD. Se borran la tabla de 4 roles y el "Pattern B"; `last_review` con la fecha del PR.
- Modify: `docs/40-quality/security.md` (sección RBAC)

- [ ] **Step 1: Write** el ADR con las decisiones del spec §2 y §2.1 y la referencia a los tests de garantía (`test_rbac_action_coverage.py`, `test_permission_references.py`, `test_rbac_bundles.py`).
- [ ] **Step 2: Verify** que los enlaces relativos de los documentos modificados apuntan a archivos existentes.
- [ ] **Step 3: Commit** — `docs(rbac): ADR-0104 y playbook de permisos, paquetes y puestos`

---

## Cierre de fase

- [ ] Suite completa del backend y `ruff check`: sin fallos nuevos respecto de la línea base de la Fase 0. Frontend: `npm run type-check`, `npm run lint` y los tests de `features/users`.
- [ ] En el servidor de desarrollo (Mutagen `Connected: Yes`), en este orden:
  1. `docker compose exec -T backend python manage.py migrate`;
  2. `docker compose exec -T backend python manage.py sync_permissions`;
  3. `docker compose exec -T backend python manage.py rbac_migrate_legacy_roles --plan`, y **mostrar la tabla al usuario para que la apruebe**;
  4. `rbac_migrate_legacy_roles --apply`.

  Después verificar en el navegador con un usuario de cada puesto: Ventas confirma pero no anula, Producción no ve remuneraciones y el Auditor ve los estados financieros pero no la configuración de usuarios.
- [ ] PR → `master` que referencie #69, #140 y #188.
- [ ] Escribir el plan de la Fase 2 (frontend). Consume `GET /permissions/catalog/`, `GET /permissions/bundles/`, `GET|PUT /groups/{id}/composition/`, `?kind=` y los codenames de la Task 3. La matriz de la Fase 2 se organiza por **paquetes** (módulo × nivel más capacidades sensibles), con permisos sueltos solo como opción avanzada.
