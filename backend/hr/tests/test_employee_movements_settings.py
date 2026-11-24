"""Ajustes de movimientos con el empleado: cuentas de préstamos/intereses y tope legal."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounting.models import Account, AccountingSettings, AccountType
from hr.models import GlobalHRSettings

pytestmark = pytest.mark.django_db


def test_accounting_settings_has_loan_accounts():
    settings = AccountingSettings.get_solo()
    assert settings.account_prestamos_trabajadores is None
    assert settings.account_intereses_prestamos is None
    loans = Account.objects.create(name="Préstamos a trabajadores", code="1.1.05.902", account_type=AccountType.ASSET)
    interest = Account.objects.create(name="Intereses ganados", code="4.2.01.901", account_type=AccountType.INCOME)
    settings.account_prestamos_trabajadores = loans
    settings.account_intereses_prestamos = interest
    settings.save()
    settings.refresh_from_db()
    assert settings.account_prestamos_trabajadores_id == loans.id
    assert settings.account_intereses_prestamos_id == interest.id


def test_global_hr_settings_default_cap_is_15_and_patchable():
    obj, _ = GlobalHRSettings.objects.get_or_create(pk=1)
    assert obj.loan_deduction_cap_percent == Decimal("15")
    client = APIClient()
    client.force_authenticate(user=get_user_model().objects.create_superuser(username="hr_cap", password="x"))
    response = client.patch("/api/hr/global-settings/current/", {"loan_deduction_cap_percent": "20"}, format="json")
    assert response.status_code == 200, response.content
    obj.refresh_from_db()
    assert obj.loan_deduction_cap_percent == Decimal("20")
