import logging
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from contacts.models import Contact

logger = logging.getLogger(__name__)


class ContactPartnerService:
    """
    Servicio para gestionar la promoción de un Contacto a Socio (Partner) y su degradación.
    T-22.
    """

    @staticmethod
    @transaction.atomic
    def promote_to_partner(contact: Contact, *, user=None) -> Contact:
        """
        Promueve un Contact a Socio.
        Las cuentas contables ahora se usan desde AccountingSettings (configuración global).
        """
        if not contact.is_partner:
            contact.is_partner = True
            contact.save()

        if user:
            from core.services import ActionLoggingService

            ActionLoggingService.log_action(
                user=user,
                action_type="CONTACT_PROMOTED",
                description=f"Promovido a socio: {contact.name}",
                metadata={"contact_id": contact.id},
            )

        return contact

    @staticmethod
    @transaction.atomic
    def demote_from_partner(contact: Contact, *, user=None) -> Contact:
        """
        Degrada a un Socio de vuelta a Contacto normal.
        Aplica guards: no debe tener saldo ni histórico de transacciones patrimoniales
        que impida la eliminación o desactivación de sus cuentas.
        """
        if not contact.is_partner:
            return contact

        # Guard 1: Verificar si el socio tiene acciones o aportes
        if contact.partner_total_contributions > 0:
            raise ValidationError(
                _(
                    "No se puede degradar. El socio tiene capital suscrito. "
                    "Realice un retiro de capital total o transferencia de acciones primero."
                )
            )

        # Guard 2: Verificar si tiene retiros provisorios no liquidados
        if contact.partner_provisional_withdrawals_balance > 0:
            raise ValidationError(
                _(
                    "No se puede degradar. El socio tiene retiros provisorios pendientes de liquidar."
                )
            )

        # Guard 3: Verificar si tiene utilidades retenidas o dividendos por pagar
        if contact.partner_earnings_balance > 0 or contact.partner_dividends_payable_balance > 0:
            raise ValidationError(
                _(
                    "No se puede degradar. El socio tiene utilidades retenidas o dividendos por pagar."
                )
            )

        contact.is_partner = False
        contact.save()

        if user:
            from core.services import ActionLoggingService

            ActionLoggingService.log_action(
                user=user,
                action_type="CONTACT_DEMOTED",
                description="Degradado de socio a contacto normal.",
                metadata={"contact_id": contact.id},
            )

        return contact

