"""Selectores de RRHH (zero N+1, ADR-0118)."""

from django.db.models import DecimalField, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce

from .models import EmployeeMovement, PayrollAllocation


def employee_movements_for_list():
    """Movimientos con lo que la API lee: contraparte, asiento/tesorería, cuotas, asignaciones y capital aplicado."""
    allocations = PayrollAllocation.objects.select_related("movement", "installment", "payroll")
    return (
        EmployeeMovement.objects.select_related(
            "employee", "employee__contact", "journal_entry__treasury_movement__payment_method_new"
        )
        .prefetch_related("installments", Prefetch("allocations", queryset=allocations))
        .annotate(
            applied_annot=Coalesce(
                Sum("allocations__principal_part", filter=Q(allocations__payroll__status="POSTED")),
                Value(0),
                output_field=DecimalField(max_digits=14, decimal_places=0),
            )
        )
        .order_by("-date", "-id")  # Meta.ordering se ignora en consultas con agregación
    )
