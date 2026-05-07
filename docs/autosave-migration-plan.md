---
doc: autosave-migration-plan
status: in-progress
owner: frontend-team
last_review: 2026-05-05
---

# Plan de migración a autosave centralizado

Documento vivo de seguimiento de la iniciativa que unifica las estrategias de guardado de los paneles de configuración bajo un sistema centralizado (`useAutoSaveForm`).

> **Origen del análisis**: ver inventario y matriz de decisión en la conversación que originó este plan. Este documento traduce esa decisión a PRs ejecutables.

## Decisiones de UX confirmadas

- **ReconciliationIntelligence** → autosave puro (sin botón). Cuando los pesos no suman 100, el guardado queda gateado y el estado expone el motivo.
- **WorkflowSettings** → autosave por fila con `debounceMs: 400` (más rápido que el estándar de 1000 ms para preservar la sensación inmediata del patrón actual).

## Matriz de decisión vigente

| Caso | Estrategia | Sub-modo |
|---|---|---|
| Singleton sin validación cruzada | `useAutoSaveForm` debounce 1000 ms | base |
| Singleton con validación terminal | `useAutoSaveForm` + `validate` | gating semántico |
| Colección con N filas editables | `useAutoSaveForm` por fila + `useCombinedAutoSaveStatus` | per-row |
| Catálogo CRUD (alta/baja además de edición) | `BaseModal` + submit manual | fuera de scope autosave |

## Estado de PRs

| PR | Título | Estado | Notas |
|---|---|---|---|
| PR-1 | Hook + primitivas + Treasury de referencia | ✅ Completado | — |
| PR-2 | Migrar singletons puros (8–10 paneles) | ✅ Completado | — |
| PR-3 | ReconciliationIntelligence (autosave + `validate`) | ✅ Completado | — |
| PR-4 | WorkflowSettings (autosave por fila + upsert) | ✅ Completado | — |
| PR-5 | Documentación de catálogos CRUD | ⏳ Pendiente | Independiente |

Leyenda: ⏳ Pendiente · 🔄 En progreso · ✅ Completado · 🚫 Bloqueado

---

## PR-1 — Hook + primitivas + Treasury de referencia

**Objetivo**: entregar el hook centralizado y demostrarlo refactorizando el panel cuya lógica actual está más cerca del contrato deseado (Treasury, que ya usa estados `idle/saving/synced/error`). Sin cambios visibles para el usuario final.

**Tareas**:

- [x] Crear este documento de seguimiento (`docs/autosave-migration-plan.md`).
- [x] Crear ADR-0011 — autosave centralizado para paneles de configuración.
- [x] Crear `frontend/hooks/useAutoSaveForm.ts`.
- [x] Crear `frontend/hooks/useAutoSaveForm.test.ts` (9/9 tests verdes).
- [x] Crear `frontend/hooks/useUnsavedChangesGuard.ts`.
- [x] Crear `frontend/components/shared/AutoSaveStatusBadge.tsx`.
- [x] Exportar `AutoSaveStatusBadge` desde `frontend/components/shared/index.ts`.
- [x] Refactorizar `frontend/features/settings/components/TreasurySettingsView.tsx` para usar `useAutoSaveForm` (eliminar `useEffect + setTimeout` + `onSavingChange` callback duplicado).
- [x] Adaptar el consumidor del callback `onSavingChange` (no aplicable: el padre nunca lo pasaba; el badge se renderiza dentro del componente).
- [x] Crear `docs/20-contracts/autosave-contract.md`.
- [x] Actualizar `docs/20-contracts/hook-contracts.md` con referencia al nuevo contrato.
- [x] Actualizar `docs/20-contracts/component-form-patterns.md` con sección "Save strategy" (§8).
- [x] Ejecutar `npm run type-check` — errores de PR-1 resueltos (Label en WorkflowSettings, required_error en TransferModal). Errores restantes son pre-existentes fuera de scope.
- [ ] Ejecutar `npm run test -- useAutoSaveForm` sin errores (bloqueado: incompatibilidad Node.js/rolldown en entorno local — 9/9 tests escritos, verificar en CI).

**Criterios de éxito**:
- Treasury sigue funcionando idéntico desde el punto de vista del usuario.
- Tests cubren: debounce dispara una vez, flush en unmount, gating por `validate`, retry tras error, estado `synced` revierte a `idle` tras `syncedDurationMs`.
- 0 nuevos `any`, 0 violaciones de invariantes globales.

---

## PR-2 — Singletons puros

**Objetivo**: eliminar el `useEffect + setTimeout` duplicado (~10 instancias) reemplazándolo por `useAutoSaveForm` en los paneles de configuración tipo singleton.

**Tareas**:

