from datetime import date

import pytest
from django.db import IntegrityError, transaction

from accounting.models import RCVApiKey, RCVDocument, RCVImport, RCVSettings
from core.rbac.bundles import expand


@pytest.mark.django_db
def test_settings_singleton_and_password_roundtrip():
    s = RCVSettings(company_rut="11111111-1", user_rut="22222222-2")
    s.set_sii_password("clave-de-prueba")
    s.save()
    s.pk = 99
    s.save()  # save() fuerza pk=1: sigue habiendo una sola fila
    assert RCVSettings.objects.count() == 1
    assert s.pk == 1
    loaded = RCVSettings.get_settings()
    assert RCVSettings.objects.count() == 1
    assert loaded.get_sii_password() == "clave-de-prueba"
    assert "clave-de-prueba" not in loaded.sii_password_encrypted
    assert loaded.has_sii_password is True


@pytest.mark.django_db
def test_api_key_masked():
    k = RCVApiKey(label="principal")
    k.set_key("TEST-KEY-0000-0000-4472")
    k.save()
    assert k.masked_key == "••••-4472"
    assert k.get_key() == "TEST-KEY-0000-0000-4472"
    assert "TEST-KEY" not in k.key_encrypted
    assert k.monthly_limit == 10


def _doc(imp, **kw):
    base = dict(
        direction=RCVImport.Direction.PURCHASES,
        company_rut="11111111-1",
        period="202610",
        dte_type=33,
        folio=100,
        counterparty_rut="33333333-3",
        issue_date=date(2026, 10, 1),
        first_import=imp,
        last_import=imp,
    )
    base.update(kw)
    return RCVDocument.objects.create(**base)


@pytest.mark.django_db
def test_document_natural_key_unique():
    imp = RCVImport.objects.create(
        direction=RCVImport.Direction.PURCHASES,
        year=2026,
        month=10,
        trigger=RCVImport.Trigger.MANUAL,
    )
    _doc(imp)
    with pytest.raises(IntegrityError), transaction.atomic():
        _doc(imp)
    _doc(imp, dte_type=34)


def test_import_period():
    assert RCVImport(year=2026, month=3).period == "202603"


@pytest.mark.parametrize(
    "perm",
    [
        "add_rcvimport",
        "change_rcvsettings",
        "add_rcvapikey",
        "change_rcvapikey",
        "delete_rcvapikey",
    ],
)
def test_rcv_permissions_bundles(perm):
    assert "accounting.view_rcvdocument" in expand(["accounting.read"])
    assert f"accounting.{perm}" not in expand(["accounting.operate"])
    assert f"accounting.{perm}" in expand(["accounting.manage"])
