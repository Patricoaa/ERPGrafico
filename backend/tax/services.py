from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from datetime import date
from .models import TaxPeriod, F29Declaration, F29Payment
from billing.models import Invoice
from accounting.models import JournalEntry, JournalItem, AccountingSettings
from accounting.services import JournalEntryService


class F29CalculationService:
    """
    Service for calculating F29 tax declaration values from invoice data.
    """

    @staticmethod
    def calculate_f29_for_period(year: int, month: int) -> dict:
        """
        Calculate all F29 values for a given period by querying invoices.
        
        Returns dict with:
        - sales_taxed, sales_exempt, debit_notes_taxed, credit_notes_taxed
        - purchases_taxed, purchases_exempt, purchase_debit_notes, purchase_credit_notes
        - net_taxed_sales, net_taxed_purchases
        - vat_debit, vat_credit
        """
        # Calculate date range for the period
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)
        
        # Query all posted invoices in the period
        invoices = Invoice.objects.filter(
            date__gte=start_date,
            date__lt=end_date,
            status=Invoice.Status.POSTED
        )
        
        # Initialize accumulators
        sales_taxed = Decimal('0')
        sales_exempt = Decimal('0')
        debit_notes_taxed = Decimal('0')
        credit_notes_taxed = Decimal('0')
        
        purchases_taxed = Decimal('0')
        purchases_exempt = Decimal('0')
        purchase_debit_notes = Decimal('0')
        purchase_credit_notes = Decimal('0')
        
        # Process each invoice
        for invoice in invoices:
            is_sale = invoice.sale_order_id is not None
            is_exempt = invoice.is_tax_exempt
            
            if is_sale:
                # Sales documents
                if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
                    # Credit notes reduce sales
                    if not is_exempt:
                        credit_notes_taxed += invoice.total_net
                elif invoice.dte_type == Invoice.DTEType.NOTA_DEBITO:
                    # Debit notes increase sales
                    if not is_exempt:
                        debit_notes_taxed += invoice.total_net
                else:
                    # Regular invoices/boletas
                    if is_exempt:
                        sales_exempt += invoice.total_net
                    else:
                        sales_taxed += invoice.total_net
            else:
                # Purchase documents
                if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
                    # Credit notes reduce purchases
                    if not is_exempt:
                        purchase_credit_notes += invoice.total_net
                elif invoice.dte_type == Invoice.DTEType.NOTA_DEBITO:
                    # Debit notes increase purchases
                    if not is_exempt:
                        purchase_debit_notes += invoice.total_net
                else:
                    # Regular purchase invoices
                    if is_exempt:
                        purchases_exempt += invoice.total_net
                    else:
                        purchases_taxed += invoice.total_net
        
        # Calculate net amounts
        net_taxed_sales = sales_taxed + debit_notes_taxed - credit_notes_taxed
        net_taxed_purchases = purchases_taxed + purchase_debit_notes - purchase_credit_notes
        
        # Get accounting settings for VAT rate
        settings = AccountingSettings.objects.first()
        tax_rate = settings.default_vat_rate if settings else Decimal('19.00')
        
        # Calculate VAT
        vat_debit = (net_taxed_sales * tax_rate / Decimal('100')).quantize(
            Decimal('1'), rounding='ROUND_HALF_UP'
        )
        vat_credit = (net_taxed_purchases * tax_rate / Decimal('100')).quantize(
            Decimal('1'), rounding='ROUND_HALF_UP'
        )
        
        return {
            'sales_taxed': sales_taxed,
            'sales_exempt': sales_exempt,
            'debit_notes_taxed': debit_notes_taxed,
            'credit_notes_taxed': credit_notes_taxed,
            'purchases_taxed': purchases_taxed,
            'purchases_exempt': purchases_exempt,
            'purchase_debit_notes': purchase_debit_notes,
            'purchase_credit_notes': purchase_credit_notes,
            'net_taxed_sales': net_taxed_sales,
            'net_taxed_purchases': net_taxed_purchases,
            'vat_debit': vat_debit,
            'vat_credit': vat_credit,
            'tax_rate': tax_rate,
        }

    @staticmethod
    @transaction.atomic
    def create_or_update_declaration(year: int, month: int, manual_fields: dict = None) -> F29Declaration:
        """
        Create or update F29 declaration for a period.
        
        Args:
            year: Year of the period
            month: Month of the period (1-12)
            manual_fields: Dict with manual fields (ppm_amount, withholding_tax, etc.)
        
        Returns:
            F29Declaration instance
        """
        # Get or create tax period
        tax_period, _ = TaxPeriod.objects.get_or_create(year=year, month=month)
        
        # Calculate automatic values
        calc_data = F29CalculationService.calculate_f29_for_period(year, month)
        
        # Prepare fields for declaration
        declaration_data = {
            'tax_period': tax_period,
            'sales_taxed': calc_data['sales_taxed'],
            'sales_exempt': calc_data['sales_exempt'],
            'debit_notes_taxed': calc_data['debit_notes_taxed'],
            'credit_notes_taxed': calc_data['credit_notes_taxed'],
            'purchases_taxed': calc_data['purchases_taxed'],
            'purchases_exempt': calc_data['purchases_exempt'],
            'purchase_debit_notes': calc_data['purchase_debit_notes'],
            'purchase_credit_notes': calc_data['purchase_credit_notes'],
        }
        
        # Apply manual fields if provided
        if manual_fields:
            for field in ['ppm_amount', 'withholding_tax', 'vat_credit_carryforward', 
                          'vat_correction_amount', 'second_category_tax', 'tax_rate', 'notes']:
                if field in manual_fields:
                    declaration_data[field] = manual_fields[field]
        
        # Auto-populate carryforward from previous period if not provided
        if 'vat_credit_carryforward' not in (manual_fields or {}):
            prev_month = month - 1 if month > 1 else 12
            prev_year = year if month > 1 else year - 1
            
            try:
                prev_declaration = F29Declaration.objects.get(
                    tax_period__year=prev_year,
                    tax_period__month=prev_month
                )
                declaration_data['vat_credit_carryforward'] = prev_declaration.vat_credit_balance
            except F29Declaration.DoesNotExist:
                pass
        
        # Get or create declaration
        declaration, _ = F29Declaration.objects.update_or_create(
            tax_period=tax_period,
            defaults=declaration_data
        )
        
        return declaration

    @staticmethod
    @transaction.atomic
    def register_declaration(declaration_id: int, folio_number: str = '', 
                           declaration_date: date = None) -> F29Declaration:
        """
        Officially register an F29 declaration and create accounting entry.
        
        Creates journal entry with:
        - Debit: IVA Débito Fiscal (closing)
        - Credit: IVA Crédito Fiscal (closing)
        - Debit/Credit: IVA por Pagar or IVA Remanente (result)
        """
        declaration = F29Declaration.objects.get(id=declaration_id)
        
        if declaration.is_registered:
            raise ValidationError("Esta declaración ya fue registrada.")
        
        if not declaration_date:
            declaration_date = timezone.now().date()
        
        # Get accounting settings
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("No se encontró configuración contable.")
        
        # Validate required accounts
        if not settings.default_tax_payable_account or not settings.default_tax_receivable_account:
            raise ValidationError("Faltan cuentas de IVA configuradas.")
        
        if not settings.vat_payable_account:
            raise ValidationError("Falta configurar cuenta IVA por Pagar en configuración contable.")
        
        # Create journal entry
        entry_desc = f"Declaración F29 - {declaration.tax_period.get_month_display()} {declaration.tax_period.year}"
        journal_entry = JournalEntryService.create_entry(
            date=declaration_date,
            description=entry_desc,
            reference=f"F29-{folio_number}" if folio_number else ""
        )
        
        items = []
        
        # Debit: Close IVA Débito Fiscal (sales tax collected)
        if declaration.vat_debit > 0:
            items.append({
                'account': settings.default_tax_payable_account,
                'debit': declaration.vat_debit,
                'credit': Decimal('0'),
                'label': 'Cierre IVA Débito Fiscal'
            })
        
        # Credit: Close IVA Crédito Fiscal (purchase tax paid)
        if declaration.vat_credit > 0:
            items.append({
                'account': settings.default_tax_receivable_account,
                'debit': Decimal('0'),
                'credit': declaration.vat_credit,
                'label': 'Cierre IVA Crédito Fiscal'
            })
        
        # Register result
        if declaration.vat_to_pay > 0:
            # We owe taxes (net)
            items.append({
                'account': settings.vat_payable_account,
                'debit': Decimal('0'),
                'credit': declaration.vat_to_pay,
                'label': 'Impuestos por Pagar al SII (F29)'
            })
        elif declaration.vat_credit_balance > 0:
            # We have credit balance (remanente)
            if not settings.vat_carryforward_account:
                raise ValidationError("Falta configurar cuenta IVA Remanente en configuración contable.")
            
            items.append({
                'account': settings.vat_carryforward_account,
                'debit': declaration.vat_credit_balance,
                'credit': Decimal('0'),
                'label': 'IVA Remanente a Favor'
            })
        
        # --- Other Taxes & Credits ---
        
        # 1. Update/Increase Asset via Monetary Correction
        if declaration.vat_correction_amount > 0:
            if not settings.correction_income_account:
                raise ValidationError("Falta configurar cuenta de Ingreso por Corrección Monetaria.")
            
            # Debit: Asset (Increase Remanente)
            items.append({
                'account': settings.vat_carryforward_account,
                'debit': declaration.vat_correction_amount,
                'credit': Decimal('0'),
                'label': 'Reajuste Remanente (Art. 31)'
            })
            # Credit: Income (Monetary Correction)
            items.append({
                'account': settings.correction_income_account,
                'debit': Decimal('0'),
                'credit': declaration.vat_correction_amount,
                'label': 'Ingreso por Corrección Monetaria'
            })

        # 2. Consume Asset (Carryforward + Correction)
        total_remanente_to_use = declaration.vat_credit_carryforward + declaration.vat_correction_amount
        if total_remanente_to_use > 0:
            if not settings.vat_carryforward_account:
                raise ValidationError("Falta configurar cuenta de IVA Remanente.")
            items.append({
                'account': settings.vat_carryforward_account,
                'debit': Decimal('0'),
                'credit': total_remanente_to_use,
                'label': 'Uso Remanente (Nominal + Reajuste)'
            })

        # 3. Close Other Tax Liabilities
        
        # Debit: Close Withholding Tax Liability
        if declaration.withholding_tax > 0:
            if not settings.withholding_tax_account:
                raise ValidationError("Falta configurar cuenta de Retenciones de Impuestos.")
            items.append({
                'account': settings.withholding_tax_account,
                'debit': declaration.withholding_tax,
                'credit': Decimal('0'),
                'label': 'Cierre Retenciones Honorarios'
            })

        # Debit: Close Second Category Tax Liability
        if declaration.second_category_tax > 0:
            if not settings.second_category_tax_account:
                raise ValidationError("Falta configurar cuenta de Impuesto Único 2da Categoría.")
            items.append({
                'account': settings.second_category_tax_account,
                'debit': declaration.second_category_tax,
                'credit': Decimal('0'),
                'label': 'Cierre Impuesto Único 2da Cat.'
            })

        # 4. Clear Other Credits
        
        # Credit: Clear PPM Asset
        if declaration.ppm_amount > 0:
            if not settings.ppm_account:
                raise ValidationError("Falta configurar cuenta de PPM por Recuperar.")
            items.append({
                'account': settings.ppm_account,
                'debit': Decimal('0'),
                'credit': declaration.ppm_amount,
                'label': 'Uso de PPM Acumulado'
            })
        
        # Add journal items
        for item_data in items:
            JournalItem.objects.create(
                entry=journal_entry,
                **item_data
            )
        
        # Post the entry
        journal_entry.state = JournalEntry.State.POSTED
        journal_entry.save()
        
        # Update declaration
        declaration.declaration_date = declaration_date
        declaration.folio_number = folio_number
        declaration.journal_entry = journal_entry
        declaration.save()
        
        return declaration


