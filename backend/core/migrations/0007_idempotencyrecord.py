from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_add_user_theme'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='IdempotencyRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(help_text='UUID generado por el cliente en el handler que origina la acción.', max_length=64, verbose_name='Clave')),
                ('scope', models.CharField(help_text="Identificador del endpoint, e.g. 'billing.invoice.create'.", max_length=128, verbose_name='Scope')),
                ('body_hash', models.CharField(help_text='SHA-256 hex del request body — detecta reuso del key con payload distinto.', max_length=64, verbose_name='Hash del body')),
                ('response_status', models.IntegerField(blank=True, null=True, verbose_name='HTTP status cacheado')),
                ('response_payload', models.JSONField(blank=True, null=True, verbose_name='Payload cacheado')),
                ('status', models.CharField(choices=[('pending', 'En proceso'), ('done', 'Completado'), ('error', 'Error')], default='pending', max_length=16, verbose_name='Estado')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Creado el')),
                ('user', models.ForeignKey(on_delete=models.deletion.PROTECT, related_name='idempotency_records', to=settings.AUTH_USER_MODEL, verbose_name='Usuario')),
            ],
            options={
                'verbose_name': 'Registro de Idempotencia',
                'verbose_name_plural': 'Registros de Idempotencia',
            },
        ),
        migrations.AddConstraint(
            model_name='idempotencyrecord',
            constraint=models.UniqueConstraint(fields=('key', 'scope'), name='uniq_idempotency_key_scope'),
        ),
        migrations.AddIndex(
            model_name='idempotencyrecord',
            index=models.Index(fields=['created_at'], name='idx_idempotency_created'),
        ),
    ]
