# Módulo societario (socios) — ficha navegable, acciones unificadas y hooks — Plan por fases

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o superpowers:executing-plans. Los pasos usan `- [ ]`.

**Goal:** Que el socio sea una entidad de primera clase (ficha/drawer abrible con `openEntity`), con todas sus acciones en un único lugar, sin código ni endpoints muertos, y con el flujo de datos cumpliendo los invariantes 4 y 5 (hooks de feature, sin `api` directo).

**Origen:** revisión de 2026-11-11 (acciones de socio vs. ClientView/Drawers). Ver hallazgos en la conversación; resumen en "Diagnóstico".

## Diagnóstico (resumen verificado en código)

- No hay `PartnerDrawer`; el Libro Auxiliar es un drawer sin identidad (`?ledger=id`). `contacts.partnertransaction` no tiene drawer.
- Acciones repartidas entre toolbar, fila y Libro; 8 flags `useState` de modales en `PartnersClientView`.
- Componentes llaman `partnersApi` directo y cargan con `useEffect`; no existen hooks de mutación; `useProfitDistribution` importa `@/lib/api`.
- Todo vive en `features/settings` aunque dominio/API/tipos están en `contacts`.
- Código/endpoints sin llamador (ver decisiones abajo).

## Decisiones sobre acciones existentes sin uso

| Elemento | Decisión | Razón |
|---|---|---|
| **Configuración inicial** (`initial_setup`, `InitialCapitalModal`, `partnersApi.initialSetup`, `PartnerService.initial_setup`, `ContactService.initial_setup_from_request`) | **ELIMINAR** (pedido del usuario) | Es una suscripción en lote con fecha fija = hoy. `equity_subscription` ya hace `ensure_partner_setup` (auto-promueve) y recalcula participaciones; la participación se mide sobre capital *pagado* (`partner_net_equity`), por lo que el % es 0 hasta el primer aporte; el `initial_setup` viejo se comportaba igual (sin regresión). "Añadir socio" lo reemplaza sin pérdida. La toolbar vacía pasa a mostrar "Añadir socio". |
| **`setup_partner`** (`ContactService.setup_partner`, endpoint, `partnersApi.setupPartner`) + **`PartnerEditDrawer`** | **ELIMINAR** | Es el único camino que escribe `partner_equity_percentage` a mano, sin asiento ni `PartnerEquityStake`; contradice que el % es un caché derivado de las suscripciones. Cualquier edición del % debe pasar por suscripción/reducción/transferencia. |
| **`promote_partner`** (+ `ContactPartnerService.promote_to_partner`) | **ELIMINAR** | Solo voltea `is_partner`; un socio sin capital no tiene sentido y `equity_subscription` ya lo promueve. |
| **`demote_partner`** (+ guards) | **MANTENER y exponer** como "Dar de baja socio" en la ficha | Los guards (capital, retiros, utilidades, dividendos) son valiosos; es el cierre natural tras reducir capital a 0 o transferir todo. Solo visible si cumple guards (o deshabilitado con motivo). |
| **`InventoryContributionModal`** (aporte en especie) | **ELIMINADO (Fase 1)** | Redundante: `PartnerContributionWizard` ya tenía el método «Bienes» (hallado en Fase 2). No hay nada que reintegrar. |
| **`deleteProfitDistribution`** | **EXPONER** en la fila/drawer de distribución (solo `DRAFT`/`APPROVED`) | El backend ya valida (`validate_can_delete`); hoy un borrador inútil no se puede descartar. |
| **Anular distribución `EXECUTED`** (`CANCELLED`) | **FUERA DE ALCANCE** | No existe servicio de reversa del asiento. Requiere ADR propio; se deja el estado en el enum. |
| **`CapitalContributionModal`, `ProvisionalWithdrawalModal`** (EquityMovementModals) y wizard de retiro huérfano en `PartnersClientView` | **ELIMINAR** | Duplicados de los wizards, sin consumidores. |
| Tipos `LOAN_IN/OUT`, `CAPITAL_RETURN`, etc. | **NO IMPLEMENTAR ahora**; no tocar el enum | Sin UI ni endpoint; sumarlos es producto nuevo, no refactor. Enum se conserva por historial. |

