"""Datos: SalaryAdvance y PayrollPayment SALARIO → EmployeeMovement + PayrollAllocation (ADR-0156).

Reversible. Los PayrollPayment PREVIRED no se tocan. Las tablas viejas se retiran en 0019. El reverso
recrea anticipos y pagos de sueldo; los préstamos no tienen equivalente anterior y se descartan.
"""

from django.db import migrations

ADVANCE_TO_MOVEMENT = {"DRAFT": "DRAFT", "PAID": "POSTED", "DISCOUNTED": "SETTLED", "CANCELLED": "CANCELLED"}
MOVEMENT_TO_ADVANCE = {v: k for k, v in ADVANCE_TO_MOVEMENT.items()}


def _allocation(Allocation, movement, payroll_id, amount):
    return Allocation(movement=movement, payroll_id=payroll_id, amount=amount, principal_part=amount, interest_part=0)


def forward(apps, schema_editor):
    SalaryAdvance = apps.get_model("hr", "SalaryAdvance")
    PayrollPayment = apps.get_model("hr", "PayrollPayment")
    Movement = apps.get_model("hr", "EmployeeMovement")
    Allocation = apps.get_model("hr", "PayrollAllocation")

    for adv in SalaryAdvance.objects.all():
        movement = Movement.objects.create(
            employee_id=adv.employee_id, kind="ADVANCE", date=adv.date, amount=adv.amount, notes=adv.notes,
            status=ADVANCE_TO_MOVEMENT[adv.status], journal_entry_id=adv.journal_entry_id,
        )
        Movement.objects.filter(pk=movement.pk).update(created_at=adv.created_at, updated_at=adv.updated_at)
        if adv.payroll_id:
            _allocation(Allocation, movement, adv.payroll_id, adv.amount).save()

    for pay in PayrollPayment.objects.filter(payment_type="SALARIO").select_related("payroll"):
        movement = Movement.objects.create(
            employee_id=pay.payroll.employee_id, kind="PAYMENT", date=pay.date, amount=pay.amount, notes=pay.notes,
            status="CANCELLED" if pay.status == "CANCELLED" else "POSTED", journal_entry_id=pay.journal_entry_id,
        )
        Movement.objects.filter(pk=movement.pk).update(created_at=pay.created_at, updated_at=pay.updated_at)
        _allocation(Allocation, movement, pay.payroll_id, pay.amount).save()


def reverse(apps, schema_editor):
    SalaryAdvance = apps.get_model("hr", "SalaryAdvance")
    PayrollPayment = apps.get_model("hr", "PayrollPayment")
    Movement = apps.get_model("hr", "EmployeeMovement")

    SalaryAdvance.objects.all().delete()
    PayrollPayment.objects.filter(payment_type="SALARIO").delete()

    for movement in Movement.objects.filter(kind="ADVANCE").prefetch_related("allocations"):
        allocation = next(iter(movement.allocations.all()), None)
        SalaryAdvance.objects.create(
            employee_id=movement.employee_id, payroll_id=allocation.payroll_id if allocation else None,
            amount=movement.amount, date=movement.date, notes=movement.notes,
            status=MOVEMENT_TO_ADVANCE[movement.status], journal_entry_id=movement.journal_entry_id,
        )
    for movement in Movement.objects.filter(kind="PAYMENT").prefetch_related("allocations"):
        allocation = next(iter(movement.allocations.all()), None)
        if allocation is None:
            continue
        PayrollPayment.objects.create(
            payroll_id=allocation.payroll_id, payment_type="SALARIO", amount=movement.amount, date=movement.date,
            notes=movement.notes, journal_entry_id=movement.journal_entry_id,
            status="CANCELLED" if movement.status == "CANCELLED" else "POSTED",
        )
    Movement.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("hr", "0017_employee_movements")]
    operations = [migrations.RunPython(forward, reverse)]
