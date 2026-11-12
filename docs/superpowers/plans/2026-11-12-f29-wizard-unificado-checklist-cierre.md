# Wizard F29 unificado y checklist de cierre accionable — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar declaración, pago y cierre del F29 en un solo wizard reanudable, y convertir el checklist del cierre contable en una lista accionable de documentos pendientes.

**Architecture:** La fase del wizard se deriva del estado existente del `TaxPeriod` (sin campo nuevo). El backend amplía `AccountingPeriodService.get_period_status` con listas acotadas de pendientes y `tax_period_id`; el checklist las muestra y abre cada documento con `openEntity` y el F29 con el wizard, apilados sobre el modal.

**Tech Stack:** Django 5 + DRF + pytest; Next.js 16, TypeScript, TanStack Query, Vitest, `GenericWizard`, `BaseModal`, `useGlobalModals().openEntity`.

**Spec:** `docs/superpowers/specs/2026-11-12-f29-wizard-unificado-checklist-cierre-design.md`

## Global Constraints

- Zero `any`; tokens semánticos de color únicamente; imports de componentes compartidos solo por barrel; sin `@/lib/api` ni `useQuery`/`useMutation` en componentes (hooks de feature).
- Zero N+1: los conteos de queries del endpoint de estado no crecen con las filas (política ADR-0118).
- Vistas Django ≤ 20 líneas; lógica en `services.py`.
- Tope de **50** pendientes por categoría; si hay más, "y N más" + enlace a la lista completa. Sin paginación en el checklist.
- Pasos previos del wizard: **solo lectura** una vez registrada la declaración.
- Monto a pagar ≤ 0: sin fase Pago. Pago parcial permitido; Cierre solo con saldo cubierto. El cierre exige comprobante PDF.
- No cambia qué es obligatorio: el botón de cierre contable sigue habilitado con `tax_period_closed && draft_entries_count === 0`; facturas en borrador, nóminas y conciliaciones siguen como sugeridos (así lo aplica la UI hoy, aunque `is_fully_closable` del backend también exija facturas).
- `close_period` y sus validaciones no se tocan. Una clave de idempotencia por operación; se regenera tras un fallo.
- Errores del backend siempre visibles (`showApiError`) dentro del wizard; nada avanza de fase en fallo.
- Dev: `cd frontend && npm run type-check && npm run lint`; backend: `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest` desde `backend/`; frontend tests con Node 24 (nvm).

## Review Focus

- Período contable sin `TaxPeriod` del mismo mes → `tax_period_id: null` y el CTA abre el wizard por año/mes (Task 1, Task 5).
- Más de 50 pendientes → lista de 50 y "y N más" correcto (Task 1, Task 5).
- Remanente de IVA (monto a pagar 0) → el wizard salta Pago (Task 2).
- Pago parcial → fase sigue siendo Pago y Cierre bloqueado (Task 2).
- Wizard cerrado a mitad de camino y reabierto → misma fase sin duplicar declaración ni pago (Task 3).
- Fallo 400 en el cierre → mensaje visible, wizard abierto, clave de idempotencia nueva en el reintento (Task 3).
- Drawer apilado sobre el checklist cierra y el checklist se recalcula (Task 5).

## Mapa de archivos

- `backend/tax/services.py` — `AccountingPeriodService.get_period_status` (extender).
- `backend/tax/tests/test_accounting_period_status.py` — nuevo.
- `frontend/features/tax/utils/f29Phase.ts` (+ `__tests__/f29Phase.test.ts`) — derivación de fase, función pura.
- `frontend/features/tax/components/DeclarationWizard.tsx` — pasa a 3 fases.
- `frontend/features/tax/components/wizard/F29PaymentStep.tsx`, `F29CloseStep.tsx` — pasos extraídos de los modales.
- `frontend/features/accounting/components/closures/closureActions.ts` y `AccountingClosuresClientView.tsx` — acción única.
- `frontend/features/accounting/hooks/useAccountingPeriodStatus.ts` — hook de la query de estado.
- `frontend/features/accounting/components/closures/AccountingPeriodCloseChecklist.tsx` — rediseño.
- `docs/10-architecture/adr/0134-wizard-f29-unificado-y-checklist-accionable.md` y contratos.

