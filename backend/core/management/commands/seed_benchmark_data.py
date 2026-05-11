import random
import uuid
from django.core.management.base import BaseCommand
from django.db import transaction

# We will seed contacts and some movements (e.g. SaleOrder)
from contacts.models import Contact
from sales.models import SaleOrder

class Command(BaseCommand):
    help = 'Seeds the database with 50k contacts and 100k movements for benchmark testing.'

    def handle(self, *args, **options):
        self.stdout.write("Starting benchmark data seed...")
        
        # 1. Seed 50,000 Contacts
        self.stdout.write("Seeding 50,000 Contacts...")
        contacts_to_create = []
        for i in range(50000):
            # Generate realistic-looking data to make search realistic
            if i % 100 == 0:
                name = f"Carlos Empresa {i}"
                tax_id = f"76.{random.randint(100, 999)}.{random.randint(100, 999)}-K"
            else:
                name = f"Test Contact {uuid.uuid4().hex[:8]}"
                tax_id = f"1{random.randint(1000000, 9999999)}-{random.randint(0, 9)}"
            
            contacts_to_create.append(Contact(
                name=name,
                tax_id=tax_id,
                contact_name=f"Admin {i}"
            ))
            
            if len(contacts_to_create) == 10000:
                Contact.objects.bulk_create(contacts_to_create)
                contacts_to_create = []
                self.stdout.write(f"  Inserted batch... ({i+1})")
        
        if contacts_to_create:
            Contact.objects.bulk_create(contacts_to_create)
            
        self.stdout.write(self.style.SUCCESS('Successfully seeded 50k contacts.'))
        
        # Get random contacts to assign to movements
        contact_ids = list(Contact.objects.values_list('id', flat=True)[:10000])

        # 2. Seed 100,000 Sale Orders (Movements)
        self.stdout.write("Seeding 100,000 Sale Orders...")
        orders_to_create = []
        for i in range(100000):
            if i % 500 == 0:
                number = f"NV-001{i}"
            else:
                number = f"NV-{random.randint(100000, 999999)}"
            
            orders_to_create.append(SaleOrder(
                number=number,
                customer_id=random.choice(contact_ids),
                status='DRAFT',
                issue_date='2026-05-01'
            ))
            
            if len(orders_to_create) == 10000:
                SaleOrder.objects.bulk_create(orders_to_create)
                orders_to_create = []
                self.stdout.write(f"  Inserted batch... ({i+1})")
                
        if orders_to_create:
            SaleOrder.objects.bulk_create(orders_to_create)

        self.stdout.write(self.style.SUCCESS('Successfully seeded 100k movements.'))
        self.stdout.write(self.style.SUCCESS('Benchmark dataset is ready.'))
