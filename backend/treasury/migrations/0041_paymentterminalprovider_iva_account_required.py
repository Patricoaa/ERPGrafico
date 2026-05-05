from django.db import migrations, models
import django.db.models.deletion


def backfill_iva_account(apps, schema_editor):
    """Populate any null commission_iva_account using the global terminal IVA bridge
    account from AccountingSettings as a one-time migration default. Providers must
    review and update this to their per-provider IVA account afterwards."""
    PaymentTerminalProvider = apps.get_model('treasury', 'PaymentTerminalProvider')
    AccountingSettings = apps.get_model('accounting', 'AccountingSettings')

    settings = AccountingSettings.objects.first()
    fallback = getattr(settings, 'terminal_iva_bridge_account', None) if settings else None

    nulls = PaymentTerminalProvider.objects.filter(commission_iva_account__isnull=True)
    if nulls.exists() and fallback is None:
        raise RuntimeError(
            "Hay PaymentTerminalProvider con commission_iva_account=NULL y no existe "
            "AccountingSettings.terminal_iva_bridge_account para usar como respaldo. "
            "Asigne una cuenta IVA a cada proveedor antes de aplicar la migración."
        )
    nulls.update(commission_iva_account=fallback)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('treasury', '0040_posterminal_taxonomy_update'),
        ('accounting', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill_iva_account, noop_reverse),
        migrations.AlterField(
            model_name='paymentterminalprovider',
            name='commission_iva_account',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='terminal_provider_iva',
                to='accounting.account',
                verbose_name='Cuenta IVA Comisión',
            ),
        ),
        migrations.AlterField(
            model_name='historicalpaymentterminalprovider',
            name='commission_iva_account',
            field=models.ForeignKey(
                blank=True, db_constraint=False, null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='accounting.account',
                verbose_name='Cuenta IVA Comisión',
            ),
        ),
    ]
