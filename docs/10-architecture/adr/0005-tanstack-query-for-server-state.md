---
id: 0005
title: TanStack Query for server state
status: Accepted
date: 2026-04-21
author: core-team
---

# 0005 — TanStack Query for server state

## Context
Managing server state, caching, and background fetching is complex and error-prone when done manually with `useEffect`.

## Decision
Use TanStack Query for all server state management.

## Consequences
- **Positive:** Simplified data fetching, automatic caching and background updates.
- **Negative:** Added complexity in understanding query invalidation strategies.

## Alternatives considered
- Redux Toolkit RTK Query
- SWR

## References
- `docs/10-architecture/frontend-fsd.md`
