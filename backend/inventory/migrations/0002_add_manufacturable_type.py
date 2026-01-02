# Generated migration for inventory Product.Type

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),  # Adjust based on your last migration
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='product_type',
            field=models.CharField(
                choices=[
                    ('STORABLE', 'Almacenable'),
                    ('CONSUMABLE', 'Consumible'),
                    ('SERVICE', 'Servicio'),
                    ('MANUFACTURABLE', 'Fabricable')
                ],
                default='STORABLE',
                max_length=20,
                verbose_name='Tipo'
            ),
        ),
    ]
