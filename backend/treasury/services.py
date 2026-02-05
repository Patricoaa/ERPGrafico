from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Payment, CashMovement, TreasuryAccount, POSSession
from accounting.models import JournalEntry, JournalItem, Account, AccountType, AccountingSettings
from accounting.services import JournalEntryService
from decimal import Decimal

class TreasuryService:
    @staticmethod
    @transaction.atomic
    def create_cash_movement(movement_type, amount, created_by, from_account=None, to_account=None, 
                             pos_session=None, notes='', justify_reason='UNKNOWN', 
                             date=None, journal_entry_desc=None):
        """
        Creates a CashMovement record and its corresponding Journal Entry.
        """
        if amount < 0:
            raise ValidationError("El monto no puede ser negativo.")
        
        if not date:
            date = timezone.now()

        # 1. Create the Movement record
        movement = CashMovement.objects.create(
            movement_type=movement_type,
            amount=amount,
            from_account=from_account,
            to_account=to_account,
            pos_session=pos_session,
            created_by=created_by,
            notes=notes,
            date=date
        )

        # 2. Accounting Logic
        settings = AccountingSettings.objects.first()
        if not settings:
             # If no settings, we can't do accounting reliably. 
             # For some movements (like internal transfers between non-accounting containers if they existed), we might skip.
             # But here all TreasuryAccounts should have an Account.
             return movement

        from_acc = from_account.account if from_account else None
        to_acc = to_account.account if to_account else None

        # Determine Journal Entry Description
        if not journal_entry_desc:
            type_display = dict(CashMovement.Type.choices).get(movement_type, movement_type)
            journal_entry_desc = f"{type_display}: {notes}" if notes else type_display

        # Only create entry if we have at least one side with an accounting account
        # or if it's a specific type that requires it (e.g. Adjustments)
        if from_acc or to_acc:
            entry = JournalEntry.objects.create(
                date=date.date(),
                description=journal_entry_desc,
                reference=f"MOVE-{movement.id}",
                state=JournalEntry.State.DRAFT
            )

            # Case A: Transfer between two accounting accounts
            if from_acc and to_acc:
                JournalItem.objects.create(entry=entry, account=from_acc, debit=0, credit=amount)
                JournalItem.objects.create(entry=entry, account=to_acc, debit=amount, credit=0)
            
            # Case B: Withdrawal/Outflow (Money leaves an account to 'Exterior' or specific reason)
            elif from_acc and not to_acc:
                # Determine target account based on justify_reason
                target_account = (
                    (settings.pos_theft_account if justify_reason == 'THEFT' else None) or
                    (settings.pos_partner_withdrawal_account if justify_reason == 'PARTNER_WITHDRAWAL' else None) or
                    (settings.pos_rounding_adjustment_account if justify_reason == 'ROUNDING' else None) or
                    (settings.pos_counting_error_account if justify_reason == 'COUNTING_ERROR' else None) or
                    (settings.pos_cashback_error_account if justify_reason == 'CASHBACK' else None) or
                    (settings.pos_system_error_account if justify_reason == 'SYSTEM_ERROR' else None) or
                    settings.pos_cash_difference_loss_account
                )
                JournalItem.objects.create(entry=entry, account=from_acc, debit=0, credit=amount)
                JournalItem.objects.create(entry=entry, account=target_account, debit=amount, credit=0)

            # Case C: Deposit/Inflow (Money enters an account from 'Exterior' or specific reason)
            elif to_acc and not from_acc:
                # Determine source account based on justify_reason
                source_account = (
                    (settings.pos_tip_account if justify_reason == 'TIP' else None) or
                    (settings.pos_rounding_adjustment_account if justify_reason == 'ROUNDING' else None) or
                    (settings.pos_counting_error_account if justify_reason == 'COUNTING_ERROR' else None) or
                    (settings.pos_system_error_account if justify_reason == 'SYSTEM_ERROR' else None) or
                    settings.pos_cash_difference_gain_account
                )
                JournalItem.objects.create(entry=entry, account=source_account, debit=0, credit=amount)
                JournalItem.objects.create(entry=entry, account=to_acc, debit=amount, credit=0)

            JournalEntryService.post_entry(entry)
            movement.journal_entry = entry
            movement.save()

        return movement

    @staticmethod
    @transaction.atomic
    def register_payment(amount: Decimal, payment_type, payment_method=Payment.Method.CASH, 
                         date=None, reference='', partner=None, invoice=None, 
                         treasury_account_id=None, sale_order=None, purchase_order=None, 
                         transaction_number=None, is_pending_registration=False,
                         dte_type=None, document_reference=None,
                         card_provider_id=None, pos_session_id=None):
        """
        Registers a payment and creates the corresponding Accounting Entry.
        """
        if amount < 0:
            raise ValidationError("El monto no puede ser negativo.")
            
        if not date:
            date = timezone.now().date()

        # 1. Resolve Treasury Account
        from .models import TreasuryAccount
        treasury_account = None

        if treasury_account_id:
             try:
                 treasury_account = TreasuryAccount.objects.get(pk=treasury_account_id)
             except TreasuryAccount.DoesNotExist:
                 pass
        
        if not treasury_account and not card_provider_id:
            # FALLBACK: If pos_session_id is provided, try to use terminal's default account
            if pos_session_id:
                from .models import POSSession
                try:
                    session = POSSession.objects.select_related('terminal__default_treasury_account').get(pk=pos_session_id)
                    if session.terminal and session.terminal.default_treasury_account:
                        default_acc = session.terminal.default_treasury_account
                        # Verify the default account supports the requested method
                        supports_method = False
                        if payment_method == Payment.Method.CASH and default_acc.allows_cash: supports_method = True
                        elif payment_method == Payment.Method.CARD and default_acc.allows_card: supports_method = True
                        elif payment_method == Payment.Method.TRANSFER and default_acc.allows_transfer: supports_method = True
                        
                        if supports_method:
                            treasury_account = default_acc
                            treasury_account_id = treasury_account.id
                except POSSession.DoesNotExist:
                    pass

            if not treasury_account:
                # ELIMINATED FALLBACKS: We no longer guess the account. 
                # The user MUST provide one or have a default set in the frontend/service call.
                raise ValidationError(f"Debe seleccionar una cuenta de tesorería (Caja o Banco) o un proveedor de tarjetas para procesar un pago de tipo {payment_method}.")
             
        # Resolve Financial Account from Treasury Account
        financial_account = treasury_account.account if treasury_account else None
        
        # New: Resolve Card Provider
        card_provider = None
        if card_provider_id and payment_method == Payment.Method.CARD:
            from .models import CardPaymentProvider
            try:
                card_provider = CardPaymentProvider.objects.get(pk=card_provider_id)
                # Use provider's receivable account instead of treasury account
                financial_account = card_provider.receivable_account
            except CardPaymentProvider.DoesNotExist:
                pass
        
        if not financial_account:
             raise ValidationError("No se pudo determinar la cuenta contable de origen (Tesorería o Tarjeta).")

        # Overwrite financial account if Treasury Account has a specific Card Receivable Bridge
        if treasury_account and payment_method == Payment.Method.CARD and treasury_account.card_receivable_account:
            financial_account = treasury_account.card_receivable_account

        # 1.5 Handle Purchase Document Registration (Auto-billing during payment)
        if purchase_order and dte_type and document_reference and not invoice:
            existing_invoice = purchase_order.invoices.filter(status='POSTED').first()
            if not existing_invoice:
                from billing.services import BillingService
                invoice = BillingService.create_purchase_bill(
                    order=purchase_order,
                    supplier_invoice_number=document_reference,
                    dte_type=dte_type
                )
            else:
                invoice = existing_invoice
        
        # 1.6 If method is CREDIT, we DON'T create a Payment record or Journal Entry.
        # We only wanted the invoice creation (which happened above).
        if payment_method == Payment.Method.CREDIT:
             return None

        # 2. Create Payment Record
        payment = Payment.objects.create(
            treasury_account=treasury_account,
            account=financial_account, # Snapshot
            payment_type=payment_type,
            payment_method=payment_method,
            amount=amount,
            date=date,
            reference=reference,
            invoice=invoice,
            sale_order=sale_order,
            purchase_order=purchase_order,
            transaction_number=transaction_number,
            is_pending_registration=is_pending_registration,
            contact=partner,  # Unified contact field
            card_provider=card_provider,
            pos_session_id=pos_session_id  # Link to POS session
        )
        
        if card_provider:
            # Create Card Transaction
            from .models import CardTransaction
            commission = (amount * card_provider.commission_rate / 100) + card_provider.fixed_amount
            commission_vat = commission * (card_provider.vat_rate / 100)
            net_amount = amount - commission - commission_vat
            
            CardTransaction.objects.create(
                provider=card_provider,
                payment=payment,
                transaction_date=date,
                gross_amount=amount,
                commission_amount=commission,
                commission_vat=commission_vat,
                net_amount=net_amount,
                expected_settlement_date=date + timezone.timedelta(days=card_provider.settlement_delay_days),
                authorization_code=reference or '',
                # daily_settlement will be linked later via reconciliation
            )
        
        payment.save()

        # 2. Update Invoice and Order Status
        if invoice:
            from billing.models import Invoice
            # Calculate total paid for this invoice
            total_paid = sum(p.amount for p in invoice.payments.all())
            
            if total_paid >= invoice.total:
                # IMPORTANT: Only mark as PAID if the invoice is already POSTED (has a folio).
                # If it's still DRAFT, we keep it as DRAFT so the user is forced to register the folio.
                if invoice.status == Invoice.Status.POSTED:
                    invoice.status = Invoice.Status.PAID
                    invoice.save()
                    
                    if invoice.sale_order:
                        from sales.models import SaleOrder
                        invoice.sale_order.status = SaleOrder.Status.PAID
                        invoice.sale_order.save()
                    elif invoice.purchase_order:
                        from purchasing.models import PurchaseOrder
                        # Only mark as PAID if already RECEIVED or INVOICED to allow reception flow
                        if invoice.purchase_order.status in [PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.INVOICED]:
                            invoice.purchase_order.status = PurchaseOrder.Status.PAID
                            invoice.purchase_order.save()
        
        # If no invoice but associated with order directly (Partial payments without invoice yet)
        target_order = sale_order or purchase_order
        if target_order and not invoice:
            total_paid = sum(p.amount for p in target_order.payments.all())
            
            # Use effective_total for PurchaseOrders to account for ND/NC
            from purchasing.models import PurchaseOrder
            if isinstance(target_order, PurchaseOrder):
                 order_total = target_order.effective_total
            else:
                 order_total = target_order.total

            if total_paid >= order_total:
                from sales.models import SaleOrder
                if isinstance(target_order, SaleOrder):
                    target_order.status = SaleOrder.Status.PAID
                    target_order.save()
                else:
                    # For Purchase Orders, only mark as PAID if already RECEIVED or INVOICED
                    if target_order.status in [PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.INVOICED]:
                        target_order.status = PurchaseOrder.Status.PAID
                        target_order.save()

        # 3. Accounting Entry
        # Account is already set in payment.account

        entry = JournalEntry.objects.create(
            date=date,
            description=f"Pago {payment.get_payment_type_display()} ({payment.get_payment_method_display()}) - {reference} {partner.name if partner else ''}",
            reference=f"PAY-{payment.id}",
            state=JournalEntry.State.DRAFT
        )

        from accounting.models import AccountingSettings
        settings = AccountingSettings.objects.first()
        
        # Determine Financial Context (Purchase vs Sale)
        is_purchase = False
        if purchase_order:
            is_purchase = True
        elif invoice and invoice.purchase_order:
            is_purchase = True
        
        # Determine the counterpart account based on context and payment type
        target_account = None
        
        if payment_type == Payment.Type.INBOUND:
            # Money in: Could be Customer Payment (Sale) OR Supplier Refund (Purchase)
            if is_purchase:
                # Supplier Refund: Use AP account
                target_account = (partner.account_payable if partner else None) or \
                                 (settings.default_payable_account if settings else None)
            else:
                # Customer Payment (Sale / Default): Use AR account
                if invoice:
                     # For specific invoice
                     target_account = (partner.account_receivable if partner else None) or \
                                      (settings.default_receivable_account if settings else None)
                else:
                     # Prepayment from customer
                     target_account = (settings.default_advance_payment_account if settings else None) or \
                                      (settings.default_receivable_account if settings else None)
            
            if not target_account:
                partner_name = partner.name if partner else "Sin Contacto"
                raise ValidationError(
                    f"No se encontró cuenta para el Cobro/Reembolso Entrante. "
                    f"Verifique que el contacto '{partner_name}' tenga cuenta contable o "
                    f"que se haya configurado la cuenta por cobrar por defecto."
                )

            # Debit Treasury (Money In)
            JournalItem.objects.create(entry=entry, account=payment.account, debit=amount, credit=0)
            # Credit Counterpart (Reduces debtor balance or Increases supplier balance)
            JournalItem.objects.create(entry=entry, account=target_account, debit=0, credit=amount, partner=partner.name if partner else '')

        else:
            # Money out: Could be Supplier Payment (Purchase) OR Customer Refund (Sale)
            if is_purchase:
                # Regular Supplier Payment
                if invoice:
                    target_account = (partner.account_payable if partner else None) or \
                                     (settings.default_payable_account if settings else None)
                else:
                    # Prepayment to supplier
                    target_account = (settings.default_prepayment_account if settings else None) or \
                                     (settings.default_payable_account if settings else None)
            else:
                # Customer Refund: Use AR account
                target_account = (partner.account_receivable if partner else None) or \
                                 (settings.default_receivable_account if settings else None)

            if not target_account:
                partner_name = partner.name if partner else "Sin Contacto"
                raise ValidationError(
                    f"No se encontró cuenta para el Pago/Reembolso Saliente. "
                    f"Verifique que el contacto '{partner_name}' tenga una cuenta contable o "
                    f"que se haya configurado la cuenta por pagar por defecto."
                )

            # Credit Treasury (Money Out)
            JournalItem.objects.create(entry=entry, account=payment.account, debit=0, credit=amount)
            # Debit Counterpart (Reduces liability or Increases customer asset)
            JournalItem.objects.create(entry=entry, account=target_account, debit=amount, credit=0, partner=partner.name if partner else '')

             
        if not is_pending_registration:
            JournalEntryService.post_entry(entry)
        
        payment.journal_entry = entry
        payment.save()
        
        # Update POS Session totals if linked to a session
        if pos_session_id and payment_type == Payment.Type.INBOUND:
            from .models import POSSession
            try:
                session = POSSession.objects.get(id=pos_session_id, status='OPEN')
                if payment_method == Payment.Method.CASH:
                    session.total_cash_sales += amount
                elif payment_method == Payment.Method.CARD:
                    session.total_card_sales += amount
                elif payment_method == Payment.Method.TRANSFER:
                    session.total_transfer_sales += amount
                elif payment_method == Payment.Method.CREDIT:
                    session.total_credit_sales += amount
                session.save()
            except POSSession.DoesNotExist:
                pass  # Session not found or closed, ignore
        
        return payment

    @staticmethod
    @transaction.atomic
    def delete_payment(payment: Payment):
        """
        Deletes a payment and its associated Journal Entry.
        Only allowed if the Journal Entry is DRAFT.
        """
        if payment.journal_entry and payment.journal_entry.state == JournalEntry.State.POSTED:
            raise ValidationError("No se puede eliminar un pago cuyo asiento contable ya ha sido publicado.")

        if payment.journal_entry:
            # We must break the link first because on_delete=PROTECT
            entry = payment.journal_entry
            payment.journal_entry = None
            payment.save()
            entry.delete()
        payment.delete()

    @staticmethod
    @transaction.atomic
    def annul_payment(payment: Payment):
        """
        Annuls a payment record and its accounting entry.
        """
        if not payment.journal_entry or payment.journal_entry.state != JournalEntry.State.POSTED:
             # If it's DRAFT, user should just delete it.
             raise ValidationError("Solo se pueden anular pagos con asientos contables publicados.")

        # 1. Reverse Accounting Entry
        JournalEntryService.reverse_entry(payment.journal_entry, description=f"Anulación Pago {payment.id}")

        # 2. Update Invoice/Order Totals (by letting them know a payment was reversed)
        # The balance logic usually handles this, but if we have hardcoded status 'PAID', we might need to revert it.
        target = payment.invoice or payment.sale_order or payment.purchase_order
        if target and hasattr(target, 'status') and target.status == 'PAID':
             # Revert status to INVOICED or CONFIRMED
             from billing.models import Invoice
             from sales.models import SaleOrder
             from purchasing.models import PurchaseOrder

             if isinstance(target, Invoice):
                  target.status = Invoice.Status.POSTED
             elif isinstance(target, SaleOrder):
                  target.status = SaleOrder.Status.INVOICED
             elif isinstance(target, PurchaseOrder):
                  target.status = PurchaseOrder.Status.INVOICED
             
             target.save()

        # 3. We don't have a CANCELLED status on Payment model, so we might want to add one 
        # OR just rely on the JournalEntry state. 
        # For now, we delete the link to the original JE (which is now CANCELLED via reverse_entry) 
        # actually reverse_entry marks original as CANCELLED.
        
        return payment
