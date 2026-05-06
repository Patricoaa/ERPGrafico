---
id: 0011
title: Centralized autosave for settings panels
status: Proposed
date: 2026-05-05
author: frontend-team
---

# 0011 — Centralized autosave for settings panels

## Context

Los paneles de configuración del sistema (≥10 vistas tipo singleton, más casos especiales como `ReconciliationIntelligence` y `WorkflowSettings`) implementan el guardado de forma fragmentada. La auditoría detallada (ver `docs/autosave-migration-plan.md`) reveló:

- **Patrón mayoritario duplicado** ≥10 veces: `useEffect` + `setTimeout(form.handleSubmit(onSubmit), 1000)` con dependencias `watchedValues + isDirty`. Mismo bloque copiado-pegado en `Company`, `Accounting` (×3), `Sales`, `Inventory` (×3), `Billing`, `Purchasing`, `HR-Global`, `Treasury`, `Partners-Accounting`.
- **Estados de UI inconsistentes**: cada panel improvisa su feedback (toast, spinner, callback `onSavingChange` con shape distinto). `TreasurySettingsView` ya implementa el patrón más avanzado (estados `idle | saving | synced | error`) — sirve de referencia.
- **Casos especiales sin contrato**: `ReconciliationIntelligence` usa botón manual (justificado por validación cruzada de pesos = 100); `WorkflowSettings` dispara `onChange` inmediato sin RHF ni TanStack Query.
- **Sin recuperación ante fallos**, sin protección de navegación con cambios pendientes, sin updates optimistas, sin documentación.

## Decision

Adoptamos un sistema centralizado de autosave para todos los paneles de configuración del sistema. La unidad de implementación es un hook reutilizable más un badge de estado uniforme.

1. **Hook canónico**: `useAutoSaveForm<T>` ubicado en `frontend/hooks/useAutoSaveForm.ts`. Acepta una instancia de `react-hook-form`, una callback `onSave`, un `debounceMs` configurable (default 1000), una callback opcional `validate` para gating semántico, y un `enabled` para condiciones externas (loading inicial). Expone los estados `idle | dirty | invalid | saving | synced | error` y métodos `flush` y `retry`.
2. **Badge canónico**: `AutoSaveStatusBadge` en `frontend/components/shared/`. Sustituye los `Loader2` ad-hoc y los toasts de "Configuración aplicada" por un componente único.
3. **Guarda de navegación**: `useUnsavedChangesGuard(status, flush)` que engancha `beforeunload` cuando hay un guardado pendiente o en vuelo.
4. **Helper para colecciones**: `useCombinedAutoSaveStatus(...statuses)` consolida el peor estado de varias instancias del hook (necesario para filas Workflow con dos forms).
5. **Matriz de aplicabilidad**:
   - **Singletons sin validación** → `useAutoSaveForm` con debounce 1000 ms.
   - **Singletons con validación terminal** (ej. pesos = 100) → `useAutoSaveForm` con `validate`.
   - **Colecciones de filas editables** → un `useAutoSaveForm` por fila, debounce 300–500 ms, upsert `PATCH/POST` en `onSave`.
   - **Catálogos CRUD** (alta/baja además de edición) → quedan **fuera del scope autosave**: `BaseModal` + submit manual.

Toda nueva vista de configuración debe consumir el hook salvo justificación documentada en el playbook `add-catalog-crud.md`.

## Consequences

**Positivas**:
- Elimina ≥10 duplicaciones del bloque `useEffect + setTimeout`.
- UX consistente: un único componente de feedback, comportamiento predecible.
- Habilita gating por validez (caso ReconciliationIntelligence) sin renunciar al autosave.
- Añade protección de navegación con cambios pendientes (hoy ausente en todos los paneles).
- Fija contrato testeable: el hook tiene tests unitarios; los componentes consumidores no necesitan repetir la lógica.

**Negativas**:
- Cambio de UX en `ReconciliationIntelligence`: desaparece el botón "Guardar Perfil"; los usuarios habituados pueden necesitar reorientación. Mitigación: estado `invalid` con motivo explícito + release note.
- Cambio de UX en `WorkflowSettings`: el guardado deja de ser instantáneo y pasa a 400 ms de debounce; se reemplazan los toasts por click por badges por fila. Mitigación: `debounceMs` reducido a 400 (no 1000) preserva la sensación inmediata.
- Refactor de `WorkflowSettings` introduce TanStack Query y RHF en un componente que no los usa hoy → PR aislado y de mayor riesgo.
- `form.watch()` re-renderiza en cada keystroke; en forms grandes no empeora respecto al patrón actual pero tampoco mejora.

**Neutras**:
- Backend permanece sin cambios (los PATCH parciales ya están implementados y son idempotentes).

## Alternatives considered

1. **Mantener el statu quo**: rechazado. La duplicación crece con cada nuevo panel y la UX es heterogénea. La auditoría documenta ≥10 instancias del mismo bloque.
2. **Adoptar una librería externa** (ej. `@react-hookz/web` autosave, `react-autosave`): rechazado. Ninguna soporta nativamente `validate` con motivo legible ni el modelo de estados que necesitamos. Añadir una dep para esto cuando el hook propio tiene <100 líneas no se justifica.
3. **Mantener `ReconciliationIntelligence` y `WorkflowSettings` fuera** del sistema centralizado: rechazado por el equipo de producto. La fragmentación visible al usuario es uno de los motivadores principales.
4. **Optimistic updates con rollback** como obligatorio: aplazado. La primera versión del hook delega `onSave` a la mutation provista por el caller; el caller puede aplicar `onMutate` optimista cuando lo amerite. No queremos forzarlo en todos los paneles.

## References

- `docs/autosave-migration-plan.md` — plan vivo de seguimiento por PR.
- `docs/20-contracts/autosave-contract.md` — contrato detallado del hook (creado en PR-1).
- `docs/20-contracts/component-form-patterns.md` — sección "Save strategy" (actualizada en PR-1).
- ADR-0006 — Zod + react-hook-form para todos los formularios.
- ADR-0005 — TanStack Query para estado de servidor.
