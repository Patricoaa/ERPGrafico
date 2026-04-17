"""
Tests del PaymentOrchestrator y gateway factory.

Cubre:
- Resolución de cuenta: CASH → treasury_account, CARD_TERMINAL → settlement_account
- Mapeo legacy: CARD_TERMINAL, DEBIT_CARD, CHECK → Method enum correcto
- create_movement usa cuenta puente (no drawer) para CARD_TERMINAL
- is_integrated property en PaymentMethod
- GatewayError para provider sin adapter en modo live
- initiate_remote_payment valida is_integrated
"""
from __future__ import annotations

from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings

from accounting.models import Account
from accounting.services import AccountingService
from contacts.models import Contact
from treasury.gateways.base import GatewayError
from treasury.models import (
    PaymentMethod,
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    TreasuryAccount,
    TreasuryMovement,
)
from treasury.orchestrator import PaymentOrchestrator, _to_legacy_method


def _seed_coa():
    AccountingService.populate_ifrs_coa()
    return {
        "acct1": Account.objects.get(code="1.1.01.01"),  # Caja General
        "acct2": Account.objects.get(code="1.1.01.02"),  # Banco Principal
        "acct3": Account.objects.get(code="1.1.01.03"),  # Banco de Chile
        "acct4": Account.objects.get(code="1.1.01.04"),  # Caja Recepción
    }


class LegacyMethodMappingTest(TestCase):
    def test_card_terminal_maps_to_card(self):
        self.assertEqual(_to_legacy_method("CARD_TERMINAL"), TreasuryMovement.Method.CARD)

    def test_debit_card_maps_to_card(self):
        self.assertEqual(_to_legacy_method("DEBIT_CARD"), TreasuryMovement.Method.CARD)

    def test_credit_card_maps_to_card(self):
        self.assertEqual(_to_legacy_method("CREDIT_CARD"), TreasuryMovement.Method.CARD)

    def test_check_maps_to_other(self):
        self.assertEqual(_to_legacy_method("CHECK"), TreasuryMovement.Method.OTHER)

    def test_cash_maps_to_cash(self):
        self.assertEqual(_to_legacy_method("CASH"), TreasuryMovement.Method.CASH)

    def test_transfer_maps_to_transfer(self):
        self.assertEqual(_to_legacy_method("TRANSFER"), TreasuryMovement.Method.TRANSFER)

    def test_unknown_maps_to_other(self):
        self.assertEqual(_to_legacy_method("UNKNOWN_FUTURE_TYPE"), TreasuryMovement.Method.OTHER)


class IsIntegratedPropertyTest(TestCase):
    def setUp(self):
        accts = _seed_coa()
        supplier = Contact.objects.create(name="TUU", tax_id="76.000.000-2")
        drawer = TreasuryAccount.objects.create(
            name="Gaveta", account=accts["acct1"], account_type=TreasuryAccount.Type.CASH,
        )
        bridge = TreasuryAccount.objects.create(
            name="Puente", account=accts["acct2"], account_type=TreasuryAccount.Type.BRIDGE,
        )
        provider = PaymentTerminalProvider.objects.create(
            name="TUU", provider_type=PaymentTerminalProvider.ProviderType.TUU,
            supplier=supplier, receivable_account=accts["acct1"],
            commission_expense_account=accts["acct1"], bank_treasury_account=bridge,
        )
        self.device = PaymentTerminalDevice.objects.create(
            name="T1", provider=provider, serial_number="SN001",
        )
        self.drawer = drawer

    def test_card_terminal_with_device_is_integrated(self):
        pm = PaymentMethod(
            name="TUU Card",
            method_type=PaymentMethod.Type.CARD_TERMINAL,
            treasury_account=self.drawer,
            linked_terminal_device=self.device,
        )
        self.assertTrue(pm.is_integrated)

    def test_card_without_device_not_integrated(self):
        pm = PaymentMethod(
            name="Card Manual",
            method_type=PaymentMethod.Type.CARD,
            treasury_account=self.drawer,
        )
        self.assertFalse(pm.is_integrated)

    def test_cash_not_integrated(self):
        pm = PaymentMethod(
            name="Efectivo",
            method_type=PaymentMethod.Type.CASH,
            treasury_account=self.drawer,
        )
        self.assertFalse(pm.is_integrated)


