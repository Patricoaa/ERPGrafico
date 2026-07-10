import re

def fix():
    with open('backend/inventory/services.py', 'r') as f:
        content = f.read()

    # Fix confirmar_documento
    content = re.sub(
        r'if document\.document_type == InventoryDocument\.Type\.TRANSFER:.*?generated_moves\.extend\(\[out_move,\s*in_move\]\)',
        r'''if document.document_type == InventoryDocument.Type.TRANSFER:
            # Transfer creates a single move now from src to dst
            move = StockMove.objects.create(
                product=detail.product,
                quantity=detail.quantity,
                source_location=src_loc,
                destination_location=dst_loc,
                description=f"Transferencia Doc: {document.reference or document.id}",
                journal_entry=journal_entry
            )
            generated_moves.append(move)''',
        content, flags=re.DOTALL
    )

    # Fix the generic move creation (removing move_type and warehouse)
    content = re.sub(
        r'move = StockMove\.objects\.create\(\s*product=detail\.product,\s*warehouse=detail\.warehouse,\s*quantity=abs\(qty\),\s*move_type=move_type,',
        r'''move = StockMove.objects.create(
                product=detail.product,
                quantity=abs(qty),''',
        content, flags=re.DOTALL
    )
    
    # Fix anular_documento
    content = re.sub(
        r'def anular_documento\(document\):.*?document\.status = InventoryDocument\.Status\.CANCELLED',
        r'''def anular_documento(document):
    from .models import InventoryDocument, StockMove
    
    if document.status != InventoryDocument.Status.CONFIRMED:
        raise ValidationError("Solo se pueden anular documentos confirmados.")
        
    for detail in document.details.select_related('product', 'source_location', 'destination_location'):
        StockMove.objects.create(
            product=detail.product,
            quantity=detail.quantity,
            source_location=detail.destination_location,
            destination_location=detail.source_location,
            unit_cost=detail.unit_cost,
            description=f"Anulación {document.get_document_type_display()} Doc: {document.reference or document.id}"
        )
            
    document.status = InventoryDocument.Status.CANCELLED''',
        content, flags=re.DOTALL
    )

    # Fix adjust_stock
    content = re.sub(
        r'def adjust_stock\(product_id,\s*warehouse_id,\s*quantity,\s*unit_cost=None,\s*reason=None,\s*move_type=None,\s*notes=""\):',
        r'def adjust_stock(product_id, warehouse_id, quantity, unit_cost=None, reason=None, move_type=None, notes=""):',
        content
    )
    
    content = re.sub(
        r'StockMove\.objects\.create\(\s*product=product,\s*warehouse_id=warehouse_id,\s*quantity=abs\(qty_diff\),\s*move_type=StockMove\.Type\.ADJUSTMENT,',
        r'''StockMove.objects.create(
            product=product,
            quantity=abs(qty_diff),''',
        content, flags=re.DOTALL
    )

    with open('backend/inventory/services.py', 'w') as f:
        f.write(content)

fix()
