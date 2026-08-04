"""
Tests para TreasuryMovementAnalyticsService y el endpoint analytics.

Sigue el patrón de ``inventory/tests/test_analytics.py`` (ADR 0058):
agregación server-side, shapes chart-ready y filtros.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from accounting.models import Account, AccountType
from treasury.models import Bank, TreasuryAccount, TreasuryMovement

User = get_user_model()


@pytest.fixture
def env(db):
    user = User.objects.create_user(username="analytics", password="x")

    bank_a = Bank.objects.create(name="Banco A", code="BA")
    bank_b = Bank.objects.create(name="Banco B", code="BB")

    def _account(name, code, bank=None, account_type=TreasuryAccount.Type.CASH):
        acc = Account.objects.create(
            name=name,
            code=code,
            account_type=AccountType.ASSET,
        )
        kwargs = dict(
            name=name,
            code=code,
            account=acc,
            account_type=account_type,
            bank=bank,
        )
        if account_type == TreasuryAccount.Type.CHECKING:
            kwargs["account_number"] = code.replace(".", "")
        return TreasuryAccount.objects.create(**kwargs)

    caja = _account("Caja General", "1.1.01.001")
    cuenta = _account("Cuenta Banco A", "1.1.02.001", bank=bank_a, account_type=TreasuryAccount.Type.CHECKING)
    cuenta_b = _account("Cuenta Banco B", "1.1.02.002", bank=bank_b, account_type=TreasuryAccount.Type.CHECKING)

    return {"user": user, "caja": caja, "cuenta": cuenta, "cuenta_b": cuenta_b, "bank_a": bank_a}


def _movimiento(env, movement_type, amount, days_ago=1, **overrides):
    kwargs = dict(
        movement_type=movement_type,
        amount=Decimal(str(amount)),
        date=timezone.now().date() - timedelta(days=days_ago),
        created_by=env["user"],
        status=TreasuryMovement.MovementStatus.POSTED,
    )
    kwargs.update(overrides)
    return TreasuryMovement.objects.create(**kwargs)


@pytest.mark.django_db
class TestDirectionClassification:
    def test_directions_mapean_tipos(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.OUTBOUND, "400", from_account=env["caja"])
        _movimiento(
            env, TreasuryMovement.Type.TRANSFER, "300", from_account=env["caja"], to_account=env["cuenta"]
        )
        _movimiento(env, TreasuryMovement.Type.ADJUSTMENT, "200", from_account=env["caja"])
        _movimiento(
            env, TreasuryMovement.Type.CREDIT_LINE_DRAW, "500", from_account=env["cuenta"]
        )
        _movimiento(
            env, TreasuryMovement.Type.CREDIT_LINE_REPAY, "700", to_account=env["cuenta"]
        )

        from treasury.analytics import TreasuryMovementAnalyticsService

        dist = TreasuryMovementAnalyticsService.get_direction_distribution()
        by_id = {row["id"]: row for row in dist}

        assert by_id["IN"]["amount"] == "1700"  # 1000 INBOUND + 700 CREDIT_LINE_REPAY
        assert by_id["IN"]["count"] == 2
        assert by_id["OUT"]["amount"] == "900"  # 400 OUTBOUND + 500 CREDIT_LINE_DRAW
        assert by_id["OUT"]["count"] == 2
        assert by_id["TRANSFER"]["amount"] == "300"
        assert by_id["ADJUSTMENT"]["amount"] == "200"

    def test_cancelled_excluidos(self, env):
        _movimiento(
            env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"],
            status=TreasuryMovement.MovementStatus.CANCELLED,
        )

        from treasury.analytics import TreasuryMovementAnalyticsService

        dist = TreasuryMovementAnalyticsService.get_direction_distribution()
        by_id = {row["id"]: row for row in dist}
        assert by_id["IN"]["count"] == 0
        assert by_id["IN"]["amount"] == "0"


@pytest.mark.django_db
class TestConsolidated:
    def test_summary_kpis(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.OUTBOUND, "400", from_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.ADJUSTMENT, "50", from_account=env["caja"])

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated()
        summary = data["summary"]

        assert summary["total_movements"] == 3
        assert summary["ingresos_count"] == 1
        assert summary["egresos_count"] == 1
        assert summary["ingresos_amount"] == "1000"
        assert summary["egresos_amount"] == "400"
        assert summary["ajustes_amount"] == "50"
        assert summary["net_flow"] == "650"  # 1000 + 50 - 400

    def test_flow_trend_shape(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated()
        assert data["flow_trend"]
        row = data["flow_trend"][0]
        assert set(row.keys()) == {
            "period", "count", "ingresos", "egresos", "ajustes", "transferencias",
        }
        assert row["ingresos"] == "1000"
        assert row["count"] == 1

    def test_account_distribution(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.OUTBOUND, "400", from_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.OUTBOUND, "300", from_account=env["cuenta"])

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated()
        rows = {row["id"]: row for row in data["account_distribution"]}

        assert rows[env["caja"].id]["count"] == 2
        assert rows[env["caja"].id]["in"] == "1000"
        assert rows[env["caja"].id]["out"] == "400"
        assert rows[env["cuenta"].id]["count"] == 1
        assert rows[env["cuenta"].id]["out"] == "300"

    def test_distribuciones_usan_choices(self, env):
        _movimiento(
            env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"],
            payment_method=TreasuryMovement.Method.CASH,
        )

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated()
        pm = {row["id"]: row for row in data["payment_method_distribution"]}
        types = {row["id"]: row for row in data["type_distribution"]}

        assert pm["CASH"]["label"] == "Efectivo"
        assert pm["CASH"]["count"] == 1
        assert pm["CASH"]["amount"] == "1000"
        assert pm["TRANSFER"]["count"] == 0
        assert types["INBOUND"]["count"] == 1
        assert types["INBOUND"]["label"] == "Entrante (Cobro/Venta)"
        assert types["OUTBOUND"]["count"] == 0


@pytest.mark.django_db
class TestGranularity:
    def test_granularity_bucketing(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"], days_ago=45)
        _movimiento(env, TreasuryMovement.Type.INBOUND, "2000", to_account=env["caja"], days_ago=1)

        from treasury.analytics import TreasuryMovementAnalyticsService

        month = TreasuryMovementAnalyticsService.get_flow_trend(granularity="month")
        year = TreasuryMovementAnalyticsService.get_flow_trend(granularity="year")

        assert len(month) == 2
        assert sum(Decimal(r["ingresos"]) for r in month) == Decimal("3000")
        assert len(year) >= 1
        assert sum(Decimal(r["ingresos"]) for r in year) == Decimal("3000")


@pytest.mark.django_db
class TestFilters:
    def test_treasury_account_filter(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.INBOUND, "2000", to_account=env["cuenta"])

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated(treasury_account=env["caja"].id)
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["ingresos_amount"] == "1000"

    def test_bank_filter(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["cuenta"])
        _movimiento(env, TreasuryMovement.Type.INBOUND, "2000", to_account=env["cuenta_b"])

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated(bank=env["bank_a"].id)
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["ingresos_amount"] == "1000"

    def test_payment_method_filter(self, env):
        _movimiento(
            env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"],
            payment_method=TreasuryMovement.Method.CASH,
        )
        _movimiento(
            env, TreasuryMovement.Type.INBOUND, "2000", to_account=env["caja"],
            payment_method=TreasuryMovement.Method.TRANSFER,
        )

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated(payment_method=TreasuryMovement.Method.CASH)
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["ingresos_amount"] == "1000"

    def test_movement_type_filter(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.OUTBOUND, "2000", from_account=env["caja"])

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated(movement_type=TreasuryMovement.Type.OUTBOUND)
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["egresos_amount"] == "2000"

    def test_amount_range_filter(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.INBOUND, "2000", to_account=env["caja"])

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated(amount_min="1500", amount_max="2500")
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["ingresos_amount"] == "2000"

    def test_date_range_filter(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"], days_ago=60)
        _movimiento(env, TreasuryMovement.Type.INBOUND, "2000", to_account=env["caja"], days_ago=1)

        from treasury.analytics import TreasuryMovementAnalyticsService

        today = timezone.now().date()
        data = TreasuryMovementAnalyticsService.get_consolidated(
            date_from=str(today - timedelta(days=7)),
            date_to=str(today),
        )
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["ingresos_amount"] == "2000"

    def test_months_window(self, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"], days_ago=400)

        from treasury.analytics import TreasuryMovementAnalyticsService

        data = TreasuryMovementAnalyticsService.get_consolidated()
        assert data["summary"]["total_movements"] == 0


@pytest.mark.django_db
class TestEndpoint:
    @pytest.fixture
    def auth_client(self):
        client = APIClient()
        user, _ = User.objects.get_or_create(
            username="treasury_analytics_admin",
            defaults={"is_superuser": True},
        )
        client.force_authenticate(user=user)
        return client

    def test_analytics_endpoint_shape(self, auth_client, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.OUTBOUND, "400", from_account=env["caja"])

        response = auth_client.get("/api/treasury/movements/analytics/")
        assert response.status_code == 200

        data = response.json()
        assert set(data.keys()) == {
            "flow_trend",
            "direction_distribution",
            "account_distribution",
            "payment_method_distribution",
            "type_distribution",
            "summary",
        }
        assert data["summary"]["total_movements"] == 2
        assert data["summary"]["ingresos_amount"] == "1000"
        assert data["summary"]["egresos_amount"] == "400"
        assert data["flow_trend"][0]["ingresos"] == "1000"
        assert data["direction_distribution"][0]["label"] == "Ingresos"

    def test_analytics_endpoint_respects_filters(self, auth_client, env):
        _movimiento(env, TreasuryMovement.Type.INBOUND, "1000", to_account=env["caja"])
        _movimiento(env, TreasuryMovement.Type.INBOUND, "2000", to_account=env["cuenta"])

        response = auth_client.get(
            f"/api/treasury/movements/analytics/?treasury_account={env['caja'].id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_movements"] == 1
        assert data["summary"]["ingresos_amount"] == "1000"

    def test_analytics_endpoint_requires_auth(self, env):
        response = APIClient().get("/api/treasury/movements/analytics/")
        assert response.status_code in (401, 403)