## Reglas del plan

- Ejecutar en rama `refactor/socios-ficha-acciones`, una fase = un PR mergeable y verde por sí solo.
- Antes de cada fase leer los playbooks `add-feature.md`, `add-endpoint.md`, `refactor-workflow.md`, `deprecate-feature.md` y los contratos `component-entity-drawers.md`, `component-entity-view.md`, `permission-config-entities.md`.
- **ADR requerido** (invariante 12: cambia API pública): `0132-socios-ficha-y-superficie-de-acciones.md`, escrito en Fase 0 y referenciado en el resto.
- DoD de cada fase: `npm run type-check`, `npm run lint`, tests del alcance, `ruff check backend` y pytest de `contacts`; cero `any`; sin colores crudos.
- Tests backend: `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest contacts -v`. Frontend con Node 24.

---

## Fase 0 — ADR y decisiones (sin código de producto)

- [x] Escribir ADR-0132 con: tabla de decisiones de arriba, nueva superficie (PartnerDrawer + acciones), y endpoints eliminados/añadidos.
- [ ] Inventariar tests que referencian lo eliminado (`grep -rn "initial_setup\|setup_partner\|promote_partner\|PartnerEditDrawer\|InitialCapital" backend frontend docs`) y `core/tests/test_business_action_permissions.py:100`.
- [x] Decisiones confirmadas con el usuario.

**Salida:** ADR aprobado. **Riesgo:** ninguno.

## Fase 1 — Limpieza (HECHA en la rama `refactor/socios-ficha-acciones`) (borrar lo muerto y la configuración inicial)

Backend:
- [ ] Eliminar `initial_setup` (view + `ContactService.initial_setup_from_request` + `PartnerService.initial_setup`), `setup_partner` (view + `ContactService.setup_partner`), `promote_partner` (view + `ContactPartnerService.promote_to_partner`) y sus entradas en `action_permissions`.
- [ ] Actualizar `core/tests/test_business_action_permissions.py` y tests de `contacts` afectados; quitar `CONTACT_PROMOTED` si queda sin uso (verificar con grep).
- [ ] Verificar con test que `equity_subscription` sobre un contacto nuevo: lo promueve, fija `partner_since`, fija el capital suscrito, genera 1 asiento balanceado (la participación queda en 0 % hasta el primer aporte pagado). (Es el reemplazo de `initial_setup`; si falta, añadirlo antes de borrar.)

Frontend:
- [ ] Borrar `InitialCapitalModal`, `PartnerEditDrawer`, `InventoryContributionModal` (se reescribe en Fase 3 como método del wizard; copiar su lógica de producto/almacén/UoM antes de borrar), `CapitalContributionModal`, `ProvisionalWithdrawalModal`, y el `PartnerWithdrawalWizard` huérfano de `PartnersClientView` (con su estado `isWithdrawalOpen`).
- [ ] Quitar `partnersApi.initialSetup` y `setupPartner`, exports de `settings/index.ts` y `components/index.ts`.
- [ ] `PartnersClientView`: toolbar sin socios → "Añadir socio" (`AddPartnerModal`); con socios, mismo set actual. Eliminar el estado `isInitialSetupOpen`.
- [ ] Actualizar docs (`docs/50-audit/Tablascards/*` mencionan `InitialCapitalModal`; `component-form-patterns.md:81`) y CHANGELOG vía conventional commit.

**Salida:** menos ~1.200 líneas, comportamiento visible igual salvo el botón inicial. **Riesgo:** bajo; verificar que no haya seed/demo (`setup_demo_data`) que llame a `initial_setup`.

