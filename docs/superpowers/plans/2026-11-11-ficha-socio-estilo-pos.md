# Ficha del socio al estilo POS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `PartnerDrawer` como ficha de 6 pestañas con alertas y acciones secundarias dentro de cada pestaña, y reducir la lista de composición a «abrir ficha», «Añadir socio» y «Transferencia».

**Architecture:** Un endpoint de lectura `GET /contacts/{id}/partner_overview/` (query count fijo, patrón `treasury/pos_session_overview.py`) alimenta el Resumen; `partnerActions` sigue siendo la única fuente de acciones y gana `placement` para repartirlas por pestaña; Capital y Resultados filtran en el cliente los `transactions` de `partner_statement`; Relaciones usa un proveedor nuevo `contacts.partner`.

**Tech Stack:** Django 5 + DRF + pytest; Next.js 16, TypeScript, TanStack Query, `@/components/entity-view`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-ficha-socio-estilo-pos-design.md`

## Global Constraints

- Zero `any`; tokens semánticos de color; barrels (`@/components/shared`, `@/components/entity-view`, `@/features/*`); sin `@/lib/api` ni `useQuery`/`useMutation` en componentes (solo en `features/*/api|hooks`); `StatusBadge` para estados; tablas por entity-view; todos los shared handlean `loading/empty/error`.
- Vistas Django ≤ 20 líneas, lógica en módulo de servicio/selector; **zero N+1** (test de query count con varios socios).
- Escrituras monetarias con `Idempotency-Key` (ya cableado en `usePartnerMutations`); los endpoints de escritura no cambian.
- Cambiar el contrato de la ficha exige ADR 0133 y actualizar `docs/20-contracts/component-document-sheet.md`.
- Tests locales: backend `DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest` desde `backend/`; frontend con Node 24 (nvm v24).
- Definition of done: `npm run type-check`, `npm run lint`, tests afectados, `ruff check backend`.
- Fuera de alcance: auditoría/«Actividad», anular distribuciones `EXECUTED`, página `/finances/partners/distributions`.

## Review Focus

- Socio sin ningún movimiento: `overview` devuelve ceros y cero alertas; los paneles muestran empty state, no error.
- Socio con exceso **y** pendiente de capital a la vez: ambas alertas coherentes con la visibilidad de `partnerActions` (test de paridad).
- Contacto que no es socio (o dado de baja con la ficha abierta): `overview` responde 400 estándar; la ficha muestra el mensaje «no es un socio» sin romper.
- `Dar de baja` bloqueada: queda visible, deshabilitada, con el motivo; tras una acción que libera los saldos se habilita sin recargar.
- Lista sin socios: un solo «Añadir socio» (no dos) y sin «Transferencia».

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/contacts/partner_overview.py` (nuevo) | `build_partner_overview(contact) -> dict`: alertas, KPIs, datos y composición |
| `backend/contacts/views.py` | acción `partner_overview` (≤ 20 líneas) + entrada en el mapa de permisos |
| `backend/contacts/relations.py` | proveedor `contacts.partner` |
| `backend/contacts/tests/test_partner_overview.py` (nuevo) | contenido, 400, permisos, N+1, paridad |
| `frontend/features/contacts/api/partnersApi.ts`, `types/partner.ts` | `getOverview`, tipo `PartnerOverview` |
| `frontend/features/partners/hooks/usePartnerOverview.ts` (nuevo), `queryKeys.ts`, `hooks/index.ts` | consulta del overview |
| `components/partnerActionRequest.ts`, `partnerActions.tsx`, `PartnerActionModal.tsx`, `EquityMovementModals.tsx` | `placement`, acción `transfer` con origen |
| `components/PartnerSummaryPanel.tsx`, `PartnerCapitalPanel.tsx`, `PartnerResultsPanel.tsx` (nuevos) | pestañas |
| `components/PartnerDrawer.tsx` | ensamble de 6 pestañas + menú «⋯» |
| `components/PartnersClientView.tsx` | lista reducida |
| `docs/10-architecture/adr/0133-*.md`, `docs/20-contracts/component-document-sheet.md` | contrato |

---

### Task 1: Endpoint `partner_overview`

