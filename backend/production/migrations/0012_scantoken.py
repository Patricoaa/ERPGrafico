from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0011_workordertemplate'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScanToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('work_order', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='scan_tokens',
                    to='production.workorder',
                )),
            ],
            options={
                'verbose_name': 'Token de Escaneo',
                'verbose_name_plural': 'Tokens de Escaneo',
            },
        ),
    ]
