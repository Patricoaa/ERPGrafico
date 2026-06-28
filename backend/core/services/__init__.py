from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone


class SequenceService:
    """
    Centralized service to handle sequential numbering for different entities.
    Example: NV-000001, OC-000001, etc.
    """

    @staticmethod
    def get_next_number(
        model_class, field_name="number", padding=6, filter_kwargs=None, year_prefix=False
    ):
        """
        Calculates the next numeric value for a given model and field.
        """
        queryset = model_class.objects.all()

        current_year = None
        if year_prefix:
            current_year = timezone.now().year
            if filter_kwargs is None:
                filter_kwargs = {}
            filter_kwargs["created_at__year"] = current_year

        if filter_kwargs:
            queryset = queryset.filter(**filter_kwargs)

        last_instance = queryset.order_by("id").last()
        seq_str = "1".zfill(padding)

        if last_instance:
            curr_number = getattr(last_instance, field_name)
            # Try to extract numbers from common patterns (e.g., BOL-123 -> 123)
            # if curr_number is not purely digits
            if curr_number:
                import re

                nums = re.findall(r"\d+", str(curr_number))
                if nums:
                    try:
                        next_val = int(nums[-1]) + 1
                        seq_str = str(next_val).zfill(padding)
                    except (ValueError, IndexError) as e:
                        import logging

                        logging.getLogger(__name__).warning(
                            f"Error extracting sequence number: {e}"
                        )

        if year_prefix:
            return f"{current_year}-{seq_str}"
        return seq_str

    @staticmethod
    def format_number(prefix, number):
        """Helper to format a number with a prefix if needed"""
        return f"{prefix}{number}"


class BaseNoteService:
    @staticmethod
    def create_document_note(
        order,
        note_type,
        amount_net,
        amount_tax,
        document_number,
        document_attachment=None,
        partner_name=None,
        receivable_account=None,
        payable_account=None,
        revenue_account=None,
        tax_account=None,
        inventory_account=None,
        date=None,
    ):
        """
        Base logic for creating Credit/Debit Notes and their corresponding Accounting Entries.
        """
        from accounting.models import JournalEntry, JournalItem
        from accounting.services import JournalEntryService
        from billing.models import Invoice

        total_amount = amount_net + amount_tax
        doc_date = date or timezone.now().date()

        # 1. Create Invoice Record
        invoice_data = {
            "dte_type": note_type,
            "number": document_number,
            "document_attachment": document_attachment,
            "date": doc_date,
            "total_net": amount_net,
            "total_tax": amount_tax,
            "total": total_amount,
            "status": Invoice.Status.POSTED,
        }

        invoice_field = order.totals_strategy.invoice_field
        invoice_data[invoice_field] = order

        invoice = Invoice.objects.create(**invoice_data)

        # 2. Accounting Entry
        description = f"{invoice.get_dte_type_display()} {document_number} (Ref {order.number})"
        entry = JournalEntry.objects.create(
            date=doc_date,
            description=description,
            reference=f"NOTE-{invoice.id}",
            status=JournalEntry.State.DRAFT,
            source_content_type=ContentType.objects.get_for_model(invoice._meta.model),
            source_object_id=invoice.id,
        )

        return invoice, entry


class ActionLoggingService:
    @staticmethod
    def log_action(user, action_type, description, request=None, metadata=None):
        from core.models import ActionLog

        ip_address = None
        if request:
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(",")[0]
            else:
                ip_address = request.META.get("REMOTE_ADDR")

        return ActionLog.objects.create(
            user=user,
            action_type=action_type,
            description=description,
            ip_address=ip_address,
            metadata=metadata or {},
        )

    @staticmethod
    def log_failed_login(username, request):
        from core.models import User, ActionLog

        u = User.objects.filter(username=username).first()
        ActionLoggingService.log_action(
            user=u,
            action_type=ActionLog.Type.SECURITY,
            description=f"Fallo login '{username}'.",
            request=request,
        )

    @staticmethod
    def log_successful_login(username, request):
        from core.models import User, ActionLog

        u = User.objects.filter(username=username).first()
        if u:
            ActionLoggingService.log_action(
                user=u,
                action_type=ActionLog.Type.LOGIN,
                description=f"Login {u.username}",
                request=request,
            )


class PINService:
    @staticmethod
    def validate_pin(pin_text):
        """
        Validates if a plain-text PIN matches ANY active user's pos_pin.
        Returns the User object if found and valid, else None.
        """
        if not pin_text:
            return None

        from core.models import User

        # Iterate active users to check hashes.
        # Note: Optimize with a separate lookup table or PIN salt if scale becomes an issue.
        active_users = (
            User.objects.filter(is_active=True).exclude(pos_pin__isnull=True).exclude(pos_pin="")
        )

        for user in active_users:
            if user.check_pos_pin(pin_text):
                return user
        return None


class UserService:
    """
    Operaciones de ciclo de vida del usuario (seguridad, acceso).

    Centraliza mutaciones de User que antes estaban directamente en las vistas
    ChangePasswordView, ChangePinView y UserViewSet.
    """

    @staticmethod
    def change_password(*, user, new_password: str, request=None) -> None:
        """
        Cambia la contraseña del usuario y registra la acción en el audit log.

        Reemplaza ``user.set_password(); user.save()`` + ``ActionLoggingService.log_action``
        que estaban en ``ChangePasswordView.post``.
        """
        from core.models import ActionLog

        user.set_password(new_password)
        user.save(update_fields=["password"])

        ActionLoggingService.log_action(
            user=user,
            action_type=ActionLog.Type.SECURITY,
            description=f"Usuario {user.username} cambió su contraseña.",
            request=request,
        )

    @staticmethod
    def change_pin(*, user, new_pin: str, request=None) -> None:
        """
        Actualiza el PIN de POS del usuario y registra la acción en el audit log.

        Reemplaza ``user.pos_pin = make_password(pin); user.save()`` + log que
        estaban en ``ChangePinView.post``.
        """
        from django.contrib.auth.hashers import make_password

        from core.models import ActionLog

        user.pos_pin = make_password(new_pin)
        user.save(update_fields=["pos_pin"])

        ActionLoggingService.log_action(
            user=user,
            action_type=ActionLog.Type.SECURITY,
            description=f"Usuario {user.username} cambió su PIN de POS.",
            request=request,
        )

    @staticmethod
    def deactivate(*, user, deactivated_by=None, request=None) -> None:
        """
        Desactiva un usuario en lugar de eliminarlo (soft-delete de seguridad).

        Reemplaza ``instance.is_active = False; instance.save()`` + log que estaban
        en ``UserViewSet.destroy``.
        """
        from core.models import ActionLog

        user.is_active = False
        user.save(update_fields=["is_active"])

        ActionLoggingService.log_action(
            user=deactivated_by or user,
            action_type=ActionLog.Type.SECURITY,
            description=f"Usuario {user.username} fue desactivado (Baja de sistema) en lugar de eliminado para trazabilidad.",
            request=request,
            metadata={"target_user_id": user.id, "target_username": user.username},
        )
