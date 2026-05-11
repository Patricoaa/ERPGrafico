"""
T-13: Migrate JournalEntry to AuditedModel abstract base.

No schema changes: created_at/updated_at definitions are identical to
TimeStampedModel's; simple_history manages its own table separately.
JournalEntry does NOT inherit TransactionalDocument because it has no
total_net/total_tax/total fields — those belong to JournalItem.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0009_accountingsettings_auto_post_reconciliation_adjustments'),
    ]

    operations = [
    ]
