from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contacts', '0001_initial'),
        ('production', '0010_stage_data_versioning'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkOrderTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Nombre de la plantilla')),
                ('default_data', models.JSONField(blank=True, default=dict, verbose_name='Datos predeterminados')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='work_order_templates',
                    to='contacts.contact',
                    verbose_name='Cliente',
                )),
            ],
            options={
                'verbose_name': 'Plantilla de OT',
                'verbose_name_plural': 'Plantillas de OT',
                'ordering': ['name'],
            },
        ),
    ]
