from datetime import date
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounting.glosa_builder import GlosaBuilder, Roles
from accounting.models import AccountingSettings, JournalEntry, JournalItem
from accounting.services import JournalEntryService
from treasury.check_service import CheckService
from treasury.models import TreasuryMovement


class TreasuryReturnService:
    """
    Service for handling payment returns.
    Only available for payments linked to DRAFT invoices.
    """

    @staticmethod
    def register_payment_return_from_request(request, payment: TreasuryMovement):
        amount = request.data.get("amount")
        reason = request.data.get("reason", "")
        treasury_account_id = request.data.get("treasury_account_id")

        if not amount:
            raise ValidationError("Debe especificar el monto a devolver.")

        amount_decimal = Decimal(str(amount))
        return TreasuryReturnService.register_payment_return(
            payment, amount_decimal, reason=reason, treasury_account_id=treasury_account_id
        )

    @staticmethod
    @transaction.atomic
    def register_payment_return(
        payment: TreasuryMovement,
        amount: Decimal,
        return_date: date = None,
        reason: str = "",
        treasury_account_id: int = None,
    ):
        """
        Registers payment return (partial or total).
        Only for payments linked to DRAFT invoices.

        Args:
            payment: Original TreasuryMovement to return
            amount: Amount being returned (Positive)
            return_date: Date of return (defaults to today)
            reason: Reason for return
            treasury_account_id: Account receiving/sending the returned funds

        Returns:
            TreasuryMovement: Return movement record

        Raises:
            ValidationError: If invoice is not DRAFT or amount invalid
        """
        # 1. Validate invoice status (must be DRAFT)
        if payment.invoice and payment.invoice.status != "DRAFT":
            raise ValidationError(
                "❌ Solo se pueden devolver pagos de facturas en borrador.\n"
                "📋 Para facturas publicadas, use una Nota de Crédito."
            )

        # 2. Validate amount
        if amount > payment.amount:
            raise ValidationError(
                f"❌ Monto a devolver ({amount}) excede monto del pago ({payment.amount})."
            )

        if amount <= 0:
            raise ValidationError("❌ El monto a devolver debe ser mayor a cero.")

        # Determine movement type/account logic
        movement_type = "OUTBOUND"
        from_account = None
        to_account = None

        current_treasury = treasury_account_id or (
            payment.to_account.id
            if payment.to_account
            else (payment.from_account.id if payment.from_account else None)
        )
        resolved_account = None
        if current_treasury:
            # We need the object instance for TreasuryMovement
            # We'll resolve it simply by ID
            resolved_account = (
                payment.to_account
                if payment.to_account and payment.to_account.id == current_treasury
                else (
                    payment.from_account
                    if payment.from_account and payment.from_account.id == current_treasury
                    else None
                )
            )
            if not resolved_account:
                # Fallback query if ID changed
                from treasury.models import TreasuryAccount

                resolved_account = TreasuryAccount.objects.get(pk=current_treasury)

        if payment.sale_order:
            # Customer Return: Us -> Customer (OUTBOUND)
            movement_type = "OUTBOUND"
            from_account = resolved_account
        elif payment.purchase_order:
            # Supplier Return: Supplier -> Us (INBOUND)
            movement_type = "INBOUND"
            to_account = resolved_account
        else:
            # Fallback/Manual logic? Assume OUTBOUND if original was INBOUND, vice versa.
            if payment.movement_type == "INBOUND":
                movement_type = "OUTBOUND"
                from_account = resolved_account
            else:
                movement_type = "INBOUND"
                to_account = resolved_account

        # 3. Check if original payment is a Check → route through CheckService
        check = getattr(payment, "check_receipt", None)
        if check:
            return_movement = CheckService.void_and_return_movement(check, notes=reason)
            from_account = return_movement.from_account
            to_account = return_movement.to_account
        else:
            # 3. Generic return movement (no check involved)
            return_movement = TreasuryMovement.objects.create(
                movement_type=movement_type,
                payment_method=payment.payment_method,
                amount=amount,
                reference=f"DEV-{payment.id}",
                contact=payment.contact,
                invoice=payment.invoice,
                sale_order=payment.sale_order,
                purchase_order=payment.purchase_order,
                from_account=from_account,
                to_account=to_account,
                transaction_number=f"DEV-{payment.transaction_number}"
                if payment.transaction_number
                else None,
                notes=f"Devolución de pago: {reason}",
                date=return_date or timezone.now().date(),
            )

        # 4. Create accounting entry (separate reversal entry)
        settings = AccountingSettings.get_solo()

        # Determine accounts based on payment type
        if payment.sale_order:
            # Sale payment return
            partner_account = settings.default_receivable_account
            # Treasury Account to adjust
            treasury_acc = from_account

            entry = JournalEntry.objects.create(
                date=return_movement.date,
                description=GlosaBuilder.build(GlosaBuilder.DEVOLUCION_PAGO, f"DEV-{payment.id}", payment.contact.name if payment.contact else "", amount),
                reference=f"DEV-JE-{payment.id}",
                status=JournalEntry.State.DRAFT,
                source_content_type=ContentType.objects.get_for_model(TreasuryMovement),
                source_object_id=return_movement.id,
            )

            # Debit: Receivable (Customer owes us again)
            JournalItem.objects.create(
                entry=entry,
                account=partner_account,
                debit=amount,
                credit=0,
                partner=payment.contact,
                partner_name=payment.contact.name if payment.contact else None,
                label=GlosaBuilder.item(Roles.CXC, reason, f"DEV-{payment.id}"),
            )

            # Credit: Cash/Bank (Money leaves our account)
            JournalItem.objects.create(
                entry=entry,
                account=treasury_acc.account if hasattr(treasury_acc, "account") else treasury_acc,
                debit=0,
                credit=amount,
                label=GlosaBuilder.item(Roles.EFECTIVO, "Devolución", f"DEV-{payment.id}"),
            )

        elif payment.purchase_order:
            # Purchase payment return
            partner_account = settings.default_payable_account
            treasury_acc = to_account

            entry = JournalEntry.objects.create(
                date=return_movement.date,
                description=GlosaBuilder.build(GlosaBuilder.DEVOLUCION_PAGO, f"DEV-{payment.id}", payment.contact.name if payment.contact else "", amount),
                reference=f"DEV-JE-{payment.id}",
                status=JournalEntry.State.DRAFT,
                source_content_type=ContentType.objects.get_for_model(TreasuryMovement),
                source_object_id=return_movement.id,
            )

            # Debit: Cash/Bank (Money comes back)
            JournalItem.objects.create(
                entry=entry,
                account=treasury_acc.account if hasattr(treasury_acc, "account") else treasury_acc,
                debit=amount,
                credit=0,
                label=GlosaBuilder.item(Roles.EFECTIVO, "Devolución", f"DEV-{payment.id}"),
            )

            # Credit: Payable (We owe them again)
            JournalItem.objects.create(
                entry=entry,
                account=partner_account,
                debit=0,
                credit=amount,
                partner=payment.contact,
                partner_name=payment.contact.name if payment.contact else None,
                label=GlosaBuilder.item(Roles.CXP, reason, f"DEV-{payment.id}"),
            )

        JournalEntryService.post_entry(entry)
        return_movement.journal_entry = entry
        return_movement.save()

        # 5. Update order pending amount
        if payment.sale_order:
            payment.sale_order.pending_amount = (payment.sale_order.pending_amount or 0) + amount
            payment.sale_order.save()
        elif payment.purchase_order:
            payment.purchase_order.pending_amount = (
                payment.purchase_order.pending_amount or 0
            ) + amount
            payment.purchase_order.save()

        return return_movement
