"""Proveedores de relaciones documentales de producción (ADR-0080, M5)."""

from core.documents import DocumentType, DocumentTypeRegistry, Link, relation_provider
from core.documents.details import display, join

DocumentTypeRegistry.register(DocumentType(
    label="production.workorder", amount_field=None,
    detail=lambda ot: join(display(ot, "current_stage"), ot.description),
))


@relation_provider("production.workorder")
def work_order_relations(work_order):
    if work_order.sale_order_id:
        yield Link("derivation", "incoming", "sale_order", work_order.sale_order)
    if work_order.related_note_id:
        yield Link("reference", "incoming", "note", work_order.related_note, is_dependency=False)
    for line in work_order.delivery_lines.select_related("delivery"):
        yield Link("fulfillment", "outgoing", "delivery", line.delivery)
    for order in work_order.purchase_orders.all():
        # Servicios tercerizados de la OT
        yield Link("derivation", "outgoing", "purchase_order", order)
    for consumption in work_order.consumptions.select_related("stock_move"):
        if consumption.stock_move_id:
            yield Link("fulfillment", "outgoing", "stock_move", consumption.stock_move, quantity=consumption.quantity)


# Sin ficha ni detalle: lista de BOM
DocumentTypeRegistry.register(DocumentType(label="production.bom", canonical_url="/production/boms", status_field=None))
