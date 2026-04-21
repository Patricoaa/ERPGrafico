---
id: 0010
title: JWT auth via /api/token/
status: Accepted
date: 2026-04-21
author: core-team
---

# 0010 — JWT auth via /api/token/

## Context
We need a stateless authentication mechanism that works well with a decoupled frontend (Next.js) and backend (Django).

## Decision
Use JSON Web Tokens (JWT) for authentication via the `/api/token/` endpoint.

## Consequences
- **Positive:** Stateless, scalable, standard approach for SPAs.
- **Negative:** Token revocation is harder compared to session-based auth.

## Alternatives considered
- Session cookies
- Token Auth (DRF built-in)

## References
- `docs/10-architecture/system-diagram.md`
