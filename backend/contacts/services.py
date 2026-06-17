import logging
from django.db import transaction
from django.core.exceptions import ValidationError
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
                metadata={'contact_id': contact.id}
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
                _("No se puede degradar. El socio tiene capital suscrito. "
                  "Realice un retiro de capital total o transferencia de acciones primero.")
            )

        # Guard 2: Verificar si tiene retiros provisorios no liquidados
        if contact.partner_provisional_withdrawals_balance > 0:
            raise ValidationError(
                _("No se puede degradar. El socio tiene retiros provisorios pendientes de liquidar.")
            )

        # Guard 3: Verificar si tiene utilidades retenidas o dividendos por pagar
        if contact.partner_earnings_balance > 0 or contact.partner_dividends_payable_balance > 0:
            raise ValidationError(
                _("No se puede degradar. El socio tiene utilidades retenidas o dividendos por pagar.")
            )

        contact.is_partner = False
        contact.save()

        if user:
            from core.services import ActionLoggingService
            ActionLoggingService.log_action(
                user=user,
                action_type="CONTACT_DEMOTED",
                description="Degradado de socio a contacto normal.",
                metadata={'contact_id': contact.id}
            )

        return contact