class EffectiveSettlementAccountTest(TestCase):
    def setUp(self):
        accts = _seed_coa()
        supplier = Contact.objects.create(name="TUU", tax_id="76.000.000-3")
        self.drawer = TreasuryAccount.objects.create(
            name="Gaveta", account=accts["acct1"], account_type=TreasuryAccount.Type.CASH,
        )
        self.bridge = TreasuryAccount.objects.create(
            name="Puente TUU", account=accts["acct2"], account_type=TreasuryAccount.Type.BRIDGE,
        )
        self.other = TreasuryAccount.objects.create(
            name="Explicit", account=accts["acct3"], account_type=TreasuryAccount.Type.CASH,
        )
        self.provider = PaymentTerminalProvider.objects.create(
            name="TUU", provider_type=PaymentTerminalProvider.ProviderType.TUU,
            supplier=supplier, receivable_account=accts["acct1"],
            commission_expense_account=accts["acct1"], bank_treasury_account=self.bridge,
        )
        self.device = PaymentTerminalDevice.objects.create(
            name="T1", provider=self.provider, serial_number="SN002",
        )

    def test_explicit_override_raises_validation_error(self):
        """settlement_account diferente al puente del proveedor debe ser rechazado."""
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError) as ctx:
            PaymentMethod.objects.create(
                name="TUU c/ override",
                method_type=PaymentMethod.Type.CARD_TERMINAL,
                treasury_account=self.drawer,
                settlement_account=self.other,
                linked_terminal_device=self.device,
            )
        self.assertIn('settlement_account', ctx.exception.message_dict)

    def test_card_terminal_auto_assigns_provider_bridge(self):
        """clean() auto-asigna settlement_account desde el proveedor del device."""
        pm = PaymentMethod.objects.create(
            name="TUU card",
            method_type=PaymentMethod.Type.CARD_TERMINAL,
            treasury_account=self.drawer,
            linked_terminal_device=self.device,
        )
        self.assertEqual(pm.settlement_account, self.bridge)
        self.assertEqual(pm.effective_settlement_account, self.bridge)

    def test_cash_uses_treasury_account(self):
        pm = PaymentMethod.objects.create(
            name="Cash",
            method_type=PaymentMethod.Type.CASH,
            treasury_account=self.drawer,
        )
        self.assertEqual(pm.effective_settlement_account, self.drawer)


@override_settings(TUU_GATEWAY_MODE="fake")
class OrchestratorCreateMovementTest(TestCase):
    """create_movement usa effective_settlement_account, no el drawer."""

    def setUp(self):
        accts = _seed_coa()
        supplier = Contact.objects.create(name="TUU", tax_id="76.000.000-4")
        self.customer = Contact.objects.create(name="Cliente Test", tax_id="11.111.111-1")

        self.drawer = TreasuryAccount.objects.create(
            name="Gaveta POS", account=accts["acct1"], account_type=TreasuryAccount.Type.CASH,
        )
        self.bridge = TreasuryAccount.objects.create(
            name="Puente TUU", account=accts["acct2"], account_type=TreasuryAccount.Type.BRIDGE,
        )
        self.provider = PaymentTerminalProvider.objects.create(
            name="TUU",
            provider_type=PaymentTerminalProvider.ProviderType.TUU,
            supplier=supplier,
            receivable_account=accts["acct1"],
            commission_expense_account=accts["acct1"],
            bank_treasury_account=self.bridge,
        )
        self.device = PaymentTerminalDevice.objects.create(
            name="T1", provider=self.provider, serial_number="SN003",
        )
        self.pm_card_terminal = PaymentMethod.objects.create(
            name="TUU Card Terminal",
            method_type=PaymentMethod.Type.CARD_TERMINAL,
            treasury_account=self.drawer,
            linked_terminal_device=self.device,
        )
        self.pm_cash = PaymentMethod.objects.create(
            name="Efectivo",
            method_type=PaymentMethod.Type.CASH,
            treasury_account=self.drawer,
            settlement_account=self.drawer,
        )

    def test_card_terminal_movement_lands_on_bridge_not_drawer(self):
        movement = PaymentOrchestrator.create_movement(
            payment_method_obj=self.pm_card_terminal,
            amount=Decimal("10000"),
            movement_type=TreasuryMovement.Type.INBOUND,
            partner=self.customer,
            reference="test",
        )
        self.assertNotEqual(movement.to_account, self.drawer, "No debe aterrizar en gaveta")
        self.assertEqual(movement.to_account, self.bridge, "Debe aterrizar en cuenta puente")
        self.assertEqual(movement.payment_method, TreasuryMovement.Method.CARD)
        self.assertEqual(movement.payment_method_new, self.pm_card_terminal)

    def test_cash_movement_lands_on_drawer(self):
        movement = PaymentOrchestrator.create_movement(
            payment_method_obj=self.pm_cash,
            amount=Decimal("5000"),
            movement_type=TreasuryMovement.Type.INBOUND,
            partner=self.customer,
            reference="test",
        )
        self.assertEqual(movement.to_account, self.drawer)
        self.assertEqual(movement.payment_method, TreasuryMovement.Method.CASH)

    def test_transaction_number_resolved_from_payment_request(self):
        from treasury.models import PaymentRequest
        pr = PaymentRequest.objects.create(
            idempotency_key="test-idem-key-001",
            amount=10000,
            device=self.device,
            provider=self.provider,
            status=PaymentRequest.Status.COMPLETED,
            sequence_number="SEQ-42",
        )
        movement = PaymentOrchestrator.create_movement(
            payment_method_obj=self.pm_card_terminal,
            amount=Decimal("10000"),
            partner=self.customer,
            payment_request=pr,
        )
        self.assertEqual(movement.transaction_number, "SEQ-42")

    def test_transaction_number_from_idempotency_key(self):
        from treasury.models import PaymentRequest
        PaymentRequest.objects.create(
            idempotency_key="key-via-string",
            amount=10000,
            device=self.device,
            provider=self.provider,
            status=PaymentRequest.Status.COMPLETED,
            sequence_number="SEQ-99",
        )
        movement = PaymentOrchestrator.create_movement(
            payment_method_obj=self.pm_card_terminal,
            amount=Decimal("10000"),
            partner=self.customer,
            payment_request_idempotency_key="key-via-string",
        )
        self.assertEqual(movement.transaction_number, "SEQ-99")


