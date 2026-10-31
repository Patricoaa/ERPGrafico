import pytest
from django.contrib.auth.models import AnonymousUser, Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from billing.models import Invoice
from billing.views import InvoiceViewSet
from core.api.permissions import StandardizedModelPermissions
from core.tests.rbac_factories import make_user


@pytest.fixture
def annul_perm(db):
    ct = ContentType.objects.get_for_model(Invoice)
    return Permission.objects.create(
        content_type=ct, codename="annul_invoice", name="Can annul invoice"
    )


def _check(method, user, action, action_permissions=None):
    django_request = getattr(APIRequestFactory(), method)("/api/billing/invoices/")
    request = Request(django_request)
    request.user = user
    view = InvoiceViewSet()
    view.action = action
    view.request = request
    view.args = ()
    view.kwargs = {}
    view.format_kwarg = None
    if action_permissions is not None:
        view.action_permissions = action_permissions
    return StandardizedModelPermissions().has_permission(request, view)


@pytest.mark.django_db
def test_mapped_action_requires_declared_permission(annul_perm):
    user = make_user("adder", "billing.add_invoice")
    assert _check("post", user, "annul", {"annul": "billing.annul_invoice"}) is False


@pytest.mark.django_db
def test_mapped_action_allows_with_declared_permission(annul_perm):
    user = make_user("annuler", "billing.annul_invoice")
    assert _check("post", user, "annul", {"annul": "billing.annul_invoice"}) is True


@pytest.mark.django_db
def test_tuple_requires_all_permissions(annul_perm):
    ct = ContentType.objects.get_for_model(Invoice)
    Permission.objects.create(
        content_type=ct, codename="confirm_invoice", name="Can confirm invoice"
    )
    perms = ("billing.annul_invoice", "billing.confirm_invoice")
    partial = make_user("partial", "billing.annul_invoice")
    assert _check("post", partial, "annul", {"annul": perms}) is False
    full = make_user("full", "billing.annul_invoice", "billing.confirm_invoice")
    assert _check("post", full, "annul", {"annul": perms}) is True


@pytest.mark.django_db
def test_none_mapping_falls_back_to_method_map():
    with_change = make_user("changer", "billing.change_invoice")
    assert _check("patch", with_change, "current", {"current": None}) is True
    without_change = make_user("nochange")
    assert _check("patch", without_change, "current", {"current": None}) is False


@pytest.mark.django_db
def test_unmapped_action_keeps_method_behaviour():
    user = make_user("creator", "billing.add_invoice")
    assert _check("post", user, "create", {}) is True


@pytest.mark.django_db
def test_mapped_action_denies_anonymous(annul_perm):
    assert _check("post", AnonymousUser(), "annul", {"annul": "billing.annul_invoice"}) is False
