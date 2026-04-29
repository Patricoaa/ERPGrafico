"""
allocation_service.py — S5.2 (Gap B13, F13)

Handles creation, replacement and validation of PaymentAllocation records.
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from .models import PaymentAllocation, TreasuryMovement

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


class AllocationService:
    """Service layer for split-payment allocations (S5.1 / B13)."""

    # ── Public API ───────────────────────────────────────────────────────────

    @staticmethod
    def allocate(
        movement: TreasuryMovement,
        allocations: list[dict],
        user: "AbstractUser | None" = None,
        validate_sum: bool = True,
    ) -> list[PaymentAllocation]:
        """
        Replace all existing allocations for *movement* with the given list.

        Each dict in *allocations* must contain exactly one of:
            invoice, sale_order, purchase_order, bank_statement_line  (int id)
        plus ``amount`` (Decimal | str | int).

        Args:
            movement:      TreasuryMovement instance.
            allocations:   List of dicts describing each allocation row.
            user:          Authenticated user creating the allocations (may be None).
            validate_sum:  If True (default) raises if sum(amounts) ≠ movement.amount.
                           Pass False to allow partial/draft allocations.

        Returns:
            List of created PaymentAllocation instances.

        Raises:
            ValidationError: On invalid input or sum mismatch (when validate_sum=True).
        """
        if not allocations:
            raise ValidationError(_("Debe proporcionar al menos una distribución."))

        AllocationService._validate_rows(allocations)

        total = sum(Decimal(str(row["amount"])) for row in allocations)

        if validate_sum:
            AllocationService._assert_sum_equals_movement(movement, total)

        with transaction.atomic():
            # Delete existing allocations for this movement
            PaymentAllocation.objects.filter(treasury_movement=movement).delete()

            created: list[PaymentAllocation] = []
            for row in allocations:
                alloc = PaymentAllocation(
                    treasury_movement=movement,
                    amount=Decimal(str(row["amount"])),
                    notes=row.get("notes", ""),
                    created_by=user,
                    invoice_id=row.get("invoice"),
                    sale_order_id=row.get("sale_order"),
                    purchase_order_id=row.get("purchase_order"),
                    bank_statement_line_id=row.get("bank_statement_line"),
                )
                alloc.full_clean()   # triggers clean() → XOR validation
                alloc.save()
                created.append(alloc)

        return created

    @staticmethod
    def get_allocations(movement_id: int):
        """Return queryset of allocations for a movement, with related objects."""
        return (
            PaymentAllocation.objects
            .filter(treasury_movement_id=movement_id)
            .select_related(
                "invoice",
                "sale_order",
                "purchase_order",
                "bank_statement_line",
                "created_by",
            )
            .order_by("created_at")
        )

    @staticmethod
    def validate_sum(movement: TreasuryMovement, allocations: list[dict]) -> None:
        """
        Public helper: raises ValidationError if sum of amounts ≠ movement.amount.
        Useful for client-side pre-validation before committing.
        """
        total = sum(Decimal(str(row["amount"])) for row in allocations)
        AllocationService._assert_sum_equals_movement(movement, total)

    @staticmethod
    def get_allocation_summary(movement_id: int) -> dict:
        """
        Returns a summary dict: {total_allocated, movement_amount, remaining, is_complete}.
        Useful for UI progress indicator.
        """
        try:
            movement = TreasuryMovement.objects.get(id=movement_id)
        except TreasuryMovement.DoesNotExist:
            raise ValidationError(_("Movimiento no encontrado."))

        from django.db.models import Sum
        total_allocated = (
            PaymentAllocation.objects
            .filter(treasury_movement_id=movement_id)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )

        remaining = movement.amount - total_allocated
        return {
            "movement_amount": movement.amount,
            "total_allocated": total_allocated,
            "remaining": remaining,
            "is_complete": remaining == Decimal("0"),
        }

    # ── Private helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _validate_rows(allocations: list[dict]) -> None:
        """Basic structure validation for each allocation dict."""
        target_keys = {"invoice", "sale_order", "purchase_order", "bank_statement_line"}
        for i, row in enumerate(allocations):
            if "amount" not in row:
                raise ValidationError(
                    _("Fila %(i)d: falta el campo 'amount'.") % {"i": i + 1}
                )
            try:
                val = Decimal(str(row["amount"]))
            except Exception:
                raise ValidationError(
                    _("Fila %(i)d: 'amount' debe ser un número válido.") % {"i": i + 1}
                )
            if val <= 0:
                raise ValidationError(
                    _("Fila %(i)d: el monto debe ser positivo.") % {"i": i + 1}
                )
            defined = sum(1 for k in target_keys if row.get(k) is not None)
            if defined == 0:
                raise ValidationError(
                    _("Fila %(i)d: debe especificar un documento destino.") % {"i": i + 1}
                )
            if defined > 1:
                raise ValidationError(
                    _("Fila %(i)d: solo puede asignar a un documento por fila.") % {"i": i + 1}
                )

    @staticmethod
    def _assert_sum_equals_movement(movement: TreasuryMovement, total: Decimal) -> None:
        if total != movement.amount:
            raise ValidationError(
                _("La suma de las distribuciones (%(total)s) no coincide con el monto "
                  "del movimiento (%(amount)s).") % {
                    "total": total,
                    "amount": movement.amount,
                }
            )