**Files:**
- Create: `backend/contacts/partner_overview.py`, `backend/contacts/tests/test_partner_overview.py`
- Modify: `backend/contacts/views.py` (junto a `partner_statement`, ~l.135, y el mapa de permisos ~l.34)

**Interfaces:**
- Produces: `build_partner_overview(contact: Contact) -> dict` con la forma

```python
{
  "alerts": [{"code": str, "severity": "info"|"warning", "amount": str, "target_tab": "capital"|"results", "action": "subscription"|"contribution"|"dividend"|"mobilize"}],
  "kpis": {"equity_percentage": str, "total_contributions": str, "total_paid_in": str, "pending_capital": str, "excess_capital": str, "net_equity": str},
  "info": {"partner_since": str | None, "tax_id": str, "contact_id": int},
  "composition": {"capital": str, "earnings_balance": str, "dividends_payable": str, "provisional_withdrawals": str},
}
```
  Códigos de alerta: `excess_capital`→`subscription`/capital, `pending_capital`→`contribution`/capital, `dividends_payable`→`dividend`/results, `retained_earnings`→`mobilize`/results. Una alerta existe sii su importe `> 0`.

- [ ] **Step 1: Tests** en `test_partner_overview.py` (reusar fixtures de `test_partner_endpoints_hardening.py`: `client`, `_configure_capital`, `_partner`): `test_overview_empty_partner_has_zeros_and_no_alerts`; `test_overview_alerts_follow_balances` (suscripción 1000 sin aporte ⇒ alerta `pending_capital` con `amount == "1000"`, acción `contribution`, `target_tab == "capital"`); `test_overview_non_partner_returns_400_standard_error` (forma `{"error": {...}}`); `test_overview_requires_permission`; `test_overview_query_count_is_fixed` (`CaptureQueriesContext` con 1 y con 5 socios con movimientos: mismo número de consultas); `test_overview_alert_amounts_match_partner_list_payload` (cada importe de alerta == campo equivalente de `/contacts/partners/`).
- [ ] **Step 2:** correr `pytest contacts/tests/test_partner_overview.py -v` → FAIL (404/ImportError).
- [ ] **Step 3: Implementar `build_partner_overview`** reutilizando `_partner_metrics_map([contact.id])` de `contacts/selectors.py` (no crear fórmulas nuevas) y `contact.partner_equity_percentage`; lanzar `ValidationError` si `not contact.is_partner` (el handler lo convierte en 400). Acción `partner_overview` (`detail=True`, GET) que devuelve `Response(build_partner_overview(self.get_object()))`; registrar `"partner_overview": "contacts.view_contact"` (o el permiso que use `partner_statement` en ese mapa — copiar el suyo).
- [ ] **Step 4:** tests → PASS; `ruff check backend/contacts`.
- [ ] **Step 5: Commit** `feat(partners): endpoint partner_overview con alertas y KPIs (ADR-0133)`.

### Task 2: Cliente API, tipo y hook del overview

**Files:**
- Modify: `frontend/features/contacts/api/partnersApi.ts`, `frontend/features/contacts/types/partner.ts`, `frontend/features/contacts/index.ts` (export del tipo), `frontend/features/partners/hooks/queryKeys.ts`, `hooks/index.ts`
- Create: `frontend/features/partners/hooks/usePartnerOverview.ts`, `hooks/__tests__/usePartnerOverview.test.tsx`

**Interfaces:**
- Produces: `interface PartnerOverview` (espejo exacto del payload de Task 1); `partnersApi.getOverview(contactId: number): Promise<PartnerOverview>`; `PARTNER_KEYS.overview(contactId: number)`; `usePartnerOverview(contactId: number | null)` → `UseQueryResult<PartnerOverview>` (`enabled: !!contactId`, `staleTime.stable`).

- [ ] **Step 1: Test** `usePartnerOverview.test.tsx`: no consulta con `null`; con id llama `GET /contacts/7/partner_overview/` y devuelve los datos (mockear `partnersApi`, patrón de `usePartnerMutations.test.tsx`).
- [ ] **Step 2:** `npm run test -- features/partners/hooks/__tests__/usePartnerOverview.test.tsx` → FAIL.
- [ ] **Step 3:** implementar tipo, `getOverview`, clave y hook; exportar desde los barrels. La clave cuelga de `ROOT` para que las mutaciones existentes (`PARTNER_KEYS.all`) la invaliden.
- [ ] **Step 4:** test → PASS; `npm run type-check`.
- [ ] **Step 5: Commit** `feat(partners): hook usePartnerOverview`.