class GatewayFactoryRegistryTest(TestCase):
    def test_fake_mode_returns_fake_gateway(self):
        from treasury.gateways.factory import get_gateway
        from treasury.gateways.fake import FakeTuuGateway
        with override_settings(TUU_GATEWAY_MODE="fake"):
            gw = get_gateway()
            self.assertIsInstance(gw, FakeTuuGateway)

    def test_live_without_provider_raises(self):
        from treasury.gateways.factory import get_gateway
        with override_settings(TUU_GATEWAY_MODE="live"):
            with self.assertRaises(ValueError):
                get_gateway(provider=None)

    def test_unsupported_provider_type_raises_gateway_error(self):
        from treasury.gateways.factory import get_gateway
        provider = mock.MagicMock()
        provider.provider_type = "MERCADOPAGO"  # not yet in registry
        with override_settings(TUU_GATEWAY_MODE="live"):
            with self.assertRaises(GatewayError) as ctx:
                get_gateway(provider=provider)
            self.assertIn("UNSUPPORTED_PROVIDER", ctx.exception.code)

    def test_unknown_mode_raises(self):
        from treasury.gateways.factory import get_gateway
        with override_settings(TUU_GATEWAY_MODE="invalid"):
            with self.assertRaises(ValueError):
                get_gateway()


class InitiateRemoteValidationTest(TestCase):
    def setUp(self):
        accts = _seed_coa()
        supplier = Contact.objects.create(name="TUU", tax_id="76.000.000-5")
        treas = TreasuryAccount.objects.create(
            name="Gaveta", account=accts["acct1"], account_type=TreasuryAccount.Type.CASH,
        )
        bridge = TreasuryAccount.objects.create(
            name="Puente", account=accts["acct2"], account_type=TreasuryAccount.Type.BRIDGE,
        )
        provider = PaymentTerminalProvider.objects.create(
            name="TUU", provider_type=PaymentTerminalProvider.ProviderType.TUU,
            supplier=supplier, receivable_account=accts["acct1"],
            commission_expense_account=accts["acct1"], bank_treasury_account=bridge,
        )
        # CARD_TERMINAL sin device → is_integrated = False
        self.pm_no_device = PaymentMethod.objects.create(
            name="Card sin device",
            method_type=PaymentMethod.Type.CARD,
            treasury_account=treas,
        )

    def test_initiate_remote_without_device_raises(self):
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            PaymentOrchestrator.initiate_remote_payment(
                payment_method_obj=self.pm_no_device,
                amount=5000,
            )
