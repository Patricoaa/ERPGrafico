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

1. **Entidad propia `contacts.partner`** con `PartnerDrawer` registrado en `entity-drawers` y `entity-registry` (pestañas: Resumen, Libro auxiliar, Participación, Distribuciones, Documentos; **lista de pestañas reemplazada por el [ADR-0133](0133-ficha-socio-estilo-pos.md)**). No es un modo de `ContactDrawer`; este solo enlaza a la ficha.
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

## Fase 5 — Backend de socios (ejecutada)

- **Errores:** `erpgrafico_exception_handler` convierte `django.core.exceptions.ValidationError` en 400 con la forma estándar `{"error": {"message", "code", "details"}}`. Se eliminaron los `except Exception → 400/500` de `ContactViewSet` y `ProfitDistributionResolutionViewSet`: los errores inesperados responden 500 genérico y no exponen `str(e)`. Los parseos de monto inválido y cuentas inexistentes ahora son 400.
- **Vistas delgadas:** la lógica pasó a `PartnerService` (`equity_subscription_response`, `equity_transfer_response`, `get_global_summary_payload`) y `ProfitDistributionService.create_draft_from_request`. `@transaction.atomic` vive en los servicios.
- **`partner_transactions`:** GET (`partner_transactions`) y POST (`register_partner_transaction`, mismo URL) son acciones distintas, ambas con `contacts.post_partnertransaction`.
- **Idempotencia:** se amplía la lista cerrada de `idempotency.md` con 7 scopes (suscripción, transferencia, aporte/retiro, pago individual de dividendo, movilización, aprobar y ejecutar distribución). El frontend genera la clave en `useIdempotencyKey` (por payload; se conserva ante fallos inciertos), de modo que los formularios no cambian.
- **N+1:** `profit-distributions`, `partners` y `partners_summary` tienen test de conteo de queries constante.
- **Pendiente deliberado:** `PartnerViewSet` propio con rutas `/partners/…` y alias deprecados — no se hizo: cambia URLs públicas y no aporta sobre lo anterior.

