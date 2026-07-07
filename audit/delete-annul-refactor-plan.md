---
layer: 50-audit
doc: delete-annul-refactor-plan
status: draft
owner: core-team
last_review: 2026-06-10
---

# Plan de Refactor: Delete → Cancel / Annul

## Problema

El DELETE actual de SaleOrder y PurchaseOrder en estado DRAFT hace hard-delete
físico que se propaga en cascada a invoices, payments, receipts, stock moves
y journal entries. Esto viola los estándares de ERP (SAP, Odoo, NetSuite,
Dynamics 365 BC, Infor LN) que:

1. **Nunca** hard-deletean documentos transaccionales — los anulan o cancelan.
2. Preservan secuencias numéricas (crítico para compliance SII chileno).
3. Mantienen audit trail de todas las operaciones.
4. Validan período contable antes de cualquier modificación.
5. No permiten borrar documentos con hijos en estado confirmado.

Además, el código actual tiene bugs identificados:
- **SaleOrder**: no maneja `SaleDelivery` en DRAFT → `ProtectedError` en `order.delete()`.
- **PurchaseOrder**: no valida payments POSTED ni receipts CONFIRMED antes de intentar borrarlos.
- **Ambos**: no validan período contable, no registran en `workflow.Transition`.

## Nueva taxonomía de acciones

Tres operaciones, no dos:

| Operación | Mecanismo | Reversible | Registro | Compliance |
|-----------|-----------|------------|----------|------------|
| `cancel` (nueva) | `status = CANCELLED`. Documentos hijos DRAFT → CANCELLED. JEs DRAFT → CANCELLED. **Sin reversos contables ni de stock.** | Sí (Reset to Draft) | `workflow.Transition` `type=cancel` | No fiscal (era DRAFT) |
| `annul` (existe) | `status = CANCELLED`. Documentos hijos CONFIRMED → reverso contable + stock + pagos. | Solo vía nuevo documento (NC/ND) | `workflow.Transition` `type=annul` | Fiscal completo |
| `delete` (purge) | Hard delete real. Solo para cleanup batch de registros CANCELLED viejos (>90 días) + sin JEs. | No | `workflow.Transition` `type=delete` | N/A (purga admin) |

## Árbol de decisión (backend)

```
¿Usuario solicita "Eliminar" en orden DRAFT?
│
├── 1. ¿Status == DRAFT?
│     └── No → error + redirigir a "Anular"
│
├── 2. ¿Algún hijo tiene folio SII asignado?
│     └── Sí → BLOQUEAR. "Emita Nota de Crédito"
│
├── 3. ¿Algún hijo tiene estado CONFIRMED / POSTED / PAID / DELIVERED / RECEIVED?
│     └── Sí → FULL ANNUL === ejecutar `SaleOrderService.cancel()` / `PurchaseOrderService.cancel()`
│     │        ├── Crea contra-asientos contables (JournalEntry REVERSAL)
│     │        ├── Crea TreasuryMovement reverso por cada payment POSTED
│     │        ├── Crea StockMove reverso (IN/OUT) por cada delivery/receipt CONFIRMED
│     │        ├── Cancela OTs con reverso de consumos (si aplica)
│     │        └── workflow.Transition: type=annul, reason, user, timestamp
│     │
│     └── No → SOFT CANCEL === nuevo método unificado
│            ├── Order.status = CANCELLED
│            ├── Invoice.status = CANCELLED (FK SET_NULL de todas formas)
│            ├── Payment.status → si tiene JE, JE.status = CANCELLED
│            ├── Delivery/Receipt.status = CANCELLED, StockMove relacionado → CANCELLED
│            ├── OT → WorkOrder.status = CANCELLED
│            ├── JE.status = CANCELLED (NO reverso, solo marcar)
│            └── workflow.Transition: type=cancel, reason, user, timestamp
```

## Archivos a modificar

### Fase 1 — Backend services (core)

