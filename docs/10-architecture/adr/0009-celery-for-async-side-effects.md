---
id: 0009
title: Celery for async side effects
status: Accepted
date: 2026-04-21
author: core-team
---

# 0009 — Celery for async side effects

## Context
Long-running tasks (e.g., email generation, document creation) block the HTTP request-response cycle, degrading user experience.

## Decision
Use Celery with Redis for all asynchronous side effects and background tasks.

## Consequences
- **Positive:** Fast HTTP responses, reliable background processing.
- **Negative:** Increased infrastructure complexity (requires Redis and Celery workers).

## Alternatives considered
- Django Q
- RQ

## References
- `docs/10-architecture/backend-apps.md`
