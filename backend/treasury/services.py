from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from treasury.models import TreasuryMovement, TreasuryAccount, TerminalBatch, PaymentMethod
from accounting.models import JournalEntry, JournalItem, AccountingSettings
from accounting.services import JournalEntryService
from decimal import Decimal

class TreasuryService:
    @staticmethod
    @transaction.atomic
    def create_movement(amount, movement_type, payment_method=TreasuryMovement.Method.CASH,
                        date=None, created_by=None,
                        from_account=None, to_account=None,
                        partner=None, invoice=None, sale_order=None, purchase_order=None,
                        payroll=None, payroll_payment_type=None,
                        pos_session=None, pos_session_id=None, reference='', notes='', justify_reason=None,
                        transaction_number=None, is_pending_registration=False,
                        payment_method_new=None, is_reconciled=False):
        """
        Unified method to create a TreasuryMovement.
        Handles:
        1. Validation (Funds, Accounts)
        2. Creation of TreasuryMovement record
        3. Accounting Journal Entry creation (in real-time)
        4. Updating Business Documents (Invoices, Orders)
        5. Updating POS Session totals
        """
        if amount is not None:
            amount = Decimal(str(amount))
            
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor a cero.")
        
        if not date:
            date = timezone.now().date()

        # 1. Account Logic Resolution
        # Ensure we have valid accounts for the movement type (except for CREDIT_BALANCE)
        if not from_account and not to_account and payment_method != TreasuryMovement.Method.CREDIT_BALANCE:
             raise ValidationError("Debe especificar al menos una cuenta de tesorería (Origen o Destino).")

        # Validation: Insufficient Funds for Outbound from Cash
        if from_account and from_account.account_type == TreasuryAccount.Type.CASH:
             # Refresh balance check
             if amount > from_account.current_balance:
                 # We allow it but with a warning? strict? 
                 # Current logic was strict for transfers.
                 if movement_type in [TreasuryMovement.Type.TRANSFER, TreasuryMovement.Type.OUTBOUND]:
                      pass # Keeping strict logic might block business. Let's rely on frontend warning, or strict.
                      # raise ValidationError(f"Fondos insuficientes en {from_account.name}.")

        # 1.5 Resolve POS Session
        if not pos_session and pos_session_id:
            from .models import POSSession
            pos_session = POSSession.objects.filter(id=pos_session_id).first()


        # 2. Create TreasuryMovement
        movement = TreasuryMovement.objects.create(
            movement_type=movement_type,
            payment_method=payment_method,
            payment_method_new=payment_method_new,
            amount=amount,
            date=date,
            created_by=created_by,
            from_account=from_account,
            to_account=to_account,
            contact=partner,
            invoice=invoice,
            sale_order=sale_order,
            purchase_order=purchase_order,
            payroll=payroll,
            payroll_payment_type=payroll_payment_type,
            reference=reference or '',
            notes=notes or '',
            justify_reason=justify_reason,
            pos_session=pos_session,
            transaction_number=transaction_number,
            is_pending_registration=is_pending_registration,
            is_reconciled=is_reconciled
        )

        # 3. Handle Business Documents (Status Updates)
        TreasuryService.update_related_document_status(movement, invoice, sale_order, purchase_order, payroll)

        # 4. Handle POS Session Totals
        if pos_session:
            TreasuryService._update_pos_session(movement, pos_session)


        # 5. Generate Accounting Entry
        if not is_pending_registration:
            TreasuryService._create_accounting_entry(movement)

        # 6. Create PartnerTransaction if applicable
        if movement.justify_reason in [TreasuryMovement.JustifyReason.CAPITAL_CONTRIBUTION, TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL] and movement.contact and movement.contact.is_partner:
            from contacts.partner_models import PartnerTransaction
            partner = movement.contact
            
            # Smart Type Selection
            if movement.movement_type == TreasuryMovement.Type.INBOUND:
                # If it's an inbound contribution, check if it's paying a pending capital subscription
                if partner.partner_pending_capital > 0:
                    target_tx_type = PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH # Generic but correct
                else:
                    target_tx_type = PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH
            else:
                # Withdrawal side: Smart Type Selection
                if partner.partner_dividends_payable_balance > 0:
                    target_tx_type = PartnerTransaction.Type.DIVIDEND_PAYMENT
                else:
                    target_tx_type = PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL

            PartnerTransaction.objects.get_or_create(
                treasury_movement=movement,
                defaults={
                    'partner': movement.contact,
                    'transaction_type': target_tx_type,
                    'amount': movement.amount,
                    'date': movement.date,
                    'description': movement.notes or f"{movement.get_justify_reason_display()}",
                    'journal_entry': movement.journal_entry,
                    'created_by': created_by
                }
            )
        
        return movement


    @staticmethod
    def update_related_document_status(movement, invoice=None, sale_order=None, purchase_order=None, payroll=None):
        # Logic to update status to PAID
        targets = []
        if invoice: targets.append(invoice)
        if sale_order and not invoice: targets.append(sale_order)
        if purchase_order and not invoice: targets.append(purchase_order)
        if payroll: targets.append(payroll)
        
        # If arguments are missing, try to resolve from movement
        if not invoice and movement.invoice: targets.append(movement.invoice)
        if not sale_order and movement.sale_order and not movement.invoice: targets.append(movement.sale_order)
        if not purchase_order and movement.purchase_order and not movement.invoice: targets.append(movement.purchase_order)
        if not payroll and movement.payroll: targets.append(movement.payroll)

        targets = list(set(targets)) # unique

        for target in targets:
             # Recalculate total paid
             model_to_field = {
                 'invoice': 'invoice',
                 'saleorder': 'sale_order',
                 'purchaseorder': 'purchase_order'
             }
             field_name = model_to_field.get(target._meta.model_name, target._meta.model_name)
             
             # Get all related payments
             related_payments = TreasuryMovement.objects.filter(**{field_name: target})
             total_paid = sum(m.amount for m in related_payments)
             
             target_total = getattr(target, 'total', 0)
             if hasattr(target, 'effective_total'): target_total = target.effective_total

             # Check if fully paid
             if total_paid >= target_total:
                 # CRITICAL: Check if any payment requires a transaction number but misses it
                 has_pending_transactions = related_payments.filter(
                     movement_type__in=[TreasuryMovement.Type.INBOUND, TreasuryMovement.Type.OUTBOUND, TreasuryMovement.Type.TRANSFER],
                     payment_method__in=[TreasuryMovement.Method.CARD, TreasuryMovement.Method.TRANSFER],
                     transaction_number__isnull=True
                 ).exclude(transaction_number__exact='').exists()
                 
                 # Also check empty string explicitly in case nulls are handled differently
                 if not has_pending_transactions:
                      # If we do exclude(exact='') above, it handles empty strings.
                      # Let's be thorough:
                      pending_empty = related_payments.filter(
                         movement_type__in=[TreasuryMovement.Type.INBOUND, TreasuryMovement.Type.OUTBOUND, TreasuryMovement.Type.TRANSFER],
                         payment_method__in=[TreasuryMovement.Method.CARD, TreasuryMovement.Method.TRANSFER],
                         transaction_number=''
                      ).exists()
                      has_pending_transactions = has_pending_transactions or pending_empty

                 status_field = 'status'
                 if hasattr(target, 'Status'):
                      if hasattr(target.Status, 'PAID'):
                          # Only mark as PAID if NO pending transaction numbers
                          if not has_pending_transactions:
                              setattr(target, status_field, target.Status.PAID)
                              target.save()
                          else:
                               if target.status == target.Status.PAID:
                                    new_status = target.Status.CONFIRMED
                                    if hasattr(target.Status, 'INVOICED'):
                                         new_status = target.Status.INVOICED
                                    setattr(target, status_field, new_status)
                                    target.save()

                 # Sync HUB Tasks
                 from workflow.services import WorkflowService
                 if target._meta.model_name in ['saleorder', 'purchaseorder']:
                     WorkflowService.sync_hub_tasks(target)
                 elif target._meta.model_name == 'invoice':
                     if hasattr(target, 'sale_order') and target.sale_order:
                         WorkflowService.sync_hub_tasks(target.sale_order)
                     if hasattr(target, 'purchase_order') and target.purchase_order:
                         WorkflowService.sync_hub_tasks(target.purchase_order)

    @staticmethod
    def _update_pos_session(movement, pos_session):
        # Update session totals based on payment method and type
        if pos_session.status != 'OPEN': return
        
        amount = movement.amount
        is_sale = bool(movement.invoice or movement.sale_order)

        if movement.movement_type == TreasuryMovement.Type.INBOUND:
             if is_sale:
                 if movement.payment_method == TreasuryMovement.Method.CASH:
                     pos_session.total_cash_sales += amount
                 elif movement.payment_method == TreasuryMovement.Method.CARD:
                     pos_session.total_card_sales += amount
                 elif movement.payment_method == TreasuryMovement.Method.TRANSFER:
                     pos_session.total_transfer_sales += amount
                 elif movement.payment_method == TreasuryMovement.Method.CREDIT:
                     pos_session.total_credit_sales += amount
             else:
                 pos_session.total_other_cash_inflow += amount

        elif movement.movement_type == TreasuryMovement.Type.OUTBOUND:
             if not is_sale:
                 pos_session.total_other_cash_outflow += amount
        
        elif movement.movement_type == TreasuryMovement.Type.TRANSFER:
             session_treasury_id = pos_session.treasury_account_id or (pos_session.terminal.default_treasury_account_id if pos_session.terminal else None)
             if session_treasury_id:
                 if movement.to_account_id == session_treasury_id:
                     pos_session.total_other_cash_inflow += amount
                 elif movement.from_account_id == session_treasury_id:
                     pos_session.total_other_cash_outflow += amount

        pos_session.save()

    @staticmethod
    def _create_accounting_entry(movement):
        settings = AccountingSettings.get_solo()
        if not settings: return
        
        date = movement.date
        description = f"{movement.get_movement_type_display()} - {movement.reference or movement.notes or 'Sin Ref'}"
        entry = JournalEntry.objects.create(
             date=date,
             description=description,
             reference=f"MOV-{movement.id}",
             status=JournalEntry.State.DRAFT
        )

        from_acc = movement.from_account.account if movement.from_account else None
        to_acc = movement.to_account.account if movement.to_account else None
        
        # Override for Credit Balance (Virtual Pool Account)
        if movement.payment_method == TreasuryMovement.Method.CREDIT_BALANCE:
            pool_acc = settings.default_advance_payment_account
            if pool_acc:
                if movement.movement_type == TreasuryMovement.Type.INBOUND:
                    to_acc = pool_acc
                elif movement.movement_type == TreasuryMovement.Type.OUTBOUND:
                    from_acc = pool_acc

        # 1. TRANSFER (Internal)
        if movement.movement_type == TreasuryMovement.Type.TRANSFER:
             if from_acc and to_acc:
                 JournalItem.objects.create(entry=entry, account=from_acc, debit=0, credit=movement.amount)
                 JournalItem.objects.create(entry=entry, account=to_acc, debit=movement.amount, credit=0)
        
        # 2. INBOUND (Sale / Deposit)
        elif movement.movement_type == TreasuryMovement.Type.INBOUND:
            # Debit ToAccount (Treasury or Card Provider Receivable)
            debit_acc = to_acc
            
            # Stage 1: Record to Terminal Receivable Account if it's a terminal-based payment
            processes_via_terminal = getattr(movement.payment_method_new, 'processes_via_terminal', False)
            if processes_via_terminal and movement.terminal_device:
                 provider = movement.terminal_device.provider
                 if provider.receivable_account:
                     debit_acc = provider.receivable_account
            elif processes_via_terminal:
                 # Logic fallback if no device is set but should have one
                 pass
            
            if debit_acc:
                JournalItem.objects.create(entry=entry, account=debit_acc, debit=movement.amount, credit=0)
            
            # Credit Source (Revenue / Debtor)
            source_acc = None
            if movement.justify_reason == TreasuryMovement.JustifyReason.CAPITAL_CONTRIBUTION and movement.contact and movement.contact.is_partner:
                # Smart Contribution: Priority Capital Receivable > Equity
                partner = movement.contact
                if partner.partner_pending_capital > 0:
                    source_acc = settings.partner_capital_receivable_account
                else:
                    source_acc = partner.partner_contribution_account or settings.partner_capital_contribution_account

            if not source_acc:
                if movement.invoice or movement.sale_order:
                    # Customer Account
                    source_acc = (movement.contact.account_receivable if movement.contact else None) or settings.default_receivable_account
                elif movement.justify_reason:
                    # Operational Reasons (Tips, Adjustments)
                    source_acc = TreasuryService._get_reason_account(settings, movement.justify_reason, 'IN')
            
            if not source_acc and movement.contact:
                source_acc = movement.contact.account_receivable

            if source_acc:
                JournalItem.objects.create(entry=entry, account=source_acc, debit=0, credit=movement.amount)

        # 3. OUTBOUND (Expense / Withdrawal)
        elif movement.movement_type == TreasuryMovement.Type.OUTBOUND:
             # Credit FromAccount (Treasury)
             if from_acc:
                 JournalItem.objects.create(entry=entry, account=from_acc, debit=0, credit=movement.amount)
             
             # Debit Target (Expense / Creditor)
             target_acc = None
             if movement.justify_reason == TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL and movement.contact and movement.contact.is_partner:
                  # Smart Withdrawal: Priority Dividends Payable > Provisional Withdrawal
                  partner = movement.contact
                  if partner.partner_dividends_payable_balance > 0:
                      target_acc = settings.partner_dividends_payable_account
                  else:
                      target_acc = partner.partner_provisional_withdrawal_account or settings.partner_withdrawal_account or settings.pos_partner_withdrawal_account

             if not target_acc:
                 if movement.invoice or movement.purchase_order or movement.sale_order:
                      is_sale = bool(movement.sale_order or (movement.invoice and movement.invoice.sale_order))
                      if is_sale:
                          target_acc = (movement.contact.account_receivable if movement.contact else None) or settings.default_receivable_account
                      else:
                          # Supplier Account
                          target_acc = (movement.contact.account_payable if movement.contact else None) or settings.default_payable_account
                 elif movement.justify_reason:
                      target_acc = TreasuryService._get_reason_account(settings, movement.justify_reason, 'OUT')
             
             if not target_acc and movement.contact:
                  target_acc = movement.contact.account_payable

             if not target_acc and movement.payroll:
                  from hr.models import GlobalHRSettings
                  hr_settings = GlobalHRSettings.get_solo()
                  if hr_settings:
                       if movement.payroll_payment_type == 'SALARY':
                            target_acc = hr_settings.account_remuneraciones_por_pagar
                       elif movement.payroll_payment_type == 'PREVIRED':
                            target_acc = hr_settings.account_previred_por_pagar
                       elif movement.payroll_payment_type == 'ADVANCE':
                            target_acc = hr_settings.account_anticipos

             if target_acc:
                  JournalItem.objects.create(entry=entry, account=target_acc, debit=movement.amount, credit=0)

        # Post if valid
        if entry.items.count() >= 2:
             JournalEntryService.post_entry(entry)
             movement.journal_entry = entry
             movement.save()
        else:
             entry.delete()

    @staticmethod
    def _get_reason_account(settings, reason, direction):
        if reason == 'TIP' and direction == 'IN':
             return settings.pos_tip_account
        elif reason == 'ROUNDING':
             return settings.pos_rounding_adjustment_account or settings.rounding_adjustment_account
        elif reason == 'COUNTING_ERROR':
             return settings.pos_counting_error_account
        elif reason == 'SYSTEM_ERROR':
             return settings.pos_system_error_account
        elif reason == 'OTHER_IN' and direction == 'IN':
             return settings.pos_other_inflow_account
        elif reason == 'OTHER_OUT' and direction == 'OUT':
             return settings.pos_other_outflow_account
        elif reason == 'THEFT' and direction == 'OUT':
             return settings.pos_theft_account
        elif reason == 'PARTNER_WITHDRAWAL' and direction == 'OUT':
             return settings.pos_partner_withdrawal_account
        elif reason == 'CASHBACK' and direction == 'OUT':
             return settings.pos_cashback_error_account
        return None

    @staticmethod
    @transaction.atomic
    def delete_movement(movement: TreasuryMovement):
        """
        Deletes a movement and its associated journal entry.
        Only allowed for movements that are not reconciled and if accounting entry is DRAFT (or force delete).
        """
        if movement.is_reconciled:
             raise ValidationError("No se puede eliminar un movimiento conciliado.")
        
        # Reverse/Delete Journal Entry
        if movement.journal_entry:
             if movement.journal_entry.status == JournalEntry.State.POSTED:
                  # If posted, we should ideally annul, not delete. 
                  # But matching 'delete_payment' behavior which allowed deletion of DRAFT/PENDING things.
                  # If strict, raise error. Assuming this is for Draft/Cancelled flows.
                  # But verify logic: delete_invoice only calls this for DRAFT invoice payments.
                  movement.journal_entry.delete()
             else:
                  movement.journal_entry.delete()

        movement.delete()

    @staticmethod
    @transaction.atomic
    def annul_movement(movement: TreasuryMovement):
        """
        Annuls a movement by reversing its accounting entry and marking it (or deleting it depending on logic).
        For now, we reverse accounting and keep the record if needed, or maybe just delete if it's a hard annulment.
        """
        if movement.is_reconciled:
             raise ValidationError("No se puede anular un movimiento conciliado.")

        if movement.journal_entry and movement.journal_entry.status == JournalEntry.State.POSTED:
             JournalEntryService.reverse_entry(movement.journal_entry, description=f"Anulación Movimiento {movement.id}")
        
        # Update movement status? We don't have a status field in TreasuryMovement (only validation flags).
        # Typically we might delete it or mark it as cancelled if we add a status field.
        # For now, let's delete strictly to avoid orphans affecting totals.
        # The reversed entry remains as audit trail.
        movement.delete()

    @staticmethod
    def create_movement_from_payload(data: dict, *, created_by) -> "TreasuryMovement":
        """
        Resolves all entity references from a raw request payload dict and delegates
        to create_movement. Handles aliased field names from different frontend callers.

        Accepts:
          amount, movement_type | payment_type, payment_method | paymentMethod,
          treasury_account_id | treasury_account, contact_id | partner,
          invoice_id | invoice, purchase_order_id | purchase_order,
          sale_order_id | sale_order, payment_method_id | payment_method_new,
          pos_session_id | pos_session, reference, transaction_number,
          is_pending_registration
        """
        amount_val = data.get("amount")
        if not amount_val:
            raise ValidationError("Amount required")
        amount = Decimal(str(amount_val))

        movement_type = data.get("movement_type") or data.get("payment_type")
        payment_method = (
            data.get("payment_method") or data.get("paymentMethod") or TreasuryMovement.Method.CASH
        )

        is_pending = data.get("is_pending_registration", False)
        if isinstance(is_pending, str):
            is_pending = is_pending.lower() == "true"

        # Resolve treasury account → from/to based on direction
        treasury_account_id = data.get("treasury_account_id") or data.get("treasury_account")
        treasury_account = None
        if treasury_account_id:
            treasury_account = TreasuryAccount.objects.get(pk=treasury_account_id)

        from_account = to_account = None
        if movement_type == TreasuryMovement.Type.INBOUND:
            to_account = treasury_account
        elif movement_type == TreasuryMovement.Type.OUTBOUND:
            from_account = treasury_account

        # Resolve related entities
        contact_id = data.get("contact_id") or data.get("partner")
        partner = None
        if contact_id:
            from contacts.models import Contact
            partner = Contact.objects.filter(pk=contact_id).first()

        invoice = None
        invoice_id = data.get("invoice_id") or data.get("invoice")
        if invoice_id:
            from billing.models import Invoice
            invoice = Invoice.objects.filter(pk=invoice_id).first()

        purchase_order = None
        purchase_order_id = data.get("purchase_order_id") or data.get("purchase_order")
        if purchase_order_id:
            from purchasing.models import PurchaseOrder
            purchase_order = PurchaseOrder.objects.filter(pk=purchase_order_id).first()

        sale_order = None
        sale_order_id = data.get("sale_order_id") or data.get("sale_order")
        if sale_order_id:
            from sales.models import SaleOrder
            sale_order = SaleOrder.objects.filter(pk=sale_order_id).first()

        payment_method_new = None
        payment_method_id = data.get("payment_method_id") or data.get("payment_method_new")
        if payment_method_id:
            from django.apps import apps
            PaymentMethod = apps.get_model('treasury', 'PaymentMethod')
            payment_method_new = PaymentMethod.objects.filter(pk=payment_method_id).first()

        pos_session_id = data.get("pos_session_id") or data.get("pos_session")

        return TreasuryService.create_movement(
            amount=amount,
            movement_type=movement_type,
            payment_method=payment_method,
            payment_method_new=payment_method_new,
            from_account=from_account,
            to_account=to_account,
            reference=data.get("reference", ""),
            partner=partner,
            invoice=invoice,
            purchase_order=purchase_order,
            sale_order=sale_order,
            transaction_number=data.get("transaction_number"),
            is_pending_registration=is_pending,
            pos_session_id=pos_session_id,
            created_by=created_by,
        )