---

### Task 1: Backend — pendientes y `tax_period_id` en el estado del período contable

**Files:**
- Modify: `backend/tax/services.py` (`AccountingPeriodService.get_period_status`, ~línea 1076)
- Create: `backend/tax/tests/test_accounting_period_status.py`

**Interfaces:**
- Produces: la respuesta de `GET /api/tax/accounting-periods/{id}/status_check/` conserva todas las claves actuales y agrega:
  - `tax_period_id: int | None`
  - `draft_entries`, `draft_invoices`, `unposted_payrolls`, `unconfirmed_statements`: `list[{id: int, label: str, amount: str | None, date: str | None}]`, máx. 50 cada una, orden por fecha ascendente. Total real = el `*_count` existente (para nóminas: `payroll_count - payroll_posted_count`; extractos: `reconciliation_count - reconciliation_confirmed_count`).

- [ ] **Step 1: Test que falla** en `test_accounting_period_status.py` (fixtures `api_client` de `conftest.py`): `test_status_lists_pending_documents` (crea 2 asientos DRAFT y 1 factura DRAFT del mes, assert ids/labels y `tax_period_id == tax_period.id`), `test_status_tax_period_id_null_without_tax_period`, `test_status_caps_pending_at_50` (55 asientos → `len(draft_entries) == 50` y `draft_entries_count == 55`), `test_status_query_count_constant` (con 1 vs 10 filas por categoría el `len(ctx.captured_queries)` es igual).
- [ ] **Step 2:** `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest tax/tests/test_accounting_period_status.py -v` → FAIL (claves ausentes).
- [ ] **Step 3:** Extender `get_period_status`: una query por categoría con `select_related` de lo que el label lee, `order_by("date")[:50]`, construir dicts en el servicio (sin serializadores). Labels: asiento = folio/glosa; factura = tipo+folio; nómina = empleado + `MM/AAAA`; extracto = cuenta + fecha. `tax_period_id` desde el `TaxPeriod` ya consultado.
- [ ] **Step 4:** Mismo comando → PASS; correr `pytest tax/tests -q` completo.
- [ ] **Step 5: Commit** — `feat(tax): pendientes y tax_period_id en el estado del período contable`.

---

### Task 2: Derivación de fase del wizard F29

**Files:**
- Create: `frontend/features/tax/utils/f29Phase.ts`, `frontend/features/tax/utils/__tests__/f29Phase.test.ts`

**Interfaces:**
- Produces: `type F29Phase = 'prior' | 'payment' | 'close' | 'done'` y `function deriveF29Phase(period: Pick<TaxPeriod,'status'|'declaration_summary'> | null): F29Phase`. Reglas: sin período/sin declaración → `prior`; `status === 'CLOSED'` → `done`; declarada con `Number(vat_to_pay) > 0` y no `is_fully_paid` → `payment`; declarada y (pagada o `vat_to_pay <= 0`) → `close`.

- [ ] **Step 1:** Tests con los casos: null→prior, sin declaración→prior, declarada con saldo→payment, pago parcial→payment, pagada→close, `vat_to_pay` 0→close, `vat_to_pay` negativo→close, CLOSED→done.
- [ ] **Step 2:** `npm run test -- features/tax/utils` → FAIL.
- [ ] **Step 3:** Implementar `deriveF29Phase` (función pura, tipos de `features/tax/types`).
- [ ] **Step 4:** Tests → PASS; `npm run type-check`.
- [ ] **Step 5: Commit** — `feat(tax): derivación de fase del wizard F29`.

---

### Task 3: `DeclarationWizard` con fases Pago y Cierre

