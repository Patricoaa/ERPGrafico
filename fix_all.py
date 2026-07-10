import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # 1. backend/inventory/services.py (already mostly handled, but we will redo)
    if 'inventory/services.py' in filepath:
        # We need to replace the `confirmar_documento` block
        content = re.sub(
            r'if document\.document_type == InventoryDocument\.Type\.TRANSFER:.*?generated_moves\.extend\(\[out_move, in_move\]\)',
            r'''if document.document_type == InventoryDocument.Type.TRANSFER:
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
        content = re.sub(
            r'move = StockMove\.objects\.create\([^)]*warehouse=detail\.warehouse,[^)]*move_type=move_type,',
            r'''move = StockMove.objects.create(
                    product=detail.product,
                    quantity=abs(qty),''',
            content, flags=re.DOTALL
        )
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
        content = content.replace(
            "move = StockMove.objects.filter(product=product, warehouse=warehouse).order_by('-id').first()",
            "move = StockMove.objects.filter(product=product).order_by('-id').first()"
        )
        content = content.replace(
            "for detail in document.details.select_related('product', 'warehouse', 'source_warehouse', 'source_location', 'destination_location'):",
            "for detail in document.details.select_related('product', 'source_location', 'destination_location'):"
        )
        content = content.replace(
            "if not move: # Fallback if move_type was something else",
            "if not move:  # Fallback"
        )

    # 2. backend/inventory/selectors.py
    if 'inventory/selectors.py' in filepath:
        content = content.replace(
            '.select_related("warehouse", "uom", "product")',
            '.select_related("source_location", "destination_location", "uom", "product")'
        )
        content = content.replace(
            'if unit_price == 0 or m.move_type == "OUT":',
            'if unit_price == 0 or (m.source_location and m.source_location.location_type == "INTERNAL" and m.destination_location and m.destination_location.location_type != "INTERNAL"):'
        )
        content = content.replace(
            '"type": m.move_type,',
            '"type": f"{m.source_location.name if m.source_location else \'?\'} → {m.destination_location.name if m.destination_location else \'?\'}",'
        )
        content = content.replace(
            '"warehouse": m.warehouse.name,',
            '"warehouse": m.source_location.warehouse.name if m.source_location and m.source_location.warehouse else "?",'
        )

    # 3. backend/billing/selectors.py
    if 'billing/selectors.py' in filepath:
        content = content.replace(
            "'status': m.move_type",
            "'status': f\"{getattr(m.source_location, 'name', '?')} → {getattr(m.destination_location, 'name', '?')}\""
        )

    # 4. backend/core/management/commands/setup_demo_data.py
    if 'setup_demo_data.py' in filepath:
        content = re.sub(
            r'move = StockMove\(\s*date=timezone\.now\(\)\.date\(\),\s*product=product,\s*warehouse=warehouse,\s*quantity=qty,\s*move_type=StockMove\.Type\.IN,',
            r'''from inventory.models import Location
            vendor_loc = Location.objects.filter(location_type="VENDOR").first()
            internal_loc = Location.objects.filter(location_type="INTERNAL", warehouse=warehouse).first()
            move = StockMove(
                date=timezone.now().date(),
                product=product,
                quantity=qty,
                source_location=vendor_loc,
                destination_location=internal_loc,''',
            content
        )

    # 5. backend/inventory/tests/test_inventory_document.py
    if 'test_inventory_document.py' in filepath:
        content = re.sub(
            r'StockMove\.objects\.create\(\s*product=product,\s*warehouse=warehouse_src,\s*quantity=Decimal\(\'100\.0\'\),\s*move_type=StockMove\.Type\.IN\s*\)',
            r'''from inventory.models import Location
    vendor_loc, _ = Location.objects.get_or_create(name='Proveedor Test', location_type='VENDOR', defaults={'warehouse': None})
    internal_loc, _ = Location.objects.get_or_create(name='Interno Test Src', location_type='INTERNAL', defaults={'warehouse': warehouse_src})
    StockMove.objects.create(product=product, quantity=Decimal('100.0'), source_location=vendor_loc, destination_location=internal_loc)''',
            content
        )
        content = re.sub(
            r'InventoryDocumentDetail\.objects\.create\(\s*document=doc,\s*product=product,\s*warehouse=warehouse,\s*quantity=Decimal\(\'50\.0\'\)\s*\)',
            r'''from inventory.models import Location
    vendor_loc, _ = Location.objects.get_or_create(name='Proveedor Test', location_type='VENDOR', defaults={'warehouse': None})
    internal_loc, _ = Location.objects.get_or_create(name='Interno Test', location_type='INTERNAL', defaults={'warehouse': warehouse})
    InventoryDocumentDetail.objects.create(document=doc, product=product, source_location=vendor_loc, destination_location=internal_loc, quantity=Decimal('50.0'))''',
            content
        )
        content = re.sub(
            r'InventoryDocumentDetail\.objects\.create\(\s*document=doc,\s*product=product,\s*warehouse=warehouse_dest,\s*source_warehouse=warehouse_src,\s*quantity=Decimal\(\'20\.0\'\)\s*\)',
            r'''internal_loc_dest, _ = Location.objects.get_or_create(name='Interno Test Dest', location_type='INTERNAL', defaults={'warehouse': warehouse_dest})
    InventoryDocumentDetail.objects.create(document=doc, product=product, source_location=internal_loc, destination_location=internal_loc_dest, quantity=Decimal('20.0'))''',
            content
        )

    # 6. backend/inventory/tests/test_stock.py
    if 'test_stock.py' in filepath:
        content = re.sub(
            r'move = StockMove\.objects\.create\(\s*product=product,\s*warehouse=warehouse,\s*quantity=Decimal\(\'10\.5\'\),\s*move_type=StockMove\.Type\.IN,\s*description=\'Test move IN\'\s*\)',
            r'''from inventory.models import Location
    vendor_loc, _ = Location.objects.get_or_create(name='Proveedor Test', location_type='VENDOR', defaults={'warehouse': None})
    internal_loc, _ = Location.objects.get_or_create(name='Interno Test', location_type='INTERNAL', defaults={'warehouse': warehouse})
    move = StockMove.objects.create(product=product, quantity=Decimal('10.5'), source_location=vendor_loc, destination_location=internal_loc, description='Test move IN')''',
            content
        )
        content = re.sub(
            r'StockMove\.objects\.create\(\s*product=product,\s*warehouse=warehouse,\s*quantity=Decimal\(\'3\.0\'\),\s*move_type=StockMove\.Type\.OUT,\s*description=\'Test move OUT\'\s*\)',
            r'''customer_loc, _ = Location.objects.get_or_create(name='Cliente Test', location_type='CUSTOMER', defaults={'warehouse': None})
    StockMove.objects.create(product=product, quantity=Decimal('3.0'), source_location=internal_loc, destination_location=customer_loc, description='Test move OUT')''',
            content
        )

    # 7. backend/billing/test_note_manual.py
    if 'test_note_manual.py' in filepath:
        content = content.replace(
            '{move.move_type}',
            "{getattr(move.source_location, 'name', '?')} → {getattr(move.destination_location, 'name', '?')}"
        )

    # 8. backend/billing/test_note_workflow.py
    if 'test_note_workflow.py' in filepath:
        content = content.replace(
            'product=setup["products"]["stockable"], warehouse=setup["warehouse"]',
            'product=setup["products"]["stockable"], destination_location__warehouse=setup["warehouse"]'
        )
        content = content.replace(
            'assert move.move_type == StockMove.Type.IN  # Credit note = IN',
            "assert move.source_location.location_type == 'CUSTOMER'  # Credit note = IN"
        )

    # Fix all InventoryDocumentDetail(...) instantiations inside services
    if filepath.endswith('.py') and ('services.py' in filepath or 'pos_service.py' in filepath):
        if 'InventoryDocumentDetail' in content:
            # We want to replace `warehouse=` with `destination_location_id=` or something.
            # But the backend `Location` might not be known without DB lookup. 
            # Actually, `warehouse_id` could be preserved if we just add a `__init__` wrapper to `InventoryDocumentDetail`
            pass

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('backend'):
    for file in files:
        if file.endswith('.py'):
            process_file(os.path.join(root, file))