class ContactService:
    @staticmethod
    def validate_deletion(contact):
        if contact.is_default_customer or contact.is_default_vendor:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "No se puede eliminar un cliente o proveedor por defecto del sistema."
            )

    @classmethod
    def write_off_debt_from_request(cls, request, contact):
        total, entry = cls.write_off_debt(contact)
        return {'message': f'Castigo procesado. Se han regularizado {total} a pérdidas.', 'journal_entry': entry.display_id, 'amount': str(total)}

    @classmethod
    def recover_written_off_debt_from_request(cls, request, contact):
        from decimal import Decimal
        from rest_framework.exceptions import ValidationError
        amount_str = request.data.get('amount')
        if not amount_str: raise ValidationError('Debe especificar el monto recuperado.')
        amount = Decimal(amount_str)
        entry = cls.recover_written_off_debt(contact, amount)
        return {'message': f'Recuperación procesada por {amount}.', 'journal_entry': entry.display_id}

    @classmethod
    def initial_setup_from_request(cls, request):
        from .partner_models import RetainedEarnings
        from datetime import date
        from decimal import Decimal
        from rest_framework.exceptions import ValidationError
        amount_str = request.data.get('amount')
        date_str = request.data.get('date', date.today().isoformat())
        notes = request.data.get('notes', 'Saldo Inicial / Setup')
        if not amount_str: raise ValidationError('Monto requerido.')
        RetainedEarnings.objects.create(amount=Decimal(amount_str), date=date_str, notes=notes)
        return {'message': 'Saldo inicial de utilidades retenidas configurado exitosamente.'}

    @classmethod
    def individual_dividend_payment_from_request(cls, request, contact):
        from rest_framework.exceptions import ValidationError
        from treasury.models import TreasuryAccount
        from decimal import Decimal
        v = request.data
        if 'amount' not in v or 'treasury_account_id' not in v: raise ValidationError('Monto y cuenta requeridos.')
        ta = TreasuryAccount.objects.get(pk=v['treasury_account_id'])
        entry = cls.individual_dividend_payment(partner=contact, amount=Decimal(str(v['amount'])), treasury_account=ta, date=v.get('date'), created_by=request.user)
        return {'message': 'Pago de dividendos procesado.', 'journal_entry': entry.display_id}

    @classmethod
    def mass_mobilize_retained_earnings_from_request(cls, request):
        from decimal import Decimal
        from rest_framework.exceptions import ValidationError
        amount = request.data.get('amount')
        if not amount: raise ValidationError('Monto requerido.')
        cls.mass_mobilize_retained_earnings(amount=Decimal(str(amount)), date=request.data.get('date'), created_by=request.user)
        return {'message': 'Utilidades retenidas movilizadas exitosamente.'}

    @staticmethod
    @transaction.atomic
    def write_off_debt(contact: Contact) -> tuple:
        from decimal import Decimal
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from treasury.models import TreasuryMovement
        from django.contrib.contenttypes.models import ContentType

        orders_with_balance = []
        total_balance = Decimal("0")

        orders = contact.sale_orders.exclude(status__in=["DRAFT", "CANCELLED"])
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum(
                (p.amount for p in payments if p.movement_type in ["INBOUND", "ADJUSTMENT"]),
                Decimal("0"),
            )
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == "OUTBOUND"), Decimal("0")
            )
            payments_net = paid_in - paid_out
            order_balance = order.effective_total - payments_net
            if order_balance > 0:
                orders_with_balance.append((order, order_balance))
                total_balance += order_balance

        if total_balance <= 0:
            raise ValidationError("El contacto no tiene deuda activa para castigar.")

        settings = AccountingSettings.get_solo()
        if not settings or not settings.default_uncollectible_expense_account:
            raise ValidationError("No hay una cuenta de gasto por incobrabilidad configurada en Contabilidad.")

        receivable_account = settings.default_receivable_account
        if not receivable_account:
            raise ValidationError("No se encontró una cuenta por cobrar configurada para este contacto o sistema.")

        entry = JournalEntry.objects.create(
            description=f"Castigo de deuda incobrable: {contact.name}",
            reference=f"CASTIGO-{contact.code}",
            status="POSTED",
            source_content_type=ContentType.objects.get_for_model(Contact),
            source_object_id=contact.id,
        )

        JournalItem.objects.create(
            entry=entry,
            account=settings.default_uncollectible_expense_account,
            label=f"Pérdida por incobrabilidad RUT {contact.tax_id}",
            debit=total_balance,
            credit=0,
        )

        JournalItem.objects.create(
            entry=entry,
            account=receivable_account,
            partner=contact,
            partner_name=contact.name,
            label=f"Cierre de deuda incobrable RUT {contact.tax_id}",
            debit=0,
            credit=total_balance,
        )

        for order, amount in orders_with_balance:
            TreasuryMovement.objects.create(
                movement_type="ADJUSTMENT",
                payment_method="WRITE_OFF",
                amount=amount,
                contact=contact,
                sale_order=order,
                journal_entry=entry,
                reference="CASTIGO",
                notes=f"Ajuste por castigo de deuda (Asiento {entry.display_id})",
                is_pending_registration=False,
            )

        if not contact.is_default_customer:
            contact.credit_blocked = True
            contact.credit_auto_blocked = False
            contact.credit_risk_level = "CRITICAL"
        from django.utils import timezone

        contact.credit_last_evaluated = timezone.now()
        contact.save()

        return total_balance, entry

    @staticmethod
    @transaction.atomic
    def recover_written_off_debt(contact: Contact, amount: Decimal) -> tuple:
        from accounting.models import AccountingSettings, JournalEntry, JournalItem
        from treasury.models import TreasuryMovement
        from django.contrib.contenttypes.models import ContentType

        settings = AccountingSettings.get_solo()

        recovery_account = (
            getattr(settings, "default_recovery_income_account", None)
            or settings.default_uncollectible_expense_account
        )

        if not recovery_account:
            raise ValidationError("No hay una cuenta de recuperación configurada.")

        from treasury.models import TreasuryAccount

        target_account = (
            TreasuryAccount.objects.filter(is_active=True).first()
            if hasattr(TreasuryAccount, "is_active")
            else TreasuryAccount.objects.first()
        )
        if not target_account:
            raise ValidationError("No hay una cuenta de tesorería activa para recibir el pago.")

        entry = JournalEntry.objects.create(
            description=f"Recuperación de deuda castigada: {contact.name}",
            reference=f"RECUP-{contact.code}",
            status="POSTED",
            source_content_type=ContentType.objects.get_for_model(Contact),
            source_object_id=contact.id,
        )

        JournalItem.objects.create(
            entry=entry,
            account=target_account.account,
            label=f"Ingreso por recuperación de deuda RUT {contact.tax_id}",
            debit=amount,
            credit=0,
        )

        JournalItem.objects.create(
            entry=entry,
            account=recovery_account,
            label=f"Recuperación de incobrable RUT {contact.tax_id}",
            debit=0,
            credit=amount,
        )

        TreasuryMovement.objects.create(
            movement_type="INBOUND",
            payment_method="OTHER",
            amount=amount,
            contact=contact,
            journal_entry=entry,
            reference="RECUPERACION",
            notes=f"Recuperación de deuda castigada (Asiento {entry.display_id})",
            is_pending_registration=False,
            to_account=target_account,
        )

        return entry

    @staticmethod
    @transaction.atomic
    def unblock_credit(*, contact: Contact, unblocked_by=None) -> Contact:
        """
        Rehabilita el crédito de un contacto bloqueado manualmente.

        Reemplaza el bloque ``contact.save()`` + ``WorkflowService.send_notification``
        que vivía en ``ContactViewSet.unblock_credit``.

        Args:
            contact: Instancia del contacto a desbloquear.
            unblocked_by: Usuario que ejecuta la acción (para el mensaje de notificación).

        Returns:
            Instancia ``Contact`` actualizada.
        """
        contact.credit_blocked = False
        contact.credit_auto_blocked = False
        contact.credit_risk_level = "LOW"
        contact.save(update_fields=["credit_blocked", "credit_auto_blocked", "credit_risk_level"])

        from workflow.services import WorkflowService

        actor = (
            unblocked_by.get_full_name() or unblocked_by.username
            if unblocked_by
            else "sistema"
        )
        WorkflowService.send_notification(
            notification_type="CREDIT_UNBLOCK",
            title=f"Crédito Rehabilitado: {contact.name}",
            message=f"El cliente ha sido desbloqueado manualmente por {actor}.",
            link=f"/credits/portfolio?search={contact.tax_id}",
            content_object=contact,
            level="SUCCESS",
        )
        return contact

    @staticmethod
    @transaction.atomic
    def setup_partner(*, contact: Contact, is_partner: bool, equity_percentage=None) -> Contact:
        """
        Habilita o actualiza la configuración de socio de un contacto.

        Reemplaza el bloque ``contact.is_partner = ...; contact.save()``
        que vivía en ``ContactViewSet.setup_partner``.

        Args:
            contact: Contacto a actualizar.
            is_partner: Valor booleano del flag de socio.
            equity_percentage: Porcentaje de participación (opcional).

        Returns:
            Instancia ``Contact`` actualizada.
        """
        update_fields = ["is_partner"]
        contact.is_partner = is_partner
        if equity_percentage is not None:
            contact.partner_equity_percentage = equity_percentage
            update_fields.append("partner_equity_percentage")
        contact.save(update_fields=update_fields)
        return contact
