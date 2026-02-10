# Generated manually for SII codes extension

from django.db import migrations, models


def assign_sii_codes_forward(apps, schema_editor):
    """Asignar códigos SII a documentos existentes"""
    Invoice = apps.get_model('billing', 'Invoice')
    
    mapping = {
        'FACTURA': 33,
        'BOLETA': 39,
        'NOTA_DEBITO': 56,
        'NOTA_CREDITO': 61,
        'PURCHASE_INV': 33,  # Asumimos factura afecta
    }
    
    for dte_type, code in mapping.items():
        Invoice.objects.filter(
            dte_type=dte_type,
            sii_document_code__isnull=True
        ).update(sii_document_code=code)


def assign_sii_codes_backward(apps, schema_editor):
    """Revertir asignación de códigos SII"""
    Invoice = apps.get_model('billing', 'Invoice')
    Invoice.objects.all().update(sii_document_code=None)


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0013_noteworkflow'),
    ]

    operations = [
        # Extend dte_type max_length for new values
        migrations.AlterField(
            model_name='invoice',
            name='dte_type',
            field=models.CharField(
                choices=[
                    ('FACTURA', 'Factura Electrónica'),
                    ('FACTURA_EXENTA', 'Factura No Afecta o Exenta'),
                    ('BOLETA', 'Boleta Electrónica'),
                    ('BOLETA_EXENTA', 'Boleta No Afecta o Exenta'),
                    ('PURCHASE_INV', 'Factura de Compra'),
                    ('NOTA_CREDITO', 'Nota de Crédito'),
                    ('NOTA_DEBITO', 'Nota de Débito')
                ],
                max_length=25,
                verbose_name='Tipo DTE'
            ),
        ),
        # Add sii_document_code field
        migrations.AddField(
            model_name='invoice',
            name='sii_document_code',
            field=models.IntegerField(
                blank=True,
                choices=[
                    (33, 'Factura Electrónica'),
                    (34, 'Factura Exenta'),
                    (39, 'Boleta Electrónica'),
                    (41, 'Boleta Exenta'),
                    (56, 'Nota de Débito'),
                    (61, 'Nota de Crédito')
                ],
                help_text='Código oficial del tipo de DTE según SII de Chile',
                null=True,
                verbose_name='Código SII'
            ),
        ),
        # Assign SII codes to existing documents
        migrations.RunPython(
            assign_sii_codes_forward,
            assign_sii_codes_backward
        ),
        # Update historical model
        migrations.AlterField(
            model_name='historicalinvoice',
            name='dte_type',
            field=models.CharField(
                choices=[
                    ('FACTURA', 'Factura Electrónica'),
                    ('FACTURA_EXENTA', 'Factura No Afecta o Exenta'),
                    ('BOLETA', 'Boleta Electrónica'),
                    ('BOLETA_EXENTA', 'Boleta No Afecta o Exenta'),
                    ('PURCHASE_INV', 'Factura de Compra'),
                    ('NOTA_CREDITO', 'Nota de Crédito'),
                    ('NOTA_DEBITO', 'Nota de Débito')
                ],
                max_length=25,
                verbose_name='Tipo DTE'
            ),
        ),
        migrations.AddField(
            model_name='historicalinvoice',
            name='sii_document_code',
            field=models.IntegerField(
                blank=True,
                choices=[
                    (33, 'Factura Electrónica'),
                    (34, 'Factura Exenta'),
                    (39, 'Boleta Electrónica'),
                    (41, 'Boleta Exenta'),
                    (56, 'Nota de Débito'),
                    (61, 'Nota de Crédito')
                ],
                help_text='Código oficial del tipo de DTE según SII de Chile',
                null=True,
                verbose_name='Código SII'
            ),
        ),
    ]