## Fase 2 — Hooks de feature y mover el dominio (cumplir invariantes 4 y 5) — HECHA (rama `refactor/socios-ficha-acciones`)

- [ ] Crear `usePartnerStatement`, `usePartnerMutations` (suscripción, reducción, transferencia, aporte, retiro, pago dividendo, movilización) y `useProfitDistributions` / `useProfitDistributionMutations` (crear, recalcular, destinos, aprobar, ejecutar, eliminar, pago masivo) en `features/contacts/hooks/`.
- [ ] Una sola invalidación: toda mutación invalida `PARTNERS_KEYS.all`, `partner statement`, y las claves de asientos/tesorería afectadas.
- [ ] Reemplazar en wizards/modales cada `partnersApi.getPartners().then(...)` y llamada directa por los hooks; quitar `useEffect`/`setTimeout`/`requestAnimationFrame`/`isMounted` de `ProfitDistributionsTab` y `PartnerLedgerDrawer` (usar `isLoading`/`isFetching` de TanStack Query).
- [ ] `useProfitDistribution` deja de importar `@/lib/api`; pasa por `partnersApi`.
- [ ] Decidir ubicación final de la UI de socios: mover `features/settings/components/partners/*` y `entity-view/partner*.ts(x)` a `features/contacts/` (o nuevo `features/partners/` con barrel). `settings` conserva solo `PartnerSettings` (cuentas contables). Actualizar `entity-registry`, `searchableEntityRoutes`, barrels y el ratchet de ESLint.
- [ ] Renombrar a la convención de sufijos (ADR/naming-conventions): `...Modal` que son wizards → `...Wizard`; `MassPaymentModal` vs archivo `MassPaymentWizard`.

**Salida:** cero `api` directo en componentes de socios; datos consistentes entre lista, libro y perfil. **Riesgo:** medio (muchos imports); mitigar con mover en un commit puro de rename y luego cambios de lógica.

## Fase 3 — `PartnerDrawer` y superficie única de acciones