### Task 3: Acciones con `placement` y transferencia con origen

**Files:**
- Modify: `components/partnerActionRequest.ts`, `components/partnerActions.tsx`, `components/PartnerActionModal.tsx`, `components/EquityMovementModals.tsx` (`EquityTransferModal`)
- Test: `components/__tests__/partnerActions.test.tsx` (nuevo), `components/__tests__/PartnerActionModal.test.tsx` (ampliar)

**Interfaces:**
- Produces: `PartnerActionRequest` cambia a `{ type: "transfer"; fromPartnerId?: number }`; `type PartnerActionPlacement = "capital" | "results" | "menu"`; `partnerActions` agrega la acción `transfer` («Transferir a otro socio», `placement: "capital"`, `onClick: () => ctx.run({ type: "transfer", fromPartnerId: item.id })`); cada acción lleva `placement`; helper `partnerActionsFor(partner: Partner, placement: PartnerActionPlacement, ctx: PartnerActionsCtx)` que devuelve solo las visibles de ese placement; `EquityTransferModal` acepta `initialFromPartnerId?: string`. «Dar de baja» pasa a `placement: "menu"`; «Ver ficha» se elimina de la lista de acciones por socio (la lista ya no tiene menú).
- Placements: `subscription`(formalizar exceso), `contribution`(ambas), `transfer` → `capital`; `withdrawal`, `dividend`, `mobilize` → `results`; `demote` → `menu`.

- [ ] **Step 1: Tests** `partnerActions.test.tsx`: (a) `partnerActionsFor(p,"capital",ctx)` incluye «Registrar aporte» y «Transferir a otro socio» y excluye «Registrar retiro»; (b) «Formalizar exceso» solo aparece con `partner_excess_capital > 0`; (c) `onClick` de transferir llama `run({ type: "transfer", fromPartnerId: p.id })`; (d) `demoteBlockedReason` sin cambios. En `PartnerActionModal.test.tsx`: con `request={{type:"transfer", fromPartnerId: 3}}` el modal recibe origen `"3"`.
- [ ] **Step 2:** correr los dos archivos → FAIL.
- [ ] **Step 3:** implementar según Interfaces; `usePartnerActions`/`PartnerActionModal` pasan `initialFromPartnerId`. Eliminar la rama `visible: !!ctx.onOpen`/«Ver ficha» y el `onOpen` de `PartnerActionsCtx`.
- [ ] **Step 4:** tests → PASS; `npm run type-check` (arreglar consumidores de `partnerActions.forCollection` en Task 5, no antes: aquí mantener `forCollection` compilando).
- [ ] **Step 5: Commit** `refactor(partners): placement de acciones y transferencia con origen`.

### Task 4: Paneles Resumen, Capital y Resultados

**Files:**
- Create: `components/PartnerSummaryPanel.tsx`, `PartnerCapitalPanel.tsx`, `PartnerResultsPanel.tsx`, `entity-view/partnerMovement.entity.ts` (fila de movimiento; derivar de `partnerLedger.entity.ts` en vez de duplicar columnas), tests en `components/__tests__/`

**Interfaces:**
- Consumes: `usePartnerOverview`, `usePartnerStatement`, `usePartnerStakes`, `partnerActionsFor`, `isInflowType/isOutflowType`, `PartnerActionRunner`.
- Produces: `PartnerSummaryPanel({ partner: Partner, run: PartnerActionRunner, onGoToTab: (tab: "capital" | "results") => void })`; `PartnerCapitalPanel({ partner, run })`; `PartnerResultsPanel({ partner, run })`.

