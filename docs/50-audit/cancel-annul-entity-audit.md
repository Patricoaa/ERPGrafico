---
layer: 50-audit
doc: cancel-annul-entity-audit
status: draft
owner: core-team
last_review: 2026-06-10
related:
  - ../20-contracts/deletion-policy.md
  - ../20-contracts/state-map.md
  - ../10-architecture/adr/0047-delete-annul-refactor.md
  - delete-annul-refactor-plan.md
---

# Auditoría: Cancelación / Anulación por entidad (HUB de mandos — compras y ventas)

**Fecha:** 2026-06-10 · **Alcance:** todas las entidades expuestas por el HUB de mandos
(OriginPhase, ProductionPhase, LogisticsPhase, BillingPhase, TreasuryPhase) para los
flujos de venta (NV) y compra (OCS), contrastadas con el contrato
[deletion-policy.md](../20-contracts/deletion-policy.md), el [ADR-0047](../10-architecture/adr/0047-delete-annul-refactor.md)
y las prácticas de referencia de ERPs modernos (Odoo 17, SAP Business One, Dynamics 365 BC, NetSuite).

## 1. Resumen ejecutivo

El refactor delete → cancel/annul (PRs 1–3, ADR-0047) instaló correctamente la columna
vertebral del modelo: ningún documento transaccional activo puede hard-deletearse vía
`DELETE`, los reversos contables usan `reversal_of` con guard de doble reverso, y el
frontend del HUB consulta `cancel_impact` antes de cancelar órdenes. Eso pone al sistema
por encima del punto de partida y cerca del estándar en el eje "no borrar documentos fiscales".

Sin embargo, la auditoría encuentra **4 gaps críticos** que rompen la promesa del ADR en
producción:

1. **Las Órdenes de Trabajo no participan de la cancelación** — se puede cancelar/anular
   una NV y producción sigue fabricándola.
2. **El hard delete sigue disponible** para cualquier documento `CANCELLED` — incluidos
   los anulados con reversos (ex-POSTED), destruyendo la pista fiscal que el ADR declaró protegida.
3. **Anular una OCS confirmada con factura de proveedor registrada es imposible**: la regla
   de folio (pensada para documentos emitidos al SII) bloquea también facturas recibidas.
4. **Los despachos DRAFT quedan huérfanos** al cancelar una NV en borrador (el test de
   integración que lo cubre fallaría; hoy la suite ni siquiera ejecuta en local).

Además, los tres requisitos de compliance que el plan original marcó como criterios de
aceptación —registro en `workflow.Transition`, motivo obligatorio y validación de período
contable— **no se implementaron en ningún servicio**.

Veredicto global: **arquitectura correcta, ejecución incompleta (≈60%)**. El plan de la
sección 6 cierra los gaps en 4 PRs acotados, sin infraestructura nueva (alineado con
presupuesto PYME).

## 2. Alcance y metodología

Entidades auditadas (las que renderiza el HUB por fase):

| Fase HUB | Entidad | Servicios auditados |
|----------|---------|---------------------|
| Origin | `SaleOrder`, `PurchaseOrder` | `sales/services.py:536,1003`, `purchasing/services.py:1167,1248` |
| Production | `WorkOrder` | `production/services.py:412` |
| Logistics | `SaleDelivery`, `PurchaseReceipt`, `SaleReturn`, `PurchaseReturn` | `sales/services.py:591`, `purchasing/services.py:875,905` |
| Billing | `Invoice` (FACT/BOL/NC/ND) | `billing/services.py:1068,1101` |
| Treasury | `TreasuryMovement` | `treasury/services.py:614,648` |

Método: lectura completa de servicios, views y frontend del HUB; verificación cruzada con
contratos (deletion-policy, state-map, row-actions); intento de ejecución de la suite
`core/tests/test_cancel_annul_integration.py`; benchmark contra el comportamiento documentado
de Odoo/SAP B1/D365 BC/NetSuite. Los retornos (`SaleReturn`/`PurchaseReturn`) se verificaron
solo a nivel de endpoint (`ReturnService.annul_return`), no en profundidad.

