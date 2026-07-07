---
layer: 50-audit
doc: bancos/fase-2-creditos-bancarios
status: active
owner: core-team
last_review: 2026-06-02
kind: roadmap
---

# Fase 2 — Créditos / préstamos bancarios (CLP + UF)

## Objetivo de la fase
Modelar el proceso completo de créditos bancarios (hoy ausente): la deuda como pasivo, la
tabla de amortización, el desembolso al banco y el pago de cuotas (capital + interés +
seguros), con indexación **UF** desde el inicio (decisión del usuario). Esfuerzo: XL.

> **Contratos:** registrar `BankLoan` y `LoanInstallment` en `ENTITY_REGISTRY`
> (`display_id` `CRE-{id}` / `CUO-{id}`); estados nuevos en `state-map.md` + `STATUS_MAP`;
> montos `DecimalField` + `MoneyDisplay`; ADR-0033 al cierre.

**Patrón base:** una `TreasuryAccount` `CREDIT_CARD`-style de tipo **LIABILITY** representa
la deuda (préstamo por pagar). Desembolso = INBOUND al banco. Pago de cuota = movimiento(s)
que **debitan** el pasivo (amortización capital) + asientan interés/seguros como gasto.
Todo vía `TreasuryService.create_movement`.

**Referencias a reutilizar:** `TerminalBatch` (entidad con status + JE + movimiento),
`CheckService` (lifecycle + reversa), `AccountingSettings` (cuentas configurables).

---

## Sub-bloque A — Indexación UF (prerequisito)

### F2.1 · Modelo `IndicatorValue` (UF/UTM/USD) + feed
- **Objetivo:** no existe tabla de valores UF/tipo de cambio. Crear el almacén de valores
  diarios para indexar créditos (y futura multi-moneda en conciliación, gap B7).
- **Dificultad:** M
- **Archivos clave:** `backend/finances/models.py` (o nueva app `indicators` si se prefiere
  aislar), `finances/services.py`, migración.
- **Cambios esperados:**
  - Modelo `IndicatorValue(indicator [UF|UTM|USD], date, value)`, unique `(indicator, date)`.
  - Helper `get_value(indicator, date)` con fallback al último valor previo.
  - Carga **manual** (CRUD mínimo) + **opcional** task que consulta `mindicador.cl`
    (API pública gratuita, alineado con presupuesto PYME — ver `feedback_pyme_budget`).
    Si no hay red, el sistema funciona con carga manual.
- **DoD:** test: `get_value('UF', fecha)` retorna el valor cargado o el último previo;
  unique constraint impide duplicar `(indicator, date)`.

---

## Sub-bloque B — Modelo del préstamo

### F2.2 · Modelo `BankLoan`
- **Objetivo:** representar el crédito.
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/models.py` (o nueva app `loans` si crece; mantener
  en treasury para reusar infra), migración.
- **Cambios esperados:** modelo `BankLoan` con:
  - `lender` (FK `Bank`), `loan_number`, `currency` (`CLP`|`UF`),
  - `principal` (monto original), `interest_rate` (anual o mensual — documentar cuál),
  - `amortization_system` (`FRENCH` cuota fija | `LINEAR` capital fijo),
  - `term_months`, `start_date`, `first_due_date`,
  - `disbursement_account` (FK `TreasuryAccount` banco donde se recibió),
  - `liability_account` (FK `TreasuryAccount` tipo LIABILITY = "préstamo por pagar"),
  - `insurance_monthly` (seguro desgravamen/cesantía, opcional),
  - `status` (`DRAFT`/`ACTIVE`/`PAID`/`REFINANCED`/`DEFAULTED`),
  - `notes`, auditoría, `HistoricalRecords`. `display_id` = `CRE-{id}`.
  - Garantías: campo opcional `collateral_notes` (modelo dedicado queda fuera del MVP).
- **DoD:** `manage.py check` ok; migración creada.

### F2.3 · Modelo `LoanInstallment` (tabla de amortización)
- **Objetivo:** cada cuota con su desglose.
- **Dificultad:** S
- **Archivos clave:** `backend/treasury/models.py`, migración.
- **Cambios esperados:** `LoanInstallment(loan FK, number, due_date, principal_amount,
  interest_amount, insurance_amount, total_amount, outstanding_balance, status
  [PENDING|PAID|OVERDUE|PARTIAL], paid_at, payment_movement FK TreasuryMovement null)`.
  Para créditos UF, los montos se guardan **en UF** y se convierten a CLP al pagar.
- **DoD:** migración; índice por `(loan, status)` y `due_date`.

---

## Sub-bloque C — Lógica de negocio

### F2.4 · `LoanService.generate_schedule()` — tabla de amortización
- **Objetivo:** generar las N cuotas según sistema francés o lineal.
- **Dificultad:** L
- **Archivos clave:** `backend/treasury/loan_service.py` (nuevo).
- **Cambios esperados:**
  - Francés (cuota fija): `cuota = P · i / (1 - (1+i)^-n)`; repartir capital/interés por cuota.
  - Lineal: capital constante, interés sobre saldo.
  - Sumar `insurance_monthly` por cuota si aplica.
  - Persistir `LoanInstallment` con `outstanding_balance` decreciente.
- **DoD:** test: préstamo $12.000.000 a 12 meses 1%/mes francés → 12 cuotas, suma de capital
  == principal, saldo final 0, primera cuota interés = principal·i.

### F2.5 · `LoanService.disburse()` — desembolso
- **Objetivo:** registrar la entrada del dinero al banco y el nacimiento de la deuda.
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/loan_service.py`.
- **Cambios esperados:** `TreasuryService.create_movement` INBOUND al `disbursement_account`
  con origen contable = `liability_account` (crédito al pasivo); `status` → `ACTIVE`.
  Generar la tabla (F2.4) si no existe.
