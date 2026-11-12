"""Relaciones documentales de la ficha del socio (`contacts.partner`): contacto, asientos y distribuciones."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounting.models import JournalEntry
from contacts.models import Contact
from contacts.partner_models import (
    PartnerTransaction,
    ProfitDistributionLine,
    ProfitDistributionResolution,
)

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def client():
    api_client = APIClient()
    api_client.force_authenticate(user=User.objects.create_superuser(username="admin", password="x"))
    return api_client


def _partner(name="Ana", n=1):
    return Contact.objects.create(name=name, tax_id=f"{n}1111111-1", is_partner=True)


def _movement(partner, with_entry=True, entry=None):
    if with_entry and entry is None:
        entry = JournalEntry.objects.create(date=date(2026, 1, 1), description=f"Aporte {partner.name}")
    return PartnerTransaction.objects.create(
        partner=partner, transaction_type=PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH,
        amount=Decimal("1000"), date=date(2026, 1, 1), journal_entry=entry,
    )


def _distribution(partner, year=2025, posted=False):
    entry = JournalEntry.objects.create(date=date(year + 1, 4, 30), description="Distribución") if posted else None
    resolution = ProfitDistributionResolution.objects.create(
        fiscal_year=year, resolution_date=date(year + 1, 4, 30), net_result=Decimal("5000"), journal_entry=entry,
    )
    ProfitDistributionLine.objects.create(
        resolution=resolution, partner=partner, percentage_at_date=Decimal("100"),
        gross_amount=Decimal("5000"), net_amount=Decimal("5000"),
    )
    return resolution


def _url(pk):
    return f"/api/core/documents/contacts.partner/{pk}/relations/"


def _targets(data):
    return {(r["role"], r["target"]["label"], r["target"]["id"]) for r in data["relations"]}


def test_partner_relations_cover_contact_entries_and_distributions(client):
    partner = _partner()
    first, second = _movement(partner), _movement(partner)
    _movement(partner, with_entry=False)
    shared = _movement(partner, entry=first.journal_entry)  # mismo asiento: no se duplica
    resolution = _distribution(partner)
    _distribution(_partner("Otro", 2), year=2024)  # distribución ajena: no aparece

    response = client.get(_url(partner.pk))

    assert response.status_code == 200, response.data
    data = response.data
    assert data["document"]["label"] == "contacts.partner"
    assert _targets(data) == {
        ("contact", "contacts.contact", partner.pk),
        ("journal_entry", "accounting.journalentry", first.journal_entry_id),
        ("journal_entry", "accounting.journalentry", second.journal_entry_id),
        ("profit_distribution", "contacts.profitdistributionresolution", resolution.pk),
    }
    assert shared.journal_entry_id == first.journal_entry_id
    by_role = {r["role"]: r for r in data["relations"]}
    assert by_role["contact"]["semantic"] == "association"
    assert by_role["contact"]["direction"] == "incoming"
    assert by_role["journal_entry"]["target"]["domain"] == "accounting"
    assert by_role["profit_distribution"]["semantic"] == "association"


def test_partner_without_movements_only_links_contact(client):
    partner = _partner()
    data = client.get(_url(partner.pk)).data
    assert _targets(data) == {("contact", "contacts.contact", partner.pk)}


def test_partner_relations_query_count_is_fixed(client):
    def count(partner):
        with CaptureQueriesContext(connection) as ctx:
            assert client.get(_url(partner.pk)).status_code == 200
        return len(ctx)

    one = _partner("Uno", 1)
    _movement(one)
    _distribution(one, year=2020, posted=True)
    five = _partner("Cinco", 2)
    for _ in range(5):
        _movement(five)
    for year in range(2021, 2026):
        _distribution(five, year=year, posted=True)

    count(one)  # calienta cachés (permisos, content types)
    assert count(five) == count(one)


def test_non_partner_contact_is_not_found(client):
    contact = Contact.objects.create(name="Cliente", tax_id="9999999-9")
    response = client.get(_url(contact.pk))
    assert response.status_code == 404
    assert client.get(_url(999999)).status_code == 404


def test_partner_relations_require_contact_view_permission():
    partner = _partner()
    user = User.objects.create_user(username="nobody", password="x")
    api = APIClient()
    api.force_authenticate(user=user)
    assert api.get(_url(partner.pk)).status_code == 403
    user.user_permissions.add(Permission.objects.get(codename="view_contact", content_type__app_label="contacts"))
    user = User.objects.get(pk=user.pk)
    api.force_authenticate(user=user)
    assert api.get(_url(partner.pk)).status_code == 200


def test_partner_canonical_url_points_at_composition_page():
    from core.documents import DocumentTypeRegistry
    assert DocumentTypeRegistry.get("contacts.partner").canonical_url == "/finances/partners/composition?selected={id}"


def test_profit_distribution_relations(client):
    partner = _partner()
    resolution = _distribution(partner, posted=True)
    _movement(partner)

    # Crear movimiento asociado a la resolución
    ptx = PartnerTransaction.objects.create(
        partner=partner,
        transaction_type=PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
        amount=Decimal("1500"),
        date=date(2026, 1, 1),
        distribution_resolution=resolution,
    )

    url = f"/api/core/documents/contacts.profitdistributionresolution/{resolution.pk}/relations/"
    response = client.get(url)
    assert response.status_code == 200, response.data
    data = response.data
    assert data["document"]["label"] == "contacts.profitdistributionresolution"
    assert data["document"]["domain"] == "capital"

    targets = _targets(data)
    assert ("partner", "contacts.contact", partner.pk) in targets
    assert ("journal_entry", "accounting.journalentry", resolution.journal_entry_id) in targets
    assert ("partner_transaction", "contacts.partnertransaction", ptx.pk) in targets