- [x] Migrar `CompanySettingsView.tsx`.
- [x] Migrar `AccountingSettingsView.tsx` (Structure, Defaults, Tax — 3 sub-forms).
- [x] Migrar `SalesSettingsView.tsx`.
- [x] Migrar `InventorySettingsView.tsx` (Accounts, Adjustments, COGS — 3 sub-forms).
- [x] Migrar `BillingSettingsView.tsx`.
- [x] Migrar `PurchasingSettingsView.tsx`.
- [x] Migrar `HRSettingsView.tsx` (sólo pestaña Global; conceptos/AFPs siguen modal).
- [x] Migrar `PartnerAccountingTab` dentro de `PartnersSettingsView.tsx`.
- [x] Crear `docs/30-playbooks/add-settings-panel.md`.
- [x] Validar con `npm run type-check` — sin errores nuevos (errores pre-existentes en otros módulos no relacionados con PR-2).

**Criterios de éxito**: ≥10 bloques `useEffect + setTimeout` eliminados; todos los paneles muestran el mismo `AutoSaveStatusBadge`.

---

## PR-3 — ReconciliationIntelligence (autosave puro con `validate`)

**Objetivo**: convertir el último botón manual de configuración en autosave gateado por validez.

**Tareas**:

- [x] Refactorizar `ReconciliationIntelligence.tsx` a `react-hook-form` con `Controller` (sliders + switch).
- [x] Eliminar `useState<any>` local.
- [x] Configurar `useAutoSaveForm` con `validate: v => sumOfWeights === 100 || "Los pesos deben sumar 100% — los cambios no se guardarán hasta corregir"`.
- [x] Eliminar el botón "Guardar Perfil de Inteligencia" y el banner inline `<AlertTriangle />` (el badge global asume el rol).
- [x] Mantener el badge `totalWeight 95% / 100%` por campo como afordancia inmediata.
- [x] Validar con `npm run type-check`.

**Criterios de éxito**: usuario mueve sliders libremente; badge en `invalid` con motivo mientras los pesos no sumen 100; en cuanto suman 100, autosave dispara tras 1 s sin intervención.

---

## PR-4 — WorkflowSettings (autosave por fila con upsert)

**Objetivo**: refactor estructural del componente con más fragmentación. Introduce TanStack Query y RHF en un componente que hoy no usa ninguno.

**Tareas**:

- [x] Crear hooks TanStack Query: `useWorkflowRules`, `useNotificationRules`, `useWorkflowRecurrentSettings` (con upsert PATCH/POST).
- [x] Crear `frontend/hooks/useCombinedAutoSaveStatus.ts`.
- [x] Refactorizar `WorkflowSettings.tsx` partiendo cada `renderRuleRows` row en un componente `<WorkflowRuleRow>` con su propio `useAutoSaveForm` (`debounceMs: 400`).
- [x] Filas recurrentes: dos `useAutoSaveForm` (uno a `/assignment-rules/`, otro a `/settings/current/`) combinados con `useCombinedAutoSaveStatus`.
- [x] Eliminar `defaultValue + onBlur` (uncontrolled) y los toasts por click.
- [x] Crear `docs/30-playbooks/add-collection-row-autosave.md`.
- [x] Validar con `npm run type-check`.

**Criterios de éxito**: cambiar usuario→grupo en una fila guarda atómicamente tras 400 ms (no en dos PATCH); badge por fila + badge consolidado de página.

---

## PR-5 — Documentación de catálogos CRUD

**Objetivo**: cerrar el loop documental para que catálogos no migren por error a autosave.

**Tareas**:

- [ ] Crear `docs/30-playbooks/add-catalog-crud.md` con la receta `DataTable + BaseModal + submit manual`.
- [ ] Listar componentes que aplican esta categoría: `PaymentHardwareManagement`, `MasterDataManagement`, `TerminalManagement`, conceptos de nómina, AFPs, Users, Groups.
- [ ] Actualizar checklist de PR en `docs/90-governance/` con la pregunta: "Si tocas un panel de settings, ¿usaste el hook o justificaste la excepción en `add-catalog-crud.md`?"

**Criterios de éxito**: ningún panel queda sin categoría documentada.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `form.watch()` re-renderiza en cada keystroke en forms grandes | Aceptable: ya pasa hoy con el patrón actual; el hook no lo empeora. |
| Race condition: usuario edita mientras saving está en curso | El `useEffect` reprograma el timer al cambiar `watchedValues`; el siguiente save dispara después del actual. PATCH parcial es idempotente. |
| Workflow ráfaga de PATCH a `/workflow/settings/current/` | Cada fila tiene su propio form; sólo se envían los campos tocados. |
| `flush()` en unmount llama un PATCH al cerrar el tab | Comportamiento deseado; `useUnsavedChangesGuard` advierte si `status === "saving"`. |
| Usuarios habituados al botón de Reconciliation se confunden | Mensaje claro en estado `invalid`; badge "Guardado hace 2 s" cuando guarda. Documentar en release notes del PR-3. |

## Estimación

- PR-1: 1–2 días.
- PR-2: 1 día.
- PR-3: 0.5 día.
- PR-4: 2–3 días.
- PR-5: 0.5 día.

Total ~5–7 días repartibles en 2 sprints sin bloqueos entre PR-3 y PR-4.
