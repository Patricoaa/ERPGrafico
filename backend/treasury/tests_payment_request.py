"""Tests Fase 1 — ADR 002.

Cubre: service initiate (happy path, rate limit, pending limit, gateway error),
cancel (PENDING ok, SENT bloqueado), polling task (completed, timeout, failed,
errores transitorios), endpoints DRF.
"""
from __future__ import annotations

from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account
from accounting.services import AccountingService
from contacts.models import Contact
from treasury.gateways import GatewayError
from treasury.gateways.ratelimit import MAX_PENDING_PER_DEVICE
from treasury.models import (
    PaymentRequest,
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    TreasuryAccount,
)
from treasury.payment_request_service import PaymentRequestService
from treasury.tasks import poll_payment_request


def _make_sale_order(customer, number="NV-X-001"):
    from sales.models import SaleOrder
    return SaleOrder.objects.create(
        customer=customer, number=number,
        status=SaleOrder.Status.CONFIRMED,
        payment_method=SaleOrder.PaymentMethod.CARD,
        channel=SaleOrder.Channel.POS,
    )


def _fixture():
    AccountingService.populate_ifrs_coa()
    supplier = Contact.objects.create(name="TUU Haulmer", tax_id="76.000.000-2")
    cash_acc = Account.objects.get(code="1.1.01.01")
    treas = TreasuryAccount.objects.create(
        name="Caja Terminal", account=cash_acc,
        account_type=TreasuryAccount.Type.CASH, allows_cash=True,
    )
    provider = PaymentTerminalProvider.objects.create(
        name="TUU", provider_type=PaymentTerminalProvider.ProviderType.TUU,
        supplier=supplier, receivable_account=cash_acc,
        commission_expense_account=cash_acc, bank_treasury_account=treas,
    )
    device = PaymentTerminalDevice.objects.create(
        name="Terminal 1", provider=provider, serial_number="TJ44245N20448",
    )
    return provider, device


def _reset_fake():
    import treasury.gateways.factory as factory
    factory._fake_singleton = None
    cache.clear()


@override_settings(TUU_GATEWAY_MODE="fake", CELERY_TASK_ALWAYS_EAGER=True)
class InitiateServiceTests(TestCase):
    def setUp(self):
        _reset_fake()
        self.provider, self.device = _fixture()

    def test_happy_path_creates_sent_and_schedules_poll(self):
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as mocked:
            mocked.return_value = mock.Mock(id="task-123")
            result = PaymentRequestService.initiate(device=self.device, amount=1600)
        pr = result.payment_request
        self.assertTrue(result.created)
        self.assertEqual(pr.status, PaymentRequest.Status.SENT)
        self.assertEqual(pr.celery_task_id, "task-123")
        mocked.assert_called_once()

    def test_idempotent_reuses_existing(self):
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as m:
            m.return_value = mock.Mock(id="t")
            first = PaymentRequestService.initiate(
                device=self.device, amount=1600, idempotency_key="fixed-key-1",
            )
            second = PaymentRequestService.initiate(
                device=self.device, amount=9999, idempotency_key="fixed-key-1",
            )
        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.payment_request.pk, second.payment_request.pk)
        self.assertEqual(second.payment_request.amount, 1600)

    def test_rate_limit_blocks_second_create_within_minute(self):
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as m:
            m.return_value = mock.Mock(id="t")
            PaymentRequestService.initiate(device=self.device, amount=1600)
        with self.assertRaises(GatewayError) as ctx:
            PaymentRequestService.initiate(device=self.device, amount=1700)
        self.assertEqual(ctx.exception.code, "RATE-LIMIT-LOCAL")

    def test_pending_limit_blocks_sixth_request(self):
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as m:
            m.return_value = mock.Mock(id="t")
            for i in range(MAX_PENDING_PER_DEVICE):
                PaymentRequest.objects.create(
                    idempotency_key=f"pending-{i}", amount=1000 + i,
                    device=self.device, provider=self.provider,
                    status=PaymentRequest.Status.SENT,
                )
            with self.assertRaises(GatewayError) as ctx:
                PaymentRequestService.initiate(device=self.device, amount=1600)
        self.assertEqual(ctx.exception.code, "PENDING-LIMIT")

    def test_gateway_error_on_create_persists_failed(self):
        with mock.patch("treasury.gateways.fake.FakeTuuGateway.create") as mocked, \
             mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as task_mock:
            mocked.side_effect = GatewayError("nope", code="RP-028")
            result = PaymentRequestService.initiate(device=self.device, amount=101)
        self.assertEqual(result.payment_request.status, PaymentRequest.Status.FAILED)
        self.assertEqual(result.payment_request.failure_reason, "RP-028")
        task_mock.assert_not_called()


