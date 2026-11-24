# Movimientos con el empleado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar pago de remuneración, anticipo y préstamo en un solo documento `EmployeeMovement` asignable (total o parcial) a liquidaciones, con préstamos con interés y plan de cuotas, y un historial único en el drawer del empleado.

**Architecture:** Tres tablas nuevas en `hr` (`EmployeeMovement`, `PayrollAllocation`, `LoanInstallment`) y un módulo de cálculo puro (`hr/loans.py`). Las tablas viejas (`SalaryAdvance`, `PayrollPayment` tipo SALARIO) se migran por una migración de datos reversible y se retiran al final del backend. `post_payroll` y el saldo a pagar leen las asignaciones; el saldo vive en **una sola función**. El frontend reemplaza la entidad "anticipos" por "movimientos" y añade la pestaña de historial al `EmployeeDrawer`.

**Tech Stack:** Django 5 + DRF, pytest, PostgreSQL; Next.js 16, TanStack Query, Zod, react-hook-form, vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-hr-employee-movements-design.md`. Ejecutar desde la rama `feat/hr-employee-movements`.

## Global Constraints

- Backend tests (desde `backend/`): `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest -p no:cacheprovider <ruta>`. Frontend (desde `frontend/`): `source ~/.nvm/nvm.sh && nvm use 24` antes de `npx vitest run <ruta>`; DoD: `npm run type-check` y `npm run lint` sin errores.
- Invariantes del repo (CLAUDE.md): cero `any`; tokens semánticos; imports por barrel; sin `useQuery` en componentes (hooks en `features/*/hooks/`); vistas ≤ 20 líneas, lógica en `services.py`; entidades con `defineEntity` y `@/components/entity-view`; **zero N+1** en listados; objetos relacionados creados en `services.py` bajo `@transaction.atomic`.
- Montos en CLP **enteros** (`decimal_places=0`); tasas con 6 decimales.
- Estados de `EmployeeMovement.status`: `DRAFT` | `POSTED` | `SETTLED` | `CANCELLED`. Tipos `kind`: `PAYMENT` | `ADVANCE` | `LOAN`. `rate_period`: `MONTHLY` | `ANNUAL`.
- Tasa anual → mensual: `r = (1 + anual)^(1/12) − 1` (efectiva). Cuota fija (francés), redondeo a pesos, la última cuota absorbe la diferencia.
- Interés se reconoce **al aplicar la cuota**: `interest = round(saldo_capital × r)`, `principal = cuota − interest`.
- Al editar una cuota se recalculan las **restantes** con el nuevo saldo y el plazo restante original. Rechazar cuota < interés del período; cuota ≥ saldo + interés liquida el préstamo.
- Tope legal: **advertencia** no bloqueante cuando la suma de descuentos de anticipo/préstamo supera `GlobalHRSettings.loan_deduction_cap_percent` (default `15`) de `Payroll.total_haberes`.
- Empleado archivado no recibe movimientos nuevos (misma regla y helper `_validate_assignable_employee` de ADR-0154).
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; nunca `git commit -a`; los archivos `frontend/components/shared/AccountingLinesTable.tsx`, `frontend/features/accounting/components/JournalEntryDrawer.tsx` y `frontend/features/accounting/entity-view/journalEntryLine.entity.tsx` pueden tener cambios del usuario: no incluirlos jamás.
- No pushear sin preguntar.

## Review Focus

1. Un anticipo asignado parcialmente a dos liquidaciones sucesivas: el saldo baja en cada una y la segunda no puede exceder el resto (Task 5).
2. Suma de asignaciones de una liquidación mayor que su `net_salary`: se rechaza, no produce un pasivo negativo (Task 5).
3. Borrar o anular una liquidación con asignaciones: el movimiento recupera su saldo y las cuotas vuelven a `PENDING` (Task 6).
4. Migración de datos: anticipo `DISCOUNTED` con liquidación, anticipo `PAID` sin liquidación y pago de sueldo conservan `journal_entry` y estado equivalente; el reverso reconstruye las filas (Task 4).
5. Doble envío concurrente de la misma asignación: el movimiento se bloquea con `lock_document` y no se asigna dos veces (Task 5).
6. Cuota editada que liquida el préstamo exactamente, o con redondeo: el movimiento queda `SETTLED` y no quedan cuotas `PENDING` (Tasks 2 y 5).

---

## File Structure

Backend (`backend/`):
- `hr/loans.py` (nuevo): matemática del préstamo, sin ORM.
- `hr/models.py`: `EmployeeMovement`, `PayrollAllocation`, `LoanInstallment`; luego se retira `SalaryAdvance`.
- `hr/services.py`: `EmployeeMovementService`, `payroll_balance`, cambios en `post_payroll` y `PayrollPaymentService`.
- `hr/serializers.py`, `hr/views.py`, `hr/urls.py`, `hr/apps.py`, `hr/relations.py`, `hr/payroll_pdf.py`: API, registros y relaciones.
- `hr/migrations/0016` (tope legal), `0017` (modelos), `0018` (datos), `0019` (retirar viejo).
- `accounting/models.py` + migración: `account_prestamos_trabajadores`, `account_intereses_prestamos`.
- `core/rbac/bundles.py`, `core/rbac/seed.py`, `core/user_service.py`, `core/prefix_registry.py`, `treasury/services.py`, `core/management/commands/setup_demo_data.py`: reemplazos puntuales.

Frontend (`frontend/`): `types/hr.ts`, `features/hr/api/hrApi.ts`, `features/hr/hooks/` (movimientos), `features/hr/entity-view/employeeMovement.entity.ts`, `features/hr/components/` (lista, drawer, historial, asignaciones), `app/(dashboard)/hr/movements/`, registros en `lib/`, ajustes contables en `features/settings/`.

---

### Task 1: Cuentas contables y tope legal en ajustes

**Files:**
- Modify: `backend/accounting/models.py` (junto a `account_anticipos`, ~línea 1217), `backend/hr/models.py` (`GlobalHRSettings`, línea 13), `backend/hr/serializers.py` (`GlobalHRSettingsSerializer`, línea 31)
- Create: `backend/accounting/migrations/<next>_hr_loan_accounts.py`, `backend/hr/migrations/0016_globalhrsettings_loan_cap.py`
- Test: `backend/hr/tests/test_employee_movements_settings.py`

**Interfaces:**
- Produces: `AccountingSettings.account_prestamos_trabajadores` y `account_intereses_prestamos` (FK a `Account`, null, `related_name` `settings_hr_prestamos` / `settings_hr_intereses`); `GlobalHRSettings.loan_deduction_cap_percent: Decimal` (default `Decimal("15")`).

- [ ] **Step 1: Write the failing tests** — `test_accounting_settings_has_loan_accounts` (campos existen, null por defecto, aceptan una cuenta) y `test_global_hr_settings_default_cap_is_15` (`GlobalHRSettings.get_solo().loan_deduction_cap_percent == Decimal("15")`; PATCH a `/api/hr/global-settings/` lo cambia a `20`).
- [ ] **Step 2: Run to verify RED** — `pytest hr/tests/test_employee_movements_settings.py -v`. Expected: FAIL (campos inexistentes).
- [ ] **Step 3: Implement** los tres campos con `verbose_name`/`help_text` en español como los vecinos, `makemigrations accounting hr`, y exponer `loan_deduction_cap_percent` en `GlobalHRSettingsSerializer`.
- [ ] **Step 4: Run to verify GREEN** — mismo comando. Expected: 2 passed.
- [ ] **Step 5: Commit** — `git add backend/accounting backend/hr && git commit -m "feat(hr): cuentas de préstamos/intereses y tope legal en ajustes"`.

### Task 2: Matemática del préstamo (`hr/loans.py`)

**Files:**
- Create: `backend/hr/loans.py`
- Test: `backend/hr/tests/test_loans_math.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class InstallmentSpec: number: int; year: int; month: int; principal: int; interest: int; amount: int`
  - `monthly_rate(rate: Decimal, period: str) -> Decimal` (`period` ∈ `"MONTHLY"`, `"ANNUAL"`; `rate` en fracción, `0.01` = 1 %).
  - `build_schedule(principal: int, r: Decimal, n: int, first: tuple[int, int]) -> list[InstallmentSpec]`
  - `split_installment(balance: int, r: Decimal, amount: int) -> tuple[int, int]` → `(principal_part, interest_part)`; lanza `ValueError` si `amount` < interés (cuota menor al interés).
  - `reschedule(balance: int, r: Decimal, remaining: int, first: tuple[int, int], start_number: int) -> list[InstallmentSpec]` (mismas reglas, numeración desde `start_number`).

- [ ] **Step 1: Write the failing tests** en `test_loans_math.py`:
  - `test_monthly_rate_annual_is_effective`: `monthly_rate(Decimal("0.12"), "ANNUAL")` ≈ `Decimal("0.009489")` (±1e-6) y `monthly_rate(Decimal("0.01"), "MONTHLY") == Decimal("0.01")`.
  - `test_schedule_600000_1pct_6_cuotas`: `build_schedule(600000, Decimal("0.01"), 6, (2026, 12))` → 6 cuotas, `[0].amount == 103529`, `[0].interest == 6000`, `[0].principal == 97529`, períodos `(2026,12)…(2027,5)`, `sum(principal) == 600000`.
  - `test_schedule_zero_rate`: tasa 0 → seis cuotas de 100000 sin interés.
  - `test_last_installment_absorbs_rounding`: `sum(principal) == principal_total` para `(1_000_003, 0.0123, 7)`.
  - `test_split_rejects_installment_below_interest`: `split_installment(600000, Decimal("0.01"), 5000)` lanza `ValueError`.
  - `test_reschedule_after_lower_installment`: con saldo 502471 tras la primera cuota, `reschedule(502471, 0.01, 5, (2027,1), 2)` → 5 cuotas, `sum(principal) == 502471`, numeración 2..6.
- [ ] **Step 2: Run to verify RED** — `pytest hr/tests/test_loans_math.py -v`. Expected: FAIL (`ModuleNotFoundError: hr.loans`).
- [ ] **Step 3: Implement** el módulo con `Decimal` y `ROUND_HALF_UP`; `build_schedule` y `reschedule` comparten una rutina interna `_amortize(balance, r, n, first, start_number)`: `cuota = balance·r / (1 − (1+r)^−n)` (o `balance/n` con `r == 0`), por cuota `interest = round(saldo·r)`, `principal = cuota − interest`, la última cuota fija `principal = saldo` restante. `build_schedule` = `_amortize(principal, r, n, first, 1)`.
- [ ] **Step 4: Run to verify GREEN** — Expected: 6 passed.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): cálculo de préstamo (cuota fija, recálculo del resto)"`.

### Task 3: Modelos `EmployeeMovement`, `PayrollAllocation`, `LoanInstallment`

**Files:**
- Modify: `backend/hr/models.py` (después de `SalaryAdvance`), `backend/core/prefix_registry.py` (agregar `EntityPrefix.EMPLOYEE_MOVEMENT` siguiendo `SALARY_ADVANCE`)
- Create: `backend/hr/migrations/0017_employee_movements.py`
- Test: `backend/hr/tests/test_employee_movement_models.py`

**Interfaces:**
- Consumes: `hr/loans.py` (Task 2) no se importa aquí.
- Produces:
  - `EmployeeMovement`: `employee` FK PROTECT `related_name="movements"`, `kind`, `date`, `amount` (`DecimalField(14,0)`), `notes`, `status` (default `DRAFT`), `journal_entry` FK SET_NULL `related_name="employee_movements"`, `rate` `DecimalField(8,6, null)`, `rate_period` (null), `installments_count` (null), `first_installment_year`/`first_installment_month` (null), `created_at`/`updated_at`, `edit_policy` (editable `{"DRAFT"}`, `mutable_when_locked={"notes"}`, `deletable=True`), `Kind`/`Status`/`RatePeriod` como `TextChoices`, `display_id` property con el prefijo nuevo.
  - `PayrollAllocation`: `movement` FK CASCADE `related_name="allocations"`, `payroll` FK CASCADE `related_name="allocations"`, `amount`, `principal_part`, `interest_part` (`DecimalField(14,0)`), `installment` FK SET_NULL a `LoanInstallment` (null); `CheckConstraint` `amount == principal_part + interest_part` y `amount > 0`.
  - `LoanInstallment`: `movement` FK CASCADE `related_name="installments"`, `number`, `year`, `month`, `principal`, `interest`, `amount`, `status` (`PENDING`|`APPLIED`), `unique_together (movement, number)`, orden por `number`.
  - Propiedades de `EmployeeMovement`: `applied_principal` (Σ `principal_part` de asignaciones de liquidaciones `POSTED`), `balance` (`amount − applied_principal` para `ADVANCE`/`LOAN`, `0` para `PAYMENT`).

- [ ] **Step 1: Write the failing tests** — `test_movement_defaults_and_display_id`, `test_allocation_check_constraint_rejects_inconsistent_parts` (`IntegrityError`), `test_installment_unique_per_movement`, `test_balance_counts_only_posted_payrolls` (una asignación a liquidación `DRAFT` no resta; a `POSTED` sí).
- [ ] **Step 2: Run to verify RED** — Expected: FAIL (`ImportError`).
- [ ] **Step 3: Implement** los modelos y `makemigrations hr` (nombre `0017_employee_movements`); `balance`/`applied_principal` usan una sola agregación (`aggregate`), no iteran.
- [ ] **Step 4: Run to verify GREEN** — `pytest hr/tests/test_employee_movement_models.py -v`. Expected: 4 passed.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): modelos de movimientos, asignaciones y cuotas"`.

### Task 4: Migración de datos reversible

**Files:**
- Create: `backend/hr/migrations/0018_migrate_advances_and_salary_payments.py`
- Test: `backend/hr/tests/test_movements_data_migration.py`

**Interfaces:**
- Consumes: modelos de Task 3 (vía `apps.get_model`).
- Produces: cada `SalaryAdvance` → `EmployeeMovement(kind=ADVANCE)` con `status` `DRAFT→DRAFT`, `PAID→POSTED`, `DISCOUNTED→SETTLED`, `CANCELLED→CANCELLED`, mismo `journal_entry`, `employee`, `amount`, `date`, `notes`, y si `payroll_id` una `PayrollAllocation(amount=principal_part=amount, interest_part=0)`; cada `PayrollPayment` con `payment_type="SALARIO"` → `EmployeeMovement(kind=PAYMENT, status=POSTED o CANCELLED según el pago)` con su `journal_entry`, y una asignación a su liquidación. Los pagos PREVIRED no se tocan. El reverso recrea `SalaryAdvance`/`PayrollPayment` desde los movimientos.

- [ ] **Step 1: Write the failing tests** con `MigrationExecutor` (estado `0017` → crear filas con los modelos históricos → migrar a `0018`): `test_forward_maps_advance_states_and_allocations` (los cuatro estados; el `DISCOUNTED` con liquidación tiene asignación de monto completo), `test_forward_keeps_journal_entry_links`, `test_forward_converts_salary_payments_only` (un PREVIRED sigue en `PayrollPayment`), `test_reverse_restores_original_rows`.
- [ ] **Step 2: Run to verify RED** — Expected: FAIL (migración inexistente).
- [ ] **Step 3: Implement** `RunPython(forward, reverse)` usando `bulk_create` por lotes; el reverso borra los movimientos migrados (`kind` ADVANCE/PAYMENT) tras recrear las filas viejas.
- [ ] **Step 4: Run to verify GREEN** — Expected: 4 passed. Luego `pytest hr -q` para confirmar que nada previo se rompió.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): migración de anticipos y pagos de sueldo a movimientos"`.

### Task 5: Servicio de movimientos y saldo único

**Files:**
- Modify: `backend/hr/services.py` (nueva clase `EmployeeMovementService` y función `payroll_balance`)
- Test: `backend/hr/tests/test_employee_movement_service.py`

**Interfaces:**
- Consumes: `hr/loans.py`, modelos de Task 3, `TreasuryService.create_movement` (como en `SalaryAdvanceService.create_advance_with_payment`, líneas 999-1050), `lock_document`.
- Produces:
  - `payroll_balance(payroll) -> Decimal` = `net_salary − Σ allocations(ADVANCE/LOAN) − Σ allocations(PAYMENT de movimientos POSTED)`. **Única fuente** del saldo a pagar.
  - `EmployeeMovementService.create(employee, kind, date, amount, *, notes="", loan: LoanTerms | None = None, treasury: TreasuryPayload | None = None, user=None) -> EmployeeMovement` (valida empleado asignable; con `treasury` genera el egreso, enlaza `journal_entry` y pasa a `POSTED`; `LOAN` genera cuotas con `build_schedule`).
  - `EmployeeMovementService.preview_schedule(amount: int, rate: Decimal, rate_period: str, installments: int, first: tuple[int,int]) -> list[InstallmentSpec]`.
  - `allocate(movement, payroll, amount: int | None = None) -> PayrollAllocation` (solo liquidación `DRAFT` del mismo empleado, movimiento `POSTED`; `amount` por defecto = saldo para `ADVANCE`, cuota pendiente más antigua para `LOAN`; valida saldo, `Σ allocations ≤ payroll.net_salary`, y para `LOAN` aplica `split_installment` y `reschedule` de las restantes si `amount` difiere de la cuota).
  - `deallocate(allocation)` (solo si la liquidación es `DRAFT`; la cuota vuelve a `PENDING` y se restituye el plan con `reschedule`).
  - `annul(movement, *, reason, user=None)` (solo `POSTED` sin asignaciones contabilizadas; anula el egreso en tesorería).
  - `cap_warning(payroll) -> str | None`.
  - `pay_payroll(payroll, **payment_kwargs) -> EmployeeMovement` (reemplaza `PayrollPaymentService.pay_salary`; mismo asiento y misma validación de `remaining = payroll_balance(payroll)`).

- [ ] **Step 1: Write the failing tests** — `test_advance_partial_allocations_across_two_payrolls` (anticipo 100000: asignar 40000 y luego 60000 a dos liquidaciones; tercera asignación de 1 falla), `test_allocation_exceeding_net_salary_is_rejected`, `test_loan_creates_schedule_and_posts_disbursement`, `test_loan_edited_installment_reschedules_remaining` (asignar 90000 en vez de 103529: las 5 restantes suman el capital que queda y el plazo sigue en 6), `test_installment_below_interest_rejected`, `test_installment_that_pays_off_settles_loan` (sin cuotas `PENDING`), `test_deallocate_restores_installment_and_balance`, `test_allocate_locks_movement_against_double_submit` (dos llamadas secuenciales con el mismo movimiento no sobreasignan), `test_archived_employee_rejected`, `test_annul_blocked_with_posted_allocation`, `test_pay_payroll_uses_payroll_balance`, `test_cap_warning_when_over_15_percent`.
- [ ] **Step 2: Run to verify RED** — `pytest hr/tests/test_employee_movement_service.py -v`. Expected: FAIL (`ImportError`).
- [ ] **Step 3: Implement** los métodos con `@transaction.atomic`; `allocate` toma `lock_document(movement)` primero. Reutilizar `_validate_assignable_employee` (ADR-0154) y los mensajes de `ValidationError` en español de los servicios existentes.
- [ ] **Step 4: Run to verify GREEN** — Expected: 12 passed.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): servicio de movimientos, asignaciones y saldo de liquidación único"`.

### Task 6: `post_payroll` y liquidaciones leen asignaciones

**Files:**
- Modify: `backend/hr/services.py` (`post_payroll` líneas ~607-756, `pay_salary` ~930-998), `backend/hr/serializers.py` (`PayrollListSerializer` `get_advances_total`/`get_remuneration_paid_*`, `PayrollDetailSerializer`), `backend/hr/payroll_pdf.py` (~línea 182), `backend/hr/views.py` (`PayrollViewSet`: acciones `pay_salary`, nuevas `allocations`)
- Test: `backend/hr/tests/test_post_payroll_allocations.py`

**Interfaces:**
- Consumes: `payroll_balance`, `EmployeeMovementService` (Task 5).
- Produces: `post_payroll(payroll)` acredita por cada asignación: anticipo → `account_anticipos`; préstamo → `account_prestamos_trabajadores` por `principal_part` y `account_intereses_prestamos` por `interest_part`; el pasivo `account_remuneraciones_por_pagar` = `net_salary − Σ asignaciones`; marca cuotas `APPLIED` y pasa el movimiento a `SETTLED` si `balance == 0`. Falta de cuenta de préstamo/interés con asignaciones de préstamo → `ValidationError` claro. Serializadores exponen `advances_total` (suma de asignaciones, mismo nombre de campo para no romper la lista), `allocations` (detalle) y `balance` (= `payroll_balance`). Al borrar una liquidación `DRAFT` sus asignaciones se eliminan en cascada y las cuotas vuelven a `PENDING` (señal o `PayrollViewSet.perform_destroy` vía servicio).

- [ ] **Step 1: Write the failing tests** — `test_post_payroll_with_advance_and_loan_balances_entry` (asiento cuadrado; créditos a anticipos, préstamos e intereses por los montos esperados; pasivo = `net − Σ`), `test_post_marks_installment_applied_and_settles_movement`, `test_post_requires_loan_accounts_when_loan_allocated`, `test_payroll_list_balance_matches_payment_service` (la lista y `pay_salary` usan el mismo valor), `test_deleting_draft_payroll_restores_installments`, `test_payroll_list_query_count_constant_with_allocations` (más liquidaciones con asignaciones no suman consultas).
- [ ] **Step 2: Run to verify RED** — Expected: FAIL.
- [ ] **Step 3: Implement** el cambio; `PayrollListSerializer` usa `prefetch_related("allocations__movement")` desde el selector/queryset del viewset. Mantener temporalmente `payroll.advances` (legado) sin usar para no romper imports hasta Task 8.
- [ ] **Step 4: Run to verify GREEN** — `pytest hr/tests/test_post_payroll_allocations.py hr -q`. Expected: nuevos 6 passed; los tests legados de anticipos pueden fallar y se reescriben en Task 8 (anotarlos en el ledger).
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): contabilización y saldos de liquidación desde asignaciones"`.

### Task 7: API de movimientos, permisos y registros

**Files:**
- Modify: `backend/hr/serializers.py`, `backend/hr/views.py`, `backend/hr/urls.py` (`router.register(r"employee-movements", EmployeeMovementViewSet, basename="employee-movements")`), `backend/hr/apps.py` (permiso `annul_employeemovement`, `UniversalRegistry` con label `hr.employeemovement`, `list_url="/hr/movements"`), `backend/core/rbac/bundles.py` y `seed.py` (bundle `hr.employee_movements` con `view/add/change/delete/annul_employeemovement`, mismos grupos que `hr.salary_advances`), `backend/core/user_service.py`, `backend/treasury/services.py` (~línea 940: `employee_movements` en la lista de vínculos protegidos)
- Test: `backend/hr/tests/test_employee_movement_api.py`

**Interfaces:**
- Produces: `GET/POST /api/hr/employee-movements/` (`?kind=&employee=&status=&payroll=`), `GET /{id}/` con `installments`, `allocations`, `balance`, `status_display`, `kind_display`, `employee_name`; acciones `POST /{id}/annul/`, `POST /{id}/allocate/` (`{payroll, amount?}`), `POST /{id}/deallocate/` (`{allocation}`), `POST /preview-schedule/` (`{amount, rate, rate_period, installments, first_year, first_month}` → lista de cuotas), `GET /api/hr/employees/{id}/movements/` (historial paginado del empleado, mismo serializador); `EmployeeMovementSerializer` y `EmployeeMovementListSerializer`; selector `employee_movements_for_list()` con `select_related("employee__contact", "journal_entry__treasury_movement")` y `prefetch_related("installments", "allocations__payroll")`.

- [ ] **Step 1: Write the failing tests** — crear anticipo con tesorería (201, `status="POSTED"`), crear préstamo (cuotas en la respuesta), `preview-schedule` coincide con `build_schedule`, `allocate`/`deallocate`, `annul`, permisos (usuario sin `add_employeemovement` recibe 403), empleado archivado → 400, `test_list_query_count_does_not_grow_with_rows`, filtro `?kind=LOAN`, `GET employees/{id}/movements/` devuelve los tres tipos juntos ordenados por fecha descendente.
- [ ] **Step 2: Run to verify RED** — Expected: FAIL (404 en la ruta).
- [ ] **Step 3: Implement** respetando vistas ≤ 20 líneas por acción (la lógica en `EmployeeMovementService`); `core/user_service.py` pasa a serializar movimientos del empleado; `treasury/services.py` agrega la relación `employee_movements`.
- [ ] **Step 4: Run to verify GREEN** — `pytest hr/tests/test_employee_movement_api.py core/tests -q --deselect core/tests/test_no_utc_today.py`. Expected: los nuevos pasan; `core` se mantiene verde.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): API de movimientos, permisos y registros"`.

### Task 8: Relaciones documentales y retiro de lo legado

**Files:**
- Modify: `backend/hr/relations.py` (registrar `hr.employeemovement` con dominio `hr`; reemplazar `hr.salaryadvance`; proveedores empleado ↔ movimiento ↔ liquidación; `canonical_url` de `hr.salaryadvance` ya no se emite), `backend/hr/models.py` (eliminar `SalaryAdvance`; en `PayrollPayment` conservar solo PREVIRED en `PaymentType`/servicios), `backend/hr/services.py` (borrar `SalaryAdvanceService` y `pay_salary`), `backend/hr/views.py` + `urls.py` (quitar `advances`), `backend/hr/apps.py` (quitar registro `hr.salaryadvance`), `backend/core/rbac/*` (quitar bundle viejo), `backend/core/tests/test_document_relations.py` (mapa de dominios), `backend/core/management/commands/setup_demo_data.py`
- Create: `backend/hr/migrations/0019_remove_salaryadvance.py`
- Test: reescribir `backend/hr/tests/test_salary_advance_lifecycle.py` → `test_employee_movement_lifecycle.py`; actualizar `test_hr_relations.py`, `core/tests/test_deletion_policy_consistency.py`, `core/tests/test_state_map_consistency.py` (Employee movement entra en Anulación/estado), `core/tests/conftest.py` (fixtures N+1)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: relaciones `employee ↔ movement` (`role="employee_movement"`), `movement ↔ payroll` por cada asignación (`amount` de la asignación, `is_dependency=True` para que la ventana no la oculte), `journal_entry` del movimiento por los enlaces indirectos existentes.

- [ ] **Step 1: Write the failing tests** — `test_employee_relations_lists_movements`, `test_movement_relations_show_payrolls_with_allocation_amount`, el ciclo de vida de anticipo/préstamo reescrito (crear → asignar → contabilizar → `SETTLED`; anular), y los tests de política de borrado/estado esperando `EmployeeMovement`.
- [ ] **Step 2: Run to verify RED** — Expected: FAIL.
- [ ] **Step 3: Implement** y generar `0019` (`RemoveModel SalaryAdvance` + `HistoricalSalaryAdvance` si existe); `PayrollPayment` deja de aceptar `SALARIO` en el servicio (el campo y sus filas ya migradas se limpian en esta migración: borrar los SALARIO migrados).
- [ ] **Step 4: Run to verify GREEN** — `pytest hr core -q --deselect core/tests/test_no_utc_today.py`. Expected: verde completo (anotar los fallos previos conocidos, `partners` y `test_no_utc_today`, sin tocarlos).
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): relaciones de movimientos y retiro de SalaryAdvance"`.

### Task 9: Frontend — tipos, API y hooks

**Files:**
- Modify: `frontend/types/hr.ts` (reemplazar `SalaryAdvance` por `EmployeeMovement`, `LoanInstallment`, `PayrollAllocation`; mantener alias exportado hasta Task 12 si algo aún lo importa), `frontend/features/hr/api/hrApi.ts` y `api/index.ts`, `frontend/features/hr/index.ts`
- Create: `frontend/features/hr/hooks/useEmployeeMovements.ts`, `useEmployeeMovementMutations.ts`, `useEmployeeMovementHistory.ts`, `frontend/features/hr/hooks/queryKeys` (si no existe, extender el existente), `frontend/features/hr/schemas/employeeMovement.schema.ts` (Zod + tipos derivados)
- Test: `frontend/features/hr/__tests__/hrApi.movements.test.ts`

**Interfaces:**
- Produces: `hrApi.getEmployeeMovements(filters)`, `getEmployeeMovement(id)`, `createEmployeeMovement(payload)`, `annulEmployeeMovement(id, reason)`, `allocateMovement(id, {payroll, amount?})`, `deallocateMovement(id, allocationId)`, `previewLoanSchedule(payload)`, `getEmployeeMovementHistory(employeeId)`; hooks `useEmployeeMovements(filters)`, `useEmployeeMovementHistory(employeeId | null)`, `useEmployeeMovementMutations()` con `createMovement`, `annulMovement`, `allocate`, `deallocate`, `previewSchedule`; esquema `employeeMovementFormSchema` (discriminado por `kind`: `LOAN` exige `rate`, `rate_period`, `installments_count`, `first_installment_year/month`).

- [ ] **Step 1: Write the failing tests** — `getEmployeeMovements` llama `/hr/employee-movements/` con los filtros; `previewLoanSchedule` envía el cuerpo esperado; el esquema rechaza `LOAN` sin tasa y acepta `ADVANCE` sin campos de préstamo.
- [ ] **Step 2: Run to verify RED** — `cd frontend && source ~/.nvm/nvm.sh && nvm use 24 && npx vitest run features/hr/__tests__/hrApi.movements.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** API, esquemas y hooks (invalidar `["hr","employee-movements"]`, `["hr","payrolls"]` y las relaciones del empleado en cada mutación).
- [ ] **Step 4: Run to verify GREEN** — mismo comando + `npm run type-check`. Expected: passed / 0 errores.
- [ ] **Step 5: Commit** — `git add frontend/types frontend/features/hr && git commit -m "feat(hr): tipos, API y hooks de movimientos"`.

### Task 10: Frontend — lista, drawer del movimiento y registros

**Files:**
- Create: `frontend/features/hr/entity-view/employeeMovement.entity.ts`, `frontend/features/hr/components/EmployeeMovementClientView.tsx`, `EmployeeMovementDrawer.tsx`, `LoanScheduleTable.tsx`, `frontend/features/hr/employeeMovementActions.tsx`, `frontend/app/(dashboard)/hr/movements/page.tsx` + `MovementsPageClient.tsx`
- Modify: `frontend/features/hr/navigation.ts` (ruta `/hr/movements`, etiqueta «Movimientos»), `frontend/features/hr/components/index.ts`, `frontend/lib/entity-registry.ts`, `frontend/lib/entity-drawers.tsx`, `frontend/lib/searchableEntityRoutes.ts`, `frontend/features/comments/lib/entityLabels.ts`, `frontend/audit-views.ts`, `frontend/features/audit/**` (referencias a `salaryadvance`), `frontend/app/(dashboard)/hr/page.tsx`, `frontend/lib/__tests__/entity-drawers.record.test.tsx`
- Test: `frontend/features/hr/components/__tests__/EmployeeMovementDrawer.test.tsx`

**Interfaces:**
- Consumes: hooks de Task 9.
- Produces: `employeeMovementEntity = defineEntity<EmployeeMovement>()` (campos: folio, empleado, tipo, fecha, monto, saldo, estado vía `StatusBadge`), `employeeMovementViews`; drawer con pestañas **Datos** (formulario `react-hook-form` + `zodResolver`; selector de tipo; bloque de préstamo con tasa, periodicidad, cuotas, primera cuota y `LoanScheduleTable` alimentada por `previewLoanSchedule`) y **Relaciones** (`DocumentRelationsTab label="hr.employeemovement"`); `openEntity("hr.employeemovement", id)` funcional; el drawer de anticipo antiguo se elimina (`AdvanceDrawer`, `SalaryAdvanceClientView`, `salaryAdvance.entity.ts`, `salaryAdvanceActions.tsx`, `useSalaryAdvances.ts`, `useAdvanceMutations.ts`, ruta `/hr/advances`).

- [ ] **Step 1: Write the failing tests** — `EmployeeMovementDrawer`: crear anticipo envía `kind: "ADVANCE"`; elegir préstamo muestra los campos de tasa y pide la vista previa (tabla con la cuota esperada del mock); en modo vista con movimiento `POSTED` los campos están deshabilitados pero la pestaña Relaciones es accionable; `entity-drawers.record.test.tsx` actualizado a `hr.employeemovement`.
- [ ] **Step 2: Run to verify RED** — `npx vitest run features/hr lib/__tests__/entity-drawers.record.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** con `DrawerLayout` como en `AbsenceDrawer` (rightRail `EntitySidebar`, claves de almacenamiento `erpgrafico.drawer.sidebar.employeemovement`); botones de la pestaña con `type="button"`; redirigir `/hr/advances` a `/hr/movements` en un `page.tsx` mínimo con `redirect`.
- [ ] **Step 4: Run to verify GREEN** — mismos tests + `npm run type-check` + `npm run lint`. Expected: verdes, 0 errores.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): lista y drawer de movimientos con empleado"`.

### Task 11: Frontend — historial unificado en `EmployeeDrawer`

**Files:**
- Create: `frontend/features/hr/components/EmployeeMovementsHistory.tsx`
- Modify: `frontend/features/hr/components/EmployeeDrawer.tsx` (nueva pestaña **Movimientos** fuera del `lockFormTabs`, como Relaciones), `frontend/features/hr/components/__tests__/EmployeeDrawer.relations.test.tsx` (mocks), `frontend/features/hr/index.ts`
- Test: `frontend/features/hr/components/__tests__/EmployeeMovementsHistory.test.tsx`

**Interfaces:**
- Consumes: `useEmployeeMovementHistory(employeeId)`.
- Produces: `<EmployeeMovementsHistory employeeId onOpen />`: lista con tipo (etiqueta), fecha, monto, saldo pendiente, `StatusBadge`; fila de préstamo expandible a sus cuotas (`LoanScheduleTable` de Task 10 en modo lectura); acciones «Nuevo anticipo», «Nuevo préstamo» abren `EmployeeMovementDrawer` con el empleado fijado; estados `loading`/`empty`/`error`.

- [ ] **Step 1: Write the failing tests** — muestra los tres tipos mezclados ordenados por fecha, saldo y estado de cada uno; un préstamo expandido lista sus cuotas con `APPLIED`/`PENDING`; vacío muestra el estado vacío; la pestaña aparece solo con `employee.id` y es clicable en modo vista.
- [ ] **Step 2: Run to verify RED** — `npx vitest run features/hr/components/__tests__/EmployeeMovementsHistory.test.tsx features/hr/components/__tests__/EmployeeDrawer.relations.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** y añadir la pestaña con badge = cantidad de movimientos con saldo pendiente.
- [ ] **Step 4: Run to verify GREEN** — mismos tests + type-check + lint. Expected: verdes.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): historial de movimientos en la ficha del empleado"`.

### Task 12: Frontend — asignaciones en la liquidación y ajustes

**Files:**
- Modify: `frontend/features/hr/components/payrolls/PayrollDetailView.tsx` (reemplazar `AdvancesSection`, líneas ~149-151 y ~384-600: usar `payroll.balance` y `payroll.allocations`; sección **Asignaciones**: movimientos pendientes del empleado con botón «Asignar», monto/cuota editable, advertencia de tope; quitar `getPendingAdvancesForEmployee`/`updateAdvance`), `frontend/features/hr/components/PayrollClientView.tsx` (modo de pago `ADVANCE` desaparece de `PaymentModal`; el pago de sueldo usa `pay_salary` que ahora crea un movimiento), `frontend/features/settings/schemas/hr.ts`, `frontend/features/settings/types/index.ts`, `frontend/features/settings/components/UnifiedAccountsView.tsx` (campos «Préstamos a Trabajadores (Activo)» e «Intereses de Préstamos (Ingreso)» junto a Anticipos), `frontend/features/settings/**` del formulario global de RRHH (campo `loan_deduction_cap_percent`)
- Test: `frontend/features/hr/components/payrolls/__tests__/PayrollAllocationsSection.test.tsx` (extraer la sección a `PayrollAllocationsSection.tsx`)

**Interfaces:**
- Consumes: `allocateMovement`, `deallocateMovement`, hooks de Task 9; campos `allocations`, `balance`, `cap_warning` del serializador de liquidación (agregar `cap_warning` al detalle si Task 6 no lo expuso).
- Produces: `<PayrollAllocationsSection payrollId employeeId isPosted allocations onChanged />`.

- [ ] **Step 1: Write the failing tests** — con liquidación `DRAFT`: lista asignaciones y permite «Quitar»; asignar un préstamo muestra la cuota sugerida editable y envía `{payroll, amount}`; con la advertencia de tope muestra el aviso sin bloquear; con liquidación `POSTED` las acciones no aparecen; los campos nuevos de ajustes se guardan.
- [ ] **Step 2: Run to verify RED** — `npx vitest run features/hr/components/payrolls features/settings`. Expected: FAIL.
- [ ] **Step 3: Implement** y limpiar importaciones muertas; `npm run type-check` debe quedar sin referencias a `SalaryAdvance`.
- [ ] **Step 4: Run to verify GREEN** — `npx vitest run features/hr features/settings lib && npm run type-check && npm run lint`. Expected: verdes; los fallos previos de `partners`, `Step2_DTE` y Storybook (Chromium) se anotan sin tocar.
- [ ] **Step 5: Commit** — `git commit -m "feat(hr): asignaciones en liquidación y cuentas de préstamos en ajustes"`.

### Task 13: ADR, contratos y verificación final

**Files:**
- Create: `docs/10-architecture/adr/0156-hr-employee-movements.md` (mismo formato de front-matter que ADR-0154/0155; confirmar que 0156 esté libre con `ls docs/10-architecture/adr`)
- Modify: `docs/10-architecture/adr/README.md`, `docs/20-contracts/deletion-policy.md` (EmployeeMovement: Anulación; SalaryAdvance retirado), `docs/20-contracts/state-map.md` (estados `DRAFT/POSTED/SETTLED/CANCELLED`), `docs/20-contracts/document-relations.md` (cobertura RRHH: `hr.employeemovement`), `docs/20-contracts/permission-config-entities.md` si lista bundles de RRHH

- [ ] **Step 1: Write the ADR** con la decisión (unificar, modelo, interés efectivo y cuota fija, recálculo del resto, saldo único, migración), consecuencias (`PayrollPayment` queda solo para Previred hasta el subproyecto 2, `hr.salaryadvance` desaparece) y referencias a los ADR 0091, 0154, 0155; fila en el índice.
- [ ] **Step 2: Update the contracts** listados.
- [ ] **Step 3: Verify** — backend: `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest hr core -q -p no:cacheprovider --deselect core/tests/test_no_utc_today.py`; frontend: `cd frontend && npx vitest run features/hr features/documents features/settings lib && npm run type-check && npm run lint`. Expected: verde completo salvo los fallos previos conocidos.
- [ ] **Step 4: Commit** — `git add docs && git commit -m "docs: ADR-0156 movimientos con el empleado"`.
