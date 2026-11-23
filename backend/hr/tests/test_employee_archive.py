"""Employee sigue el patrón Archivo (ADR-0154): is_active, sin hard delete."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from hr.models import Employee

pytestmark = pytest.mark.django_db


def _employee(name, tax_id, is_active=True):
    contact = Contact.objects.create(name=name, tax_id=tax_id)
    return Employee.objects.create(contact=contact, base_salary=500000, is_active=is_active)


@pytest.fixture
def client():
    user = get_user_model().objects.create_superuser(username="hr_admin", password="x")
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _ids(response):
    data = response.json()
    rows = data["results"] if isinstance(data, dict) and "results" in data else data
    return {r["id"] for r in rows}


def test_list_defaults_to_active_only(client):
    active = _employee("Ana", "1-9")
    archived = _employee("Beto", "2-7", is_active=False)
    assert _ids(client.get("/api/hr/employees/")) == {active.id}
    assert _ids(client.get("/api/hr/employees/?is_active=false")) == {archived.id}
    assert _ids(client.get("/api/hr/employees/?is_active=all")) == {active.id, archived.id}


def test_archive_and_restore_via_patch_keeps_detail_reachable(client):
    emp = _employee("Ana", "1-9")
    assert client.patch(f"/api/hr/employees/{emp.id}/", {"is_active": False}, format="json").status_code == 200
    emp.refresh_from_db()
    assert emp.is_active is False
    assert client.get(f"/api/hr/employees/{emp.id}/").status_code == 200
    assert client.patch(f"/api/hr/employees/{emp.id}/", {"is_active": True}, format="json").status_code == 200
    emp.refresh_from_db()
    assert emp.is_active is True


def test_hard_delete_is_blocked(client):
    emp = _employee("Ana", "1-9")
    assert client.delete(f"/api/hr/employees/{emp.id}/").status_code == 405
    assert Employee.objects.filter(pk=emp.pk).exists()


def test_archive_sets_end_date_and_restore_clears_it(client):
    emp = _employee("Ana", "1-9")
    r = client.patch(
        f"/api/hr/employees/{emp.id}/", {"is_active": False, "end_date": "2026-11-20"}, format="json"
    )
    assert r.status_code == 200
    emp.refresh_from_db()
    assert str(emp.end_date) == "2026-11-20"
    assert client.patch(f"/api/hr/employees/{emp.id}/", {"is_active": True}, format="json").status_code == 200
    emp.refresh_from_db()
    assert emp.end_date is None


def test_archive_without_end_date_defaults_to_today(client):
    from django.utils import timezone

    emp = _employee("Ana", "1-9")
    client.patch(f"/api/hr/employees/{emp.id}/", {"is_active": False}, format="json")
    emp.refresh_from_db()
    assert emp.end_date == timezone.localdate()


def test_end_date_cannot_precede_start_date(client):
    emp = _employee("Ana", "1-9")
    emp.start_date = "2026-06-01"
    emp.save()
    r = client.patch(
        f"/api/hr/employees/{emp.id}/", {"is_active": False, "end_date": "2026-05-01"}, format="json"
    )
    assert r.status_code == 400
    assert "end_date" in r.json()["error"]["details"]


def test_active_employee_rejects_end_date(client):
    emp = _employee("Ana", "1-9")
    r = client.patch(f"/api/hr/employees/{emp.id}/", {"end_date": "2026-11-20"}, format="json")
    assert r.status_code == 400


def test_absence_for_archived_employee_is_rejected_but_existing_stays_editable(client):
    from hr.models import Absence

    emp = _employee("Ana", "1-9")
    body = {
        "employee": emp.id, "absence_type": "AUSENTISMO",
        "start_date": "2026-11-02", "end_date": "2026-11-03", "days": 2,
    }
    created = client.post("/api/hr/absences/", body, format="json")
    assert created.status_code == 201, created.content
    emp.is_active = False
    emp.save()
    assert client.post("/api/hr/absences/", body, format="json").status_code == 400
    # Editing the already-recorded absence of the same (now archived) employee still works.
    patch = client.patch(f"/api/hr/absences/{created.json()['id']}/", {"notes": "x"}, format="json")
    assert patch.status_code == 200
    other = _employee("Beto", "2-7")
    moved = client.patch(f"/api/hr/absences/{created.json()['id']}/", {"employee": other.id}, format="json")
    assert moved.status_code == 200
    back = client.patch(f"/api/hr/absences/{created.json()['id']}/", {"employee": emp.id}, format="json")
    assert back.status_code == 400
    assert Absence.objects.count() == 1


def test_advance_for_archived_employee_is_rejected(client):
    emp = _employee("Ana", "1-9", is_active=False)
    r = client.post(
        "/api/hr/advances/",
        {"employee": emp.id, "amount": "10000", "date": "2026-11-10"},
        format="json",
    )
    assert r.status_code == 400
    assert "employee" in r.json()["error"]["details"]