## 3. Estado actual por entidad

### 3.1 SaleOrder (NV)

- **Cancel** (`SalesService.cancel_sale_order`, `sales/services.py:536`): rama DRAFT valida
  despachos CONFIRMED y pagos POSTED, cascadea a facturas y pagos, borra el JE draft.
  Idempotente. Rama no-DRAFT delega en `SaleOrderService.cancel` (full annul).
- **Annul** (`SaleOrderService.cancel`, `sales/services.py:1003`): cascada correcta a
  facturas (cancel/annul según estado), despachos (reverso de stock vía `annul_delivery`)
  y pagos (reverso de JE).
- **Gaps**: la rama DRAFT **no cancela despachos DRAFT** ni toca OTs; la rama annul
  **tampoco toca OTs**; el endpoint `cancel` (`sales/views.py:302`) no pasa `user` ni `reason`;
  no escribe `workflow.Transition`; sin validación de período.

### 3.2 PurchaseOrder (OCS)

- **Cancel** (`purchasing/services.py:1167`): simétrico a ventas e incluye recepciones
  (las cancela vía `cancel_receipt`). Idempotente.
- **Annul** (`PurchaseOrderService.cancel`, `purchasing/services.py:1248`): cascada a
  facturas, recepciones (reverso OUT de stock) y pagos.
- **Gaps**: anular con factura de proveedor con folio **siempre falla** (ver G-03);
  mismos déficits de auditoría/período/user que ventas.

### 3.3 Invoice (FACT / BOL / NC / ND)

- **Cancel** (`billing/services.py:1068`): solo DRAFT; cascadea pagos, borra JE draft y
  asientos `RECO-*`. Correcto en esencia.
- **Annul** (`billing/services.py:1101`): valida folio, despachos/recepciones confirmados
  y pagos POSTED (con `force` para cascada); reversa JE; revierte estado de la orden origen.
  Es el servicio más completo del sistema.
- **Gaps**: no idempotente (re-llamar `cancel` sobre CANCELLED da 400; el check de
  idempotencia en `billing/services.py:1076` es código muerto, está después del `raise`);
  el endpoint `cancel_impact` está **roto** (importa `CancelImpact`, clase inexistente —
  `billing/views.py:360` → 500 garantizado); el bloqueo por folio no distingue documentos
  emitidos (ventas, regla SII correcta) de recibidos (compras, regla incorrecta).

### 3.4 SaleDelivery / PurchaseReceipt

- **Annul** (`annul_delivery` `sales/services.py:591`; `annul_receipt` `purchasing/services.py:905`):
  reverso contable + stock move inverso + reversión de cantidades + actualización de estado
  de la orden. Patrón correcto.
- **Cancel receipt** (`purchasing/services.py:875`): hard-deletea los `StockMove` y el JE
  (`line.stock_move.delete()`, línea 889) en vez de marcarlos CANCELLED como exige el plan;
  no idempotente (check muerto en línea 883). `SaleDelivery` no tiene servicio de cancel
  propio (solo el inline en `SaleOrderService.cancel:1031`).
- **Gaps**: pérdida de trazabilidad en cancel de recepción; deliveries DRAFT huérfanas (G-04).

### 3.5 WorkOrder (OT)

- **Annul** (`production/services.py:412`): valida etapa límite y consumos registrados;
  cancela POs vinculadas; escribe `WorkOrderHistory`. Solo invocable manualmente desde
  ProductionPhase (gating UI: factura DRAFT + etapa ≤ PREPRESS).
- **Gaps**: **ningún servicio de cancelación de órdenes lo invoca** (G-01); al cancelar
  POs/facturas vinculadas setea `status` a mano (`production/services.py:462-470`) saltándose
  los servicios — deja JEs draft vivos y no cascadea pagos, violando la regla "transición
  siempre vía servicio" del contrato.

### 3.6 TreasuryMovement

- **Cancel** (`treasury/services.py:614`): bloquea conciliados; idempotente; borra JE draft
  desvinculándolo primero (maneja `ProtectedError`).
