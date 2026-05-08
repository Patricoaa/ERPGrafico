---
id: 0015
title: DocumentService and Metadata Schema for UI Forms
status: Accepted
date: 2026-05-07
author: Core Team
---

# 0015 — DocumentService and Metadata Schema for UI Forms

## Context
As the ERP grows, we have a proliferation of forms to create and edit domain entities. Manually creating React components (`Form` + `Zod Schema` + `TanStack Query Mutations`) for every single model leads to:
1. Massive code duplication.
2. Divergence between backend models/validation and frontend representation.
3. Inconsistent UI layouts.
4. Difficulty rolling out generic UI improvements (like auto-save, inline validation, and error handling) across all forms.

We need a system that delegates the "Source of Truth" for form rendering back to the Django backend. The backend already knows the database schema, choices, validations, and relations. It should dictate the layout.

## Decision
We will implement a **Metadata-Driven UI Architecture** using `DocumentService` (or `UniversalRegistry`) alongside a standard generic `<EntityForm>` component in the frontend.

1. **Backend (`FormMeta` class)**: 
   Models will declare an inner `class FormMeta` that defines:
   - `ui_layout`: A declarative JSON structure defining tabs, grids, and fields.
   - `exclude_fields`: Fields to be hidden from the UI.
   - `child_collection`: Metadata indicating that a 1:N relationship should be rendered as an editable grid inline within the form (e.g., `SaleLine` within `SaleOrder`).

2. **API Endpoint (`/api/registry/<app>.<model>/schema/`)**: 
   A standardized metadata endpoint (`build_schema`) will dynamically serialize the model's fields, constraints, choices, and `FormMeta` definitions into a JSON schema payload.

3. **Frontend (`<EntityForm>`)**:
   A polymorphic, headless-ui component that:
   - Fetches the schema for a given `modelLabel` (e.g., `"sales.saleorder"`).
   - Generates a React Hook Form context dynamically based on the schema types (`z.string()`, `z.number()`, `z.date()`, etc.).
   - Renders generic inputs (`<DynamicField>`) and handles nested collections (`<ChildCollectionGrid>`) based on the layout instructions.
   - Automatically handles data submission (`POST` or `PATCH`) mapping the form state back to the REST endpoint.

## Consequences

### Positive
- **Drastic reduction in boilerplate**: Adding a new CRUD entity requires zero frontend code. We just define `class FormMeta` on the backend and route to `<EntityForm modelLabel="app.model" />`.
- **Single Source of Truth**: Backend handles field requirements, max lengths, relationships, and layout rules.
- **Consistent UX**: All forms instantly benefit from generic UI upgrades (e.g., keyboard navigation, error toast notifications).
- **Nested Collections**: We can render master-detail forms (Header + Lines) polymorphically without custom React code.

### Negative
- **Reduced Flexibility**: Highly custom UI interactions (e.g., specific maps, drag and drop, complex multi-step wizards) are harder to implement generically.
- **Migration Effort**: Existing forms need to be audited and refactored to use `EntityForm`.
- **Typing Challenges**: Since the form fields are completely dynamic at runtime, strict static typing in TypeScript for `form.watch()` or `form.setValue()` is lost inside the generic component.

## Alternatives considered
- **Maintain hardcoded forms**: Rejected due to high maintenance burden and inconsistency across 50+ models.
- **Frontend-only generic schema library (like `react-jsonschema-form`)**: Rejected because it requires duplicating the model schema in the frontend codebase. The backend should remain the source of truth for validation and structure.

## References
- [20-task-list.md (T-26 to T-40)](../../docs/50-audit/Arquitectura%20Django/20-task-list.md)
- `backend/core/serializers/metadata.py`
- `frontend/components/shared/EntityForm/`