| Archivo | Cambio |
|---------|--------|
| `sales/services.py` | `delete_sale_order()` → reemplazar por `cancel_order()` unificado. Reparar bug deliveries DRAFT. Agregar validación invoices con folio. |
| `purchasing/services.py` | `delete_purchase_order()` → mismo tratamiento. Agregar validaciones faltantes (receipts CONFIRMED, payments POSTED). |
| `billing/services.py` | `delete_invoice()` → reemplazar por `cancel_invoice()` (status + JE cancel). |
| `treasury/services.py` | `delete_movement()` → reemplazar por `cancel_movement()` (status + JE cancel). |
| `purchasing/services.py` | `delete_receipt()` → reemplazar por `cancel_receipt()`. |
| `sales/services.py` | Agregar manejo de WorkOrders vinculadas en el soft cancel (cancelar OTs, reversar consumos si hay). |

### Fase 2 — Backend validaciones (nuevas)

| Validación | Dónde |
|------------|-------|
| Chequeo de folio SII asignado en hijos | En todos los servicios de cancel/annul |
| Período contable abierto | Servicio compartido: `AccountingPeriod.is_open_for_date()` |
| `workflow.Transition` en todo cancel/annul | `workflow.services.WorkflowService.log_transition()` |
| `assert journal_entry.status == DRAFT` antes de cancelar JE | En todo soft cancel que toque JEs |

### Fase 3 — Frontend HUB

| Archivo | Cambio |
|---------|--------|
| `OriginPhase.tsx` | Cambiar label "Eliminar Borrador" a "Cancelar Borrador". Agregar modal de confirmación que muestre resumen de impacto. |
| `BillingPhase.tsx` | Cambiar "Eliminar Borrador" → "Cancelar Borrador". |
| `TreasuryPhase.tsx` | Cambiar "Eliminar/Anular Pago" → intentar `cancel` primero, si JE POSTED redirigir a `annul`. |
| `sales/actions.tsx` | `delete-draft` → cambiar `checkAvailability` para que también muestre resumen de hijos. |
| `purchasing/actions.tsx` | Ídem. |
| `useOrdersMutations.ts` | Mutaciones: cambiar `deleteOrder` → `cancelOrder`. |

### Fase 4 — Contratos y docs

| Archivo | Cambio |
|---------|--------|
| `deletion-policy.md` | Agregar patrón "Cancel" como tercer mecanismo para DRAFTs. Actualizar tabla. |
| `state-map.md` | Agregar regla: desde DRAFT se puede transitar a CANCELLED (cancel) además de CONFIRMED. |
| `component-row-actions.md` | Agregar `cancel` al registro ROW_ACTIONS si no existe. Definir label, icono, orden. |
| ADR (nuevo) | ADR que documente el cambio de política de delete a cancel/annul. |

## Secuencia de implementación

```
PR 1: Backend — nuevo servicio cancel() unificado
  ├── sales/services.py: delete_sale_order → cancel_sale_order
  ├── purchasing/services.py: delete_purchase_order → cancel_purchase_order
  ├── billing/services.py: delete_invoice → cancel_invoice
  ├── treasury/services.py: delete_movement → cancel_movement
  ├── purchasing/services.py: delete_receipt → cancel_receipt
  ├── Agregar validaciones (folio, período, workflow.Transition)
  ├── Bugfix: SaleOrder deliveries DRAFT
  ├── Bugfix: PurchaseOrder validaciones faltantes
  └── Tests

PR 2: Frontend — HUB actions
  ├── OriginPhase.tsx: label + modal de impacto
  ├── BillingPhase.tsx: label
  ├── TreasuryPhase.tsx: cancel → annul fallback
  ├── sales/actions.tsx, purchasing/actions.tsx
  ├── useOrdersMutations.ts
  └── type-check + lint

PR 3: Docs + ADR
  ├── ADR de cambio de política
  ├── deletion-policy.md update
  ├── state-map.md update
  ├── component-row-actions.md update (row-actions.ts si aplica)
  └── Test de consistencia (test_deletion_policy_consistency)
```

