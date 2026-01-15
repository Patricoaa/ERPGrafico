from django.core.management.base import BaseCommand
from inventory.models import Subscription

class Command(BaseCommand):
    help = 'Test Subscription Import'

    def handle(self, *args, **options):
        print("Subscription imported successfully:", Subscription)
