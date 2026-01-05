from django.core.management.base import BaseCommand
from django.utils import timezone
from services.models import ServiceContract
from services.services import ServiceContractService
from services.tasks import generate_provisions_task, check_overdue_obligations_task
from dateutil.relativedelta import relativedelta

class Command(BaseCommand):
    help = 'Simulates time passing by generating future obligations for active contracts'

    def add_arguments(self, parser):
        parser.add_argument('--months', type=int, default=1, help='Number of months to simulate')

    def handle(self, *args, **options):
        months = options['months']
        today = timezone.now().date()
        
        self.stdout.write(self.style.NOTICE(f"Simulating {months} months for active contracts..."))
        
        active_contracts = ServiceContract.objects.filter(status=ServiceContract.Status.ACTIVE)
        
        total_gen = 0
        for m in range(1, months + 1):
            sim_date = today + relativedelta(months=m)
            # We want to iterate day by day or just use a reference date for the logic?
            # The ServiceContractService.generate_next_obligation uses reference_date 
            # to check if something is due soon or if we should skip.
            
            month_gen = 0
            for contract in active_contracts:
                # We call it multiple times if needed, but for monthly recurrence one call per month is fine
                # This simple loop covers common cases.
                ob = ServiceContractService.generate_next_obligation(contract, reference_date=sim_date)
                if ob:
                    month_gen += 1
            
            total_gen += month_gen
            self.stdout.write(f"Month {m} ({sim_date.strftime('%Y-%m')}): {month_gen} obligations generated")
        
        self.stdout.write(self.style.SUCCESS(f"Total simulated: {total_gen} new obligations."))
        
        self.stdout.write(self.style.NOTICE("Running provision and overdue checks..."))
        # We run these synchronously if possible for immediate feedback in command, 
        # but since they are shared_tasks, calling them .delay() is standard.
        # For a management command, we can just call the service methods directly.
        from services.services import ServiceObligationService
        prov_count = generate_provisions_task()
        overdue_count = check_overdue_obligations_task()
        
        self.stdout.write(self.style.SUCCESS(f"Finished. {prov_count}, {overdue_count}"))
