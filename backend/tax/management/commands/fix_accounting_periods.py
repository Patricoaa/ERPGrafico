
from django.core.management.base import BaseCommand
from accounting.models import JournalEntry
from tax.models import AccountingPeriod

class Command(BaseCommand):
    help = 'Fixes missing Accounting Periods for existing Journal Entries'

    def handle(self, *args, **options):
        self.stdout.write("Checking for missing Accounting Periods...")
        
        entries = JournalEntry.objects.all()
        created_count = 0
        
        for entry in entries:
            year = entry.date.year
            month = entry.date.month
            
            period, created = AccountingPeriod.objects.get_or_create(
                year=year,
                month=month
            )
            
            if created:
                created_count += 1
                self.stdout.write(f"Created period: {year}-{month}")
                
            # Ensure entry is linked
            if not entry.accounting_period:
                entry.accounting_period = period
                entry.save(update_fields=['accounting_period'])
                self.stdout.write(f"Linked entry {entry.id} to period {year}-{month}")

        self.stdout.write(self.style.SUCCESS(f"Finished. Created {created_count} new periods."))
