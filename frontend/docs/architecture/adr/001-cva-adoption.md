# ADR 001: Component Variance Authority (CVA) Adoption

## Context
During the process of standardizing the "Industrial Premium" aesthetic to remove hardcoded colors and align with the `globals.css` and `color-tokens.md` references, an anti-pattern of using template literal interpolation for Tailwind classes (e.g., ``text-${color}-600``, ``bg-${colorBg}/30``) was detected in several shared and feature components. 
This anti-pattern circumvents Tailwind CSS statically analyzable JIT engine compilation, leading to broken styles at runtime and inconsistent adherence to semantic palettes.

## Decision
We establish **`class-variance-authority` (cva)** as the mandatory architectural pattern for building variants of both Shared UI Components and Feature UI Components where a visual element changes according to business status or application states (e.g., Badges, Card statuses, Status alerts).
Components must define discrete variants aligned to the design system tokens instead of calculating colors programmatically on the fly. 

## Consequences
- **Positive:** Improved compilation reliability, consistent use of semantic tokens across components, fully predictable theming, removal of unexpected broken UI states due to uncompiled CSS.
- **Negative:** Slightly increased boilerplate for configuring components, requiring developers to preconfigure all possible states of a component (e.g. `variant: 'primary' | 'destructive' | ...`).

## Implementation Checklist
- Refactored `RelatedDocumentsSection.tsx` to adopt `cva`.
- Added adoption rule into internal coding practices moving forward.
- Any subsequent component refactoring during the Industrializing UI initiative will check and migrate to this pattern.
