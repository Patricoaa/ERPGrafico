"""ADR-0158: el listado de presupuestos resuelve búsqueda, rango de fechas y orden en servidor."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Budget


pytestmark = pytest.mark.django_db


@pytest.fixture
def client(db):
    c = APIClient()
    c.force_authenticate(get_user_model().objects.create_superuser("budgetfilters", "bf@x.cl", "x"))
    return c


@pytest.fixture
def budgets():
    operativo = Budget.objects.create(
        name="Presupuesto Operativo 2026",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        description="Gastos generales",
    )
    anterior = Budget.objects.create(
        name="Presupuesto 2025",
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
    )
    inversiones = Budget.objects.create(
        name="Plan Inversiones",
        start_date=date(2026, 6, 1),
        end_date=date(2027, 5, 31),
    )
    return operativo, anterior, inversiones


def names(response):
    assert response.status_code == 200, response.data
    return [row["name"] for row in response.data["results"]]


def test_budget_list_filters_by_start_and_end_date(client, budgets):
    operativo, anterior, inversiones = budgets
    url = "/api/accounting/budgets/"

    assert set(names(client.get(url, {"start_date__gte": "2026-01-01"}))) == {operativo.name, inversiones.name}
    assert set(names(client.get(url, {"end_date__lte": "2026-12-31"}))) == {operativo.name, anterior.name}
    # Los dos params del filtro `period` de la barra, tal como los escribe useCollectionQuery.
    assert names(client.get(url, {
        "start_date__gte": "2026-01-01",
        "end_date__lte": "2026-12-31",
    })) == [operativo.name]


def test_budget_list_search_matches_name_and_description(client, budgets):
    operativo, _anterior, inversiones = budgets
    url = "/api/accounting/budgets/"

    assert names(client.get(url, {"search": "Inversiones"})) == [inversiones.name]
    assert names(client.get(url, {"search": "generales"})) == [operativo.name]


def test_budget_list_ordering_uses_drf_keys(client, budgets):
    operativo, anterior, inversiones = budgets
    url = "/api/accounting/budgets/"

    assert names(client.get(url, {"ordering": "name"})) == [
        inversiones.name, anterior.name, operativo.name,
    ]
    assert names(client.get(url, {"ordering": "-start_date"})) == [
        inversiones.name, operativo.name, anterior.name,
    ]

    # Consulta real de la barra: filtro de fechas + búsqueda + orden a la vez.
    assert names(client.get(url, {
        "search": "Presupuesto",
        "start_date__gte": "2026-01-01",
        "end_date__lte": "2026-12-31",
        "ordering": "-name",
    })) == [operativo.name]
