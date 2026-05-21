from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0007_fts_gin_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='price_inheritance_mode',
            field=models.CharField(
                choices=[
                    ('INHERIT', 'Heredar del template'),
                    ('OVERRIDE', 'Precio propio'),
                    ('SURCHARGE', 'Precio template + sobrecargo'),
                ],
                default='INHERIT',
                help_text='Solo aplica para variantes. Determina cómo se resuelve el precio de venta.',
                max_length=10,
                verbose_name='Modo de precio',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='price_surcharge',
            field=models.DecimalField(
                blank=True,
                decimal_places=0,
                help_text='Monto adicional (neto) sobre el precio del template. Solo aplica cuando el modo es SURCHARGE.',
                max_digits=12,
                null=True,
                verbose_name='Sobrecargo sobre precio template',
            ),
        ),
        migrations.AddField(
            model_name='historicalproduct',
            name='price_inheritance_mode',
            field=models.CharField(
                choices=[
                    ('INHERIT', 'Heredar del template'),
                    ('OVERRIDE', 'Precio propio'),
                    ('SURCHARGE', 'Precio template + sobrecargo'),
                ],
                default='INHERIT',
                help_text='Solo aplica para variantes. Determina cómo se resuelve el precio de venta.',
                max_length=10,
                verbose_name='Modo de precio',
            ),
        ),
        migrations.AddField(
            model_name='historicalproduct',
            name='price_surcharge',
            field=models.DecimalField(
                blank=True,
                decimal_places=0,
                help_text='Monto adicional (neto) sobre el precio del template. Solo aplica cuando el modo es SURCHARGE.',
                max_digits=12,
                null=True,
                verbose_name='Sobrecargo sobre precio template',
            ),
        ),
    ]
