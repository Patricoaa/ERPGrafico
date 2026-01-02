# Generated migration for production models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0001_initial'),  # Adjust based on your last migration
        ('inventory', '0001_initial'),
        ('sales', '0001_initial'),
    ]

    operations = [
        # Add DRAFT status to WorkOrder.Status choices
        migrations.AlterField(
            model_name='workorder',
            name='status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Borrador'),
                    ('PLANNED', 'Planificada'),
                    ('IN_PROGRESS', 'En Proceso'),
                    ('FINISHED', 'Terminada'),
                    ('CANCELLED', 'Anulada')
                ],
                default='DRAFT',
                max_length=20,
                verbose_name='Estado'
            ),
        ),
        
        # Add sale_line FK to WorkOrder
        migrations.AddField(
            model_name='workorder',
            name='sale_line',
            field=models.ForeignKey(
                blank=True,
                help_text='Línea de venta asociada',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='work_orders',
                to='sales.saleline'
            ),
        ),
        
        # Remove qty_planned and qty_produced
        migrations.RemoveField(
            model_name='workorder',
            name='qty_planned',
        ),
        migrations.RemoveField(
            model_name='workorder',
            name='qty_produced',
        ),
        
        # Remove start_date
        migrations.RemoveField(
            model_name='workorder',
            name='start_date',
        ),
        
        # Rename due_date to estimated_completion_date
        migrations.RenameField(
            model_name='workorder',
            old_name='due_date',
            new_name='estimated_completion_date',
        ),
        
        # Create BillOfMaterials model
        migrations.CreateModel(
            name='BillOfMaterials',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Ej: BOM Camiseta Roja v1', max_length=255, verbose_name='Nombre')),
                ('active', models.BooleanField(default=True, help_text='Solo puede haber un BOM activo por producto', verbose_name='Activo')),
                ('notes', models.TextField(blank=True, verbose_name='Notas')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('product', models.ForeignKey(
                    help_text='Producto fabricable',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='boms',
                    to='inventory.product'
                )),
            ],
            options={
                'verbose_name': 'Lista de Materiales (BOM)',
                'verbose_name_plural': 'Listas de Materiales (BOMs)',
                'ordering': ['-active', '-created_at'],
            },
        ),
        
        # Create BillOfMaterialsLine model
        migrations.CreateModel(
            name='BillOfMaterialsLine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.DecimalField(decimal_places=4, help_text='Cantidad necesaria por unidad producida', max_digits=12, verbose_name='Cantidad')),
                ('unit', models.CharField(default='UN', max_length=20, verbose_name='Unidad')),
                ('notes', models.TextField(blank=True, verbose_name='Notas')),
                ('sequence', models.IntegerField(default=10, help_text='Orden de visualización', verbose_name='Secuencia')),
                ('bom', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='production.billofmaterials')),
                ('component', models.ForeignKey(
                    help_text='Producto componente/material',
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='used_in_boms',
                    to='inventory.product'
                )),
            ],
            options={
                'verbose_name': 'Línea de BOM',
                'verbose_name_plural': 'Líneas de BOM',
                'ordering': ['sequence', 'id'],
            },
        ),
        
        # Add unique constraint
        migrations.AlterUniqueTogether(
            name='billofmaterialsline',
            unique_together={('bom', 'component')},
        ),
    ]
