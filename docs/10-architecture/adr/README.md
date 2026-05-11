---
layer: 10-architecture
doc: adr-index
status: active
owner: core-team
last_review: 2026-04-21
---

# Architecture Decision Records

## When an ADR is required

- New core dependency (runtime, framework, major lib).
- Mass refactor affecting ≥3 features / ≥3 apps.
- Change to any contract in `/docs/20-contracts/`.
- Change to a global invariant in root `README.md`.
- New cross-cutting pattern (auth, caching, error handling).

No PR may merge if it contradicts an `Accepted` ADR without first superseding it.

## Format

Filename: `NNNN-kebab-title.md` — NNNN is zero-padded sequence.

```markdown
---
id: NNNN
title: …
status: Proposed | Accepted | Superseded by NNNN | Deprecated
date: YYYY-MM-DD
author: …
---

# NNNN — Title

## Context
What forces motivate this decision. What constraints exist.

## Decision
The chosen approach, stated as an instruction.

## Consequences
Positive, negative, neutral. What becomes easier, what becomes harder.

## Alternatives considered
Briefly — what else, why rejected.

## References
Links to playbooks, contracts, external docs.
```

## Lifecycle

```
Proposed → (review) → Accepted → (later) → Superseded | Deprecated
```

- `Proposed`: open PR, under review.
- `Accepted`: merged, enforceable.
- `Superseded by NNNN`: replaced; link forward, keep file for history.
- `Deprecated`: no longer applies; link to replacement context.

## Index

| ID | Title | Status |
|----|-------|--------|
| 0001 | Next.js App Router | Accepted |
| 0002 | TypeScript strict + zero-any | Accepted |
| 0003 | Tailwind v4 `@theme` inline | Accepted |
| 0004 | Shadcn UI base components | Accepted |
| 0005 | TanStack Query for server state | Accepted |
| 0006 | Zod + react-hook-form for all forms | Accepted |
| 0007 | Feature-Sliced Design frontend structure | Accepted |
| 0008 | DRF ViewSets + service layer | Accepted |
| 0009 | Celery for async side effects | Accepted |
| 0012 | Unified system versioning | Accepted |
| 0013 | ActionDock pattern for floating tasks | Proposed |
| 0014 | `decimal_places=0` para totales de documentos transaccionales | Accepted |
| 0015 | DocumentService and Metadata Schema for UI Forms | Accepted |

(Create individual files lazily as decisions are revisited or disputed.)
