import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    orig = content
    
    # In sales/services.py
    if 'sales/services.py' in filepath:
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=dispatch_doc,\s*product=item\["product"\],\s*warehouse=warehouse,\s*quantity=item\["quantity"\],\s*\)',
            r'''InventoryDocumentDetail(
                document=dispatch_doc,
                product=item["product"],
                source_location=Location.objects.get(location_type='INTERNAL', warehouse=warehouse),
                destination_location=Location.objects.get(location_type='CUSTOMER'),
                quantity=item["quantity"],
            )''',
            content
        )
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=dispatch_doc,\s*product=detail\.product,\s*warehouse=warehouse,\s*quantity=detail\.quantity,\s*unit_cost=detail\.unit_cost,\s*\)',
            r'''InventoryDocumentDetail(
                document=dispatch_doc,
                product=detail.product,
                source_location=Location.objects.get(location_type='INTERNAL', warehouse=warehouse),
                destination_location=Location.objects.get(location_type='CUSTOMER'),
                quantity=detail.quantity,
                unit_cost=detail.unit_cost,
            )''',
            content
        )
        if 'Location' not in content:
            content = content.replace('from inventory.models import InventoryDocument, InventoryDocumentDetail', 'from inventory.models import InventoryDocument, InventoryDocumentDetail, Location')


    # In sales/return_services.py
    if 'sales/return_services.py' in filepath:
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=logistics_doc,\s*product=item\["product"\],\s*warehouse=warehouse,\s*quantity=item\["quantity"\],\s*\)',
            r'''InventoryDocumentDetail(
                document=logistics_doc,
                product=item["product"],
                source_location=Location.objects.filter(location_type='CUSTOMER').first(),
                destination_location=Location.objects.filter(location_type='INTERNAL', warehouse=warehouse).first(),
                quantity=item["quantity"],
            )''',
            content
        )
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=logistics_doc,\s*product=return_item\.invoice_detail\.product,\s*warehouse=warehouse,\s*quantity=return_item\.quantity,\s*unit_cost=return_item\.invoice_detail\.unit_price,\s*\)',
            r'''InventoryDocumentDetail(
                document=logistics_doc,
                product=return_item.invoice_detail.product,
                source_location=Location.objects.filter(location_type='CUSTOMER').first(),
                destination_location=Location.objects.filter(location_type='INTERNAL', warehouse=warehouse).first(),
                quantity=return_item.quantity,
                unit_cost=return_item.invoice_detail.unit_price,
            )''',
            content
        )
        # Needs from inventory.models import Location if not present
        if 'Location' not in content:
            content = content.replace('from inventory.models import InventoryDocument, InventoryDocumentDetail', 'from inventory.models import InventoryDocument, InventoryDocumentDetail, Location')

    # In purchasing/services.py
    if 'purchasing/services.py' in filepath:
        # Reception
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=receipt_doc,\s*product=item\["product"\],\s*warehouse=warehouse,\s*quantity=item\["quantity"\],\s*\)',
            r'''InventoryDocumentDetail(
                document=receipt_doc,
                product=item["product"],
                source_location=Location.objects.get(location_type='VENDOR'),
                destination_location=Location.objects.get(location_type='INTERNAL', warehouse=warehouse),
                quantity=item["quantity"],
            )''',
            content
        )
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=receipt_doc,\s*product=detail\.product,\s*warehouse=warehouse,\s*quantity=detail\.quantity,\s*unit_cost=detail\.unit_price,\s*\)',
            r'''InventoryDocumentDetail(
                document=receipt_doc,
                product=detail.product,
                source_location=Location.objects.get(location_type='VENDOR'),
                destination_location=Location.objects.get(location_type='INTERNAL', warehouse=warehouse),
                quantity=detail.quantity,
                unit_cost=detail.unit_price,
            )''',
            content
        )
        # Manual receipt
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=receipt_doc,\s*product=detail\["product"\],\s*warehouse=warehouse,\s*quantity=detail\["quantity"\],\s*unit_cost=detail\.get\("unit_price", Decimal\("0"\)\),\s*\)',
            r'''InventoryDocumentDetail(
                document=receipt_doc,
                product=detail["product"],
                source_location=Location.objects.get(location_type='VENDOR'),
                destination_location=Location.objects.get(location_type='INTERNAL', warehouse=warehouse),
                quantity=detail["quantity"],
                unit_cost=detail.get("unit_price", Decimal("0")),
            )''',
            content
        )
        if 'Location' not in content:
            content = content.replace('from inventory.models import InventoryDocument, InventoryDocumentDetail', 'from inventory.models import InventoryDocument, InventoryDocumentDetail, Location')

    # In purchasing/return_services.py
    if 'purchasing/return_services.py' in filepath:
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=logistics_doc,\s*product=item\["product"\],\s*warehouse=warehouse,\s*quantity=item\["quantity"\],\s*\)',
            r'''InventoryDocumentDetail(
                document=logistics_doc,
                product=item["product"],
                source_location=Location.objects.filter(location_type='INTERNAL', warehouse=warehouse).first(),
                destination_location=Location.objects.filter(location_type='VENDOR').first(),
                quantity=item["quantity"],
            )''',
            content
        )
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=logistics_doc,\s*product=return_item\.invoice_detail\.product,\s*warehouse=warehouse,\s*quantity=return_item\.quantity,\s*unit_cost=return_item\.invoice_detail\.unit_price,\s*\)',
            r'''InventoryDocumentDetail(
                document=logistics_doc,
                product=return_item.invoice_detail.product,
                source_location=Location.objects.filter(location_type='INTERNAL', warehouse=warehouse).first(),
                destination_location=Location.objects.filter(location_type='VENDOR').first(),
                quantity=return_item.quantity,
                unit_cost=return_item.invoice_detail.unit_price,
            )''',
            content
        )
        if 'Location' not in content:
            content = content.replace('from inventory.models import InventoryDocument, InventoryDocumentDetail', 'from inventory.models import InventoryDocument, InventoryDocumentDetail, Location')

    # In production/services.py
    if 'production/services.py' in filepath:
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=issue_doc,\s*product=ingredient\["product"\],\s*warehouse=warehouse,\s*quantity=ingredient\["quantity"\],\s*\)',
            r'''InventoryDocumentDetail(
                document=issue_doc,
                product=ingredient["product"],
                source_location=Location.objects.filter(location_type='INTERNAL', warehouse=warehouse).first(),
                destination_location=Location.objects.filter(location_type='PRODUCTION').first(),
                quantity=ingredient["quantity"],
            )''',
            content
        )
        content = re.sub(
            r'InventoryDocumentDetail\(\s*document=receipt_doc,\s*product=finished_product,\s*warehouse=warehouse,\s*quantity=quantity,\s*\)',
            r'''InventoryDocumentDetail(
                document=receipt_doc,
                product=finished_product,
                source_location=Location.objects.filter(location_type='PRODUCTION').first(),
                destination_location=Location.objects.filter(location_type='INTERNAL', warehouse=warehouse).first(),
                quantity=quantity,
            )''',
            content
        )
        if 'Location' not in content:
            content = content.replace('from inventory.models import InventoryDocument, InventoryDocumentDetail', 'from inventory.models import InventoryDocument, InventoryDocumentDetail, Location')


    if orig != content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")


for root, _, files in os.walk('backend'):
    for f in files:
        if f.endswith('.py'):
            fix_file(os.path.join(root, f))
