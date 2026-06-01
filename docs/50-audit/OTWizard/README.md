---
layer: 50-audit
doc: ot-wizard-unification-audit
status: active
owner: production-frontend
created: 2026-05-19
last_review: 2026-05-19
related:
  - ../OT/production-audit.md
  - ../../30-playbooks/refactor-workflow.md
---

# Auditoría: Unificación del flujo de creación de OT en el Wizard

Evalúa la factibilidad de absorber `WorkOrderForm` (modal de creación/edición) como **Step 0** del `WorkOrderWizard`, eliminando el patrón actual de modal-sobre-modal.

> **Documentos hermanos**
> - [implementation-plan.md](./implementation-plan.md) — fases, dependencias, rollback
> - [contracts.md](./contracts.md) — contratos API/tipos que NO deben romperse
> - [tasks/](./tasks/) — tareas atómicas ejecutables por LLM

---

## TL;DR

| Eje | Veredicto |
|---|---|
| **Factibilidad técnica** | Alta — backend ya alineado, no requiere migraciones |
| **Cambios backend** | Opcionales (sólo si se quiere atomicidad create + materials) |
| **Cambios frontend** | Medios — refactor concentrado en `features/production/components/` |
| **Riesgo** | Medio — concentrado en preservar `multipart/form-data` + `stage_data` JSON |
| **Deuda técnica saldada** | 4 violaciones de invariante #4 (`useQuery` en componente) |

**Recomendación: Opción A — Wizard unificado con Step 0 condicional.**

---

## 1. Estado actual (mapeo)

### 1.1 Componentes implicados

| Archivo | LOC | Rol |
|---|---|---|
| [WorkOrderForm/index.tsx](../../../frontend/features/production/components/forms/WorkOrderForm/index.tsx) | 511 | Modal de creación/edición de datos básicos + specs |
| [WorkOrderForm/WorkOrderBasicInfo.tsx](../../../frontend/features/production/components/forms/WorkOrderForm/WorkOrderBasicInfo.tsx) | 363 | Sub-componente del form |
| [WorkOrderWizard.tsx](../../../frontend/features/production/components/WorkOrderWizard.tsx) | 672 | Modal stage-by-stage para OTs existentes |
| [app/(dashboard)/production/orders/page.tsx](../../../frontend/app/(dashboard)/production/orders/page.tsx) | 410 | Entry point — orquesta ambas UIs |

### 1.2 El anti-patrón confirmado

`WorkOrderWizard.tsx:452-460` monta `WorkOrderForm` como modal anidado cuando el usuario pulsa "Editar" en `WizardHeader`. Dos `BaseModal` apilados implican:

- Dos focus traps superpuestos (Esc ambiguo).
- En mobile el segundo modal queda casi inutilizable.
- El usuario abandona el contexto de etapas para editar datos básicos.

### 1.3 Entry points

| Trigger | Resultado |
|---|---|
| Botón "Nueva OT" en toolbar | `?modal=new` → `WorkOrderForm` (create) |
| Acción `edit` en fila de tabla | `editingOrder=row` → `WorkOrderForm` (edit) |
| Acción `hub` en fila | `?selected=ID` → `WorkOrderWizard` |
| Click en columna kanban | `setActiveWizardId(id)` → `WorkOrderWizard` |
| Botón editar dentro del wizard | `setIsEditOpen(true)` → **modal anidado** |
| Link "para stock" desde producto | `?modal=new&type=stock&product_id=X` → `WorkOrderForm` con `defaultOtType="NONE"` |

---

## 2. Backend: contrato vigente

### 2.1 Creación

