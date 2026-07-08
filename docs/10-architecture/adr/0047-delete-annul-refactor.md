---
id: 0047
title: Refactor borrado → cancelación/anulación — tres patrones de eliminación
status: Accepted
date: 2026-06-10
author: equipo-core
---

# 0047 — Refactor borrado → cancelación/anulación

## Context

Hasta ahora, los documentos transaccionales (SaleOrder, PurchaseOrder, Invoice, TreasuryMovement, PurchaseReceipt) tenían un mecanismo único de "borrado" vía `destroy()` del ViewSet. Esto presentaba varios problemas:

1. **Seguridad fiscal**: documentos en estado POSTED podían ser hard-deleteados, violando el requisito de pista de auditoría.
2. **Inconsistencia entre apps**: Sales ocultaba el botón de borrado para POSTED; otras apps no.
3. **Falta de semántica clara**: no existía diferencia entre "cancelar un borrador" (sin consecuencias fiscales) y "anular un documento contabilizado" (requiere reverso contable/de stock).
4. **Dependencias huérfanas**: borrar una Order no cancelaba sus Invoices hijas ni revertía movimientos de stock.

La decisión tomada fue refactorizar todo el ecosistema hacia una taxonomía de tres patrones: **Cancelación**, **Anulación** y **Borrado**.

## Decision

### Taxonomía resultante

| Patrón | Árbol afectado | Reversos | Pista fiscal | Acción |
|--------|---------------|----------|--------------|--------|
| **Cancelación** | Todo DRAFT | No — solo `status=CANCELLED` + borrar JE si DRAFT | No (nunca salió de borrador) | `cancel` |
| **Anulación** | Al menos un POSTED/PAID | Sí — contra-asiento, reverso de stock | Sí | `annul` |
| **Borrado** | Maestros / config | No | No aplica | `delete` |

### Reglas de negocio

1. **Cada documento expone tres endpoints**: `POST /cancel/` (cancelar), `POST /cancel_impact/` (preview de impacto), y el `DELETE /{id}/` existente que ahora retorna 400 si el documento está activo (status != DRAFT).
2. **Propagación en cadena**: el servicio de cancelación de un padre (SaleOrder) delega en el servicio de cancelación de sus hijos (Invoice → TreasuryMovement). Cada servicio es idempotente.
3. **El JE se borra si está DRAFT**: al cancelar un movimiento cuyo JE está en borrador, el JE se elimina (no queda basura). Si el JE está POSTED, se requiere `annul` con reverso.
4. **`cancel_impact`**: endpoint de solo lectura que devuelve el sub-árbol de documentos que serán cancelados, permitiendo al frontend mostrar un modal de confirmación informado.

### Modelo

- `TreasuryMovement` recibe campo `status` con `MovementStatus` (DRAFT / POSTED / CANCELLED), completando el último documento transaccional que carecía de él.
- Se corrige duplicación de clase `Status` en `Check` model que causaba shadowing del enum importado.
- Migración 0077 agrega el campo a treasury_treasurymovement.

### Frontend

- Se reemplaza `useDeleteOrder` por `useCancelOrder` con llamada a `/cancel/` + `/cancel_impact/`.
- Se registra `cancel-order` en `ActionCategory.tsx` como acción del HUB.
- OriginPhase: label "Cancelar Orden" + modal de impacto.
- BillingPhase: "Eliminar Borrador" → "Cancelar Borrador".
- TreasuryPhase: "Eliminar/Anular Pago" → "Cancelar/Anular Pago".
- Purchasing: `delete-draft` → `cancel-order`.

## Consequences

**Positivas:**
- Auditoría completa: ningún documento POSTED puede ser hard-deleteado.
- Comportamiento uniforme entre las 4 apps transaccionales.
- UX predecible: el usuario ve el impacto exacto antes de confirmar.
- Idempotencia: repetir una cancelación es seguro.

**Negativas:**
- Mayor complejidad en los servicios (cascada, chequeo de estado).
- Dos flujos (cancel vs annul) que el frontend debe distinguir.
- Migración de datos: registros existentes con `status=NULL` en TreasuryMovement deben migrarse.

## Alternatives considered

1. **Single "annul" endpoint para todo**: se descartó porque forzar reversos contables en documentos DRAFT es innecesario y ruidoso.
2. **Solo hard-delete con confirmación**: se descartó por riesgo fiscal.
3. **Soft-delete genérico (`is_active`)**: se descartó porque no distingue entre cancelación (sin rastro) y anulación (con rastro fiscal).

## References

- [Deletion policy contract](../../20-contracts/deletion-policy.md) — actualizado con Cancel como tercer patrón.
- [State map contract](../../20-contracts/state-map.md) — transiciones DRAFT→CANCELLED agregadas.
- [Component row actions contract](../../20-contracts/component-row-actions.md) — `cancel` agregado al registry.
- [Plan de refactor](../../50-audit/delete-annul-refactor-plan.md) — documento de planificación original.
