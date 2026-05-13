---
name: Hooks Audit Completed
description: Auditoría de hooks completada 2026-05-13 — 5 fases, 41 hooks migrados, prerequisito para SmartSearchBar
type: project
---

Auditoría exhaustiva de hooks completada el 2026-05-13. Documentada en `docs/50-audit/hooks/hooks-audit.md`.

**Why:** Los hooks tenían problemas críticos de performance (fetches ilimitados, sin staleTime, cache manual, useState+useEffect para fetching). Necesario resolver antes de implementar SmartSearchBar server-side.

**How to apply:** Al trabajar con hooks de features, estos son los patrones actuales correctos. No reinventar — los hooks ya tienen staleTime, queryKeys centralizadas, filters tipados en queryKey, e invalidación cross-module.

Estado post-audit (todos resueltos):
- P1 (sin staleTime): 0 hooks restantes (era 38)
- P3 (cache manual globalCache): 0 restantes (era 5)
- P4 (useState+useEffect): 0 restantes (era 8)
- P6 (invalidación demasiado amplia): 0 restantes (era 9)
- P12 (wrappers innecesarios): 0 restantes (era 6)
- P2 (fetches sin page_size): 6 restantes — estos son prerequisito para rollout de SmartSearchBar en esos módulos

Infraestructura lista para SmartSearchBar: todos los hooks aceptan `filters` tipados incluidos en `queryKey`.
