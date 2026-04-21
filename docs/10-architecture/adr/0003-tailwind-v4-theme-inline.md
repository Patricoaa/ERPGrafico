---
id: 0003
title: Tailwind v4 @theme inline
status: Accepted
date: 2026-04-21
author: core-team
---

# 0003 — Tailwind v4 @theme inline

## Context
We need a consistent styling approach. Tailwind CSS provides utility classes, but managing themes via `tailwind.config.ts` can become disconnected from the CSS.

## Decision
Use Tailwind CSS v4 and define theme variables inline using `@theme` in `app/globals.css`. Do not use `tailwind.config.ts`.

## Consequences
- **Positive:** Single source of truth for the visual system in CSS.
- **Negative:** Requires adapting to Tailwind v4 syntax.

## Alternatives considered
- Standard `tailwind.config.ts` setup
- CSS Modules

## References
- `frontend/app/globals.css`
- `docs/90-governance/GOVERNANCE.md`
