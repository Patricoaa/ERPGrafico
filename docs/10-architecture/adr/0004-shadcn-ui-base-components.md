---
id: 0004
title: Shadcn UI base components
status: Accepted
date: 2026-04-21
author: core-team
---

# 0004 — Shadcn UI base components

## Context
Building accessible UI components from scratch is time-consuming. We need a solid foundation of primitive components.

## Decision
Use Shadcn UI as the base for our UI components. Do not modify the primitives in `components/ui/`. Extend them in `components/shared/`.

## Consequences
- **Positive:** High-quality, accessible base components. Full ownership of the code.
- **Negative:** Initial setup and updating requires manual file copying.

## Alternatives considered
- Material UI
- Chakra UI

## References
- `docs/90-governance/GOVERNANCE.md`