- **Gaps**: si el JE está POSTED, `cancel` **genera el reverso igualmente** (líneas 636-640),
  es decir, "cancel" ejecuta semántica de "annul" silenciosamente; `annul_movement` (línea 648)
  es un alias de `cancel_movement`. La distinción contractual entre ambos patrones es
  cosmética en tesorería. El frontend decide cancel vs annul por `p.status` en el cliente
  (`TreasuryPhase.tsx:80-84`), pero da igual porque ambos endpoints hacen lo mismo.

### 3.7 Matriz de cumplimiento del contrato (deletion-policy §reglas operativas)

| Regla del contrato | NV | OCS | Invoice | Delivery/Receipt | OT | Movement |
|---|---|---|---|---|---|---|
| Transición solo vía servicio | ✅ | ✅ | ✅ | ✅ | ⚠️ setea hijos a mano | ✅ |
| Valida árbol DRAFT antes de cancel | ✅ | ✅ | ✅ | ✅ | n/a | ⚠️ reversa si POSTED |
| Borra JE draft (sin basura) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Propaga a hijos | ⚠️ sin deliveries/OTs | ⚠️ sin OTs | ✅ | n/a | ⚠️ parcial | n/a |
| Idempotente (CANCELLED→CANCELLED) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `cancel_impact` disponible | ✅ | ✅ | ❌ roto | ❌ | ❌ | ⚠️ trivial |
| Escribe `workflow.Transition` + motivo | ❌ | ❌ | ❌ | ❌ | ⚠️ history propio | ❌ |
| `delete()` bloqueado en entidades fiscales | ⚠️ solo si ≠CANCELLED | ⚠️ | ⚠️ | — | — | ⚠️ |

## 4. Benchmark contra mejores prácticas de ERP moderno

| Práctica de referencia | Odoo / SAP B1 / D365 BC / NetSuite | ERPGrafico hoy | Estado |
|---|---|---|---|
| Nunca hard-delete de documentos transaccionales | Universal; "Cancelled" es estado terminal visible | `destroy()` permitido si `status=CANCELLED`, sin restricción de rol ni antigüedad | ⚠️ Parcial |
| Reverso contable enlazado al original | Reversal entry con link bidireccional y guard | `reverse_entry` con `reversal_of` + guard de doble reverso (`accounting/services.py:34`) | ✅ Cumple |
| Motivo de cancelación obligatorio + actor | Campo razón obligatorio, usuario y timestamp en audit log | Backend acepta `reason` pero el frontend nunca lo envía; `cancel` ni siquiera recibe `user` | ❌ No cumple |
| Audit log semántico de transiciones | Document log / change log nativo | `workflow.Transition` existe pero ningún servicio cancel/annul escribe en él (solo history genérico ADR-0012, sin motivo) | ❌ No cumple |
| Validación de período contable/fiscal al revertir | Bloqueo si el período del reverso está cerrado | Checks de período solo en creación (`billing/services.py:242,368`); cancel/annul no validan | ❌ No cumple |
| Preview de impacto antes de cancelar | Wizard con dependencias (Odoo), bloqueo con explicación (BC) | Existe para órdenes (bien); roto para facturas; trivial para tesorería; omite OTs y folios | ⚠️ Parcial |
| Cascada completa incl. producción/MRP | Cancelar SO propone/cancela MOs vinculadas | OTs completamente fuera de la cascada | ❌ No cumple |
| Distinción cancel (sin huella) / annul (con reverso) | Sí (draft reset vs credit note/reversal) | Diseñada en contrato; difusa en tesorería; correcta en órdenes/facturas | ⚠️ Parcial |
| Documentos emitidos a autoridad fiscal → solo NC | Folio emitido = inmutable, ajustar por NC | Correcto en ventas; **sobre-aplicado a facturas de compra recibidas** | ⚠️ Parcial |
| RBAC granular por acción destructiva | Permiso específico para cancelar/anular | Endpoints sin permiso específico; HUB gatea "cancelar orden" con `billing.delete_invoice` | ❌ No cumple |
| Confirmación explícita para acciones irreversibles | Doble confirmación + resumen | Cancel sí; **"Anular Orden" ejecuta sin modal** (`OriginPhase.tsx:137-145`) | ⚠️ Parcial |
| Reversibilidad de cancelación (reset to draft) | "Set to draft" estándar | Contrato lo promete ("Reversible: Sí"), no existe endpoint; state-map declara CANCELLED terminal — contradicción documental | ❌ No cumple |

