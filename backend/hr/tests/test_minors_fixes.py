# ruff: noqa: F811 — los fixtures se importan de otros módulos de test
"""Minors diferidos de la revisión final de movimientos (ADR-0156)."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from hr import loans
from hr.models import EmployeeMovement
from hr.movement_services import EmployeeMovementService
from hr.tests.test_employee_movement_service import _loan, _posted, employee  # noqa: F401
from hr.tests.test_employee_movement_service import _payroll as svc_payroll

pytestmark = pytest.mark.django_db
BASE = "/api/hr/employee-movements/"


@pytest.fixture
def client():
    c = APIClient()
    c.force_authenticate(get_user_model().objects.create_superuser(username="minor_admin", password="x"))
    return c


def _rows(response):
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


# -- cuotas de redondeo -------------------------------------------------------


def test_small_remaining_capital_never_yields_zero_or_negative_installments():
    specs = loans.reschedule(3, Decimal("0"), 6, (2026, 10), 4)
    assert specs and all(s.principal >= 1 and s.amount >= 1 for s in specs)
    assert sum(s.principal for s in specs) == 3
    assert [s.number for s in specs] == list(range(4, 4 + len(specs)))


def test_nine_over_six_without_interest_has_no_negative_last_principal():
    specs = loans.build_schedule(9, Decimal("0"), 6, (2026, 10))
    assert all(s.principal >= 1 for s in specs) and sum(s.principal for s in specs) == 9


# -- saldo libre y saldo por estado ---------------------------------------------


def test_free_balance_discounts_allocations_to_draft_payrolls(client, employee):  # noqa: F811
    movement = _posted(employee, amount=100000)
    EmployeeMovementService.allocate(movement, svc_payroll(employee), 60000)
    row = _rows(client.get(BASE))[0]
    assert Decimal(str(row["free_balance"])) == Decimal("40000")
    assert Decimal(str(row["balance"])) == Decimal("100000")  # nada contabilizado aún


def test_draft_and_cancelled_movements_report_zero_balance(client, employee):  # noqa: F811
    EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", date=date(2026, 9, 1), amount=1000, status="DRAFT")
    EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", date=date(2026, 9, 2), amount=2000, status="CANCELLED")
    assert {Decimal(str(r["balance"])) for r in _rows(client.get(BASE))} == {Decimal("0")}


def test_installments_expose_whether_they_are_allocated(client, employee):  # noqa: F811
    loan = _loan(employee)
    EmployeeMovement.objects.filter(pk=loan.pk).update(status="POSTED")
    loan.refresh_from_db()
    EmployeeMovementService.allocate(loan, svc_payroll(employee, 10, net=900000, haberes=900000))
    flags = [i["is_allocated"] for i in _rows(client.get(BASE))[0]["installments"]]
    assert flags.count(True) == 1 and flags[0] is True


def test_payroll_filter_does_not_inflate_balance(client, employee):  # noqa: F811
    movement = _posted(employee, amount=100000)
    payroll = svc_payroll(employee)
    EmployeeMovementService.allocate(movement, payroll, 30000)
    EmployeeMovementService.allocate(movement, payroll, 20000)
    rows = _rows(client.get(f"{BASE}?payroll={payroll.pk}"))
    assert len(rows) == 1 and Decimal(str(rows[0]["free_balance"])) == Decimal("50000")


# -- validación de entradas ---------------------------------------------------------


@pytest.mark.parametrize("amount", ["", "abc", "12.5", "0", "-5"])
def test_allocate_rejects_invalid_amounts_with_400(client, employee, amount):  # noqa: F811
    movement = _posted(employee)
    response = client.post(f"{BASE}{movement.pk}/allocate/", {"payroll": svc_payroll(employee).pk, "amount": amount}, format="json")
    assert response.status_code == 400


@pytest.mark.parametrize("override", [{"installments": 0}, {"first_month": 13}, {"amount": 0}, {"rate": "x"}])
def test_preview_schedule_rejects_invalid_parameters_with_400(client, override):
    body = {"amount": 600000, "rate": "0.01", "rate_period": "MONTHLY", "installments": 6, "first_year": 2026, "first_month": 10, **override}
    assert client.post(BASE + "preview-schedule/", body, format="json").status_code == 400


@pytest.mark.parametrize("override", [{"installments_count": 0}, {"first_installment_month": 13}])
def test_create_loan_rejects_invalid_terms(client, employee, override):  # noqa: F811
    body = {
        "employee": employee.id, "kind": "LOAN", "date": "2026-09-01", "amount": "600000", "rate": "0.01", "rate_period": "MONTHLY",
        "installments_count": 6, "first_installment_year": 2026, "first_installment_month": 10, **override,
    }
    assert client.post(BASE, body, format="json").status_code == 400


def test_draft_kind_cannot_be_changed(client, employee):  # noqa: F811
    movement = EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", date=date(2026, 9, 1), amount=1000)
    assert client.patch(f"{BASE}{movement.pk}/", {"kind": "LOAN"}, format="json").status_code == 400


def test_unknown_treasury_account_is_400(client, employee):  # noqa: F811
    body = {"employee": employee.id, "kind": "ADVANCE", "date": "2026-09-01", "amount": "1000", "treasury_account_id": 99999}
    assert client.post(BASE, body, format="json").status_code == 400


# -- bloqueo y consultas -----------------------------------------------------------------


def test_deallocate_locks_the_payroll(employee, monkeypatch):  # noqa: F811
    movement = _posted(employee)
    allocation = EmployeeMovementService.allocate(movement, svc_payroll(employee), 1000)
    locked = []
    import core.services.document as document

    original = document.lock_document
    monkeypatch.setattr(document, "lock_document", lambda obj: (locked.append(type(obj).__name__), original(obj))[1])
    EmployeeMovementService.deallocate(allocation)
    assert "Payroll" in locked


def test_payroll_detail_does_not_write_on_get(client, employee):  # noqa: F811
    from hr.models import GlobalHRSettings

    GlobalHRSettings.objects.all().delete()
    payroll = svc_payroll(employee)
    assert client.get(f"/api/hr/payrolls/{payroll.pk}/").status_code == 200
    assert not GlobalHRSettings.objects.exists()


def test_allocate_requires_payroll_change_permission(employee):  # noqa: F811
    from django.contrib.auth.models import Permission

    user = get_user_model().objects.create_user(username="limited", password="x")
    user.user_permissions.add(Permission.objects.get(codename="change_employeemovement"), Permission.objects.get(codename="view_employeemovement"))
    c = APIClient()
    c.force_authenticate(user)
    movement = _posted(employee)
    response = c.post(f"{BASE}{movement.pk}/allocate/", {"payroll": svc_payroll(employee).pk, "amount": "1000"}, format="json")
    assert response.status_code == 403


# -- comentarios/adjuntos al migrar anticipos ------------------------------------------


def test_repoint_generic_relations_moves_comments_and_attachments():
    import importlib

    from django.apps import apps
    from django.contrib.contenttypes.models import ContentType
    from django.core.files.uploadedfile import SimpleUploadedFile

    from core.models import Attachment
    from workflow.models import Comment

    migration = importlib.import_module("hr.migrations.0018_migrate_advances_and_salary_payments")
    old = ContentType.objects.get_or_create(app_label="hr", model="salaryadvance")[0]
    user = get_user_model().objects.create_user(username="commenter", password="x")
    comment = Comment.objects.create(content_type=old, object_id=7, user=user, text="hola")
    other = Comment.objects.create(content_type=old, object_id=8, user=user, text="otro")
    attachment = Attachment.objects.create(content_type=old, object_id=7, original_filename="a.pdf", file=SimpleUploadedFile("a.pdf", b"%PDF-1.4"), user=user)

    migration.repoint_generic_relations(apps, "salaryadvance", 7, "employeemovement", 42)

    new = ContentType.objects.get(app_label="hr", model="employeemovement")
    for row in (comment, attachment):
        row.refresh_from_db()
        assert (row.content_type_id, row.object_id) == (new.id, 42)
    other.refresh_from_db()
    assert (other.content_type_id, other.object_id) == (old.id, 8)


# -- saldo y alerta de la liquidación sin consultas por fila ----------------------------


def test_payroll_detail_query_count_is_constant(client, employee):  # noqa: F811

    payroll = svc_payroll(employee)
    EmployeeMovementService.allocate(_posted(employee, amount=50000), payroll, 20000)

    def count():
        with CaptureQueriesContext(connection) as ctx:
            assert client.get(f"/api/hr/payrolls/{payroll.pk}/").status_code == 200
        return len(ctx)

    baseline = count()
    for _ in range(3):
        EmployeeMovementService.allocate(_posted(employee, amount=50000), payroll, 10000)
    assert count() == baseline
