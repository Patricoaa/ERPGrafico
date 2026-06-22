---
layer: 50-audit
doc: bancos/fase-6-lineas-credito
status: complete
owner: core-team
last_review: 2026-06-22
kind: phase
---

# Fase 6 · Líneas de Crédito Rotativas

**Objetivo:** Modelar el concepto de línea de crédito bancaria (REVOLVING),
integrarla con préstamos existentes (`BankLoan`) y exponerla como subtab
dentro del Centro de Bancos.

---

## Tareas

### F6.1 · Modelo CreditLine + FK en BankLoan

- **Objetivo:** Crear el modelo `CreditLine` con campos de términos
  financieros, vigencia, estado y propiedades calculadas (`drawn_amount`,
  `available_amount`, `utilization_rate`). Agregar FK nullable en `BankLoan`.
- **Archivos clave:**
  - `backend/treasury/models.py`
  - `backend/treasury/migrations/0084_creditline_model.py`
- **DoD:** `CreditLine.objects.create(...)` funciona; `cl.drawn_amount` es 0
  sin préstamos; `BankLoan.credit_line_id` es nullable.

### F6.2 · Data migration: auto-crear líneas para bancos existentes

- **Objetivo:** Para cada banco con `BankLoan` no-DRAFT/PAID, crear una
  `CreditLine` con `approved_amount = 120%` del principal total y asociar
  los préstamos.
- **Archivos clave:**
  - `backend/treasury/migrations/0085_auto_create_credit_lines_for_existing_banks.py`
- **DoD:** `python manage.py migrate` ejecuta sin error; revisar datos.

### F6.3 · Validación de cupo en BankLoan.clean() + LoanService.disburse()

- **Objetivo:** Rechazar préstamos cuyo principal exceda el cupo disponible.
- **Archivos clave:**
  - `backend/treasury/models.py` (BankLoan.clean)
  - `backend/treasury/loan_service.py` (disburse)
- **DoD:** Tests de validación pasan.

### F6.4 · API REST (CRUD + overview)

- **Objetivo:** Endpoints CRUD para CreditLine + action `overview` que
  devuelve detalle enriquecido con préstamos asociados.
- **Archivos clave:**
  - `backend/treasury/serializers.py`
  - `backend/treasury/views.py`
  - `backend/treasury/urls.py`
- **DoD:** `python manage.py test treasury.tests.test_credit_lines_api` pasa.

### F6.5 · Permisos + SearchableEntity + task programada

- **Objetivo:** Registrar CreditLine como entidad buscable con prefijo `CL-`,
  agregar permiso `view_creditline` al rol OPERATOR, y crear task que
  marque EXPIRED las líneas vencidas.
- **Archivos clave:**
  - `backend/treasury/apps.py`
  - `backend/core/management/commands/sync_permissions.py`
  - `backend/treasury/tasks.py`
- **DoD:** `python manage.py sync_permissions` agrega permiso sin error.

### F6.6 · Frontend: feature module credit-lines

- **Objetivo:** Feature module completo con types, api, hooks, componentes
  de lista (DataTableView) y formulario (Drawer). Integración como subtab
  dentro de `bank-center/[bankId]`.
- **Archivos clave:**
  - `frontend/features/treasury/credit-lines/`
  - `frontend/features/treasury/components/BankPageHeader.tsx`
  - `frontend/features/treasury/components/BankCenterDashboard.tsx`
  - `frontend/features/treasury/loans/types.ts`
  - `frontend/lib/entity-registry.ts`, `badge-resolvers.ts`
  - `frontend/features/treasury/hooks/queryKeys.ts`
  - `frontend/app/(dashboard)/treasury/bank-center/[bankId]/credit-lines/page.tsx`
- **DoD:** `npm run type-check` y `npm run lint` pasan.

---

## Commits de la fase

```
feat(treasury): add CreditLine model + FK in BankLoan (F6.1)
feat(treasury): data migration auto-create credit lines (F6.2)
feat(treasury): validate available amount on loan create/disburse (F6.3)
feat(treasury): CreditLine CRUD API + overview endpoint (F6.4)
feat(treasury): permissions, searchable entity, expiry task (F6.5)
feat(treasury): frontend credit-lines feature module + subtab (F6.6)
```

---

## Verificación de la fase

```bash
cd backend && venv/bin/python -m pytest treasury/tests/test_credit_lines.py -v
cd backend && venv/bin/python -m pytest treasury/tests/test_credit_lines_api.py -v
cd frontend && npm run type-check
cd frontend && npm run lint
```