class TaxPeriodService:
    """
    Service for managing tax periods and their lifecycle.
    """

    @staticmethod
    def get_or_create_period(year: int, month: int) -> TaxPeriod:
        """Get or create a tax period."""
        period, _ = TaxPeriod.objects.get_or_create(year=year, month=month)
        return period

    @staticmethod
    @transaction.atomic
    def close_period(year: int, month: int, user) -> TaxPeriod:
        """
        Close a tax period after validations.
        
        Validations:
        - Must have a registered F29 declaration
        - Must not be already closed
        """
        period = TaxPeriod.objects.get(year=year, month=month)
        
        if period.status == TaxPeriod.Status.CLOSED:
            raise ValidationError("El período ya está cerrado.")
        
        # Validate that declaration exists and is registered
        try:
            declaration = F29Declaration.objects.get( tax_period=period)
            if not declaration.is_registered:
                raise ValidationError(
                    "Debe registrar la declaración F29 antes de cerrar el período."
                )
        except F29Declaration.DoesNotExist:
            raise ValidationError(
                "Debe crear y registrar una declaración F29 antes de cerrar el período."
            )
        
        # Close the period
        period.status = TaxPeriod.Status.CLOSED
        period.closed_at = timezone.now()
        period.closed_by = user
        period.save()
        
        # Signal will handle marking invoices as closed
        
        return period

    @staticmethod
    @transaction.atomic
    def reopen_period(year: int, month: int, user) -> TaxPeriod:
        """
        Reopen a closed tax period.
        
        This should be restricted to users with special permissions.
        """
        period = TaxPeriod.objects.get(year=year, month=month)
        
        if period.status != TaxPeriod.Status.CLOSED:
            raise ValidationError("El período no está cerrado.")
        
        # Reopen the period
        period.status = TaxPeriod.Status.OPEN
        period.closed_at = None
        period.closed_by = None
        period.save()
        
        # Signal will handle unmarking invoices
        
        return period

    @staticmethod
    def get_period_status(year: int, month: int) -> dict:
        """
        Get status and checklist for a tax period.
        
        Returns:
            dict with status info and checklist items
        """
        try:
            period = TaxPeriod.objects.get(year=year, month=month)
        except TaxPeriod.DoesNotExist:
            period = None
        
        # Get declaration if exists
        declaration = None
        if period:
            try:
                declaration = F29Declaration.objects.get(tax_period=period)
            except F29Declaration.DoesNotExist:
                pass
        
        # Build checklist
        checklist = {
            'has_declaration': declaration is not None,
            'declaration_registered': declaration.is_registered if declaration else False,
            'has_payment': False,
            'period_status': period.status if period else 'NOT_CREATED',
        }
        
        # Check if taxes are paid (if owed)
        if declaration and declaration.vat_to_pay > 0:
            total_paid = sum(p.amount for p in declaration.payments.all())
            checklist['has_payment'] = total_paid >= declaration.vat_to_pay
        else:
            checklist['has_payment'] = True  # No payment needed
        
        return checklist