- **DoD:** test: tras desembolsar, saldo del banco sube por `principal` y el pasivo refleja
  la deuda; existen N `LoanInstallment` PENDING.

### F2.6 · `LoanService.pay_installment()` — pago de cuota
- **Objetivo:** pagar una cuota repartiendo capital / interés / seguro.
- **Dificultad:** L
- **Archivos clave:** `backend/treasury/loan_service.py`.
- **Cambios esperados:**
  - OUTBOUND desde el banco por el `total_amount` (en CLP; si UF, convertir con F2.1 al día
    de pago).
  - Asiento repartido: **debe** `liability_account` (amortiza capital, baja deuda),
    **debe** cuenta de gasto `interest_expense_account` (interés),
    **debe** cuenta gasto `insurance_expense_account` (seguro) — cuentas en `AccountingSettings`
    (ver Fase 5 F5.1; mientras tanto, parámetros del servicio).
  - Marcar `LoanInstallment` PAID, vincular `payment_movement`.
  - Si todas PAID → `BankLoan.status = PAID`.
- **DoD:** test: pagar una cuota baja el pasivo por `principal_amount`, registra gasto por
  interés+seguro, y la cuota queda PAID con su movimiento vinculado.

### F2.7 · Conversión UF → CLP en pagos
- **Objetivo:** créditos en UF se pagan en CLP al valor del día.
- **Dificultad:** M
- **Precondiciones:** F2.1, F2.6
- **Cambios esperados:** en `pay_installment`, si `loan.currency == 'UF'`, `monto_clp =
  installment.total_amount(UF) · IndicatorValue.get_value('UF', fecha_pago)`. Guardar el
  valor UF usado en notas/campo para trazabilidad.
- **DoD:** test: cuota de 10 UF pagada con UF=37.000 genera OUTBOUND por $370.000.

### F2.8 · Prepago / refinanciación (básico)
- **Objetivo:** permitir pago anticipado total y marcar refinanciación.
- **Dificultad:** M
- **Cambios esperados:** `prepay(loan)` (paga saldo insoluto, cuotas pendientes →
  cancela/recalcula); `refinance(loan)` → `status REFINANCED` + nota al nuevo crédito.
- **DoD:** test: prepago deja saldo 0 y status PAID.

