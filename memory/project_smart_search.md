---
name: Smart Search Bar Implementation Plan
description: Plan activo para implementar SmartSearchBar server-side en DataTable — Opción B elegida, nuqs como pieza central
type: project
---

Plan de implementación para `SmartSearchBar` aprobado y documentado en `docs/50-audit/searchbarDT/implementation-plan.md`.

**Why:** Los filtros de tabla actuales son dispersos, no persisten en URL y no escalan a datasets grandes. La auditoría de hooks (completada 2026-05-13) dejó la infraestructura lista para server-side filtering.

**How to apply:** Cuando el usuario pida avanzar con la search bar, ir directamente al plan en `docs/50-audit/searchbarDT/implementation-plan.md`. La siguiente tarea es resolver los prerequisitos (§5) y comenzar Epic 1 (T1.1 instalar nuqs).

Decisiones clave ya tomadas:
- Opción B (server-side) — no A ni C
- `nuqs` para sync URL ↔ filterState (central)
- Zod para validar tokens parseados
- `cmdk` (shadcn) para dropdown de sugerencias
- Cursor reset obligatorio al cambiar filtros

Pendiente de decidir (R1, bloqueante): formato de URL — `?q=json` vs params planos. Recomendación: params planos.

Milestones: M0 (prereqs) → M1 (componente) → M2 (facturas+tesorería) → M3 (órdenes+productos+contactos) → M4 opcional (sugerencias texto).