class F29PaymentService:
    """
    Service for managing F29 tax payments.
    """

    @staticmethod
    @transaction.atomic
    def register_payment(declaration_id: int, payment_data: dict, user=None):
        """
        Register a tax payment.
        
        Args:
            declaration_id: ID of F29 declaration
            payment_data: Dict with payment_date, amount, payment_method, 
                         treasury_account_id, reference, notes
        
        Returns:
            F29Payment instance
        """
        from treasury.services import TreasuryService
        
        declaration = F29Declaration.objects.get(id=declaration_id)
        
        if not declaration.is_registered:
            raise ValidationError("La declaración debe estar registrada antes de registrar pagos.")
        
        if declaration.vat_to_pay <= 0:
            raise ValidationError("Esta declaración no tiene monto a pagar.")
        
        # Get accounting settings
        settings = AccountingSettings.objects.first()
        if not settings or not settings.vat_payable_account:
            raise ValidationError("Falta configurar cuenta IVA por Pagar.")
        
        # Create payment record
        payment = F29Payment.objects.create(
            declaration=declaration,
            payment_date=payment_data.get('payment_date', timezone.now().date()),
            amount=payment_data['amount'],
            payment_method=payment_data.get('payment_method', F29Payment.PaymentMethod.TRANSFER),
            reference=payment_data.get('reference', ''),
            treasury_account_id=payment_data['treasury_account_id'],
            notes=payment_data.get('notes', '')
        )
        
        # Create treasury movement (outflow)
        treasury_movement = TreasuryService.create_movement(
            account_id=payment_data['treasury_account_id'],
            movement_type='OUTFLOW',
            amount=payment_data['amount'],
            date=payment.payment_date,
            description=f"Pago F29 {declaration.tax_period}",
            reference=payment_data.get('reference', ''),
            user=user
        )
        
        # Create journal entry for payment
        entry_desc = f"Pago F29 - {declaration.tax_period.get_month_display()} {declaration.tax_period.year}"
        journal_entry = JournalEntryService.create_entry(
            date=payment.payment_date,
            description=entry_desc,
            reference=f"Pago-{payment.reference}"
        )
        
        # Debit: IVA por Pagar (reduce liability)
        JournalItem.objects.create(
            entry=journal_entry,
            account=settings.vat_payable_account,
            debit=payment.amount,
            credit=Decimal('0'),
            label='Pago IVA al SII'
        )
        
        # Credit: Treasury Account (cash out)
        treasury_account_obj = payment.treasury_account.account
        JournalItem.objects.create(
            entry=journal_entry,
            account=treasury_account_obj,
            debit=Decimal('0'),
            credit=payment.amount,
            label=f'Pago desde {payment.treasury_account.name}'
        )
        
        # Post the entry
        journal_entry.state = JournalEntry.State.POSTED
        journal_entry.save()
        
        # Link journal entry to payment
        payment.journal_entry = journal_entry
        payment.save()
        
        return payment
