import os
import re

MODELS_TO_UPDATE = {
    'accounting': ['FiscalYear', 'ClosingChecklistTemplate'],
    'treasury': ['BankStatement', 'POSSession', 'Checkbook', 'TreasuryAccount', 'POSTerminal', 'Bank', 'PaymentTerminalProvider', 'PaymentMethod'],
    'tax': ['TaxPeriod', 'AccountingPeriod'],
    'hr': ['Employee'],
    'inventory': ['ProductCategory', 'UoMCategory', 'UoM', 'Warehouse', 'Location']
}

BASE_DIR = '/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/backend'

FIELD_CODE = """    created_by = models.ForeignKey(
        "core.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+"
    )
"""

for app, models in MODELS_TO_UPDATE.items():
    file_path = os.path.join(BASE_DIR, app, 'models.py')
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
        
    with open(file_path, 'r') as f:
        content = f.read()

    for model in models:
        pattern = r"(class " + model + r"\([^)]+\):)\n"
        replacement = r"\1\n" + FIELD_CODE
        content = re.sub(pattern, replacement, content)

    with open(file_path, 'w') as f:
        f.write(content)
        
    print(f"Updated {file_path}")