## Detalle de implementación — PR 1

### `SalesService.cancel_sale_order(order)` — nuevo método

```python
@staticmethod
@transaction.atomic
def cancel_sale_order(order: SaleOrder, user=None, reason=''):
    """
    Cancela una SaleOrder. Comportamiento según estado de documentos hijos:
    - Todo DRAFT: soft cancel (status + JE cancel, sin reversos).
    - Algún hijo CONFIRMED/POSTED: full annul (reversos contables/stock/pagos).
    """
    if order.status != SaleOrder.Status.DRAFT:
        raise ValidationError("Solo se pueden cancelar notas de venta en estado Borrador.")

    # ── Validaciones comunes ──
    # 1. Folio SII asignado
    for invoice in order.invoices.all():
        if invoice.number and invoice.number != 'Draft':
            raise ValidationError(
                "No se puede cancelar: la factura NV-... ya tiene folio asignado. "
                "Use Nota de Crédito."
            )

    # 2. Periodo contable abierto
    from tax.models import AccountingPeriod
    if order.date and not AccountingPeriod.is_open_for_date(order.date):
        raise ValidationError("No se puede cancelar: el período contable está cerrado.")

    # ── Determinar si es full annul o soft cancel ──
    has_confirmed_children = (
        order.deliveries.filter(status='CONFIRMED').exists() or
        order.payments.filter(journal_entry__status='POSTED').exists() or
        order.invoices.filter(status__in=['POSTED', 'PAID']).exists()
    )

    if has_confirmed_children:
        return SaleOrderService.cancel(order, user=user, reason=reason, force=True)

    # ── Soft cancel ──
    from billing.services import Invoice
    for invoice in order.invoices.all():
        _soft_cancel_invoice(invoice)

    for delivery in order.deliveries.all():
        _soft_cancel_delivery(delivery)

    for movement in order.payments.all():
        _soft_cancel_movement(movement)

    for work_order in order.work_orders.all():
        _soft_cancel_work_order(work_order)

    if order.journal_entry:
        order.journal_entry.status = JournalEntry.State.CANCELLED
        order.journal_entry.save()

    order.status = SaleOrder.Status.CANCELLED
    if reason:
        order.notes = (order.notes or '') + f"\nCancelado: {reason}"
    order.save()

    # ── Audit trail ──
    from workflow.services import WorkflowService
    WorkflowService.log_transition(
        entity_type='sales.saleorder',
        entity_id=order.id,
        transition='cancel',
        user=user,
        reason=reason,
    )

    return order
```

### `_soft_cancel_*` helpers

```python
def _soft_cancel_invoice(invoice):
    """Cancela invoice + JE en DRAFT. No reversos."""
    if invoice.status == 'CANCELLED':
        return
    for movement in invoice.payments.all():
        _soft_cancel_movement(movement)
    if invoice.journal_entry:
        invoice.journal_entry.status = JournalEntry.State.CANCELLED
        invoice.journal_entry.save()
    invoice.status = Invoice.Status.CANCELLED
    invoice.save()

def _soft_cancel_delivery(delivery):
    """Cancela delivery + stock moves DRAFT. No reversos de inventario."""
    if delivery.status == 'CANCELLED':
        return
    for line in delivery.lines.all():
        if line.stock_move and line.stock_move.state == 'DRAFT':
            line.stock_move.state = 'CANCELLED'
            line.stock_move.save()
    delivery.status = SaleDelivery.Status.CANCELLED
    delivery.save()

def _soft_cancel_movement(movement):
    """Cancela movement + JE si están en DRAFT."""
    if hasattr(movement, 'status') and movement.status == 'CANCELLED':
        return
    if movement.journal_entry and movement.journal_entry.status == JournalEntry.State.DRAFT:
        movement.journal_entry.status = JournalEntry.State.CANCELLED
        movement.journal_entry.save()
    # TreasuryMovement no tiene status field — se añade? O se deja como está
    # y el registro permanece pero sin JE activo.
    if hasattr(movement, 'status'):
        movement.status = 'CANCELLED'
        movement.save()

def _soft_cancel_work_order(work_order):
    """Cancela OT y reversa consumos si existen."""
    if work_order.status == 'CANCELLED':
        return
    # Si la OT consumió materiales, crear movimientos OUT de reverso
    if work_order.status in ('IN_PROGRESS', 'MATERIAL_ASSIGNMENT'):
        for consumption in work_order.consumptions.all():
            # Crear reverso de consumo
            StockMove.objects.create(
                product=consumption.product,
                warehouse=consumption.warehouse,
                quantity=consumption.quantity,
                move_type=StockMove.Type.OUT,
                description=f"Reverso OT {work_order.number}",
            )
    work_order.status = WorkOrder.Status.CANCELLED
    work_order.save()
```

