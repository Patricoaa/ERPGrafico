import os

changes = {
    "backend/sales/views.py": [
        ('    @action(detail=True, methods=["post"])\n    def confirm(self', '    @idempotent_endpoint(scope="sales.order.confirm")\n    @action(detail=True, methods=["post"])\n    def confirm(self'),
        ('    @action(detail=True, methods=["post"], url_path="dispatch")\n    def dispatch_order(self', '    @idempotent_endpoint(scope="sales.order.dispatch")\n    @action(detail=True, methods=["post"], url_path="dispatch")\n    def dispatch_order(self')
    ],
    "backend/purchasing/views.py": [
        ('    @action(detail=True, methods=["post"])\n    def confirm(self', '    @idempotent_endpoint(scope="purchasing.order.confirm")\n    @action(detail=True, methods=["post"])\n    def confirm(self'),
        ('    @action(detail=True, methods=["post"])\n    def partial_receive(self', '    @idempotent_endpoint(scope="purchasing.order.receive")\n    @action(detail=True, methods=["post"])\n    def partial_receive(self')
    ],
    "backend/hr/views.py": [
        ('    @action(detail=False, methods=["post"])\n    def create_draft_payrolls(self', '    @idempotent_endpoint(scope="hr.payroll.draft")\n    @action(detail=False, methods=["post"])\n    def create_draft_payrolls(self')
    ],
    "backend/tax/views.py": [
        ('    @action(detail=True, methods=["post"])\n    def register(self', '    @idempotent_endpoint(scope="tax.f29.register")\n    @action(detail=True, methods=["post"])\n    def register(self'),
        ('    @action(detail=True, methods=["post"])\n    def close(self', '    @idempotent_endpoint(scope="tax.period.close")\n    @action(detail=True, methods=["post"])\n    def close(self')
    ],
    "backend/treasury/views.py": [
        ('    @action(detail=False, methods=["post"])\n    def register_movement(self', '    @idempotent_endpoint(scope="treasury.movement.register")\n    @action(detail=False, methods=["post"])\n    def register_movement(self'),
        ('    @action(detail=False, methods=["post"])\n    def register_transfer(self', '    @idempotent_endpoint(scope="treasury.transfer.register")\n    @action(detail=False, methods=["post"])\n    def register_transfer(self'),
        ('    @action(detail=False, methods=["post"], url_path="card-purchase")\n    def card_purchase(self', '    @idempotent_endpoint(scope="treasury.card.purchase")\n    @action(detail=False, methods=["post"], url_path="card-purchase")\n    def card_purchase(self'),
        ('    @action(detail=True, methods=["post"])\n    def allocate(self', '    @idempotent_endpoint(scope="treasury.allocation.create")\n    @action(detail=True, methods=["post"])\n    def allocate(self'),
        ('    @action(detail=False, methods=["post"])\n    def match_group(self', '    @idempotent_endpoint(scope="treasury.reconciliation.match")\n    @action(detail=False, methods=["post"])\n    def match_group(self')
    ],
    "backend/production/views.py": [
        ('    @action(detail=False, methods=["post"], url_path="bulk_transition")\n    def bulk_transition(self', '    @idempotent_endpoint(scope="production.order.bulk_transition")\n    @action(detail=False, methods=["post"], url_path="bulk_transition")\n    def bulk_transition(self')
    ]
}

imports = {
    "backend/hr/views.py": "from core.idempotency import idempotent_endpoint\n",
    "backend/tax/views.py": "from core.idempotency import idempotent_endpoint\n",
    "backend/treasury/views.py": "from core.idempotency import idempotent_endpoint\n",
    "backend/production/views.py": "" # Already imported
}

for file_path, replacements in changes.items():
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r") as f:
        content = f.read()

    # Add import if needed and not already there
    if file_path in imports and imports[file_path] and "idempotent_endpoint" not in content:
        content = imports[file_path] + content

    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(file_path, "w") as f:
        f.write(content)

print("Done")
