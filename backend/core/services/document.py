from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, ClassVar

if TYPE_CHECKING:
    from accounting.models import JournalEntry


def lock_document(instance):
    """
    Adquiere el row-lock del documento dentro de la transacción actual
    (select_for_update; no-op en SQLite) y refresca la instancia in place
    para decidir sobre el estado real, no el del momento de la request.
    """
    type(instance).objects.select_for_update().only("pk").get(pk=instance.pk)
    instance.refresh_from_db()
    return instance


class DocumentService(ABC):
    """Servicio polimórfico para procesar cualquier documento transaccional."""

    @abstractmethod
    def confirm(self, document, *, user, **kwargs) -> "JournalEntry":
        """Confirma el documento (DRAFT → CONFIRMED). Genera asiento."""
        ...

    @abstractmethod
    def cancel(self, document, *, user, reason: str = "", **kwargs) -> None:
        """Anula el documento. Genera asiento de reverso si aplica."""
        ...

    def _cancel_order_base(
        self,
        order,
        *,
        user,
        reason: str = "",
        cancelled_status,
        force: bool = False,
    ):
        """
        Template method para anular una orden transaccional (SaleOrder / PurchaseOrder)
        y coordinar la anulación en cascada de sus documentos asociados.
        """
        from django.core.exceptions import ValidationError

        lock_document(order)

        if order.status == cancelled_status:
            return order

        if not reason:
            raise ValidationError("Debe indicar el motivo de la anulación.")

        from billing.models import Invoice
        from billing.services import BillingService
        from treasury.models import TreasuryMovement
        from treasury.services import TreasuryService

        # 1. Facturas: cancelar si DRAFT, anular si POSTED/PAID
        for invoice in order.invoices.all():
            if invoice.status == Invoice.Status.CANCELLED:
                continue
            if invoice.status == Invoice.Status.DRAFT:
                BillingService.cancel_invoice(invoice, user=user, reason=reason)
            else:
                BillingService.annul_invoice(invoice, force=force, user=user, reason=reason)

        # 2. Documentos físicos de movimiento (despachos o recepciones)
        self._cancel_physical_documents(order, user=user, reason=reason, force=force)

        # 3. Pagos de tesorería: cancelar si DRAFT (sin JE POSTED), anular si POSTED
        for movement in order.payments.all():
            if movement.status == TreasuryMovement.MovementStatus.CANCELLED:
                continue
            je_posted = movement.journal_entry and movement.journal_entry.status == "POSTED"
            if movement.status == TreasuryMovement.MovementStatus.DRAFT and not je_posted:
                TreasuryService.cancel_movement(movement, user=user, reason=reason)
            else:
                TreasuryService.annul_movement(
                    movement,
                    user=user,
                    reason=reason,
                    treasury_account_id=(
                        movement.to_account_id
                        if movement.movement_type == "INBOUND"
                        else movement.from_account_id
                    ),
                )

        # 4. Documentos auxiliares (ej. órdenes de trabajo de producción en ventas)
        self._cancel_auxiliary_documents(order, user=user, reason=reason, force=force)

        # 5. Persistir estado y notas
        order.status = cancelled_status
        if reason:
            order.notes = (order.notes or "") + f"\nAnulado: {reason}"
        order.save()

        from workflow.services import WorkflowService

        WorkflowService.log_transition(order, "annul", user=user, reason=reason)
        return order

    def _cancel_physical_documents(self, order, *, user, reason: str, force: bool = False):
        """Hook para documentos físicos asociados (despachos o recepciones)."""
        pass

    def _cancel_auxiliary_documents(self, order, *, user, reason: str, force: bool = False):
        """Hook opcional para documentos auxiliares (OTs de producción)."""
        pass

    def get_metadata(self) -> dict:
        """Override opcional para extender el schema (ver P-06)."""
        return {}


class DocumentRegistry:
    _services: ClassVar[dict[str, type[DocumentService]]] = {}

    @classmethod
    def register(cls, model_label: str):
        def decorator(service_cls):
            cls._services[model_label.lower()] = service_cls
            return service_cls

        return decorator

    @classmethod
    def for_instance(cls, instance) -> DocumentService:
        label = instance._meta.label_lower
        try:
            return cls._services[label]()
        except KeyError:
            raise NotImplementedError(f"No DocumentService registered for {label}")

    @classmethod
    def for_label(cls, label: str) -> DocumentService:
        try:
            return cls._services[label.lower()]()
        except KeyError:
            raise NotImplementedError(f"No DocumentService registered for {label}")
