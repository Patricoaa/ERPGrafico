# Pestaña Relaciones de empleado, dominio RRHH y ventana reciente — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir la pestaña «Relaciones» al `EmployeeDrawer`, un dominio documental `hr` («RRHH») y una ventana reciente con «Ver más» en todas las pestañas de relaciones.

**Architecture:** El backend registra los tipos documentales de RRHH con dominio `hr` y proveedores de relaciones tipados, y el servicio de relaciones aprende un parámetro `window` que recorta por área después de resolver (sin cambiar el default `all`). El frontend extiende el esquema Zod, el hook y `DocumentRelationsTab` (que pide `recent` y ofrece «Ver más»), y monta la pestaña en el drawer.

**Tech Stack:** Django 5 + DRF + pytest; Next.js 16, TanStack Query, Zod, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-hr-relations-tab-design.md`

## Global Constraints

- Ventana: `RELATIONS_RECENT_MONTHS = 12`, `RELATIONS_MIN_VISIBLE = 10` (constantes en `backend/core/documents/relations.py`); solo se recorta un área con **más de 10** vínculos.
- Nunca se ocultan vínculos con `is_dependency=True` ni con `target.date` nulo.
- Default de la API: `window=all`; solo `DocumentRelationsTab` pide `recent`. Valor inválido → 400.
- La respuesta añade `window` y `hidden` (`{<domain>: <n>}`); campos aditivos, `unresolved` no cambia.
- Dominio nuevo `hr` (etiqueta «RRHH»), ordenado después de `capital` y antes de `contacts`.
- Proveedores: solo FKs tipadas, con `select_related`/`prefetch_related` (invariante zero-N+1); sin heurísticas de texto.
- Frontend: zero `any`, tokens semánticos, import por barrel (`@/features/documents`, `@/components/shared`), sin `useQuery` en componentes.
- Cambio de contrato de capa 20 → ADR-0155 (Task 6).
- Backend: ejecutar desde `backend/` con `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest -p no:cacheprovider …`. Frontend: `source ~/.nvm/nvm.sh && nvm use 24` antes de `npx vitest run …`; DoD `npm run type-check` y `npm run lint` sin errores.
- Rama: `feat/hr-relations-tab` (ya creada). `core/tests/test_no_utc_today.py` falla de antes por `inventory/*`; no es de este trabajo.

## Review Focus

1. Empleado sin ninguna relación (incluido archivado): la pestaña muestra el estado vacío, no rompe (Task 1 y 4).
2. Área con exactamente 10 vínculos (no se recorta) y área con 11 donde todos son viejos (se completa hasta 10 con los más recientes) (Task 2).
3. Vínculos de dependencia o sin fecha en un área grande: jamás se ocultan (Task 2).
4. `window=basura` → 400; sin parámetro → respuesta idéntica a la actual (Task 2).
5. Usuario sin permiso sobre las liquidaciones: aparecen `accessible=false`, sin fecha ni estado, y el recorte no filtra datos (Task 1).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `backend/core/documents/types.py` (mod) | Añade `hr` a `DOCUMENT_DOMAINS` y `DEFAULT_DOMAIN_BY_APP` |
| `backend/hr/relations.py` (mod) | Tipos documentales y proveedores de RRHH |
| `backend/hr/tests/test_hr_relations.py` (new) | Pruebas de relaciones de RRHH |
| `backend/core/documents/relations.py` (mod) | Constantes y `apply_window`; parámetro `window` del servicio |
| `backend/core/api/documents.py` (mod) | Lee y valida `?window=` |
| `backend/core/tests/test_document_relations_window.py` (new) | Pruebas de la ventana (puras y por endpoint) |
| `frontend/features/documents/types.ts` (mod) | Dominio `hr`, `hidden`/`window`, filtro `window` |
| `frontend/features/documents/utils/domains.ts` (mod) | Metadatos del área RRHH |
| `frontend/features/documents/components/DocumentRelationsTab.tsx` (mod) | Ventana, «+N anteriores», «Ver más (N)» |
| `frontend/components/shared/RelatedDocumentsTable.tsx` (mod) | Etiquetas de rol nuevas |
| `frontend/features/hr/components/EmployeeDrawer.tsx` (mod) | Pestaña «Relaciones» |
| `docs/10-architecture/adr/0155-*.md` (new), índice, `document-relations.md`, `component-document-sheet.md` (mod) | Documentación y ADR |

---

### Task 1: Dominio `hr` y proveedores de relaciones de RRHH

**Files:**
- Modify: `backend/core/documents/types.py` (líneas 26-38)
- Modify: `backend/hr/relations.py`
- Test: `backend/hr/tests/test_hr_relations.py`

**Interfaces:**
- Produces: dominio `"hr"` válido en `DocumentTypeRegistry`; tipos `hr.employee`, `hr.absence`, `hr.salaryadvance`, `hr.payrollpayment` registrados; proveedores para `hr.employee`, `hr.payroll`, `hr.salaryadvance`, `hr.absence`, `hr.payrollpayment`. Roles nuevos: `employee`, `payroll`, `salary_advance`, `absence`, `payroll_payment`.

- [ ] **Step 1: Write the failing tests** en `backend/hr/tests/test_hr_relations.py` (fixture `hr_world`: superusuario autenticado con `APIClient`, un `Employee` con `Contact`, 1 `Payroll`, 1 `SalaryAdvance`, 1 `Absence`, 1 `PayrollPayment` de esa liquidación; consulta `GET /api/core/documents/{label}/{id}/relations/`):
  - `test_employee_relations_list_hr_documents`: roles presentes en `relations` = `{"payroll","salary_advance","absence","payroll_payment","contact"}` y todo target de esos cuatro roles tiene `domain == "hr"`.
  - `test_payroll_relations_include_employee`: la liquidación devuelve un vínculo `role="employee"` hacia `hr.employee`.
  - `test_advance_absence_and_payment_point_to_employee_or_payroll`: el anticipo enlaza `employee`; la inasistencia `employee`; el pago `payroll` y `employee`.
  - `test_archived_employee_with_no_relations_returns_empty`: empleado archivado sin documentos → `relations == []` y estado 200 (solo la contraparte `contact` puede aparecer; assert que ningún vínculo tiene `domain == "hr"`).
  - `test_user_without_payroll_permission_sees_inaccessible_refs`: usuario con solo `hr.view_employee` ve los vínculos `payroll` con `target.accessible is False`, `target.status is None`, `target.date is None`.

- [ ] **Step 2: Run to verify they fail**

Run: `venv/bin/python -m pytest hr/tests/test_hr_relations.py -q` → FAIL (tipos/dominio sin registrar).

- [ ] **Step 3: Implement**
  - `DOCUMENT_DOMAINS` gana `"hr"` entre `"capital"` y `"contacts"`; `DEFAULT_DOMAIN_BY_APP["hr"] = "hr"`.
  - En `hr/relations.py` registrar con `DocumentType(...)`: `hr.employee` (`status_field=None`, `amount_field=None`, `date_field="start_date"`, `partner_path="contact"`, `detail` = cargo · departamento con `core.documents.details.join`); `hr.absence` (`status_field=None`, `amount_field=None`, `date_field="start_date"`, `partner_path="employee.contact"`); `hr.salaryadvance` (`date_field="date"`, `partner_path="employee.contact"`); `hr.payrollpayment` (`date_field="date"`, `partner_path="payroll.employee.contact"`, `canonical_url=lambda p: f"/hr/payrolls?selected={p.payroll_id}"` o la ruta real de liquidaciones — verificar con `test_document_routes_sync`). `hr.payroll` se mantiene sin `date_field` (usa `created_at`).
  - Proveedores con `@relation_provider(label)`: employee → `Link("association","outgoing", role, obj)` para `payrolls` (`"payroll"`), `advances` (`"salary_advance"`), `absences` (`"absence"`) y `PayrollPayment` de sus liquidaciones (`"payroll_payment"`, con `amount`); payroll gana `Link("association","outgoing","employee", payroll.employee)`; advance → `employee`, `payroll` (si hay), asiento; absence → `employee`; payment → `payroll`, `employee`. Usar `select_related`/`prefetch_related` sobre las relaciones inversas.
  - Añadir a `RELATED_ROLE_LABELS` (`frontend/components/shared/RelatedDocumentsTable.tsx`): `employee: "Empleado"`, `payroll: "Liquidación"`, `salary_advance: "Anticipo"`, `absence: "Inasistencia"`, `payroll_payment: "Pago de remuneración"`.

- [ ] **Step 4: Run to verify they pass**

Run: `venv/bin/python -m pytest hr core/tests/test_document_routes_sync.py core/tests/test_document_relations.py -q` → todo PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core/documents/types.py backend/hr backend/hr/tests/test_hr_relations.py frontend/components/shared/RelatedDocumentsTable.tsx
git commit -m "feat(hr): dominio hr y proveedores de relaciones de empleado, liquidación, anticipo, inasistencia y pago"
```

---

### Task 2: Ventana reciente en el servicio y el endpoint

**Files:**
- Modify: `backend/core/documents/relations.py`
- Modify: `backend/core/api/documents.py`
- Test: `backend/core/tests/test_document_relations_window.py`

**Interfaces:**
- Produces: `RELATIONS_RECENT_MONTHS = 12`, `RELATIONS_MIN_VISIBLE = 10`; `apply_window(links: list[dict], today: date) -> tuple[list[dict], dict[str, int]]` (puro: devuelve los vínculos visibles en su orden original y `hidden` por dominio); `DocumentRelationService.relations(label, pk, user, semantic=None, direction=None, window="all")` añade las claves `"window"` y `"hidden"` al dict; `GET …/relations/?window=recent|all`.
- Consumes: forma de cada vínculo ya existente (`link["target"]["domain"]`, `["date"]` ISO `YYYY-MM-DD` o datetime ISO, `["is_dependency"]`).

- [ ] **Step 1: Write the failing tests** (`apply_window` puro, `today=date(2026,11,23)`, helper `mk(domain, date_iso, dep=False)`):
  - `test_area_with_10_or_fewer_is_untouched`: 10 vínculos viejos en `hr` → `kept == links`, `hidden == {}`.
  - `test_old_links_hidden_in_big_area`: 15 en `hr` (5 de hace <12 meses, 10 de hace >12 meses) → quedan 10 (5 recientes + las 5 más recientes de las viejas), `hidden == {"hr": 5}`.
  - `test_fill_up_to_min_visible_with_newest`: 11 viejos → quedan los 10 más recientes, `hidden == {"hr": 1}`.
  - `test_dependencies_and_undated_never_hidden`: 12 vínculos viejos, 2 con `is_dependency=True` y 1 con `date=None` → los 3 están en `kept`.
  - `test_original_order_preserved_and_datetime_dates_accepted`: fechas `"2025-01-05T10:00:00Z"` se comparan por sus primeros 10 caracteres y el orden de salida es el de entrada.
  - Endpoint (cliente superusuario, reutilizar un empleado con 12 liquidaciones antiguas del Task 1): `test_window_recent_returns_hidden_and_all_returns_everything`; `test_default_window_equals_all` (misma lista que `window=all`, `hidden == {}`); `test_invalid_window_is_400`.

- [ ] **Step 2: Run to verify they fail**

Run: `venv/bin/python -m pytest core/tests/test_document_relations_window.py -q` → FAIL (`apply_window` no existe).

- [ ] **Step 3: Implement** `apply_window` en `core/documents/relations.py` (corte = `today` menos 12 meses; agrupa por `target["domain"]`; ver reglas en Global Constraints; cuando faltan visibles para llegar a 10, añadir los dedatados más recientes primero). `relations()` recibe `window`, aplica `apply_window(links, timezone.localdate())` solo si `window == "recent"` y siempre devuelve `window` y `hidden`. En `document_relations` leer `request.query_params.get("window", "all")`; si no es `recent`/`all` → `Response({"detail": "window inválido"}, status=400)`.

- [ ] **Step 4: Run to verify they pass**

Run: `venv/bin/python -m pytest core/tests/test_document_relations_window.py core/tests/test_document_relations.py hr -q` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core/documents/relations.py backend/core/api/documents.py backend/core/tests/test_document_relations_window.py
git commit -m "feat(documents): ventana reciente (window=recent) con conteo de ocultos por área"
```

---

### Task 3: Frontend — esquema, dominio RRHH, API y hook

**Files:**
- Modify: `frontend/features/documents/types.ts` (líneas 4-8 y 49-62)
- Modify: `frontend/features/documents/utils/domains.ts`
- Test: `frontend/features/documents/__tests__/documentsApi.test.ts` (nuevo)

**Interfaces:**
- Produces: `DOCUMENT_DOMAINS` incluye `"hr"` (entre `"capital"` y `"contacts"`); `DocumentRelations` gana `hidden: Record<string, number>` (default `{}`) y `window: "recent" | "all"` (default `"all"`); `DocumentRelationsFilters` gana `window?: "recent" | "all"`; `DOCUMENT_DOMAIN_META.hr = { label: "RRHH", icon: <icono lucide de personas, p. ej. BriefcaseBusiness>, order: 7 }` y `contacts`/`other` suben a 8/9. `documentsApi.getRelations` ya envía `filters` como `params`, por lo que `window` viaja sin cambios.

- [ ] **Step 1: Write the failing test** `documentsApi.test.ts` (mock de `@/lib/api`): `getRelations("hr.employee", 5, { window: "recent" })` llama a `api.get` con `params: { window: "recent" }`; una respuesta sin `hidden`/`window` se parsea a `hidden: {}` y `window: "all"`; una respuesta con un `target.domain: "hr"` conserva `"hr"` (no cae en `"other"`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run features/documents/__tests__/documentsApi.test.ts` → FAIL.

- [ ] **Step 3: Implement** los cambios de `types.ts` y `domains.ts` descritos en Interfaces (`hidden: z.record(z.string(), z.number()).catch({})`, `window: z.enum(["recent","all"]).catch("all")`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run features/documents && npm run type-check` → PASS, sin errores de tipos (corregir cualquier `Record<DocumentDomain, …>` exhaustivo que ahora exija `hr`).

- [ ] **Step 5: Commit**

```bash
git add frontend/features/documents
git commit -m "feat(documents): dominio RRHH y filtro window en el esquema y la API de relaciones"
```

---

### Task 4: `DocumentRelationsTab` con ventana, «+N anteriores» y «Ver más (N)»

**Files:**
- Modify: `frontend/features/documents/components/DocumentRelationsTab.tsx`
- Test: `frontend/features/documents/components/__tests__/DocumentRelationsTab.test.tsx` (ampliar)

**Interfaces:**
- Consumes: `useDocumentRelations(label, id, { window })`, `DocumentRelations.hidden`.
- Produces: prop opcional `window?: "recent" | "all"` en `DocumentRelationsTabProps` (default `"recent"`); la pestaña mantiene estado `showAll` y pide `window: showAll ? "all" : window`.

- [ ] **Step 1: Write the failing tests** (mismo harness del archivo existente, mock de `getMock`):
  - `requests window=recent by default`: `getMock` se llama con `params` que contienen `window: "recent"`.
  - `shows "+N anteriores" in the area and a "Ver más (N)" button`: con `hidden: { hr: 4 }` y un vínculo `hr` visible, aparece el texto `4 anteriores` en su sección y un botón con nombre `Ver más (4)`.
  - `Ver más refetches with window=all`: al pulsar, `getMock` recibe `window: "all"` y el botón desaparece cuando `hidden` llega vacío.
  - `no button when nothing hidden`.
  - `prop window="all" never shows the button`.
  - `empty relations still show the empty state` (Review Focus 1).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run features/documents/components/__tests__/DocumentRelationsTab.test.tsx` → FAIL (nuevos casos).

- [ ] **Step 3: Implement** en `DocumentRelationsTab`: `useDocumentRelations(label, id ?? null, { window: showAll ? "all" : windowProp })`; en cada sección con `data.hidden[group.domain] > 0` una línea `text-xs text-muted-foreground` «N anteriores» bajo la lista; al final, si la suma de `hidden` es > 0, un `Button` `variant="ghost"` «Ver más (N)» que hace `setShowAll(true)`. Actualizar los mocks existentes de otros tests que afirmen los `params` exactos (`DocumentSheet.test.tsx`, tests de OrderSheet/PartnerDrawer) si fallan.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run features/documents features/partners features/orders features/tax features/production && npm run type-check && npm run lint` → PASS, sin errores de lint.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/documents frontend/features/partners frontend/features/orders frontend/features/tax frontend/features/production
git commit -m "feat(documents): la pestaña de relaciones pide la ventana reciente y ofrece «Ver más»"
```

---

### Task 5: Pestaña «Relaciones» en `EmployeeDrawer`

**Files:**
- Modify: `frontend/features/hr/components/EmployeeDrawer.tsx` (array `tabs` desde la línea ~295)
- Test: `frontend/features/hr/components/__tests__/EmployeeDrawer.relations.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `DocumentRelationsTab` y `useDocumentRelations` de `@/features/documents` (barrel); precedente: `PartnerDrawer.tsx:84`.
- Produces: tab `{ value: "relations", label: "Relaciones", icon: Link2, badge }` solo si `employee?.id`.

- [ ] **Step 1: Write the failing test**: con `@/features/documents` mockeado (`DocumentRelationsTab` renderiza `data-testid="relations-tab"` y `useDocumentRelations` devuelve `{ data: { relations: [a,b,c] } }`), renderizar `EmployeeDrawer` con un `employee` existente y comprobar que hay una pestaña «Relaciones» (con badge `3`) y que al activarla se ve `relations-tab` recibiendo `label="hr.employee"` e `id` del empleado; con `employee={null}` la pestaña no existe. Mockear las dependencias pesadas del drawer como en los tests de otros drawers (`ContactDrawer`/`PartnerDrawer.test.tsx` sirven de modelo).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run features/hr/components/__tests__/EmployeeDrawer.relations.test.tsx` → FAIL.

- [ ] **Step 3: Implement** la entrada de pestaña con `<DocumentRelationsTab label="hr.employee" id={employee.id} sectionActions={{}} rowActions={() => []} />`. El badge usa `useDocumentRelations("hr.employee", employee?.id ?? null, { window: "recent" })` (misma query key que la pestaña → una sola petición). Comprobar que `DrawerLayout contentDisabled={isView || saving}` no deshabilita los clics de la pestaña; si lo hace, renderizar el contenido fuera del `fieldset` como hace `PartnerDrawer`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run features/hr features/documents && npm run type-check && npm run lint` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/features/hr
git commit -m "feat(hr): pestaña Relaciones en la ficha de empleado"
```

---

### Task 6: ADR-0155 y documentación de contratos

**Files:**
- Create: `docs/10-architecture/adr/0155-hr-relations-window.md`
- Modify: `docs/10-architecture/adr/README.md`, `docs/20-contracts/document-relations.md`, `docs/20-contracts/component-document-sheet.md`

- [ ] **Step 1: Write ADR-0155** (formato de ADR-0154: front-matter `id/title/status: Accepted/date: 2026-11-23/author`): contexto (coste y volumen de relaciones de un empleado), decisión (dominio `hr`; `window=recent|all` con default `all`; regla de 12 meses/10 filas; `hidden`; la pestaña pide `recent`), consecuencias (la resolución sigue siendo completa; fase posterior = filtrar en proveedores).
- [ ] **Step 2: Update contracts**: `document-relations.md` §2 (parámetro `window`, campos `hidden`/`window`), §3 cobertura (tipos de RRHH), §5 (dominio `hr`, `domain` list); `component-document-sheet.md` (pestaña de relaciones con ventana y «Ver más»). Añadir la fila de 0155 al índice del ADR README.
- [ ] **Step 3: Verify**

Run (desde `backend/`): `venv/bin/python -m pytest core/tests -q -p no:cacheprovider --deselect core/tests/test_no_utc_today.py` → PASS (hay tests que cruzan docs e índice de ADR); y `npm run type-check` en `frontend/`.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: ADR-0155 dominio RRHH y ventana reciente en relaciones documentales"
```

---

## Self-Review (spec ↔ plan)

- Pestaña en drawer, solo con registro, también archivados → Task 5 (+ Task 1 test del archivado).
- Dominio `hr`/«RRHH» antes de «Contactos» → Tasks 1 y 3.
- Tipos y proveedores de RRHH, URL canónica del pago, sin duplicar asientos/contraparte (los añade el servicio) → Task 1.
- `window` (default `all`, `recent` pedido por la pestaña, reglas 12 meses / >10 / mínimo 10 / dependencias y sin fecha / `hidden`) → Task 2 y 4.
- «Ver más» expande toda la pestaña, «+N anteriores» por área → Task 4.
- Solo lectura al inicio (`sectionActions={{}}`) → Task 5.
- ADR y contratos → Task 6. No objetivos (pestaña en otros drawers, optimizar resolución) no tienen tarea, a propósito.
