"""Selectores de RRHH (zero N+1, ADR-0118)."""

from django.db.models import Prefetch

from .models import EmployeeMovement, PayrollAllocation


def employee_movements_for_list():
    """Movimientos con lo que la API lee: contraparte, asiento/tesorería, cuotas y asignaciones (los saldos se calculan en Python sobre lo precargado)."""
    allocations = PayrollAllocation.objects.select_related("movement", "installment", "payroll")
    return (
        EmployeeMovement.objects.select_related(
            "employee", "employee__contact", "journal_entry__treasury_movement__payment_method_new"
        )
        .prefetch_related("installments__allocations", Prefetch("allocations", queryset=allocations))
        .order_by("-date", "-id")
    )