**Files:**
- Modify: `frontend/features/tax/components/DeclarationWizard.tsx`, `frontend/features/tax/components/index.ts`, `frontend/features/tax/index.ts`
- Create: `frontend/features/tax/components/wizard/F29PaymentStep.tsx`, `frontend/features/tax/components/wizard/F29CloseStep.tsx`; tests en `frontend/features/tax/components/__tests__/DeclarationWizard.test.tsx`

**Interfaces:**
- Consumes: `deriveF29Phase` (Task 2); hooks existentes `useRegisterDeclaration`, `useCreateTaxPayment`, `useClosePeriod`, `useUploadF29Document`, `useAnnulTaxPayment`.
- Produces: `DeclarationWizard` mantiene sus props actuales (`isOpen`, `onOpenChange`, `periodId?`, `year?`, `month?`, `onSuccess`, `existingPeriods?`) y abre en la fase de `deriveF29Phase`. `F29PaymentStep` y `F29CloseStep` reciben `{ declaration: TaxDeclaration; onChanged: () => void }`.

- [ ] **Step 1:** Tests (mockear `@/features/tax` hooks, patrón de los tests de drawers): abre en paso Pago con declaración y saldo; abre en Cierre con saldo cubierto; sin fase Pago con `vat_to_pay` 0; pasos previos sin inputs editables si ya hay declaración; fallo del cierre → `showApiError` llamado y no avanza; reintento tras fallo usa clave distinta.
- [ ] **Step 2:** `npm run test -- features/tax/components` → FAIL.
- [ ] **Step 3:** Extraer el contenido de `F29PaymentModal` (lista de pagos, anular, registrar pago con `PaymentModal` de treasury) a `F29PaymentStep` y el de `F29CloseModal` (comprobante PDF obligatorio + cerrar) a `F29CloseStep`. En `DeclarationWizard`: el paso de registro (`onNext` del último paso previo) registra la declaración (tolerando "ya fue registrada") y **ya no cierra** automáticamente; agregar pasos Pago (omitido si `vat_to_pay <= 0`) y Cierre; `initialStep` según la fase; pasos previos con `fieldset disabled`/modo lectura si hay declaración; regenerar `idempotencyKeyRef` tras cualquier error de mutación; reemplazar la pantalla final por el resultado del cierre.
- [ ] **Step 4:** Tests → PASS; `npm run type-check && npm run lint`.
- [ ] **Step 5: Commit** — `feat(tax): wizard F29 unificado con fases pago y cierre`.

---

### Task 4: ClientView — acción única y retiro de modales

**Files:**
- Modify: `frontend/features/accounting/components/closures/closureActions.ts`, `AccountingClosuresClientView.tsx`, `frontend/features/accounting/utils/__tests__/closureTree.test.ts` (si cubre acciones)
- Delete: `frontend/features/tax/components/F29PaymentModal.tsx`, `F29CloseModal.tsx` (y sus exports en los barrels) una vez sin consumidores

**Interfaces:**
- Consumes: `DeclarationWizard` (Task 3).
- Produces: `ClosureActionsCtx` sin `onPayF29`/`onCloseTaxPeriod`; `onOpenDeclaration: (params: {id?: number; year: number; month: number}) => void` cubre todas las fases. Etiqueta contextual según `deriveF29Phase`: "Declarar F29" | "Registrar pago F29" | "Cerrar F29" (visible solo si el período no está cerrado).