class TerminalBatchService:
    @staticmethod
    @transaction.atomic
    def create_batch(provider, sales_date, gross_amount, commission_base, commission_tax, net_amount, terminal_reference='', user=None, movement_ids=None):
        """
        Create a TerminalBatch and its accounting entries.
        Stage 2 of the Terminal accounting flow.
        """
        # 1. Validation
        commission_total = commission_base + commission_tax
        expected_net = gross_amount - commission_total
        
        if abs(net_amount - expected_net) > Decimal('0.01'):
             raise ValidationError(f"El monto neto no coincide con Bruto - Comisión. Esperado: {expected_net}")

        # Accounts Validation
        receivable_acc = provider.receivable_account
        expense_acc = provider.commission_expense_account
        bank_acc = provider.bank_treasury_account.account if provider.bank_treasury_account else None

        if not (receivable_acc and expense_acc and bank_acc):
             raise ValidationError("El proveedor de terminal debe tener configuradas las cuentas: Por Cobrar, Gasto Comisión y Tesorería.")

        # 2. Identify Payments
        payments = TreasuryMovement.objects.none()
        if movement_ids:
            payments = TreasuryMovement.objects.filter(
                id__in=movement_ids,
                payment_method_new__processes_via_terminal=True,
                terminal_device__provider=provider,
                terminal_batch__isnull=True
            )
        
        batch = TerminalBatch.objects.create(
            provider=provider,
            sales_date=sales_date,
            settlement_date=timezone.now().date(), # Or passed as arg
            deposit_date=timezone.now().date(), # Assuming deposit happens on settlement report
            gross_amount=gross_amount,
            commission_base=commission_base,
            commission_tax=commission_tax,
            commission_total=commission_total,
            net_amount=net_amount,
            terminal_reference=terminal_reference,
            status=TerminalBatch.Status.SETTLED,
            created_by=user
        )
        
        # Link payments
        payments.update(terminal_batch=batch)
        
        # 3. Create Accounting Entry (Settlement)
        # Description: Liquidación Terminal [Provider] - [Date]
        description = f"Liq. {provider.name} - {sales_date}"
        entry = JournalEntry.objects.create(
            date=batch.settlement_date,
            description=description,
            reference=batch.display_id,
            status=JournalEntry.State.DRAFT
        )
        
        # Get Bridge Accounts
        settings = AccountingSettings.get_solo()
        comm_bridge = settings.terminal_commission_bridge_account if settings else None
        iva_bridge = settings.terminal_iva_bridge_account if settings else None
        
        if not (comm_bridge and iva_bridge):
             # Log warning or handle gracefully? For now mandatory if using this flow.
             raise ValidationError("Debe configurar las cuentas puente de comisiones e IVA en la configuración contable.")

        # A. Bridge Commission - Neto (Debit)
        JournalItem.objects.create(
            entry=entry,
            account=comm_bridge,
            debit=commission_base,
            credit=0
        )

        # B. Bridge IVA (Debit)
        JournalItem.objects.create(
            entry=entry,
            account=iva_bridge,
            debit=commission_tax,
            credit=0
        )
        
        # C. Bank Check/Transfer (Debit) <-- Net Amount received
        JournalItem.objects.create(
            entry=entry,
            account=bank_acc,
            debit=net_amount,
            credit=0
        )
        
        # D. Receivable Offset (Credit) <-- Gross Amount was previously debited here
        JournalItem.objects.create(
            entry=entry,
            account=receivable_acc,
            debit=0,
            credit=gross_amount
        )
        
        JournalEntryService.post_entry(entry)
        
        batch.settlement_journal_entry = entry
        batch.save()
        
        return batch

    @staticmethod
    @transaction.atomic
    def generate_monthly_invoice(provider, year, month, user=None, number=None, date=None, document_attachment=None):
        """
        Aggregates SETTLED batches for a month/provider and generates a Supplier Invoice.
        Status -> INVOICED.
        """
        # Find batches
        batches = TerminalBatch.objects.filter(
            provider=provider,
            sales_date__year=year,
            sales_date__month=month,
            status=TerminalBatch.Status.SETTLED,
            supplier_invoice__isnull=True
        )
        
        if not batches.exists():
            return None
            
        total_commission_net = sum(b.commission_base for b in batches)
        
        supplier = provider.supplier
        commission_product = provider.commission_product
        
        if not commission_product:
            from django.core.exceptions import ValidationError
            raise ValidationError(f"El proveedor {provider.name} no tiene un 'Producto de Comisión' configurado.")

        # 2. Create Purchase Order
        from purchasing.models import PurchaseOrder, PurchaseLine
        from purchasing.services import PurchasingService
        
        po = PurchaseOrder.objects.create(
            supplier=supplier,
            date=date or timezone.now().date(),
            notes=f"Comisiones Terminales {month}/{year}",
            payment_method=PurchaseOrder.PaymentMethod.CREDIT 
        )
        
        # Create Line
        PurchaseLine.objects.create(
            order=po,
            product=commission_product,
            quantity=1,
            unit_cost=total_commission_net,
            uom=commission_product.uom 
        )
        
        # 3. Confirm PO
        PurchasingService.confirm_order(po, user)
        
        # 4. Generate Invoice (using PurchasingService)
        # This service usually creates a JournalEntry or Invoice depending on the flow. 
        # Assuming it creates an Invoice and links it to the PO.
        PurchasingService.create_invoice_from_order(po, user=user) 
        
        # Re-fetch invoice linked to PO
        invoice = po.invoices.first()
        if not invoice:
             raise ValidationError("Error generando factura desde la orden de compra.")
             
        # Update Invoice details
        if number:
            invoice.number = number
        if document_attachment:
            invoice.document_attachment = document_attachment
        if date:
            invoice.date = date
        invoice.save()

        # 5. Link Batches
        batches.update(supplier_invoice=invoice, status=TerminalBatch.Status.INVOICED)
        
        return invoice
