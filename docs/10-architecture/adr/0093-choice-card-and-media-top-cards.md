---
id: 0093
title: ChoiceCard y tarjetas con media arriba — un solo lenguaje de selección para los pasos del POS
status: Accepted
date: 2026-10-21
author: frontend-team
---

# 0093 — ChoiceCard y tarjetas con media arriba

**Related:** ADR-0092 (anatomía de `ProductCard`), ADR-0087 (entity-view), ADR-0076, `docs/20-contracts/component-choice-card.md`

---

## Context

Tras rediseñar `ProductCard` (ADR-0092), los demás pasos del POS conservaban otros lenguajes de selección: contactos con borde grueso y `Checkbox` circular, documento tributario y entrega con `RadioCard` (anillo `CmykRing` a la derecha), métodos de pago como botones `card-base p-8` con `border-2 accent-visible`, y fabricación como tabla. Había cuatro apariencias de "elegido", tipografías distintas y los contactos usaban un ícono plano en vez de Blobatar.

## Decision

1. **`SelectableCard`** (`selectableCardClass`, `SelectionCheck`) concentra la apariencia de elegido / hover / no disponible: cinta CMYK + anillo K100 + check; la cinta se previsualiza en hover; no disponible = tarjeta lavada con cursor `not-allowed`. `ProductCard` se migra a él.
2. **`ChoiceCard` + `ChoiceGroup`** (shared, API pública nueva): opción con franja de media arriba, `meta` mono, título, descripción y `footer`; el grupo es un `radiogroup` con flechas y `activation` configurable. Migran `Step2_DTE`, `Step3_Delivery`, el selector de métodos de pago y `ContactCardGrid`.
3. **`ContactCard`** usa `Blobatar` como media y muestra RUT en mono y la posición de crédito en el pie.
4. **`entity-view`** (contrato, cambio aditivo): `CardMedia.placement?: "inline" | "top"` y `badge?`; `EntityCard.Media` dibuja la franja. Las colecciones existentes no cambian. ~~`mfgDetailLineViews` lo usa para el paso de fabricación.~~ **Actualizado en ADR-0094:** el paso de fabricación usa `MfgLineCard` + `CardRail` (anatomía horizontal con riel de estado), no `mfgDetailLineViews`.
5. **`RadioCard` no se elimina**: sigue en compras, notas y ajustes; solo se retira de los pasos del POS. `CmykRing` sigue en `Checkbox`/`RadioGroup`/`SelectionRing`.
6. `PaymentMethodSelector` es compartido: compras y notas heredan el mismo aspecto.

## Consequences

- Una sola definición de "elegido" para productos, contactos, documentos, entrega y pago.
- Los pasos son más densos y escaneables (jerarquía meta › título › descripción › pie); los íconos amarillos (`text-warning`) se reemplazan por franja ámbar + `text-warning-foreground` por contraste.
- Deuda abierta: `RadioCard` y `EntityCard` (selección múltiple con `SelectionRing`) conservan su look; migrarlos sería un cambio de contrato aparte.
