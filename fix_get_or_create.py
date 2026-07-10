import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    orig = content

    # Helper replacements to use get_or_create safely
    replacements = [
        (
            r"Location\.objects\.filter\(location_type='CUSTOMER'\)\.first\(\)",
            r"Location.objects.get_or_create(location_type='CUSTOMER', defaults={'name': 'Clientes'})[0]"
        ),
        (
            r"Location\.objects\.get\(location_type='CUSTOMER'\)",
            r"Location.objects.get_or_create(location_type='CUSTOMER', defaults={'name': 'Clientes'})[0]"
        ),
        (
            r"Location\.objects\.filter\(location_type='VENDOR'\)\.first\(\)",
            r"Location.objects.get_or_create(location_type='VENDOR', defaults={'name': 'Proveedores'})[0]"
        ),
        (
            r"Location\.objects\.get\(location_type='VENDOR'\)",
            r"Location.objects.get_or_create(location_type='VENDOR', defaults={'name': 'Proveedores'})[0]"
        ),
        (
            r"Location\.objects\.filter\(location_type='PRODUCTION'\)\.first\(\)",
            r"Location.objects.get_or_create(location_type='PRODUCTION', defaults={'name': 'Producción'})[0]"
        ),
        (
            r"Location\.objects\.get\(location_type='PRODUCTION'\)",
            r"Location.objects.get_or_create(location_type='PRODUCTION', defaults={'name': 'Producción'})[0]"
        ),
        (
            r"Location\.objects\.filter\(location_type='INTERNAL',\s*warehouse=([a-zA-Z0-9_\.]+)\)\.first\(\)",
            r"Location.objects.get_or_create(location_type='INTERNAL', warehouse=\1, defaults={'name': \1.name if \1 else 'Interno'})[0]"
        ),
        (
            r"Location\.objects\.get\(location_type='INTERNAL',\s*warehouse=([a-zA-Z0-9_\.]+)\)",
            r"Location.objects.get_or_create(location_type='INTERNAL', warehouse=\1, defaults={'name': \1.name if \1 else 'Interno'})[0]"
        ),
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != orig:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('backend'):
    for f in files:
        if f.endswith('.py'):
            fix_file(os.path.join(root, f))