### F2.9 · Devengo de interés mensual (Celery, opcional contable)
- **Objetivo:** devengar el interés del periodo aunque no se pague (criterio devengado).
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/tasks.py`, beat schedule.
- **Cambios esperados:** task mensual que crea el asiento de interés devengado por crédito
  ACTIVE. **Opt-in** (setting), default off para PYME.
- **DoD:** ejecutar el task manualmente genera el asiento devengado del mes.
- **Estado:** ✅ Hecho (`b397da0d` — `accrue_monthly_loan_interest` con BEAT mensual
  `crontab(hour=7, minute=0, day_of_month=1)`; opt-in hasta F5.1 añada las cuentas a
  `AccountingSettings`; idempotente vía `reference ACCRUAL-<display_id>-YYYYMM`; convierte
  UF→CLP con `IndicatorValue` del último día del mes; 1 test (no-op sin cuentas) passing).

### F2.10 · Alertas de vencimiento de cuotas (Celery)
- **Objetivo:** avisar cuotas próximas / vencidas.
- **Dificultad:** S
- **Archivos clave:** `backend/treasury/tasks.py`, notificaciones in-app.
- **Cambios esperados:** task diario marca `OVERDUE` las PENDING con `due_date < hoy` y
  notifica cuotas a N días.
- **DoD:** simular cuota vencida → queda OVERDUE + notificación.
- **Estado:** ✅ Hecho (`b397da0d` — `mark_overdue_loan_installments` con BEAT diario
  `crontab(hour=8, minute=0)`; marca OVERDUE y notifica a superusuarios activos las próximas
  a 5 días; dedup por día vía `Notification.data.target_date` (ISO), robusto a TZ/medianoche;
  3 tests passing — overdue marca, notificaciones + dedup).

---

## Sub-bloque D — API + Frontend

### F2.11 · Serializers + `BankLoanViewSet` / `LoanInstallmentViewSet`
- **Dificultad:** M
- **Archivos clave:** `backend/treasury/serializers.py`, `views.py`, `urls.py`.
- **Cambios esperados:** CRUD de `BankLoan`; acciones `disburse`, `pay_installment`,
  `prepay`; endpoint de la tabla de amortización. Vistas ≤20 líneas → delegar a `LoanService`.
- **DoD:** crear préstamo → desembolsar → pagar cuota vía API end-to-end.

### F2.12 · Frontend — feature `loans`
- **Dificultad:** L
- **Archivos clave:** `frontend/features/treasury/loans/*` (api, hooks TanStack Query, types,
  componentes), `frontend/app/(dashboard)/treasury/loans/page.tsx`, pestaña en `TreasuryHeader`.
- **Cambios esperados:**
  - Lista de créditos (KPIs: deuda total, próxima cuota) con `StatusBadge`.
  - Detalle con **tabla de amortización** (cuotas, estado, saldo).
  - Drawer registrar crédito (banco, monto, moneda CLP/UF, tasa, sistema, plazo).
  - Acción "Registrar pago de cuota" (selecciona banco origen).
  - Estados de cuota/crédito en `STATUS_MAP` (`badge-resolvers.ts`).
- **DoD:** `npm run type-check` + ESLint sin errores; flujo manual completo en la UI.

### F2.13 · Docs + tests + ADR
- **Dificultad:** S
- **Cambios esperados:** `test_loans.py` (schedule, disburse, pay, UF, prepay); ADR-0033
  "Créditos bancarios — deuda como pasivo + amortización (CLP/UF)". Actualizar este archivo
  a estado ✅.
- **DoD:** suite de préstamos verde en Postgres real; ADR creado.
- **Estado:** ✅ Hecho (commits por tarea; ADR-0033 creado en
  `docs/10-architecture/adr/0033-bank-loans-liabilidad-y-uf.md`; state-map.md
  extendido con `BankLoan` + `LoanInstallment`; entity-identity.md con
  `CRE-{id}`/`CUO-{id}`; api-contracts.md con sección `/treasury/loans/`
  + `/treasury/loan-installments/`; ADR README actualizado).

---

## Commits de la fase

> Secuencia atómica (1 commit por tarea o grupo cohesivo). Cierra con `Co-Authored-By`.

1. `feat(finances): modelo IndicatorValue (UF/UTM/USD) + carga manual` (`8f88cedc`) — F2.1
2. `feat(treasury): modelos BankLoan + LoanInstallment` (`ace7a82f`) — F2.2, F2.3
3. `feat(treasury): LoanService (amortización + desembolso + pago CLP/UF + prepago + refi)` (`8b8f7bdd`) — F2.4–F2.8
4. `feat(treasury): Celery tasks para devengo de interés y alertas de cuotas` (`b397da0d`) — F2.9, F2.10
5. `feat(treasury): API REST de créditos bancarios` (`b6941772`) — F2.11
6. `feat(treasury): UI de créditos bancarios` (`a11b9de2`) — F2.12
7. `docs(bancos): ADR-0033 + state-map + entity-identity + api-contracts` — F2.13

---

## Verificación de la fase
- Tests `test_loans.py` verdes (local `--no-migrations` + Postgres real, con rollback).
- `makemigrations --check` limpio; `npm run type-check`/ESLint sin errores.
- Manual: crear crédito UF → desembolsar → pagar 1 cuota (CLP convertido) → amortización y
  saldos correctos.
