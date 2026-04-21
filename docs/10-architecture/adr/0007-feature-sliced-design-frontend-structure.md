---
id: 0007
title: Feature-Sliced Design frontend structure
status: Accepted
date: 2026-04-21
author: core-team
---

# 0007 — Feature-Sliced Design frontend structure

## Context
A flat folder structure does not scale for an ERP with many bounded contexts. We need a modular architecture that enforces boundaries.

## Decision
Adopt a simplified Feature-Sliced Design (FSD) architecture. Code must be organized into business modules (`features/`), with strict import rules enforced via barrel files.

## Consequences
- **Positive:** High cohesion, low coupling. Easier to navigate and maintain large codebases.
- **Negative:** Strict rules on cross-feature imports require discipline.

## Alternatives considered
- Flat structure
- Domain-Driven Design (full)

## References
- `docs/10-architecture/frontend-fsd.md`
