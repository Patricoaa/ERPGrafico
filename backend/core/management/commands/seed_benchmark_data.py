import random

from django.core.management.base import BaseCommand

# We will seed contacts and some movements (e.g. SaleOrder)
from contacts.models import Contact
from sales.models import SaleOrder


class Command(BaseCommand):
    help = "Seeds the database with 50k contacts and 100k movements for benchmark testing."

    def handle(self, *args, **options):
        self.stdout.write("Starting benchmark data seed...")

        # 1. Seed 50,000 Contacts
        self.stdout.write("Seeding 50,000 Contacts...")
        contacts_to_create = []
        for i in range(50000):
            # Generate realistic-looking data to make search realistic
            # tax_id is unique: derive it from the index, not from random draws.
            # Random RUTs collide (birthday problem) and abort the batch with IntegrityError.
            if i % 100 == 0:
                name = f"Carlos Empresa {i}"
                tax_id = f"BENCH-C{i:08d}"
            else:
                name = f"Test Contact {i}"
                tax_id = f"BENCH-{i:08d}"

            contacts_to_create.append(Contact(name=name, tax_id=tax_id, contact_name=f"Admin {i}"))

            if len(contacts_to_create) == 10000:
                Contact.objects.bulk_create(contacts_to_create)
                contacts_to_create = []
                self.stdout.write(f"  Inserted batch... ({i + 1})")

        if contacts_to_create:
            Contact.objects.bulk_create(contacts_to_create)

        self.stdout.write(self.style.SUCCESS("Successfully seeded 50k contacts."))

        # Get random contacts to assign to movements
        contact_ids = list(Contact.objects.values_list("id", flat=True)[:10000])

        from core.prefix_registry import EntityPrefix

        # 2. Seed 100,000 Sale Orders (Movements)
        self.stdout.write("Seeding 100,000 Sale Orders...")
        orders_to_create = []
        for i in range(100000):
            # Sequential numbers: random 6-digit numbers collide under the unique constraint.
            number = f"{EntityPrefix.SALE_ORDER}-BENCH{i:07d}"

            orders_to_create.append(
                SaleOrder(
                    number=number,
                    customer_id=random.choice(contact_ids),
                    status="DRAFT",
                    issue_date="2026-05-01",
                )
            )

            if len(orders_to_create) == 10000:
                SaleOrder.objects.bulk_create(orders_to_create)
                orders_to_create = []
                self.stdout.write(f"  Inserted batch... ({i + 1})")

        if orders_to_create:
            SaleOrder.objects.bulk_create(orders_to_create)

        self.stdout.write(self.style.SUCCESS("Successfully seeded 100k movements."))
        self.stdout.write(self.style.SUCCESS("Benchmark dataset is ready."))
