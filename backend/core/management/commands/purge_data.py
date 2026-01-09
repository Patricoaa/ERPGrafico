from django.core.management.base import BaseCommand
from django.db import transaction
from accounting.models import Account, AccountingSettings, JournalEntry, JournalItem, Budget, BudgetItem
from inventory.models import ProductCategory, Product, Warehouse, StockMove, UoMCategory, UoM, PricingRule
from contacts.models import Contact
from sales.models import SaleOrder, SaleLine, SaleDelivery, SaleDeliveryLine
from purchasing.models import PurchaseOrder, PurchaseLine, PurchaseReceipt, PurchaseReceiptLine
from treasury.models import TreasuryAccount, Payment
from billing.models import Invoice
from services.models import ServiceCategory, ServiceContract, ServiceObligation
from production.models import BillOfMaterials, BillOfMaterialsLine, WorkOrder, ProductionConsumption

class Command(BaseCommand):
    help = 'Completely purges all data from the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Do not ask for confirmation',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options['no_input']:
            confirm = input("This will DELETE ALL business and master data. Are you sure? (y/N): ")
            if confirm.lower() != 'y':
                self.stdout.write("Operation cancelled.")
                return

        self.stdout.write(self.style.WARNING('Purging all data...'))
        
        models_to_purge = [
            (ProductionConsumption, "ProductionConsumption"),
            (WorkOrder, "WorkOrder"),
            (BillOfMaterialsLine, "BillOfMaterialsLine"),
            (BillOfMaterials, "BillOfMaterials"),
            (BudgetItem, "BudgetItem"),
            (Budget, "Budget"),
            (ServiceObligation, "ServiceObligation"),
            (ServiceContract, "ServiceContract"),
            (ServiceCategory, "ServiceCategory"),
            (Payment, "Payment"),
            (Invoice, "Invoice"),
            (PurchaseReceiptLine, "PurchaseReceiptLine"),
            (PurchaseReceipt, "PurchaseReceipt"),
            (PurchaseLine, "PurchaseLine"),
            (PurchaseOrder, "PurchaseOrder"),
            (SaleDeliveryLine, "SaleDeliveryLine"),
            (SaleDelivery, "SaleDelivery"),
            (SaleLine, "SaleLine"),
            (SaleOrder, "SaleOrder"),
            (StockMove, "StockMove"),
            (JournalItem, "JournalItem"),
            (JournalEntry, "JournalEntry"),
            (PricingRule, "PricingRule"),
            (Product, "Product"),
            (ProductCategory, "ProductCategory"),
            (Warehouse, "Warehouse"),
            (Contact, "Contact"),
            (TreasuryAccount, "TreasuryAccount"),
            (AccountingSettings, "AccountingSettings"),
            (UoM, "UoM"),
            (UoMCategory, "UoMCategory"),
            (Account, "Account"),
        ]

        for model, name in models_to_purge:
            self.stdout.write(f"  Deleting {name}...")
            model.objects.all().delete()

        self.stdout.write(self.style.SUCCESS('Database is now completely empty!'))