## Detalle de implementación — PR 2 (Frontend)

### OriginPhase.tsx — nuevo modal de confirmación

En vez de dos botones separados (Trash2 / X), un solo botón "Cancelar Orden"
que ejecuta el árbol de decisión en backend. El frontend muestra un modal
con el resumen del impacto:

```
¿Qué desea hacer con "NV-000042"?

📋 Estado actual de documentos relacionados:
  • Factura FACT-001       ─── DRAFT       → se cancelará
  • Pago ING-003           ─── Borrador    → se cancelará
  • Despacho DES-002       ─── CONFIRMED   → se anulará con reverso de stock
  • Orden de Trabajo OT-5  ─── EN CURSO    → se anulará con reverso de consumos

[Cancelar]  [Anular Todo]  [Volver]
```

La lógica para generar este resumen la debe exponer un nuevo endpoint
`GET /api/sales/orders/{id}/cancel-impact/` que el frontend consulta
antes de mostrar el modal.

### Cambios en actions registries

`sales/actions.tsx` — eliminar `annul-document` y `delete-draft` separados,
reemplazar por `cancel-order` que unifica ambos según el árbol.

`purchasing/actions.tsx` — idem.

## Tests

### Backend

```python
# backend/sales/tests/test_cancel_order.py
class TestCancelSaleOrder:
    def test_cancel_draft_order_no_children(self):
        """Soft cancel: solo marca status."""
    
    def test_cancel_draft_order_with_child_drafts(self):
        """Soft cancel: todos los hijos DRAFT se cancelan sin reversos."""
    
    def test_cancel_draft_order_with_confirmed_delivery(self):
        """Full annul: delivery CONFIRMED → reverso de stock."""
    
    def test_cancel_draft_order_with_posted_payment(self):
        """Full annul: payment POSTED → contra-asiento."""
    
    def test_cancel_draft_order_with_folio(self):
        """Bloquea: invoice con folio asignado."""
    
    def test_cancel_draft_order_closed_period(self):
        """Bloquea: período contable cerrado."""
    
    def test_cancel_logs_workflow_transition(self):
        """Verifica que se cree workflow.Transition."""
```

### Frontend

Tests existentes para hooks: actualizar mocks de API.

## Criterios de aceptación

- [ ] Backend: ninguna operación de "eliminar" hace hard delete de documentos transaccionales.
- [ ] Backend: soft cancel y full annul se registran en `workflow.Transition`.
- [ ] Backend: se valida período contable antes de cancelar/annular.
- [ ] Backend: se valida folio SII antes de cancelar.
- [ ] Backend: bug de deliveries DRAFT en SaleOrder corregido.
- [ ] Backend: validaciones de payments POSTED + receipts CONFIRMED en PurchaseOrder agregadas.
- [ ] Frontend: modal de impacto antes de ejecutar cancel/annul.
- [ ] Frontend: labels actualizados ("Cancelar" en vez de "Eliminar Borrador").
- [ ] Tests: cobertura ≥80% en servicios modificados.
- [ ] Docs: `deletion-policy.md`, `state-map.md` actualizados.
- [ ] ADR: aprobado antes del merge.
