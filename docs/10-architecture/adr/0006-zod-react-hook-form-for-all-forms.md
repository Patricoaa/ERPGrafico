---
id: 0006
title: Zod + react-hook-form for all forms
status: Accepted
date: 2026-04-21
author: core-team
---

# 0006 — Zod + react-hook-form for all forms

## Context
Forms in an ERP are complex and require robust validation and state management without performance degradation.

## Decision
Standardize on `react-hook-form` for form state management and `zod` for schema validation across all forms.

## Consequences
- **Positive:** Performant forms, strong typing via `zod`, consistent validation logic.
- **Negative:** Boilerplate required for schema definition.

## Alternatives considered
- Formik
- Native HTML5 validation

## References
- `docs/90-governance/GOVERNANCE.md`
