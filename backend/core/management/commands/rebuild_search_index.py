from django.core.management.base import BaseCommand
from core.registry import UniversalRegistry
from core.models import GlobalSearchIndex
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Rebuilds the global search index by re-indexing all registered entities.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear the index before rebuilding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write(self.style.WARNING("Clearing existing index..."))
            GlobalSearchIndex.objects.all().delete()

        entities = UniversalRegistry._entities
        self.stdout.write(f"Found {len(entities)} registered entities to index.")

        for label, entity in entities.items():
            self.stdout.write(f"Indexing {label}...")
            count = 0
            for instance in entity.model.objects.all():
                try:
                    UniversalRegistry.update_index(instance)
                    count += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  Error indexing {label} #{instance.pk}: {e}"))
            
            self.stdout.write(self.style.SUCCESS(f"  Successfully indexed {count} items for {label}."))

        self.stdout.write(self.style.SUCCESS("Global Search Index rebuild complete!"))
