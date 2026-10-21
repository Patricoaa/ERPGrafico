# Generated migration for Phase 1: Add is_active to CreditLine and db_index to other models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("treasury", "0094_remove_treasurymovement_allocated_gfk"),
    ]

    operations = [
        # CreditLine: add is_active BooleanField (gap from ARCHIVO_KNOWN_GAPS)
        migrations.AddField(
            model_name="creditline",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar la línea de crédito; los movimientos históricos la siguen referenciando.",
                verbose_name="Activa",
            ),
        ),
        # Bank: add db_index=True to existing is_active
        migrations.AlterField(
            model_name="bank",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar el banco; los movimientos históricos lo siguen referenciando.",
                verbose_name="Activo",
            ),
        ),
        # PaymentMethod: add db_index=True to existing is_active
        migrations.AlterField(
            model_name="paymentmethod",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar el método de pago; los movimientos históricos lo siguen referenciando.",
                verbose_name="Activo",
            ),
        ),
        # PaymentTerminalProvider: add db_index=True to existing is_active
        migrations.AlterField(
            model_name="paymentterminalprovider",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar el proveedor de terminal; los terminales históricos lo siguen referenciando.",
                verbose_name="Activo",
            ),
        ),
        # POSTerminal: add db_index=True to existing is_active
        migrations.AlterField(
            model_name="posterminal",
            name="is_active",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Desactivar para archivar el terminal POS; las sesiones históricas lo siguen referenciando.",
                verbose_name="Activo",
            ),
        ),
    ]