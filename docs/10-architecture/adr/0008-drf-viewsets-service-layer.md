---
id: 0008
title: DRF ViewSets + service layer
status: Accepted
date: 2026-04-21
author: core-team
---

# 0008 — DRF ViewSets + service layer

## Context
Fat views or fat models lead to unmaintainable backend code. Business logic needs to be decoupled from HTTP handling.

## Decision
Use Django REST Framework (DRF) ViewSets for routing and serialization, but keep views thin (≤20 lines). All business logic must reside in a dedicated `services` layer.

## Consequences
- **Positive:** Testable business logic, clear separation of concerns.
- **Negative:** Overhead of passing data between views and services.

## Alternatives considered
- Fat models
- Fat views

## References
- `docs/10-architecture/backend-apps.md`
