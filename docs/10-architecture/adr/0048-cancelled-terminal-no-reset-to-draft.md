---
id: 0048
title: CANCELLED es terminal — no se implementa Reset-to-Draft
status: Accepted
date: 2026-06-11
author: equipo-core
---

# 0048 — CANCELLED es terminal — no se implementa Reset-to-Draft

## Context

La auditoría de cancelación/anulación ([cancel-annul-entity-audit.md](../../50-audit/cancel-annul-entity-audit.md),
gap G-16) detectó una contradicción contractual: [deletion-policy.md](../../20-contracts/deletion-policy.md)
declaraba la cancelación "Reversible: Sí (Reset to Draft)", pero no existe ningún
endpoint ni servicio `reset_to_draft` en el backend (grep: cero ocurrencias), y
[state-map.md](../../20-contracts/state-map.md) define `CANCELLED` sin transiciones
salientes en todas las entidades.

Había que decidir: implementar Reset-to-Draft o corregir el contrato.

## Decision

**No se implementa Reset-to-Draft.** `CANCELLED` es un estado terminal en todas las
entidades transaccionales. Si una cancelación fue un error, el flujo es crear un
documento nuevo (para órdenes DRAFT el costo de re-crear es mínimo; el HUB permite
duplicar).

Razones (criterio PYME):

1. **Simplicidad del grafo de estados.** Reabrir un documento cancelado obliga a
   re-validar numeración, fechas contra período contable, stock reservado y todos los
   hijos cancelados en cascada (OTs, deliveries, invoices). El costo de implementación
   y de superficie de bugs supera con creces el beneficio.
2. **Audit trail limpio.** Con `CANCELLED` terminal, una fila `workflow.Transition`
   con `transition='cancel'` es definitiva. Un reset introduciría historias no lineales
   que complican la trazabilidad que PR B acaba de establecer.
3. **Consistencia con state-map.** El contrato de estados ya trataba `CANCELLED` como
   terminal; esta ADR alinea deletion-policy con ese contrato en vez de expandir ambos.

## Consequences

- deletion-policy.md corrige la columna Reversible de Cancelación a
  "No — `CANCELLED` es terminal".
- Ningún servicio nuevo. Cero cambios de código.
- Si en el futuro un caso de negocio real exige reabrir documentos (p. ej. POS con
  cancelaciones accidentales frecuentes), se revisita con una ADR nueva que defina
  las re-validaciones obligatorias; no se "des-cancela" por edición directa de status.
