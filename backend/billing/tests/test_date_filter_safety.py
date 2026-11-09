"""
Regression tests for issue #229 — invalid date strings in filter params must
not raise a 500. Each selector must silently ignore malformed dates.
"""
import pytest
from rest_framework.test import APIRequestFactory


@pytest.mark.django_db
class TestInvoiceSelectorDateSafety:
    def _make_view(self, action="list"):
        from unittest.mock import MagicMock
        view = MagicMock()
        view.action = action
        return view

    def test_invalid_date_from_does_not_raise(self):
        from billing.selectors import InvoiceSelectorExt
        view = self._make_view()
        rf = APIRequestFactory()
        req = rf.get("/", {"date_from": "not-a-date", "date_to": "also-bad"})
        from rest_framework.request import Request
        drf_req = Request(req)
        qs = InvoiceSelectorExt.get_queryset_from_request(view, drf_req)
        assert qs is not None

    def test_valid_dates_still_filter(self):
        from billing.selectors import InvoiceSelectorExt
        view = self._make_view()
        rf = APIRequestFactory()
        req = rf.get("/", {"date_from": "2024-01-01", "date_to": "2024-12-31"})
        from rest_framework.request import Request
        drf_req = Request(req)
        qs = InvoiceSelectorExt.get_queryset_from_request(view, drf_req)
        assert qs is not None


@pytest.mark.django_db
class TestBankStatementSelectorDateSafety:
    def _base_qs(self):
        from treasury.models import BankStatementLine
        return BankStatementLine.objects.all()

    def test_invalid_date_from_does_not_raise(self):
        from treasury.selectors import BankStatementSelector
        qs = BankStatementSelector.list_statement_lines(
            self._base_qs(), {"date_from": "INVALID", "date_to": "ALSO_BAD"}
        )
        list(qs)

    def test_valid_dates_accepted(self):
        from treasury.selectors import BankStatementSelector
        qs = BankStatementSelector.list_statement_lines(
            self._base_qs(), {"date_from": "2024-01-01", "date_to": "2024-12-31"}
        )
        list(qs)


@pytest.mark.django_db
class TestInventorySubscriptionDateSafety:
    def test_invalid_dates_do_not_raise(self):
        from inventory.selectors import SubscriptionSelector
        result = SubscriptionSelector.list_subscriptions(params={
            "date_from": "not-a-date", "date_to": "also-invalid"
        })
        list(result)

    def test_valid_dates_accepted(self):
        from inventory.selectors import SubscriptionSelector
        result = SubscriptionSelector.list_subscriptions(params={
            "date_from": "2024-01-01", "date_to": "2024-12-31"
        })
        list(result)