`POST /production/orders/` → `WorkOrderViewSet.create` ([views.py:110-126](../../../backend/production/views.py#L110-L126)) delega en `WorkOrderService.create_from_request_payload(data, files, user)` ([services.py:300-370](../../../backend/production/services.py#L300-L370)), que ramifica:

1. **Manual** — `product_id` + `quantity` + `uom_id`, sin `sale_line` → `create_manual()`
2. **Sale-linked** — `sale_line` presente → `create_from_sale_line()` + partial update
3. **Fallback** — `super().create()` (no hay payload reconocible)

Toda OT recién creada nace en `status=DRAFT`, `current_stage=MATERIAL_ASSIGNMENT`.

### 2.2 Update

`PUT /production/orders/{id}/` acepta multipart con `stage_data` JSON-stringified, adjuntos `design_file_N`, `approval_file`, `final_photo`.

### 2.3 Materiales

Se gestionan via `@action update_material` (detail=True), NO se aceptan en el create. Esto implica que un wizard "atómico" requiere bien (a) dos llamadas secuenciales con rollback manual, o bien (b) extender `create_from_request_payload` con `initial_materials[]` (cambio opcional documentado en [tasks/08-optional-initial-materials.md](./tasks/08-optional-initial-materials.md)).

---

## 3. Por qué tiene sentido unificar

1. **Secuencialidad real**: Step 0 (datos básicos) → MATERIAL_ASSIGNMENT (primer step del wizard) son etapas consecutivas en la state machine. La pantalla "elija LINKED o NONE" del form actual es ya un mini-step previo.
2. **Edit dentro del wizard ya existe**, pero como modal anidado. Convertirlo en navegación-al-Step-0 elimina el anidamiento sin perder funcionalidad. La regla de editabilidad ya existe: `current_stage ∈ {MATERIAL_ASSIGNMENT, MATERIAL_APPROVAL, PREPRESS}` ([page.tsx:237](../../../frontend/app/(dashboard)/production/orders/page.tsx#L237)).
3. **El backend no requiere cambios** para soportarlo. El contrato actual ya cubre create + transitions subsiguientes.

---

## 4. Riesgos y contratos a vigilar

| Riesgo | Mitigación |
|---|---|
| Romper `multipart/form-data` + `stage_data` JSON-stringified | Preservar shape literal; cubrir con test de integración |
| 4 `useQuery` directos en `WorkOrderForm` violan invariante #4 | Migrar a `features/production/hooks/` en task **01** antes de mover lógica |
| `WorkOrderWizard` requiere `orderId: number` | Introducir discriminated union `{ mode: 'create' } \| { mode: 'manage', orderId }` (task **02**) |
| Schema Zod actual no discrimina LINKED/NONE | Reforzar con `z.discriminatedUnion('otType', [...])` para zero-any (task **02**) |
| Deep-link `?modal=new` + `?selected=ID` desincronizados | Replace (no push) tras create exitoso: `?modal=new → ?selected=ID` (task **05**) |
| Doble submit por doble click | Idempotency-Key header + `disabled` en footer (task **04**) |
| Permisos: Step 0 read-only fuera de etapas editables | Reutilizar regla `isEditable` existente (task **04**) |

### Invariantes del repo que el refactor DEBE respetar

- **#1 Zero `any`** — schema discriminado + tipos derivados.
- **#4 No `useQuery`/`useMutation` en componentes** — todos los hooks via `features/production/hooks/`.
- **#6 Shared via barrel** — `import { … } from '@/components/shared'`.
- **#8 Forms con `react-hook-form` + `zodResolver`** — Step 0 mantiene RHF, NO se migra al Zustand store.

---

## 5. Opciones evaluadas

### Opción A — Wizard unificado con Step 0 condicional ✅ RECOMENDADA

Step 0 aparece sólo cuando `mode === 'create'` o cuando el usuario navega hacia atrás siendo la OT editable. Tras `POST` exitoso, `mode → 'manage'` y `viewingStepIndex → MATERIAL_ASSIGNMENT`.

**Pros**: una sola superficie modal, focus trap único, alineado con state machine, elimina el anti-patrón.
**Contras**: refactor visible en 5 archivos.

### Opción B — Inline drawer en sidebar derecha

Datos básicos en `WizardRightSidebar` con click-to-edit. Creación queda como flow ligero separado.

**Pros**: menos cambio estructural.
**Contras**: no cumple el pedido (creación dentro del wizard); mantiene divergencia create vs manage.

### Opción C — Mantener status quo

Descartada — el anti-patrón modal-sobre-modal degrada UX y duplica lógica.

---

## 6. Decisiones cerradas

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Opción a implementar | **A — Wizard unificado con Step 0** |
| 2 | Atomicidad create + materiales | **No bloqueante** — implementar en 2 llamadas; opción de `initial_materials[]` queda como mejora futura |
| 3 | Edit datos básicos en wizard | **Navegar a Step 0** (no inline) |
| 4 | Persistencia de step en URL | **`?selected=ID` + `?step=STAGE_ID`** (deep-linkeable) |
| 5 | Schema Zod | **`z.discriminatedUnion('otType', [linked, none])`** |
| 6 | State del Step 0 | **`react-hook-form`** (no Zustand) |
| 7 | Idempotency-Key | **Sí** — `crypto.randomUUID()` en POST de creación |
| 8 | Backwards compat | **Mantener `POST /production/orders/` shape** — sin breaking change |

---

## 7. Métricas de éxito

Tras el refactor:

- 0 instancias de `BaseModal` anidado en flujo de OT.
- 0 violaciones de invariantes #1, #4, #6, #8 en `features/production/components/forms/`.
- `npm run type-check` y `pytest backend/production` verdes.
- Test E2E (manual o automatizado): crear OT manual + crear OT linked + editar OT en MATERIAL_ASSIGNMENT, todo sin abrir un segundo modal.
- LOC de `WorkOrderWizard.tsx` no crece más de +150 (split en sub-componentes si es necesario).

---

## 8. Próximo paso

Leer [implementation-plan.md](./implementation-plan.md) y ejecutar tasks en orden desde [tasks/00-overview.md](./tasks/00-overview.md).