- [ ] Registrar `contacts.partner` (o reutilizar `contacts.contact` con modo `partner`; decidir en ADR) en `entity-drawers.tsx` y `entity-registry.ts`, con `openEntity`.
- [ ] `PartnerDrawer` con pestañas: **Resumen** (capital suscrito/pagado/pendiente, utilidades, dividendos, retiros, %), **Libro auxiliar** (el actual, ahora pestaña), **Participación** (`equity_stakes_history` filtrado por socio), **Distribuciones** (líneas del socio por ejercicio), **Documentos** (relaciones, `document-relations.md`).
- [ ] Las filas de `PartnersClientView` abren el drawer; `?ledger=` se reemplaza por el mecanismo estándar del drawer (ADR-0022) manteniendo compat. de URLs viejas con redirect.
- [ ] `partnerActions` único (fuente de verdad), con `visible` según estado — no `pointer-events-none`. Acciones: Registrar aporte (Efectivo/**Bienes**), Registrar retiro (Efectivo/Bienes), Formalizar capital pendiente, Pagar dividendos, Distribuir utilidades retenidas, Transferir participación, Reducir capital, **Dar de baja socio** (`demote_partner`). La toolbar de la lista solo conserva acciones globales (Añadir socio, Nueva suscripción, Transferencia).
- [ ] Reemplazar los 8 `useState` de modales por un estado único `activeAction: { type, partnerId?, params? } | null` (o reducer) y un `PartnerActionHost`.
- [x] Aporte en especie: ya existe como método «Bienes» de `PartnerContributionWizard`. Solo verificar el circuito backend `PARTNER_CONTRIBUTION` → `PartnerTransaction(CAPITAL_INVENTORY)` + asiento con un test.
- [ ] Unificar `PartnerContributionWizard` y `PartnerWithdrawalWizard` (≈70 % duplicados: efectivo/bienes, socio, bodega, producto) en un único `PartnerMovementWizard` parametrizado por dirección.
- [ ] Drawer para `contacts.partnertransaction` (o visor del asiento/documento origen) para que `DocumentRelationsTab` y la búsqueda universal tengan destino.
- [ ] Contacto → socio: en `ContactDrawer`, si `is_partner`, mostrar chip "Socio" y atajo "Ver ficha de socio"; si no, acción "Incorporar como socio" que abre `AddPartnerModal` con el contacto prefijado.

**Salida:** el socio es navegable desde contactos, búsqueda, asientos y distribuciones. **Riesgo:** medio-alto (UI nueva); entregar el drawer primero solo-lectura y sumar acciones por PR.

## Fase 4 — Distribuciones: eliminar borrador y UX del flujo

- [ ] Acción "Eliminar borrador" en fila y en drawer (visible `DRAFT`/`APPROVED`), con `ActionConfirmModal`; error del backend mostrado con `showApiError`.
- [ ] Confirmación con resumen de impacto (asiento a generar, cuentas, totales por destino) en "Ejecutar" y "Pago masivo".
- [ ] `ProfitDistributionDrawer`: mostrar acciones disponibles según estado (mismas que la fila) para no depender de volver a la lista.
- [ ] Evaluar (sin implementar) anulación de `EXECUTED`: documentar en ADR futuro.

**Salida:** ciclo de vida completo gestionable desde UI. **Riesgo:** bajo.

## Fase 5 — Backend: vistas delgadas, errores y seguridad de escritura

- [ ] Extraer lógica de `ContactViewSet` de socios a `*_from_request`/services ya existentes; vistas ≤ 20 líneas (invariante 10). Considerar `PartnerViewSet` propio (`/partners/…`) con rutas `equity-subscriptions`, `equity-transfers`, `transactions`, manteniendo alias deprecados un ciclo.
- [ ] Reemplazar `except Exception → 500 str(e)` y `except Exception → 400` por manejo común de `ValidationError` (handler DRF); nunca exponer `str(e)` de excepciones inesperadas.
- [ ] Separar `partner_transactions` GET/POST en acciones distintas.
- [ ] `Idempotency-Key` (`idempotent_endpoint`) en: `equity_subscription`, `equity_transfer`, `partner_transactions` POST, `individual_dividend_payment`, `mass_mobilize_retained_earnings`, `execute`, `approve`. Frontend envía la key (patrón de `massPaymentProfitDistribution`).
- [ ] Revisar N+1 de `partners` / `partner_statement` / `partners_summary` con test de conteo de queries (invariante 14).

**Salida:** backend alineado con invariantes. **Riesgo:** medio (cambio de rutas si se separa el ViewSet; mitigar con alias).

---

## Orden y dependencias

`0 → 1 → 2 → 3 → 4`, y `5` puede ir en paralelo a `3`–`4` (solo comparte `Idempotency-Key` con el frontend de la Fase 2). La Fase 1 es independiente y de bajo riesgo: se puede entregar de inmediato.

## Criterios de aceptación globales

- Añadir el primer socio desde cero produce capital suscrito y un asiento balanceado (participación 100 % tras el primer aporte pagado), sin pasar por "configuración inicial".
- `grep -rn "initial_setup\|setup_partner\|promote_partner\|InitialCapital\|PartnerEditDrawer"` no devuelve código vivo.
- Desde un contacto, una búsqueda o un asiento se llega a la ficha del socio con `openEntity`.
- Ningún componente de socios importa `@/lib/api` ni llama `partnersApi` directamente.
- Toda escritura monetaria de socios es idempotente y confirma impacto antes de ejecutar.

## Decisiones tomadas (2026-11-11)

1. `PartnerDrawer` es **entidad propia** (`contacts.partner`).
2. `demote_partner` **se mantiene** como «Dar de baja socio».
3. La UI va a un **nuevo `features/partners`**.

Registradas en ADR-0132 (Fase 0 completa).
