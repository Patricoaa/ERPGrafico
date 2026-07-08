---
layer: 50-audit
doc: bancos/fase-6-lineas-credito
status: complete
owner: core-team
last_review: 2026-06-22
kind: phase
---

# Fase 6 · Líneas de Crédito (Sobregiro)

**Objetivo original:** Modelar el concepto de línea de crédito bancaria,
integrarla con préstamos existentes (`BankLoan`) y exponerla como subtab
del Centro de Bancos.

**Refactor (ADR-0050):** CreditLine se rediseñó como sobregiro vinculado a
`TreasuryAccount` (CHECKING), desvinculado de `BankLoan`. El `used_amount`
se calcula desde `TreasuryMovement` (`CREDIT_LINE_DRAW`/`CREDIT_LINE_REPAY`),
ya no desde préstamos.

---

## Tareas

### F6.1 · Modelo CreditLine + TreasuryAccount

- **Objetivo:** Crear el modelo `CreditLine` con `OneToOneField` a
  `TreasuryAccount` (CHECKING), campos de términos financieros, vigencia,
  estado y propiedades calculadas (`used_amount`, `available_amount`,
  `utilization_rate`).
- **Archivos clave:**
  - `backend/treasury/models.py` — CreditLine (~line 2479)
  - `backend/treasury/migrations/0084_creditline_model.py`
  - `backend/treasury/migrations/0086_refactor_credit_line.py`
- **DoD:** `CreditLine.objects.create(treasury_account=...)` funciona;
  `cl.used_amount` es 0 sin movimientos; `cl.available_amount == cl.credit_limit`.

### F6.2 · Data migration: migrar líneas legacy (0085 → 0086)

- **Objetivo:** Migrar datos del modelo anterior (con `bank` y `approved_amount`)
  al nuevo (con `treasury_account` y `credit_limit`). La migración 0085 crea
  líneas para bancos existentes; la 0086 transforma los datos.
- **Archivos clave:**
  - `backend/treasury/migrations/0085_auto_create_credit_lines_for_existing_banks.py`
  - `backend/treasury/migrations/0086_refactor_credit_line.py`
- **DoD:** `python manage.py migrate` ejecuta sin error.

### F6.3 · Auto-draw en TreasuryService + available_liquidity

- **Objetivo:** Cuando un movimiento OUTBOUND/TRANSFER excede el saldo de
  una cuenta CHECKING con línea de crédito, crear automáticamente un
  `CREDIT_LINE_DRAW` por el excedente. Exponer `available_liquidity` en
  `TreasuryAccount`.
- **Archivos clave:**
  - `backend/treasury/services.py` — TreasuryService.create_movement()
  - `backend/treasury/models.py` — TreasuryAccount.available_liquidity
- **DoD:** Movimiento OUTBOUND por $200 en cuenta con saldo $100 y línea
  de $1000 crea CREDIT_LINE_DRAW por $100. Se rechaza si excede
  `balance + credit_line.available_amount`.

### F6.4 · API REST (CRUD + overview)

- **Objetivo:** Endpoints CRUD para CreditLine + action `overview` que
  devuelve detalle enriquecido con movimientos CREDIT_LINE_DRAW/REPAY.
- **Archivos clave:**
  - `backend/treasury/serializers.py` — CreditLineSerializer + CreditLineWriteSerializer
  - `backend/treasury/views.py` — CreditLineViewSet
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
  en `bank-center/[bankId]` y como sección dentro del TreasuryAccountDrawer
  para cuentas CHECKING.
- **Archivos clave:**
  - `frontend/features/treasury/credit-lines/`
  - `frontend/features/treasury/components/TreasuryAccountDrawer.tsx`
  - `frontend/features/treasury/components/BankCenterDashboard.tsx`
  - `frontend/lib/entity-registry.ts`, `badge-resolvers.ts`
  - `frontend/features/treasury/hooks/queryKeys.ts`
  - `frontend/app/(dashboard)/treasury/bank-center/[bankId]/credit-lines/page.tsx`
- **DoD:** `npm run type-check` y `npm run lint` pasan.

---

## Commits de la fase

```
feat(treasury): add CreditLine model + FK in BankLoan (F6.1 — original)
feat(treasury): data migration auto-create credit lines (F6.2 — original)
feat(treasury): validate available amount on loan create/disburse (F6.3 — original)
feat(treasury): CreditLine CRUD API + overview endpoint (F6.4)
feat(treasury): permissions, searchable entity, expiry task (F6.5)
feat(treasury): frontend credit-lines feature module + subtab (F6.6)
feat: refactor CreditLine as overdraft linked to TreasuryAccount (refactor — ADR-0050)
```

---

## Verificación de la fase

```bash
cd backend && venv/bin/python -m pytest treasury/tests/test_credit_lines.py -v
cd backend && venv/bin/python -m pytest treasury/tests/test_credit_lines_api.py -v
cd frontend && npm run type-check
cd frontend && npm run lint
```
