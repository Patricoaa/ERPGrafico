import re

def fix():
    with open('backend/inventory/services.py', 'r') as f:
        content = f.read()

    content = content.replace(
        "document.details.select_related('product', 'warehouse', 'source_warehouse', 'source_location', 'destination_location')",
        "document.details.select_related('product', 'source_location', 'destination_location')"
    )

    with open('backend/inventory/services.py', 'w') as f:
        f.write(content)

fix()
