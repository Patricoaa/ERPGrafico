"""Smoke tests Fase 0 — ADR 002."""
import uuid

from django.test import TestCase, override_settings

from accounting.models import Account
from accounting.services import AccountingService
from contacts.models import Contact
from treasury.gateways import GatewayError, get_gateway
from treasury.gateways.fake import FakeTuuGateway
from treasury.models import (
    PaymentRequest,
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    TreasuryAccount,
)
from treasury.tasks import poll_payment_request


def _make_provider_device():
    AccountingService.populate_ifrs_coa()
    supplier = Contact.objects.create(name="TUU Haulmer", tax_id="76.000.000-1")
    cash_acc = Account.objects.get(code="1.1.01.01")
    treas = TreasuryAccount.objects.create(
        name="Banco Terminal",
        account=cash_acc,
        account_type=TreasuryAccount.Type.CASH,
        allows_cash=True,
    )
    provider = PaymentTerminalProvider.objects.create(
        name="TUU",
        provider_type=PaymentTerminalProvider.ProviderType.TUU,
        supplier=supplier,
        receivable_account=cash_acc,
        commission_expense_account=cash_acc,
        bank_treasury_account=treas,
    )
    device = PaymentTerminalDevice.objects.create(
        name="Terminal 1", provider=provider, serial_number="TJ44245N20448"
    )
    return provider, device


class EncryptedApiKeyTests(TestCase):
    def test_set_get_roundtrip(self):
        provider, _ = _make_provider_device()
        provider.set_api_key("super-secret-key")
        provider.save()
        provider.refresh_from_db()
        self.assertEqual(provider.get_api_key(), "super-secret-key")
        self.assertNotIn("super-secret-key", str(provider.gateway_config))

    def test_empty_when_unset(self):
        provider, _ = _make_provider_device()
        self.assertEqual(provider.get_api_key(), "")


@override_settings(TUU_GATEWAY_MODE="fake")
class FakeGatewayTests(TestCase):
    def setUp(self):
        import treasury.gateways.factory as factory
        factory._fake_singleton = None  # reset per test
        self.provider, self.device = _make_provider_device()

    def _make_pr(self, amount=1600):
        return PaymentRequest.objects.create(
            idempotency_key=str(uuid.uuid4()),
            amount=amount,
            device=self.device,
            provider=self.provider,
        )

    def test_create_transitions_to_sent(self):
        pr = self._make_pr()
        gw = get_gateway()
        resp = gw.create(pr)
        self.assertEqual(resp.status, "Sent")

    def test_fetch_status_progresses_to_completed(self):
        pr = self._make_pr(amount=1600)
        gw = get_gateway()
        gw.create(pr)
        first = gw.fetch_status(pr.idempotency_key)
        self.assertEqual(first.status, "Processing")
        second = gw.fetch_status(pr.idempotency_key)
        self.assertEqual(second.status, "Completed")
        self.assertTrue(second.sequence_number)
        self.assertTrue(second.transaction_reference)

    def test_amount_mod10_eq_1_fails(self):
        pr = self._make_pr(amount=101)
        gw = get_gateway()
        gw.create(pr)
        gw.fetch_status(pr.idempotency_key)
        final = gw.fetch_status(pr.idempotency_key)
        self.assertEqual(final.status, "Failed")
        self.assertEqual(final.failure_reason, "MR-SIMULATED")

    def test_duplicate_create_raises(self):
        pr = self._make_pr()
        gw = get_gateway()
        gw.create(pr)
        with self.assertRaises(GatewayError):
            gw.create(pr)

    def test_fetch_missing_raises(self):
        gw = get_gateway()
        with self.assertRaises(GatewayError):
            gw.fetch_status("nonexistent")


class FactoryTests(TestCase):
    @override_settings(TUU_GATEWAY_MODE="live")
    def test_live_requires_provider(self):
        import treasury.gateways.factory as factory
        factory._fake_singleton = None
        with self.assertRaises(ValueError):
            get_gateway()

    @override_settings(TUU_GATEWAY_MODE="bogus")
    def test_unknown_mode_raises(self):
        import treasury.gateways.factory as factory
        factory._fake_singleton = None
        with self.assertRaises(ValueError):
            get_gateway()

    @override_settings(TUU_GATEWAY_MODE="fake")
    def test_fake_returns_singleton_instance(self):
        import treasury.gateways.factory as factory
        factory._fake_singleton = None
        gw = get_gateway()
        self.assertIsInstance(gw, FakeTuuGateway)
        self.assertIs(gw, get_gateway())


class PollTaskSkeletonTests(TestCase):
    def test_missing_payment_request(self):
        result = poll_payment_request.apply(args=[99999]).result
        self.assertEqual(result, {"ok": False, "reason": "not_found"})

    def test_terminal_status_returns_final(self):
        provider, device = _make_provider_device()
        pr = PaymentRequest.objects.create(
            idempotency_key=str(uuid.uuid4()),
            amount=1600, device=device, provider=provider,
            status=PaymentRequest.Status.COMPLETED,
        )
        result = poll_payment_request.apply(args=[pr.pk]).result
        self.assertTrue(result.get("final"))
        self.assertEqual(result["status"], "COMPLETED")