## 5. Gaps por severidad

### 🔴 Críticos (rompen integridad operativa o fiscal)

**G-01 — Las OTs no participan de la cancelación de órdenes de venta.**
Ni `cancel_sale_order` (rama DRAFT) ni `SaleOrderService.cancel` (annul) tocan
`order.work_orders`. `annul_work_order` existe pero no tiene ningún caller desde sales.
Consecuencia: se cancela una NV y producción sigue consumiendo materiales y horas en una
orden muerta. El plan original lo exigía (`_soft_cancel_work_order`).
*Refs:* `sales/services.py:549-587,1003-1049`, `production/services.py:412`.

**G-02 — Hard delete habilitado para documentos CANCELLED.**
`destroy()` permite borrar físicamente cualquier documento en estado CANCELLED
inmediatamente y sin permiso especial — incluidos los **anulados** (ex-POSTED, con folio
y reverso contable), cuyo registro el ADR-0047 declaró intocable ("ningún documento POSTED
puede ser hard-deleteado" es falso una vez anulado). El plan reservaba el purge para batch
admin >90 días. Riesgo adicional: borrar el documento puede dejar el JE de reverso huérfano
o producir `ProtectedError` → 500.
*Refs:* `sales/views.py:268`, `purchasing/views.py:48`, `billing/views.py:48`, `treasury/views.py:524`.

**G-03 — Anular una OCS confirmada con factura registrada es imposible.**
`annul_invoice` bloquea cualquier factura con `number` asignado (`billing/services.py:1111`),
pero las facturas de compra guardan el folio del **proveedor** en `number` desde su creación
(`create_purchase_bill`, `billing/services.py:392`). Como `PurchaseOrderService.cancel`
cascadea por `annul_invoice` y la transacción es atómica, **toda anulación de OCS confirmada
con factura registrada revienta con 400**. La regla de folio protege documentos *emitidos*
al SII (ventas); aplicarla a documentos *recibidos* es incorrecto — Odoo/BC permiten
revertir vendor bills con asiento de reverso.
*Refs:* `billing/services.py:1101-1115`, `purchasing/services.py:1263-1270`.

**G-04 — Despachos DRAFT quedan huérfanos al cancelar una NV en borrador.**
La rama DRAFT de `cancel_sale_order` valida que no haya despachos CONFIRMED pero **no
cancela los DRAFT** (no hay loop de deliveries, a diferencia de compras que sí cancela
recepciones). Quedan despachos vivos apuntando a una orden CANCELLED. El test
`test_004_draft_cancel_with_draft_delivery` exige el comportamiento correcto y fallaría
si la suite corriera (ver G-08).
*Refs:* `sales/services.py:549-579` vs `purchasing/services.py:1199-1210`,
`core/tests/test_cancel_annul_integration.py:159`.

### 🟠 Altos (compliance y seguridad de operación)

**G-05 — Sin audit trail semántico: ni `workflow.Transition`, ni usuario, ni motivo.**
Ningún servicio cancel/annul escribe `workflow.Transition` (grep: cero ocurrencias en los
4 services). Los endpoints `cancel` no pasan `user` (`SalesService.cancel_sale_order(order)`
a secas, `sales/views.py:306`); el frontend jamás pide ni envía `reason`
(`ordersApi.ts:25-28` manda `{force:false}` fijo). Era criterio de aceptación explícito del plan.
El history genérico (ADR-0012) registra el cambio de campo, pero no quién decidió ni por qué.

**G-06 — `cancel_impact` de facturas roto en producción.**
`billing/views.py:360` importa `CancelImpact` de `billing.services`, clase que **no existe**
en el codebase → todo GET a `/billing/invoices/{id}/cancel_impact/` devuelve 500. Hoy no
hay consumidor en frontend (BillingPhase usa un confirm simple), lo que confirma que se
mergeó sin test ni uso.

**G-07 — "Anular Orden" ejecuta sin confirmación ni preview.**
En OriginPhase, el botón para órdenes no-DRAFT llama `annulOrder.mutateAsync(id)` directo,
sin modal de impacto ni confirmación (`OriginPhase.tsx:137-145,178-183`). Un click dispara
reversos contables, de stock y de pagos. Contrasta con el flujo cancel, que sí muestra
modal con impacto. Inconsistente y peligroso.

**G-08 — La suite de integración no ejecuta y contradice la implementación.**
Los 21 tests de `test_cancel_annul_integration.py` dan ERROR en setup: una migración con
SQL crudo `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (sintaxis Postgres) rompe SQLite, a
pesar del commit `92273786` que declaraba compat SQLite. Resultado: los criterios de
aceptación del refactor están **sin verificar**, y al menos test_004 fallaría contra el
código actual (G-04). Verificado: `pytest core/tests/test_cancel_annul_integration.py`
→ 21 errors.

**G-09 — Semántica cancel/annul difusa en tesorería.**
`cancel_movement` reversa JEs POSTED (debería rechazar y exigir annul) y `annul_movement`
es un alias. El árbol de decisión del contrato (cancel = solo árbol DRAFT, sin reversos)
no se cumple. Además un "cancel" que reversa no queda diferenciado en libros ni en UI.
*Refs:* `treasury/services.py:614-653`.

**G-10 — RBAC incorrecto o ausente.**
Endpoints cancel/annul/destroy sin clase de permiso específica (cualquier usuario
autenticado anula). En el HUB, `cancel-order` se gatea con `billing.delete_invoice`
(permiso de otra app y otra semántica; `sales/actions.tsx:408`, `purchasing/actions.tsx:362`),
y los botones inline de fase (Anular Orden/OT/Pago/Despacho) no declaran
`requiredPermissions` en absoluto.

### 🟡 Medios

**G-11 — Sin validación de período contable/F29 en cancel/annul.** Los checks
`TaxPeriodService.is_period_closed` / `AccountingPeriodService.is_period_closed` existen y
se usan al crear (`billing/services.py:242-253,368-379`) pero ningún flujo de
cancelación/anulación los invoca. Mitigante: `reverse_entry` fecha el reverso a hoy, así
que no muta períodos cerrados; aun así, cancelar borradores fechados en período cerrado
altera el devengo esperado y era criterio del plan.

**G-12 — Idempotencia inconsistente + código muerto.** `cancel_invoice`
(`billing/services.py:1073-1077`) y `cancel_receipt` (`purchasing/services.py:880-884`)
hacen `raise` si el estado no es DRAFT *antes* del check de CANCELLED (inalcanzable).
Re-llamadas directas al endpoint dan 400 en vez del no-op que el contrato exige (regla 5).

**G-13 — `cancel_receipt` destruye evidencia.** Hard-delete de `StockMove` y JE en vez de
marcar CANCELLED (plan: "StockMove relacionado → CANCELLED"). En un draft es defendible
operativamente, pero borra la traza de que existió una recepción parcial digitada.

**G-14 — `cancel_impact` incompleto.** No incluye OTs ni advierte folios (el modal no puede
anticipar el bloqueo de G-03); el de tesorería devuelve un stub; el frontend duplica la
construcción del modal en dos sitios (`OriginPhase.tsx:81-135` y `ActionCategory.tsx:219-277`).

**G-15 — `annul_work_order` viola la capa de servicios.** Setea `PurchaseOrder.status` e
`Invoice.status` directamente (`production/services.py:462-470`): no borra JEs draft de esas
facturas, no cascadea pagos ni recepciones, no es idempotente con el resto del ecosistema.

**G-16 — Contradicción contractual sobre reversibilidad.** deletion-policy declara la
cancelación "Reversible: Sí (Reset to Draft)"; no existe ningún endpoint/servicio
`reset_to_draft` (grep: cero), y state-map define CANCELLED como terminal. Decidir e
implementar (o corregir el contrato).

**G-17 — Concurrencia.** `confirm` usa locks distribuidos (`acquire_locks`), pero ningún
cancel/annul usa `select_for_update` ni locks: un confirm y un cancel simultáneos sobre la
misma orden pueden intercalarse (p.ej. confirmar un despacho mientras la rama DRAFT de
cancel ya pasó la validación).

### 🟢 Bajos

**G-18 — Manejo de errores inconsistente.** Sales/purchasing/treasury devuelven
`str(ValidationError)` (renderiza `["…"]` con corchetes); billing usa `e.messages[0]`.
Los `except Exception` devuelven el error interno crudo en el body (fuga de detalles).
Emojis en mensajes de API (presentación acoplada al backend).

**G-19 — Labels y disponibilidad confusos en el HUB.** La acción `cancel-order` está
disponible para cualquier estado ≠ CANCELLED con label fijo "Cancelar Orden", aunque sobre
una orden INVOICED/PAID ejecuta una anulación con reversos (el modal sí lo aclara, el botón no).
`SaleDelivery` figura en deletion-policy como "solo Anulación" pero la cascada DRAFT la
cancela — actualizar tabla del contrato.

## 6. Plan de implementación

Cuatro PRs secuenciales, sin dependencias externas nuevas. Esfuerzo estimado total: **7–10 días-persona**.

### PR A — Integridad de cascada y compliance fiscal (crítico) — 2–3 días

| # | Cambio | Archivos | Gap |
|---|--------|----------|-----|
| A1 | Cascadear OTs en cancel/annul de NV: rama DRAFT cancela OTs vía `annul_work_order` (o nuevo `cancel_work_order` para OTs sin consumos); rama annul bloquea si la OT superó la etapa límite, con mensaje accionable | `sales/services.py` | G-01 |
| A2 | Cancelar deliveries DRAFT en rama DRAFT de `cancel_sale_order` (simetría con receipts) | `sales/services.py:569` | G-04 |
| A3 | Restringir `destroy`: solo documentos CANCELLED **que nunca fueron POSTED** (sin JE reverso asociado), solo staff/admin; opcional cron de purge >90 días | `sales/views.py:268`, `purchasing/views.py:48`, `billing/views.py:48`, `treasury/views.py:524` | G-02 |
| A4 | Bloqueo por folio solo para documentos emitidos (ventas): en `annul_invoice` distinguir `invoice.sale_order` (folio propio → exigir NC) de `invoice.purchase_order` (folio del proveedor → permitir reverso) | `billing/services.py:1110-1115` | G-03 |
| A5 | Reescribir `cancel_impact` de facturas como dict (mismo patrón que sales) eliminando el import roto | `billing/views.py:356-364` | G-06 |
| A6 | Refactor `annul_work_order` para delegar en `cancel_purchase_order`/`cancel_invoice` en vez de setear status a mano | `production/services.py:460-470` | G-15 |

**Aceptación:** anular OCS confirmada con factura de proveedor + folio funciona con reversos;
cancelar NV draft con OT y delivery draft deja ambas CANCELLED; `DELETE` de un documento
anulado ex-POSTED devuelve 403/400; `cancel_impact` de factura responde 200.

### PR B — Audit trail, motivo y semántica de servicios — 2–3 días

| # | Cambio | Gap |
|---|--------|-----|
| B1 | `WorkflowService.log_transition(entity, transition='cancel'\|'annul', user, reason)` invocado desde los 6 servicios; firma de servicios acepta `user`/`reason` y los views los propagan (`request.user`, `request.data['reason']`) | G-05 |
| B2 | Motivo obligatorio para annul (ValidationError si vacío), opcional para cancel | G-05 |
| B3 | Tesorería: `cancel_movement` rechaza JE POSTED (redirige a annul); `annul_movement` implementa el reverso y deja de ser alias | G-09 |
| B4 | Idempotencia uniforme: check CANCELLED→no-op **antes** de cualquier validación en `cancel_invoice` y `cancel_receipt` | G-12 |
| B5 | Validación de período compartida (`AccountingPeriodService.is_period_closed`) en todos los cancel/annul, sobre la fecha del documento (cancel) y la fecha del reverso (annul) | G-11 |
| B6 | `cancel_receipt`: marcar StockMove/JE como CANCELLED en vez de `delete()` (requiere aceptar moves cancelados en los cálculos de stock, verificar selectores) | G-13 |
| B7 | `select_for_update` sobre el documento raíz al inicio de cancel/annul | G-17 |

**Aceptación:** todo cancel/annul crea una fila en `workflow.Transition` con user y reason;
annul sin motivo → 400; cancel de movimiento con JE POSTED → 400 con mensaje que redirige a annul.

### PR C — Frontend HUB: confirmación, motivo, permisos — 2 días

| # | Cambio | Gap |
|---|--------|-----|
| C1 | "Anular Orden" (OriginPhase) pasa por el mismo modal de impacto que cancel (reusar `handleCancelOrder`; el backend ya decide soft/full) — eliminar `handleAnnulOrder` directo | G-07 |
| C2 | Campo de motivo (textarea) en `ActionConfirmModal` para flujos annul; enviarlo en el payload | G-05 |
| C3 | Extraer el builder del modal de impacto a un hook compartido (`useCancelImpactModal`) consumido por OriginPhase y ActionCategory; incluir OTs y warning de folio cuando el backend los exponga | G-14 |
| C4 | Permisos: gatear cancel/annul con permisos propios (`sales.delete_saleorder` / `purchasing.delete_purchaseorder` o permiso custom `can_cancel_documents`); añadir `requiredPermissions` a los botones inline de fase | G-10 |
| C5 | Label dinámico del botón según estado ("Cancelar Orden" DRAFT / "Anular Orden" resto) | G-19 |

**Aceptación:** `npm run type-check` y `lint` verdes; ninguna anulación ejecutable sin modal;
motivo visible en el modal y persistido.

### PR D — Calidad, tests y sincronización documental — 1–2 días

| # | Cambio | Gap |
|---|--------|-----|
| D1 | Arreglar la migración con `ADD COLUMN IF NOT EXISTS` (envolver en `RunSQL` condicionada por vendor o usar operación de schema editor) para que la suite corra en SQLite local | G-08 |
| D2 | Ejecutar y poner en verde los 21 tests; añadir casos: OT en cascada, delivery DRAFT, folio de compras anulable, destroy bloqueado, Transition escrita, período cerrado | G-01..08 |
| D3 | Crear `test_deletion_policy_consistency` (ya prometido en el contrato como "a crear") | contrato |
| D4 | Sincronizar contratos: resolver G-16 (decidir Reset-to-Draft: recomendación PYME — **no** implementarlo aún; corregir deletion-policy a "Reversible: No (terminal)" y dejar ADR corto), actualizar fila `SaleDelivery` (admite cancel en cascada), documentar permiso de cancelación | G-16, G-19 |

**Aceptación:** `pytest core/tests/test_cancel_annul_integration.py` verde en local;
contrato, state-map y código sin contradicciones.

### Secuencia y riesgo

```
PR A (crítico, backend)  →  PR B (compliance, backend)  →  PR C (frontend)  →  PR D (calidad/docs)
```

- A y B tocan servicios compartidos: hacer en serie, no en paralelo.
- D1 puede adelantarse en cualquier momento (desbloquea verificación de A y B).
- Ningún cambio requiere migración de datos salvo B6 si se opta por status en StockMove
  (ya existe `state` en el modelo según el plan original — verificar antes de migrar).

## 7. Lo que está bien (no tocar)

- `reverse_entry` (`accounting/services.py:34`): reverso enlazado (`reversal_of`), guard de
  doble reverso, original intacto. Es el ancla correcta de todo el sistema de anulación.
- El patrón `destroy() → 400 "Use POST /cancel/"` para documentos activos.
- El árbol cancel/annul por estado de hijos en `SaleOrderService.cancel` /
  `PurchaseOrderService.cancel` (la estructura es la correcta; faltan ramas, no rediseño).
- El modal de impacto del flujo cancel en el HUB (UX por encima del estándar Odoo community).
- `annul_invoice`: el set de validaciones más completo del sistema; usarlo como plantilla.