Contenido (spec §Estructura): **Resumen** — alertas arriba (cada una con botón: si la alerta trae `action` ⇒ `run(...)` con el importe como `amount` donde aplique, y enlace «Ver» a `target_tab`), `StatCard variant="minimal"` sin divisor (participación, suscrito, enterado, patrimonio neto), datos del socio (contacto → `openEntity("contacts.contact", contact_id)`, socio desde, ID fiscal), composición del patrimonio. **Capital** — bloque suscrito/enterado/pendiente/exceso con fórmula, tabla de vigencias (entity-view `partnerStake`, hoy en `StakesPanel`), tabla de movimientos de capital (tipos de aporte/suscripción/reducción/transferencia/reinversión del `statement`), barra de acciones `partnerActionsFor(partner,"capital",…)`. **Resultados** — tres saldos y tabla de movimientos de retiro provisorio / dividendo / utilidad retenida con filtro por tipo, barra `partnerActionsFor(partner,"results",…)`. Todos con loading/empty/error.

- [ ] **Step 1: Tests** (Vitest + Testing Library, mockear `../hooks`): Resumen — con overview que trae alerta `pending_capital` renderiza «Capital pendiente» y su botón llama `run({ type: "contribution", partnerId, amount: "1000" })`; sin alertas no renderiza la sección; Capital — muestra solo los movimientos de capital del statement y el botón «Transferir a otro socio» llama `run({type:"transfer", fromPartnerId})`; Resultados — muestra retiros/dividendos y no aportes; los tres muestran empty state sin datos y error con reintento.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** implementar los tres paneles y `partnerMovement.entity.ts`; mover `StakesPanel` dentro de Capital y borrarlo de `PartnerDrawer.tsx` en Task 5.
- [ ] **Step 4:** tests → PASS; type-check; lint.
- [ ] **Step 5: Commit** `feat(partners): paneles Resumen, Capital y Resultados de la ficha`.

### Task 5: Ensamble de `PartnerDrawer`

**Files:**
- Modify: `components/PartnerDrawer.tsx`; Test: `components/__tests__/PartnerDrawer.test.tsx` (nuevo)

**Interfaces:**
- Consumes: paneles de Task 4; `partnerActionsFor(partner,"menu",ctx)`; `demoteBlockedReason`.
- Produces: pestañas con `value` `summary | capital | results | distributions | ledger | relations`, en ese orden; `EntitySidebar` y su `rightRailStorageKey` sin cambios; `DistributionsPanel` y `PartnerLedgerPanel` sin cambios.

- [ ] **Step 1: Tests** `PartnerDrawer.test.tsx` (mockear `@/features/contacts`, `@/features/comments`, hooks, como los tests de drawers existentes): renderiza las 6 pestañas con esos nombres; el header solo ofrece «Dar de baja» (menú «⋯»); con saldos pendientes el ítem está deshabilitado y expone `demoteBlockedReason(partner)`; sin bloqueo, al pulsarlo llama `run({ type: "demote", partnerId })`; un id que no es socio muestra «Este contacto no es un socio de la sociedad.»; el botón del Resumen «Ver» cambia la pestaña activa.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** reescribir `PartnerDrawer` según Interfaces. La pestaña `relations` se monta en Task 7; hasta entonces no se incluye (el test de 6 pestañas se activa en Task 7: en este task asertar las 5 existentes). Si `createEntityActions`/`headerActions` no admite ítem deshabilitado con motivo, extender el tipo de acción con `disabled?: boolean` y `disabledReason?: string` (documentar en el contrato de `createEntityActions`).
- [ ] **Step 4:** tests + type-check + lint → PASS.
- [ ] **Step 5: Commit** `feat(partners): ficha de socio con pestañas Capital y Resultados`.

### Task 6: Lista de composición reducida

