---
id: 0002
title: TypeScript strict + zero-any
status: Accepted
date: 2026-04-21
author: core-team
---

# 0002 — TypeScript strict + zero-any

## Context
Type safety is critical for maintaining a large ERP system. The use of `any` defeats the purpose of TypeScript and leads to runtime errors.

## Decision
Enforce strict TypeScript checks and a strict "zero-any" policy across the codebase.

## Consequences
- **Positive:** Catch errors at compile time, better developer experience with autocomplete.
- **Negative:** More upfront effort required to define types, especially when dealing with complex or dynamic API responses.

## Alternatives considered
- Partial TypeScript adoption

## References
- `docs/90-governance/zero-any-policy.md`
- `docs/90-governance/GOVERNANCE.md`
