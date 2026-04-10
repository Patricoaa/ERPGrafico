# Generated manually for FiscalYear model

import django.db.models.deletion
import simple_history.models
from django.conf import settings
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0003_initial'),
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FiscalYear',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.IntegerField(unique=True, verbose_name='Año Fiscal')),
                ('start_date', models.DateField(verbose_name='Fecha Inicio')),
                ('end_date', models.DateField(verbose_name='Fecha Fin')),
                ('status', models.CharField(choices=[('OPEN', 'Abierto'), ('CLOSING', 'En Proceso de Cierre'), ('CLOSED', 'Cerrado')], default='OPEN', max_length=20, verbose_name='Estado')),
                ('net_result', models.DecimalField(blank=True, decimal_places=0, help_text='Utilidad (+) o Pérdida (-) del ejercicio al momento del cierre.', max_digits=20, null=True, verbose_name='Resultado Neto')),
                ('closed_at', models.DateTimeField(blank=True, null=True, verbose_name='Cerrado el')),
                ('notes', models.TextField(blank=True, verbose_name='Notas')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('closed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='closed_fiscal_years', to='core.user', verbose_name='Cerrado por')),
                ('closing_entry', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fiscal_year_closing', to='accounting.journalentry', verbose_name='Asiento de Cierre')),
                ('opening_entry', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fiscal_year_opening', to='accounting.journalentry', verbose_name='Asiento de Apertura')),
            ],
            options={
                'verbose_name': 'Ejercicio Fiscal',
                'verbose_name_plural': 'Ejercicios Fiscales',
                'ordering': ['-year'],
                'permissions': [
                    ('can_close_fiscal_year', 'Puede cerrar ejercicio fiscal'),
                    ('can_reopen_fiscal_year', 'Puede reabrir ejercicio fiscal'),
                ],
            },
        ),
        migrations.CreateModel(
            name='HistoricalFiscalYear',
            fields=[
                ('id', models.IntegerField(auto_created=True, blank=True, db_index=True, verbose_name='ID')),
                ('year', models.IntegerField(db_index=True, verbose_name='Año Fiscal')),
                ('start_date', models.DateField(verbose_name='Fecha Inicio')),
                ('end_date', models.DateField(verbose_name='Fecha Fin')),
                ('status', models.CharField(choices=[('OPEN', 'Abierto'), ('CLOSING', 'En Proceso de Cierre'), ('CLOSED', 'Cerrado')], default='OPEN', max_length=20, verbose_name='Estado')),
                ('net_result', models.DecimalField(blank=True, decimal_places=0, help_text='Utilidad (+) o Pérdida (-) del ejercicio al momento del cierre.', max_digits=20, null=True, verbose_name='Resultado Neto')),
                ('closed_at', models.DateTimeField(blank=True, null=True, verbose_name='Cerrado el')),
                ('notes', models.TextField(blank=True, verbose_name='Notas')),
                ('created_at', models.DateTimeField(blank=True, editable=False)),
                ('updated_at', models.DateTimeField(blank=True, editable=False)),
                ('history_id', models.AutoField(primary_key=True, serialize=False)),
                ('history_date', models.DateTimeField(db_index=True)),
                ('history_change_reason', models.CharField(max_length=100, null=True)),
                ('history_type', models.CharField(choices=[('+', 'Created'), ('~', 'Changed'), ('-', 'Deleted')], max_length=1)),
                ('closed_by', models.ForeignKey(blank=True, db_constraint=False, null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name='+', to='core.user', verbose_name='Cerrado por')),
                ('closing_entry', models.ForeignKey(blank=True, db_constraint=False, null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name='+', to='accounting.journalentry', verbose_name='Asiento de Cierre')),
                ('opening_entry', models.ForeignKey(blank=True, db_constraint=False, null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name='+', to='accounting.journalentry', verbose_name='Asiento de Apertura')),
                ('history_user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'historical Ejercicio Fiscal',
                'verbose_name_plural': 'historical Ejercicios Fiscales',
                'ordering': ('-history_date', '-history_id'),
                'get_latest_by': ('history_date', 'history_id'),
            },
        ),
    ]