**Files:**
- Modify: `components/PartnersClientView.tsx`, `frontend/app/(dashboard)/finances/partners/composition/page.tsx` (solo si el botón de crear cambia); Test: `components/__tests__/PartnersClientView.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `run`/`usePartnerActions`, `openSelected`.
- Produces: barra con `createAction` (primario, «Añadir Socio») + botón `variant="outline"` «Transferencia» (`run({ type: "transfer" })`) solo si hay socios; sin `actions=` en `Collection.Root`; `onOpen` abre la ficha.

- [ ] **Step 1: Tests**: con socios, la barra tiene «Añadir Socio» y «Transferencia» y **no** «Nueva Suscripción» ni «Registrar Aporte»; clic en una fila llama `openSelected(id)`; no se renderiza menú de acciones por fila; sin socios solo existe un botón «Añadir…» (no duplicado) y no hay «Transferencia».
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** quitar `actions={partnerActions.forCollection(actionsCtx)}`, `actionsCtx`, los botones sobrantes y los imports muertos; eliminar `forCollection` de `partnerActions` si queda sin uso.
- [ ] **Step 4:** tests, type-check, lint → PASS.
- [ ] **Step 5: Commit** `refactor(partners): la lista solo abre ficha, añade socio y transfiere`.

### Task 7: Pestaña Relaciones (mayor incertidumbre)

**Files:**
- Modify: `backend/contacts/relations.py`, `components/PartnerDrawer.tsx`; Test: `backend/contacts/tests/test_partner_relations.py` (nuevo), `PartnerDrawer.test.tsx`

**Interfaces:**
- Produces: tipo documental `contacts.partner` y `@relation_provider("contacts.partner")` que emite `Link` hacia: el contacto (`association`, `incoming`, rol `contact`), los asientos de sus `PartnerTransaction` (`derivation`/`accounting`, rol `journal_entry`, sin duplicados) y las distribuciones donde tiene línea (`association`, rol `profit_distribution`). Consultas fijas (`select_related`/`prefetch`).

- [ ] **Step 1: Spike (verificación, 15 min):** leer `core/documents` para confirmar que se puede registrar una etiqueta `contacts.partner` cuyo modelo es `Contact` (ya existe `contacts.contact`) y que `DocumentRelationsTab` acepta una entidad maestra. Si el registro por modelo choca, documentar la alternativa mínima (resolver de etiqueta propio) en el ADR 0133 y aplicarla. Anotar el resultado en el mensaje del commit.
- [ ] **Step 2: Tests** `test_partner_relations.py`: `GET /api/core/documents/contacts.partner/{id}/relations/` devuelve el contacto, un asiento por movimiento con asiento y la distribución en la que participa; socio sin movimientos ⇒ solo el contacto; query count fijo con 1 vs 5 movimientos; no-socio ⇒ 404/400 coherente con el endpoint.
- [ ] **Step 3:** → FAIL; implementar tipo y proveedor; → PASS.
- [ ] **Step 4:** en `PartnerDrawer` agregar la pestaña `relations` con `DocumentRelationsTab label="contacts.partner" id={id} sectionActions={{}} rowActions={() => []}` (patrón de `POSSessionSheet`); el test de 6 pestañas pasa a exigir las seis.
- [ ] **Step 5:** `ruff`, `pytest contacts`, type-check, tests de `features/partners` → PASS.
- [ ] **Step 6: Commit** `feat(partners): pestaña Relaciones de la ficha del socio`.

### Task 8: ADR, contrato y verificación final

**Files:**
- Create: `docs/10-architecture/adr/0133-ficha-socio-estilo-pos.md` (formato del 0132: front-matter `id/title/status/date/author`; reemplaza la lista de pestañas del 0132, registra `placement`, `partner_overview`, y la decisión sobre Relaciones del Task 7)
- Modify: `docs/20-contracts/component-document-sheet.md` (sección «Ficha de socio (`contacts.partner`)» tras §6b), `docs/10-architecture/adr/README.md` (índice), ADR-0132 (nota «pestañas reemplazadas por 0133»)

- [ ] **Step 1:** escribir ADR y sección de contrato (tabla de pestañas del spec, reglas de `placement`, endpoint y query count).
- [ ] **Step 2:** `cd frontend && npm run type-check && npm run lint && npm run test -- features/partners features/contacts`; `cd backend && ruff check . && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest contacts -q`. Esperado: todo en verde; si algo falla, reportarlo tal cual.
- [ ] **Step 3:** verificación visual en el dev server (ver `remote-dev-server.md`; confirmar Mutagen conectado): abrir `/finances/partners/composition`, la ficha de un socio con saldos y uno sin ellos; revisar cada pestaña, alertas, «Dar de baja» deshabilitada con motivo y la transferencia con origen prellenado. Si no hay entorno disponible, decirlo explícitamente en el informe.
- [ ] **Step 4: Commit** `docs(partners): ADR-0133 y contrato de la ficha de socio`.