@override_settings(TUU_GATEWAY_MODE="fake")
class CancelServiceTests(TestCase):
    def setUp(self):
        _reset_fake()
        self.provider, self.device = _fixture()

    def test_cancel_pending_ok(self):
        pr = PaymentRequest.objects.create(
            idempotency_key="k-pending", amount=1000,
            device=self.device, provider=self.provider,
            status=PaymentRequest.Status.PENDING,
        )
        out = PaymentRequestService.cancel(pr.idempotency_key)
        self.assertEqual(out.status, PaymentRequest.Status.CANCELED)
        self.assertEqual(out.failure_reason, "USER-CANCELED")

    def test_cancel_sent_blocked(self):
        pr = PaymentRequest.objects.create(
            idempotency_key="k-sent", amount=1000,
            device=self.device, provider=self.provider,
            status=PaymentRequest.Status.SENT,
        )
        with self.assertRaises(GatewayError) as ctx:
            PaymentRequestService.cancel(pr.idempotency_key)
        self.assertEqual(ctx.exception.code, "CANCEL-INVALID-STATE")


@override_settings(TUU_GATEWAY_MODE="fake")
class PollTaskTests(TestCase):
    def setUp(self):
        _reset_fake()
        self.provider, self.device = _fixture()

    def _pr(self, amount=1600, status=PaymentRequest.Status.SENT, initiated_ago_seconds=0):
        pr = PaymentRequest.objects.create(
            idempotency_key=f"poll-{amount}", amount=amount,
            device=self.device, provider=self.provider, status=status,
        )
        if initiated_ago_seconds:
            PaymentRequest.objects.filter(pk=pr.pk).update(
                initiated_at=timezone.now() - timezone.timedelta(seconds=initiated_ago_seconds)
            )
            pr.refresh_from_db()
        return pr

    def test_timeout_marks_failed(self):
        pr = self._pr(initiated_ago_seconds=300)
        result = poll_payment_request.apply(args=[pr.pk]).result
        pr.refresh_from_db()
        self.assertEqual(pr.status, PaymentRequest.Status.FAILED)
        self.assertEqual(pr.failure_reason, "TIMEOUT")
        self.assertEqual(result["reason"], "timeout")

    def test_terminal_status_returns_final(self):
        pr = self._pr(status=PaymentRequest.Status.COMPLETED)
        result = poll_payment_request.apply(args=[pr.pk]).result
        self.assertTrue(result["final"])

    def test_non_existent_returns_not_found(self):
        result = poll_payment_request.apply(args=[99999]).result
        self.assertEqual(result["reason"], "not_found")

    def test_fatal_gateway_error_marks_failed(self):
        pr = self._pr()
        with mock.patch("treasury.gateways.fake.FakeTuuGateway.fetch_status") as m:
            m.side_effect = GatewayError("bad key", code="KEY-003")
            poll_payment_request.apply(args=[pr.pk])
        pr.refresh_from_db()
        self.assertEqual(pr.status, PaymentRequest.Status.FAILED)
        self.assertEqual(pr.failure_reason, "KEY-003")

    def test_completed_persists_sequence_and_tx(self):
        from treasury.gateways.base import GatewayResponse
        pr = self._pr()
        response = GatewayResponse(
            status="Completed", sequence_number="000000051934",
            transaction_reference="tx-uuid", acquirer_id="acq-uuid",
            raw={"status": "Completed", "sequenceNumber": "000000051934"},
        )
        with mock.patch("treasury.gateways.fake.FakeTuuGateway.fetch_status", return_value=response):
            poll_payment_request.apply(args=[pr.pk])
        pr.refresh_from_db()
        self.assertEqual(pr.status, PaymentRequest.Status.COMPLETED)
        self.assertEqual(pr.sequence_number, "000000051934")
        self.assertEqual(pr.transaction_reference, "tx-uuid")
        self.assertIsNotNone(pr.completed_at)


