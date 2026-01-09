from django.core.management.base import BaseCommand
from accounting.services import AccountingService

class Command(BaseCommand):
    help = 'Populates the standard IFRS Chart of Accounts'

    def handle(self, *args, **options):
        self.stdout.write("Populating IFRS Chart of Accounts...")
        message = AccountingService.populate_ifrs_coa()
        self.stdout.write(self.style.SUCCESS(message))
