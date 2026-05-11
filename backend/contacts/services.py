import logging
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from accounting.models import AccountingSettings, Account
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
        Crea las 4 sub-cuentas contables si la empresa las tiene configuradas.
        """
        if contact.is_partner:
            # Ya es socio, no hacer nada (idempotente) o simplemente actualizar
            pass
        else:
            contact.is_partner = True

        settings = AccountingSettings.get_solo()
        if not settings:
            raise ValidationError(_("No existe configuración contable global."))

        # Mapeo: (campo en Contact, campo en AccountingSettings, Prefijo para el nombre)
        account_specs = [
            ('partner_contribution_account', 'partner_capital_contribution_account', 'C.A.'),
            ('partner_provisional_withdrawal_account', 'partner_provisional_withdrawal_account', 'R.P.'),
            ('partner_earnings_account', 'partner_current_year_earnings_account', 'Ut.'),
            ('partner_dividends_payable_account', 'partner_dividends_payable_account', 'Div.'),
        ]

        accounts_created = []

        for contact_field, settings_field, prefix in account_specs:
            if not getattr(contact, f'{contact_field}_id'):
                parent_account = getattr(settings, settings_field, None)
                if parent_account:
                    # Crear subcuenta
                    new_acc = Account.objects.create(
                        name=f"{prefix} {contact.name}",
                        parent=parent_account,
                        account_type=parent_account.account_type,
                        # Para evitar que el usuario lo use libremente, se podría
                        # marcar requires_partner_transaction=True, pero no existe esa flag.
                    )
                    setattr(contact, contact_field, new_acc)
                    accounts_created.append(new_acc.name)
                else:
                    logger.warning(
                        f"Configuración contable faltante: {settings_field}. "
                        f"No se creó cuenta para el socio {contact.name}."
                    )

        contact.save()
        
        if accounts_created and user:
            from core.services import ActionLoggingService
            ActionLoggingService.log_action(
                user=user,
                action_type="CONTACT_PROMOTED",
                description=f"Promovido a socio y creadas cuentas: {', '.join(accounts_created)}",
                metadata={'contact_id': contact.id, 'accounts': accounts_created}
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
        
        # Eliminar las 4 cuentas vinculadas (solo si no tienen asientos contables, lo cual 
        # está garantizado parcialmente por los guards y on_delete=PROTECT en JournalItem).
        # Para ser seguros, capturamos error de ProtectedError.
        from django.db.models import ProtectedError
        
        account_fields = [
            'partner_contribution_account',
            'partner_provisional_withdrawal_account',
            'partner_earnings_account',
            'partner_dividends_payable_account',
        ]

        deleted_accounts = []

        try:
            for field in account_fields:
                acc = getattr(contact, field)
                if acc:
                    # Desvincular primero
                    setattr(contact, field, None)
                    # Eliminar la cuenta del plan de cuentas
                    # (Si tiene movimientos fallará con ProtectedError)
                    deleted_accounts.append(acc.name)
                    acc.delete()
        except ProtectedError:
            raise ValidationError(
                _("No se puede degradar. Una o más cuentas de socio tienen asientos contables "
                  "históricos. Contacte a soporte para anular las cuentas manualmente.")
            )

        contact.save()

        if user:
            from core.services import ActionLoggingService
            ActionLoggingService.log_action(
                user=user,
                action_type="CONTACT_DEMOTED",
                description="Degradado de socio a contacto normal.",
                metadata={'contact_id': contact.id, 'accounts_deleted': deleted_accounts}
            )

        return contact
