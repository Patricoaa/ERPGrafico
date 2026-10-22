---
id: 0088
title: Remove ActionSlideButton — button layer standardized on shadcn Button + ActionButtons (kinetic slide animation retired)
status: Accepted
date: 2026-10-19
accepted: 2026-10-19 (migration plan approved by owner)
author: frontend-team
---

# 0088 — Remove ActionSlideButton

**Related:** contracts `component-button.md` (updated first, contract-first), `typography.contract.test.ts`, `eslint.config.mjs` (Loader2 rule), ADR-0004 (shadcn UI base), ADR-0087 (doc-code drift precedent), commit `93de216` (ToolbarCreateButton already migrated off ActionSlideButton).

## Context

`ActionSlideButton` (Capa 2 del sistema de botones) era el "Premium Kinetic Button": fondo con animación slide-in al hover/focus/active, 5 variantes de color (default `cmyk`), `loading` con spinner y `icon`. Costos acumulados:

1. **Deriva de contrato:** `component-button.md` documentaba default `primary` y 3 variantes; la implementación real tenía default `cmyk` y 5 (`primary | destructive | success | cmyk | muted`). El test de tipografía leía el archivo fuente directamente.
2. **Acoplamiento de wrappers:** `SubmitButton` y `DangerButton` lo envolvían y exponían `React.ComponentProps<typeof ActionSlideButton>` como su API pública — toda la Capa 2 dependía de un componente de animación concreto.
3. **Duplicación muerta:** `ui/button.tsx` ya implementaba la misma animación como variante `ghost-cmyk` (creada en la migración de `ToolbarCreateButton`), con **0 consumidores**.
4. **Superficie de mantenimiento:** 73 sitios JSX en ~61 componentes, más la regla de eslint que lo nombraba como canonical loader.

Se decidió retirar por completo la identidad cinética del sistema de botones: los botones de acción pasan a las variantes estándar shadcn (`default` relleno, `destructive`, `outline`).

## Decision

1. **Eliminar `ActionSlideButton` por completo:** archivo, export del barrel y todas las referencias en contratos/playbooks.
2. **Retirar la animación slide-in** del design system; eliminar también la variante muerta `ghost-cmyk` de `ui/button.tsx`.
3. **Re-implementar `SubmitButton` / `DangerButton` directamente sobre `ui/button.tsx`**, conservando:
   - tipografía canónica Capa 2: `h-9 px-4 text-3xs font-black uppercase tracking-widest rounded-sm shadow-card`;
   - `loading` → spinner `Loader2` + `disabled` (el sitio canónico de Loader2 pasa a `ActionButtons.tsx`, con la anotación `eslint-disable-next-line no-restricted-syntax` que antes vivía en `ActionSlideButton.tsx`);
   - `icon` opcional, oculto mientras `loading=true`.
4. **`SubmitButton` ya no tiene icono por defecto** (`<Save/>` se pasa explícitamente donde se quiera). Evita cambio visual en ~45 formularios.
5. **Matriz de migración de call sites directos:**

   | Variante actual | Destino |
   |---|---|
   | default `cmyk` / `primary` (submit) | `SubmitButton` |
   | `destructive` | `DangerButton` |
   | `success` / `warning` (sítios puntuales) | `SubmitButton`/`DangerButton` + `className` `bg-success…` / `bg-warning…` |
   | `muted` | `Button variant="outline"` (o `SubmitButton variant="outline"` cuando hay `loading`) |
   | `size="icon"` | `IconButton` |

6. **Contract-first:** `component-button.md` y este ADR se actualizan antes que el código.

## Consequences

**Positivas**
- Una capa menos en la jerarquía de botones; la API de `SubmitButton`/`DangerButton` queda desacoplada de cualquier componente de animación.
- El contrato vuelve a coincidir con el código; desaparece la lectura de fuente del test de tipografía y la dependencia en la regla de eslint.
- `ghost-cmyk` (código muerto) se elimina en la misma barrida.

**Negativas**
- Cambio visual amplio: ~73 sitios pasan de botón bordeado + slide a variantes estándar (principalmente filled `default`). Requiere QA visual por feature.
- `success`/`warning`/`muted` quedan como `className` residual por sitio en lugar de variantes de primera clase (6 sitios; decisión explícita para no ampliar la API).
- Se pierde la identidad de interacción "kinética" del proyecto (p.ej. el footer de `GenericWizard`) — intencional y documentado aquí.

**Neutra**
- La semántica de `size` unifica a la de `ui/button.tsx` (base h-10); la Capa 2 fija `h-9` por `className` y los sitios táctiles POS pasan `h-12` explícito.

## Alternatives considered

- **Portar la animación al CVA de `Button` (generalizar `ghost-cmyk`)** — rechazada: mantiene la complejidad de la animación y su coste de mantenimiento; el objetivo era retirar la cinética.
- **Alias deprecado `ActionSlideButton = SubmitButton`** — rechazada: dejaría código puente vivo y referencias en docs; el objetivo es eliminación completa.
- **Variantes `success`/`muted` de primera clase en el CVA** — rechazada por ahora: 6 sitios no justifican ampliar la API de `buttonVariants` (reversible vía ADR futuro).

## References

- `docs/20-contracts/component-button.md` — contrato actualizado en la misma fase 0.
- `frontend/components/shared/ActionButtons.tsx` — wrappers re-implementados.
- `frontend/lib/__tests__/typography.contract.test.ts` — aserción retargetada a `ActionButtons`.
- `frontend/eslint.config.mjs` — mensaje de la regla Loader2 actualizado.
