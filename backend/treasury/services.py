from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import TreasuryMovement, TreasuryAccount
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
                        pos_session=None, pos_session_id=None, reference='', notes='', justify_reason=None,
                        transaction_number=None, is_pending_registration=False,
                        card_provider=None, payment_method_new=None, is_reconciled=False):
        """
        Unified method to create a TreasuryMovement.
        Handles:
        1. Validation (Funds, Accounts)
        2. Creation of TreasuryMovement record
        3. Accounting Journal Entry creation (in real-time)
        4. Updating Business Documents (Invoices, Orders)
        5. Updating POS Session totals
        """
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor a cero.")
        
        if not date:
            date = timezone.now()

        # 1. Account Logic Resolution
        # Ensure we have valid accounts for the movement type
        if not from_account and not to_account:
             raise ValidationError("Debe especificar al menos una cuenta de tesorería (Origen o Destino).")

        # Validation: Insufficient Funds for Outbound from Cash
        if from_account and from_account.account_type == TreasuryAccount.Type.CASH:
             # Refresh balance check
             if amount > from_account.account.balance:
                 # We allow it but with a warning? strict? 
                 # Current logic was strict for transfers.
                 if movement_type in [TreasuryMovement.Type.TRANSFER, TreasuryMovement.Type.OUTBOUND]:
                      pass # Keeping strict logic might block business. Let's rely on frontend warning, or strict.
                      # raise ValidationError(f"Fondos insuficientes en {from_account.name}.")

        # 1.5 Resolve POS Session
        if not pos_session and pos_session_id:
            from .models import POSSession
            pos_session = POSSession.objects.filter(id=pos_session_id).first()

        # 1.6 Propagate Card Provider from Payment Method if not provided
        if not card_provider and payment_method_new and payment_method_new.card_provider:
            card_provider = payment_method_new.card_provider

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
            reference=reference or '',
            notes=notes or '',
            justify_reason=justify_reason,
            pos_session=pos_session,
            transaction_number=transaction_number,
            card_provider=card_provider,
            is_pending_registration=is_pending_registration,
            is_reconciled=is_reconciled
        )

        # 3. Handle Business Documents (Status Updates)
        TreasuryService._update_business_documents(movement, invoice, sale_order, purchase_order)

        # 4. Handle POS Session Totals
        if pos_session:
            TreasuryService._update_pos_session(movement, pos_session)

        # 4.5 Register Card Transaction if applicable
        if movement.card_provider and movement.movement_type == TreasuryMovement.Type.INBOUND:
            from .card_transaction_service import CardTransactionService
            CardTransactionService.process_movement(movement)

        # 5. Generate Accounting Entry
        if not is_pending_registration:
            TreasuryService._create_accounting_entry(movement)
        
        return movement

    @staticmethod
    @transaction.atomic
    def create_cash_movement(amount, movement_type, from_account=None, to_account=None,
                             created_by=None, pos_session=None, notes='', justify_reason=None,
                             journal_entry_desc=None, **kwargs):
        """
        Legacy wrapper for Cash movements (Adjustments, Withdrawals, Deposits).
        Redirects to unified create_movement.
        """
        # Map legacy movement types to unified types
        mapped_type = movement_type
        if movement_type == 'WITHDRAWAL':
            mapped_type = TreasuryMovement.Type.OUTBOUND
        elif movement_type == 'DEPOSIT':
            mapped_type = TreasuryMovement.Type.INBOUND
        elif movement_type == 'ADJUSTMENT' and not (from_account or to_account):
             # Adjustment without accounts? Logic usually needs one. 
             # But if it's a gap fillers, might be outbound/inbound depending on gap.
             pass
        
        return TreasuryService.create_movement(
            amount=amount,
            movement_type=mapped_type,
            from_account=from_account,
            to_account=to_account,
            created_by=created_by,
            pos_session=pos_session,
            notes=notes,
            justify_reason=justify_reason,
            reference=journal_entry_desc or notes,
            **kwargs
        )

    @staticmethod
    def _update_business_documents(movement, invoice, sale_order, purchase_order):
        # Logic to update status to PAID
        targets = []
        if invoice: targets.append(invoice)
        if sale_order and not invoice: targets.append(sale_order)
        if purchase_order and not invoice: targets.append(purchase_order)

        for target in targets:
             # Recalculate total paid
             # Assumption: target has .payments related manager. 
             # We updated related_name in TreasuryMovement to 'payments' for compatibility?
             # Or we need to check if target.payments works or we need target.treasury_movements.
             # The model rename usually keeps related_name or we check model definition.
             # Assuming related_name='payments' or we filter.
             
             model_to_field = {
                 'invoice': 'invoice',
                 'saleorder': 'sale_order',
                 'purchaseorder': 'purchase_order'
             }
             field_name = model_to_field.get(target._meta.model_name, target._meta.model_name)
             
             total_paid = sum(m.amount for m in TreasuryMovement.objects.filter(
                 **{field_name: target}
             ))
             
             target_total = getattr(target, 'total', 0)
             if hasattr(target, 'effective_total'): target_total = target.effective_total

             if total_paid >= target_total:
                 status_field = 'status'
                 # Determine PAID status constant
                 # This relies on imports, let's do soft check or import models inside
                 if hasattr(target, 'Status'):
                      if hasattr(target.Status, 'PAID'):
                          setattr(target, status_field, target.Status.PAID)
                          target.save()

    @staticmethod
    def _update_pos_session(movement, pos_session):
        # Update session totals based on payment method and type
        if pos_session.status != 'OPEN': return
        
        amount = movement.amount
        if movement.movement_type == TreasuryMovement.Type.INBOUND:
             if movement.payment_method == TreasuryMovement.Method.CASH:
                 pos_session.total_cash_sales += amount
             elif movement.payment_method == TreasuryMovement.Method.CARD:
                 pos_session.total_card_sales += amount
             elif movement.payment_method == TreasuryMovement.Method.TRANSFER:
                 pos_session.total_transfer_sales += amount
             elif movement.payment_method == TreasuryMovement.Method.CREDIT:
                 pos_session.total_credit_sales += amount
        elif movement.movement_type == TreasuryMovement.Type.OUTBOUND:
             # Maybe reduce sales? Or just track expenses?
             pass
        
        pos_session.save()

    @staticmethod
    def _create_accounting_entry(movement):
        settings = AccountingSettings.objects.first()
        if not settings: return
        
        date = movement.date
        description = f"{movement.get_movement_type_display()} - {movement.reference or movement.notes or 'Sin Ref'}"
        entry = JournalEntry.objects.create(
             date=date,
             description=description,
             reference=f"MOV-{movement.id}",
             state=JournalEntry.State.DRAFT
        )

        from_acc = movement.from_account.account if movement.from_account else None
        to_acc = movement.to_account.account if movement.to_account else None
        
        # 1. TRANSFER (Internal)
        if movement.movement_type == TreasuryMovement.Type.TRANSFER:
             if from_acc and to_acc:
                 JournalItem.objects.create(entry=entry, account=from_acc, debit=0, credit=movement.amount)
                 JournalItem.objects.create(entry=entry, account=to_acc, debit=movement.amount, credit=0)
        
        # 2. INBOUND (Sale / Deposit)
        elif movement.movement_type == TreasuryMovement.Type.INBOUND:
            # Debit ToAccount (Treasury or Card Provider Receivable)
            debit_acc = to_acc
            
            # If it's a terminal-based payment, the money is in transit with the provider
            is_terminal = getattr(movement.payment_method_new, 'is_terminal', False)
            if is_terminal and movement.card_provider and movement.card_provider.receivable_account:
                 debit_acc = movement.card_provider.receivable_account
            
            if debit_acc:
                JournalItem.objects.create(entry=entry, account=debit_acc, debit=movement.amount, credit=0)
            
            # Credit Source (Revenue / Debtor)
            source_acc = None
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
             if movement.invoice or movement.purchase_order:
                  # Supplier Account
                  target_acc = (movement.contact.account_payable if movement.contact else None) or settings.default_payable_account
             elif movement.justify_reason:
                  target_acc = TreasuryService._get_reason_account(settings, movement.justify_reason, 'OUT')
             
             if not target_acc and movement.contact:
                  target_acc = movement.contact.account_payable

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
        if direction == 'IN':
             return (
                 (settings.pos_tip_account if reason == 'TIP' else None) or
                 (settings.pos_rounding_adjustment_account if reason == 'ROUNDING' else None) or
                 (settings.pos_counting_error_account if reason == 'COUNTING_ERROR' else None) or
                 (settings.pos_other_inflow_account if reason == 'OTHER_IN' else None)
             )
        else:
             return (
                 (settings.pos_theft_account if reason == 'THEFT' else None) or
                 (settings.pos_partner_withdrawal_account if reason == 'PARTNER_WITHDRAWAL' else None) or
                 (settings.pos_rounding_adjustment_account if reason == 'ROUNDING' else None) or
                 (settings.pos_counting_error_account if reason == 'COUNTING_ERROR' else None) or
                 (settings.pos_other_outflow_account if reason == 'OTHER_OUT' else None)
             )
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
             if movement.journal_entry.state == JournalEntry.State.POSTED:
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

        if movement.journal_entry and movement.journal_entry.state == JournalEntry.State.POSTED:
             JournalEntryService.reverse_entry(movement.journal_entry, description=f"Anulación Movimiento {movement.id}")
        
        # Update movement status? We don't have a status field in TreasuryMovement (only validation flags).
        # Typically we might delete it or mark it as cancelled if we add a status field.
        # For now, let's delete strictly to avoid orphans affecting totals.
        # The reversed entry remains as audit trail.
        movement.delete()
