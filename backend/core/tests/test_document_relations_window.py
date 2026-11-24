"""Ventana reciente de relaciones (spec 2026-11-23, ADR-0155)."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from contacts.models import Contact
from core.documents.relations import RELATIONS_MIN_VISIBLE, RELATIONS_RECENT_MONTHS, apply_window
from hr.models import Employee, EmployeeMovement

TODAY = date(2026, 11, 23)


def mk(domain, day, dep=False, key=None):
    return {"target": {"domain": domain, "date": day, "id": key}, "is_dependency": dep}


def recent(n, domain="hr"):
    return [mk(domain, f"2026-0{1 + i % 9}-15", key=f"r{i}") for i in range(n)]


def old(n, domain="hr"):
    return [mk(domain, f"2024-{1 + i % 12:02d}-{1 + i // 12:02d}", key=f"o{i}") for i in range(n)]


def test_constants_match_spec():
    assert (RELATIONS_RECENT_MONTHS, RELATIONS_MIN_VISIBLE) == (12, 10)


def test_area_with_10_or_fewer_is_untouched():
    links = old(10)
    kept, hidden = apply_window(links, TODAY)
    assert kept == links and hidden == {}


def test_old_links_hidden_in_big_area():
    links = recent(5) + old(10)
    kept, hidden = apply_window(links, TODAY)
    assert len(kept) == 10 and hidden == {"hr": 5}
    assert all(link in kept for link in recent(5))


def test_fill_up_to_min_visible_with_newest():
    links = old(11)
    kept, hidden = apply_window(links, TODAY)
    newest = sorted(links, key=lambda x: x["target"]["date"], reverse=True)[:10]
    assert sorted(l["target"]["id"] for l in kept) == sorted(l["target"]["id"] for l in newest)
    assert hidden == {"hr": 1}


def test_dependencies_and_undated_never_hidden():
    dependency = mk("hr", "2020-01-01", dep=True, key="dep")
    undated = mk("hr", None, key="undated")
    kept, _ = apply_window(old(12) + [dependency, undated], TODAY)
    assert dependency in kept and undated in kept


def test_original_order_preserved_and_datetime_dates_accepted():
    links = [mk("hr", "2025-01-05T10:00:00Z", key=i) for i in range(5)] + recent(7)
    kept, hidden = apply_window(links, TODAY)
    # 7 recientes + (por empate de fecha, estable) los 3 primeros antiguos; orden original intacto.
    assert [l["target"]["id"] for l in kept] == [0, 1, 2, *[f"r{n}" for n in range(7)]]
    assert hidden == {"hr": 2}


def test_other_areas_are_independent():
    links = old(11) + old(4, domain="accounting")
    kept, hidden = apply_window(links, TODAY)
    assert hidden == {"hr": 1}
    assert len([l for l in kept if l["target"]["domain"] == "accounting"]) == 4


@pytest.fixture
def employee_with_old_advances(db):
    contact = Contact.objects.create(name="Ana Pérez", tax_id="11111111-1")
    employee = Employee.objects.create(contact=contact, base_salary=500000)
    for month in range(1, 13):
        EmployeeMovement.objects.create(employee=employee, kind="ADVANCE", amount=1000, date=date(2024, month, 10), status="POSTED")
    user = get_user_model().objects.create_superuser(username="hr_admin", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, employee


def _advances(body):
    return [r for r in body["relations"] if r["role"] == "employee_movement"]


@pytest.mark.django_db
def test_window_recent_returns_hidden_and_all_returns_everything(employee_with_old_advances):
    client, employee = employee_with_old_advances
    url = f"/api/core/documents/hr.employee/{employee.pk}/relations/"
    recent_body = client.get(url, {"window": "recent"}).json()
    assert len(_advances(recent_body)) == 10
    assert recent_body["hidden"] == {"hr": 2} and recent_body["window"] == "recent"
    all_body = client.get(url, {"window": "all"}).json()
    assert len(_advances(all_body)) == 12 and all_body["hidden"] == {}


@pytest.mark.django_db
def test_default_window_equals_all(employee_with_old_advances):
    client, employee = employee_with_old_advances
    url = f"/api/core/documents/hr.employee/{employee.pk}/relations/"
    default_body = client.get(url).json()
    assert len(_advances(default_body)) == 12
    assert default_body["hidden"] == {} and default_body["window"] == "all"
    assert default_body["relations"] == client.get(url, {"window": "all"}).json()["relations"]


@pytest.mark.django_db
def test_invalid_window_is_400(employee_with_old_advances):
    client, employee = employee_with_old_advances
    response = client.get(f"/api/core/documents/hr.employee/{employee.pk}/relations/", {"window": "basura"})
    assert response.status_code == 400
