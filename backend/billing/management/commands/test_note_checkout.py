from django.core.management.base import BaseCommand
from billing.test_note_manual import test_complete_workflow


class Command(BaseCommand):
    help = 'Test NoteCheckoutService functionality'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Running Note Checkout Service tests...\n'))
        
        success = test_complete_workflow()
        
        if success:
            self.stdout.write(self.style.SUCCESS('\nTests completed successfully!'))
        else:
            self.stdout.write(self.style.ERROR('\nTests failed!'))
