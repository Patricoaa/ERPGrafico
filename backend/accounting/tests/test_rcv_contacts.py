"""Alta de contactos derivada de las contrapartes del RCV."""

from dataclasses import replace
from unittest import mock

import pytest
from django.core.exceptions import ValidationError

from accounting import rcv_service
from accounting.integrations.rcv_normalizer import normalize_report
from accounting.models import RCVImport
from accounting.rcv_contacts import ensure_contacts_for_documents
from accounting.tests.rcv_helpers import (
    FakeClient,
    load_fixture,
    make_api_key,
    make_rcv_settings,
    ok,
)
from contacts.models import Contact

COMPANY_RUT = "11111111-1"
SALES = "SALES"
PURCHASES = "PURCHASES"


def _docs(direction=SALES):
    fixture = "rcv_ventas_202610" if direction == SALES else "rcv_compras_202610"
    return normalize_report(direction, load_fixture(fixture)).documents


@pytest.mark.django_db
def test_existing_contact_with_dotted_rut_is_reused():
    Contact.objects.create(name="Cliente Uno", tax_id="77.195.849-4")

    outcome = ensure_contacts_for_documents(_docs(), COMPANY_RUT)

    assert outcome.created == 1
    assert Contact.objects.count() == 2
    assert Contact.objects.get(tax_id="77.195.849-4").roles == []


@pytest.mark.django_db
def test_creates_contacts_without_roles():
    sales = ensure_contacts_for_documents(_docs(SALES), COMPANY_RUT)
    purchases = ensure_contacts_for_documents(_docs(PURCHASES), COMPANY_RUT)

    assert (sales.created, purchases.created) == (2, 1)
    assert {
        contact.tax_id: contact.roles for contact in Contact.objects.all()
    } == {
        "77195849-4": [],
        "76354051-0": [],
        "78950040-1": [],
    }


@pytest.mark.django_db
def test_same_rut_in_both_directions_is_not_duplicated():
    docs = [replace(_docs()[0], counterparty_rut="78950040-1", counterparty_name="Proveedor")]

    ensure_contacts_for_documents(docs, COMPANY_RUT)
    outcome = ensure_contacts_for_documents(_docs(PURCHASES), COMPANY_RUT)

    assert (outcome.created, outcome.skipped) == (0, 0)
    assert Contact.objects.count() == 1


@pytest.mark.django_db
def test_skips_generic_own_invalid_and_blank_ruts():
    docs = []
    for rut in ("66666666-6", COMPANY_RUT, "12345678-9", ""):
        docs.append(replace(_docs()[0], counterparty_rut=rut, counterparty_name="Raro"))

    outcome = ensure_contacts_for_documents(docs, COMPANY_RUT)

    assert outcome.created == 0
    assert Contact.objects.count() == 0


@pytest.mark.django_db
def test_missing_business_name_uses_rut_marker():
    docs = [replace(_docs()[0], counterparty_name="")]

    outcome = ensure_contacts_for_documents(docs, COMPANY_RUT)

    assert outcome.created == 1
    assert Contact.objects.get().name == "RUT 77195849-4 (RCV)"


@pytest.mark.django_db
def test_reimport_does_not_duplicate_contacts():
    docs = _docs()

    first = ensure_contacts_for_documents(docs, COMPANY_RUT)
    second = ensure_contacts_for_documents(docs, COMPANY_RUT)

    assert (first.created, second.created) == (2, 0)
    assert second.skipped == 0
    assert Contact.objects.count() == 2


@pytest.mark.django_db
def test_one_bad_contact_does_not_stop_the_others():
    original_save = Contact.save

    def flaky_save(self, *args, **kwargs):
        if self.tax_id == "77195849-4":
            raise ValidationError("contacto inválido")
        return original_save(self, *args, **kwargs)

    with mock.patch.object(Contact, "save", flaky_save):
        outcome = ensure_contacts_for_documents(_docs(), COMPANY_RUT)

    assert (outcome.created, outcome.skipped) == (1, 1)
    assert list(Contact.objects.values_list("tax_id", flat=True)) == ["76354051-0"]


@pytest.mark.django_db
def test_execute_import_records_created_contacts():
    make_rcv_settings()
    make_api_key()
    imp = RCVImport.objects.create(
        direction=SALES, year=2026, month=10, trigger=RCVImport.Trigger.MANUAL
    )
    client = FakeClient({"TEST-KEY-1": [ok(load_fixture("rcv_ventas_202610"))]})

    rcv_service.execute_import(imp, client_factory=client, sleep=mock.Mock())

    imp.refresh_from_db()
    assert imp.status == RCVImport.Status.SUCCESS, imp.error_message
    assert imp.contacts_created_count == 2
    assert imp.warnings == []
    assert Contact.objects.count() == 2
