"""
Migration 0028 — S5.1 PaymentAllocation (Gap B13)

Creates table treasury_paymentallocation and its HistoricalRecords counterpart.
Backfill: each TreasuryMovement that already has a direct FK to invoice,
sale_order, or purchase_order gets 1 corresponding PaymentAllocation row.
"""

from decimal import Decimal
import django.core.validators
import django.db.models.deletion
import simple_history.models
from django.conf import settings
from django.db import migrations, models


def backfill_allocations(apps, schema_editor):
    """
    Create 1 PaymentAllocation per existing movement that has a direct
    invoice / sale_order / purchase_order FK. Uses get_or_create to be
    idempotent in case migration is rolled-forward twice (unlikely, but safe).
    """
    TreasuryMovement = apps.get_model('treasury', 'TreasuryMovement')
    PaymentAllocation = apps.get_model('treasury', 'PaymentAllocation')
    Q = django.db.models.Q

    qs = TreasuryMovement.objects.filter(
        Q(invoice__isnull=False)
        | Q(sale_order__isnull=False)
        | Q(purchase_order__isnull=False)
    ).only('id', 'amount', 'invoice_id', 'sale_order_id', 'purchase_order_id')

    to_create = []
    for movement in qs.iterator(chunk_size=500):
        if movement.invoice_id:
            to_create.append(PaymentAllocation(
                treasury_movement_id=movement.id,
                invoice_id=movement.invoice_id,
                amount=movement.amount,
                notes='Migrado automáticamente (1 allocation por pago legacy)',
            ))
        elif movement.sale_order_id:
            to_create.append(PaymentAllocation(
                treasury_movement_id=movement.id,
                sale_order_id=movement.sale_order_id,
                amount=movement.amount,
                notes='Migrado automáticamente (1 allocation por pago legacy)',
            ))
        elif movement.purchase_order_id:
            to_create.append(PaymentAllocation(
                treasury_movement_id=movement.id,
                purchase_order_id=movement.purchase_order_id,
                amount=movement.amount,
                notes='Migrado automáticamente (1 allocation por pago legacy)',
            ))

    if to_create:
        PaymentAllocation.objects.bulk_create(to_create, ignore_conflicts=True)


def reverse_backfill(apps, schema_editor):
    """Remove all auto-migrated allocations (those with the auto-note)."""
    PaymentAllocation = apps.get_model('treasury', 'PaymentAllocation')
    PaymentAllocation.objects.filter(
        notes='Migrado automáticamente (1 allocation por pago legacy)'
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
        ('purchasing', '0001_initial'),
        ('sales', '0001_initial'),
        ('treasury', '0027_historicaltreasuryaccount_default_bank_format_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Schema ────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='PaymentAllocation',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(
                    decimal_places=2,
                    max_digits=14,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
                    verbose_name='Monto Asignado',
                )),
                ('notes', models.TextField(blank=True, verbose_name='Notas')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('treasury_movement', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='allocations',
                    to='treasury.treasurymovement',
                    verbose_name='Movimiento de Tesorería',
                )),
                ('invoice', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='payment_allocations',
                    to='billing.invoice',
                    verbose_name='Factura',
                )),
                ('sale_order', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='payment_allocations',
                    to='sales.saleorder',
                    verbose_name='Orden de Venta',
                )),
                ('purchase_order', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='payment_allocations',
                    to='purchasing.purchaseorder',
                    verbose_name='Orden de Compra',
                )),
                ('bank_statement_line', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='payment_allocations',
                    to='treasury.bankstatementline',
                    verbose_name='Línea de Cartola',
                )),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_allocations',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Creado Por',
                )),
            ],
            options={
                'verbose_name': 'Distribución de Pago',
                'verbose_name_plural': 'Distribuciones de Pago',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='paymentallocation',
            index=models.Index(fields=['treasury_movement'], name='idx_palloc_movement'),
        ),
        migrations.AddIndex(
            model_name='paymentallocation',
            index=models.Index(fields=['invoice'], name='idx_palloc_invoice'),
        ),
        # ── HistoricalRecords (simple-history) ─────────────────────────────
        migrations.CreateModel(
            name='HistoricalPaymentAllocation',
            fields=[
                ('id', models.IntegerField(blank=True, db_index=True)),
                ('amount', models.DecimalField(
                    decimal_places=2,
                    max_digits=14,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
                    verbose_name='Monto Asignado',
                )),
                ('notes', models.TextField(blank=True, verbose_name='Notas')),
                ('created_at', models.DateTimeField(blank=True, editable=False)),
                ('history_id', models.AutoField(primary_key=True, serialize=False)),
                ('history_date', models.DateTimeField(db_index=True)),
                ('history_change_reason', models.CharField(max_length=100, null=True)),
                ('history_type', models.CharField(
                    choices=[('+', 'Created'), ('~', 'Changed'), ('-', 'Deleted')],
                    max_length=1,
                )),
                ('history_user', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('treasury_movement', models.ForeignKey(
                    blank=True, null=True,
                    db_constraint=False,
                    on_delete=django.db.models.deletion.DO_NOTHING,
                    related_name='+',
                    to='treasury.treasurymovement',
                )),
                ('invoice', models.ForeignKey(
                    blank=True, null=True,
                    db_constraint=False,
                    on_delete=django.db.models.deletion.DO_NOTHING,
                    related_name='+',
                    to='billing.invoice',
                )),
                ('sale_order', models.ForeignKey(
                    blank=True, null=True,
                    db_constraint=False,
                    on_delete=django.db.models.deletion.DO_NOTHING,
                    related_name='+',
                    to='sales.saleorder',
                )),
                ('purchase_order', models.ForeignKey(
                    blank=True, null=True,
                    db_constraint=False,
                    on_delete=django.db.models.deletion.DO_NOTHING,
                    related_name='+',
                    to='purchasing.purchaseorder',
                )),
                ('bank_statement_line', models.ForeignKey(
                    blank=True, null=True,
                    db_constraint=False,
                    on_delete=django.db.models.deletion.DO_NOTHING,
                    related_name='+',
                    to='treasury.bankstatementline',
                )),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    db_constraint=False,
                    on_delete=django.db.models.deletion.DO_NOTHING,
                    related_name='+',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'historical Distribución de Pago',
                'verbose_name_plural': 'historical Distribuciones de Pago',
                'ordering': ['-history_date', '-history_id'],
                'get_latest_by': ('history_date', 'history_id'),
            },
            bases=(simple_history.models.HistoricalChanges, models.Model),
        ),
        # ── Data backfill ─────────────────────────────────────────────────────
        migrations.RunPython(backfill_allocations, reverse_code=reverse_backfill),
    ]
