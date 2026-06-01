from django.db import migrations
from django.db import connection
import logging

logger = logging.getLogger(__name__)

def populate_search_index(apps, schema_editor):
    """
    Data migration to automatically populate the GlobalSearchIndex 
    when this migration is applied.
    """
    try:
        from core.registry import UniversalRegistry
        
        # We need to make sure entities are registered. 
        entities = UniversalRegistry._entities
        if not entities:
            logger.warning("No entities found in UniversalRegistry during migration. Skipping population.")
            return

        # Get existing tables to avoid errors on fresh installs
        existing_tables = connection.introspection.table_names()
        count = 0
        
        for label, entity in entities.items():
            # Check if the model's table exists in the current DB state
            if entity.model._meta.db_table not in existing_tables:
                logger.debug(f"Skipping indexing for {label} as table {entity.model._meta.db_table} does not exist yet.")
                continue
                
            try:
                from django.db import transaction
                with transaction.atomic():
                    for instance in entity.model.objects.all():
                        try:
                            UniversalRegistry.update_index(instance)
                            count += 1
                        except Exception as e:
                            # Log but continue with next record
                            pass
            except Exception as e:
                logger.error(f"Error querying {label} during migration: {e}")
        
        logger.info(f"Successfully auto-populated {count} items into GlobalSearchIndex.")
    except Exception as e:
        logger.error(f"Failed to auto-populate search index during migration: {e}")

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_globalsearchindex'),
    ]

    operations = [
        migrations.RunPython(populate_search_index, reverse_code=migrations.RunPython.noop),
    ]
