from django.db import migrations, models
import django.db.models.deletion


def copy_hr_account_fields(apps, schema_editor):
    AccountingSettings = apps.get_model('accounting', 'AccountingSettings')
    GlobalHRSettings = apps.get_model('hr', 'GlobalHRSettings')
    try:
        hr = GlobalHRSettings.objects.get(pk=1)
        acct, _ = AccountingSettings.objects.get_or_create(pk=1)
        changed = False
        if hr.account_remuneraciones_por_pagar_id and not acct.account_remuneraciones_por_pagar_id:
            acct.account_remuneraciones_por_pagar_id = hr.account_remuneraciones_por_pagar_id
            changed = True
        if hr.account_previred_por_pagar_id and not acct.account_previred_por_pagar_id:
            acct.account_previred_por_pagar_id = hr.account_previred_por_pagar_id
            changed = True
        if hr.account_anticipos_id and not acct.account_anticipos_id:
            acct.account_anticipos_id = hr.account_anticipos_id
            changed = True
        if changed:
            acct.save()
    except GlobalHRSettings.DoesNotExist:
        pass


def reverse_copy(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0026_remove_accountingsettings_default_inventory_account'),
    ]

    operations = [
        migrations.AddField(
            model_name='accountingsettings',
            name='account_anticipos',
            field=models.ForeignKey(blank=True, help_text='Cuenta de activo para registrar adelantos a trabajadores.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings_hr_anticipos', to='accounting.account', verbose_name='Cuenta Anticipos de Remuneraciones'),
        ),
        migrations.AddField(
            model_name='accountingsettings',
            name='account_previred_por_pagar',
            field=models.ForeignKey(blank=True, help_text='Pasivo consolidado para pagos a instituciones previsionales.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings_hr_previred_por_pagar', to='accounting.account', verbose_name='Cuenta Obligaciones Previred por Pagar'),
        ),
        migrations.AddField(
            model_name='accountingsettings',
            name='account_remuneraciones_por_pagar',
            field=models.ForeignKey(blank=True, help_text='Pasivo con el trabajador por su sueldo líquido.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings_hr_rem_por_pagar', to='accounting.account', verbose_name='Cuenta Remuneraciones por Pagar'),
        ),
        migrations.RunPython(copy_hr_account_fields, reverse_copy),
    ]
