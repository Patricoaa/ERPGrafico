---
id: 0132
title: El socio es una entidad propia con ficha y una única superficie de acciones
status: Accepted
date: 2026-11-11
author: frontend-team
---

# 0132 — El socio es una entidad propia con ficha y una única superficie de acciones

**Relacionado:** ADR-0087, ADR-0119, ADR-0131. Plan: `docs/superpowers/plans/2026-11-11-socios-ficha-acciones-hooks.md`.

## Contexto

Las acciones de socio (suscripción, aporte, retiro, transferencia, dividendos, movilización, distribuciones) se disparan desde modales y wizards sueltos en `features/settings`. El socio no tiene ficha navegable (`openEntity`), el Libro Auxiliar vive en `?ledger=id`, los componentes llaman `partnersApi` directamente y existen endpoints y componentes sin consumidor. «Configuración inicial» duplica «Añadir socio» y `setup_partner` permite fijar el % de participación sin asiento.

## Decisión

1. **Entidad propia `contacts.partner`** con `PartnerDrawer` registrado en `entity-drawers` y `entity-registry` (pestañas: Resumen, Libro auxiliar, Participación, Distribuciones, Documentos). No es un modo de `ContactDrawer`; este solo enlaza a la ficha.
2. **UI en `features/partners`** (nuevo feature con barrel). `settings` conserva solo `PartnerSettings`. API y tipos permanecen en `contacts` hasta separar el backend.
3. **Una sola fuente de acciones** (`partnerActions`) con `visible` por estado; un único estado de acción activa en lugar de un flag por modal.
4. **Se eliminan** `initial_setup`, `setup_partner`, `promote_partner` (endpoints, servicios, `InitialCapitalModal`, `PartnerEditDrawer`) y los modales duplicados sin uso. El primer socio se crea con «Añadir socio» (`equity_subscription`, que ya promueve al contacto; la participación se mide sobre capital pagado, así que es 0 % hasta el primer aporte, igual que antes). El % de participación solo cambia por suscripción, reducción o transferencia.
5. **Se mantiene** `demote_partner`, expuesto como «Dar de baja socio» con sus guards.
6. **Se reintegra** el aporte en especie como método «Bienes» de `PartnerContributionWizard`.
7. **Se expone** la eliminación de distribuciones en `DRAFT`/`APPROVED`. Anular una distribución `EXECUTED` queda fuera de alcance (requiere ADR).
8. Las escrituras monetarias de socio exigen `Idempotency-Key`.

## Consecuencias

Cambia la API pública de `/contacts/` (tres acciones eliminadas); no hay otros consumidores que la UI. Los datos ya cargados no se migran. Las URLs `?ledger=` se redirigen a la ficha.

## Anulación de distribuciones `EXECUTED` (fuera de alcance, pendiente de ADR propio)

La UI solo permite eliminar distribuciones `DRAFT`/`APPROVED` (el backend rechaza `EXECUTED` en `validate_can_delete`). Anular una ejecutada exige un asiento de reversa, revertir los `PartnerTransaction` generados y los pagos de dividendos ya hechos, y recalcular `PartnerEquityStake`; interactúa con ADR-0091 (inmutabilidad económica). No se implementa aquí: requiere su propio ADR.