@override_settings(TUU_GATEWAY_MODE="fake")
class EndpointsTests(TestCase):
    def setUp(self):
        _reset_fake()
        self.provider, self.device = _fixture()
        User = get_user_model()
        self.user = User.objects.create_user(username="cajero", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_initiate_endpoint_creates(self):
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as m:
            m.return_value = mock.Mock(id="t-1")
            resp = self.client.post(
                "/api/treasury/payment-requests/initiate/",
                {"device": self.device.id, "amount": 1500}, format="json",
            )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "SENT")

    def test_retrieve_endpoint(self):
        pr = PaymentRequest.objects.create(
            idempotency_key="ret-k", amount=1000,
            device=self.device, provider=self.provider,
            status=PaymentRequest.Status.COMPLETED,
        )
        resp = self.client.get(f"/api/treasury/payment-requests/{pr.idempotency_key}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["idempotency_key"], "ret-k")

    def test_cancel_endpoint_pending_ok(self):
        pr = PaymentRequest.objects.create(
            idempotency_key="can-k", amount=1000,
            device=self.device, provider=self.provider,
            status=PaymentRequest.Status.PENDING,
        )
        resp = self.client.post(
            f"/api/treasury/payment-requests/{pr.idempotency_key}/cancel/"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "CANCELED")

    def test_cancel_endpoint_sent_conflict(self):
        pr = PaymentRequest.objects.create(
            idempotency_key="can-k2", amount=1000,
            device=self.device, provider=self.provider,
            status=PaymentRequest.Status.SENT,
        )
        resp = self.client.post(
            f"/api/treasury/payment-requests/{pr.idempotency_key}/cancel/"
        )
        self.assertEqual(resp.status_code, 409)

    def test_sale_order_syncs_on_initiate_and_complete(self):
        from sales.models import SaleOrder
        customer = Contact.objects.create(name="Cliente 1", tax_id="11.111.111-1")
        so = _make_sale_order(customer, number="NV-SYNC-1")
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as m:
            m.return_value = mock.Mock(id="t")
            result = PaymentRequestService.initiate(
                device=self.device, amount=1600, sale_order=so,
            )
        so.refresh_from_db()
        self.assertEqual(so.status, SaleOrder.Status.PAYMENT_PENDING)

        # Simular COMPLETED vía polling
        from treasury.gateways.base import GatewayResponse
        pr = result.payment_request
        with mock.patch("treasury.gateways.fake.FakeTuuGateway.fetch_status") as fs:
            fs.return_value = GatewayResponse(
                status="Completed", sequence_number="000000099",
                raw={"status": "Completed"},
            )
            poll_payment_request.apply(args=[pr.pk])
        pr.refresh_from_db()
        so.refresh_from_db()
        self.assertEqual(pr.status, PaymentRequest.Status.COMPLETED)
        self.assertEqual(so.status, SaleOrder.Status.PAID)

    def test_sale_order_reverts_to_confirmed_on_failure(self):
        from sales.models import SaleOrder
        customer = Contact.objects.create(name="Cliente 2", tax_id="22.222.222-2")
        so = _make_sale_order(customer, number="NV-SYNC-2")
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as m:
            m.return_value = mock.Mock(id="t")
            result = PaymentRequestService.initiate(
                device=self.device, amount=1600, sale_order=so,
            )
        so.refresh_from_db()
        self.assertEqual(so.status, SaleOrder.Status.PAYMENT_PENDING)

        pr = result.payment_request
        with mock.patch("treasury.gateways.fake.FakeTuuGateway.fetch_status") as fs:
            fs.side_effect = GatewayError("bad key", code="KEY-003")
            poll_payment_request.apply(args=[pr.pk])
        pr.refresh_from_db()
        so.refresh_from_db()
        self.assertEqual(pr.status, PaymentRequest.Status.FAILED)
        self.assertEqual(so.status, SaleOrder.Status.CONFIRMED)

    def test_cancel_reverts_sale_order(self):
        from sales.models import SaleOrder
        customer = Contact.objects.create(name="Cliente 3", tax_id="33.333.333-3")
        so = _make_sale_order(customer, number="NV-SYNC-3")
        # PR en PENDING simulando justo antes de create
        pr = PaymentRequest.objects.create(
            idempotency_key="pending-sync", amount=1000,
            device=self.device, provider=self.provider,
            status=PaymentRequest.Status.PENDING, sale_order=so,
        )
        so.status = SaleOrder.Status.PAYMENT_PENDING
        so.save(update_fields=["status"])

        PaymentRequestService.cancel(pr.idempotency_key)
        so.refresh_from_db()
        self.assertEqual(so.status, SaleOrder.Status.CONFIRMED)

    def test_rate_limit_returns_429(self):
        with mock.patch("treasury.payment_request_service.poll_payment_request.apply_async") as m:
            m.return_value = mock.Mock(id="task-x")
            self.client.post(
                "/api/treasury/payment-requests/initiate/",
                {"device": self.device.id, "amount": 1500}, format="json",
            )
            resp = self.client.post(
                "/api/treasury/payment-requests/initiate/",
                {"device": self.device.id, "amount": 1600}, format="json",
            )
        self.assertEqual(resp.status_code, 429)
        self.assertEqual(resp.data["code"], "RATE-LIMIT-LOCAL")