- [ ] **Step 1:** Test de `closureActionList`: para cada fase hay exactamente una acción F29 primaria visible con la etiqueta esperada, y ninguna acción "Pagar F29" suelta.
- [ ] **Step 2:** Correr test → FAIL.
- [ ] **Step 3:** Reemplazar las acciones `pay`/`Cerrar F29` por una acción única que llama `onOpenDeclaration`; eliminar de la vista los estados `closeF29PeriodId`, `closeF29Declaration`, `paymentPeriodId`, `paymentDeclaration`, handlers `handleCloseTaxPeriod`, `handleConfirmCloseTaxPeriod`, `handlePayF29`, `handlePaymentConfirm` y el montaje de los dos modales; el wizard refresca con `onSuccess` (refetch de períodos tributarios y contables). Mantener "Reabrir F29" y "Ver comprobante".
- [ ] **Step 4:** Tests, `type-check`, `lint` → verdes; `grep -rn "F29PaymentModal\|F29CloseModal" frontend` sin resultados.
- [ ] **Step 5: Commit** — `refactor(accounting): una sola acción F29 en cierres`.

---

### Task 5: Checklist accionable

**Files:**
- Create: `frontend/features/accounting/hooks/useAccountingPeriodStatus.ts` (+ clave en `queryKeys`), `frontend/features/accounting/components/closures/__tests__/AccountingPeriodCloseChecklist.test.tsx`
- Modify: `AccountingPeriodCloseChecklist.tsx`, tipos de `accountingApi.getAccountingPeriodStatus` (tipar la respuesta con Zod en lugar de `Record<string, unknown>`)

**Interfaces:**
- Consumes: respuesta de Task 1; `DeclarationWizard` (Task 3); `useGlobalModals().openEntity` con labels `accounting.journalentry`, `billing.invoice`, `hr.payroll`, `treasury.bankstatement`.
- Produces: `useAccountingPeriodStatus(periodId: number, enabled: boolean)` → `{ status, isLoading, error, refetch }`. Props del modal sin cambios (`isOpen, periodId, year, month, onClose, onConfirm, isLoading`).

- [ ] **Step 1:** Tests: secciones Obligatorios/Sugeridos con los ítems correctos; ítem con pendientes se expande y muestra filas; click en fila llama `openEntity(label, id)`; con 55 pendientes y 50 listados aparece "y 5 más" con enlace; CTA F29 abre el wizard con `periodId = tax_period_id` o con `year/month` si es null; cerrar drawer/wizard dispara `refetch`; estados loading y error.
- [ ] **Step 2:** `npm run test -- closures` → FAIL.
- [ ] **Step 3:** Hook con `useQuery` (reemplaza `useReducer` + fetch directo); reescribir el modal como lista densa por secciones (icono + texto de estado, sin fondos de color por ítem, tokens semánticos), filas de pendientes expandibles, enlace "y N más" a la URL de lista de la entidad (`ENTITY_REGISTRY`), CTA por ítem; montar `DeclarationWizard` dentro del componente y pasar `onSuccess`/cierre al `refetch`. Resolver capas/foco al apilar (documentar en el ADR si requiere ajuste en `BaseModal`).
- [ ] **Step 4:** Tests → PASS; `type-check`, `lint`.
- [ ] **Step 5: Commit** — `feat(accounting): checklist de cierre con documentos pendientes y CTAs`.

---

### Task 6: ADR, contratos y verificación

**Files:**
- Create: `docs/10-architecture/adr/0134-wizard-f29-unificado-y-checklist-accionable.md`; actualizar `docs/10-architecture/adr/README.md`
- Modify: `docs/20-contracts/state-map.md` (fases del F29) y el contrato del checklist si existe; corregir en el spec la referencia a `TaxPeriodService.get_period_status` → `AccountingPeriodService.get_period_status`.

- [ ] **Step 1:** Redactar el ADR (contexto, decisión: fase derivada, respuesta ampliada, apilado) y actualizar docs.
- [ ] **Step 2:** `cd frontend && npm run type-check && npm run lint && npm run test`; `pytest tax -q` en backend.
- [ ] **Step 3:** Verificación manual en el servidor de dev (`mutagen sync list` conectado primero): recorrer declarar → salir → continuar → pagar → cerrar; cierre contable con pendientes de las 4 categorías; error forzado del cierre.
- [ ] **Step 4: Commit** — `docs: ADR-0134 wizard F29 unificado y checklist accionable`.
