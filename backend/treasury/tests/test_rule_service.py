"""
Tests — S1.1: Fix success_rate en RuleService.increment_rule_usage
==================================================================

DoD del roadmap:
  "test unitario: 1 success, 1 fail → success_rate = 50%"
"""

import pytest
from django.contrib.auth import get_user_model

from treasury.models import ReconciliationRule, TreasuryAccount
from treasury.rule_service import RuleService

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="testuser", password="pass")


@pytest.fixture
def rule(db, user):
    """
    Regla global (treasury_account=None) para evitar la cadena de validación
    de TreasuryAccount (prefijo contable, jerarquía, etc.).
    ReconciliationRule.treasury_account es null=True, blank=True.
    """
    return ReconciliationRule.objects.create(
        name="Regla Test",
        treasury_account=None,
        priority=1,
        match_config={"criteria": ["amount_exact"], "min_score": 70, "weights": {"amount": 100}},
        created_by=user,
    )


# ---------------------------------------------------------------------------
# success_rate como propiedad derivada
# ---------------------------------------------------------------------------

class TestSuccessRateProperty:
    def test_zero_applications_returns_zero(self, rule):
        """Sin aplicaciones la tasa debe ser 0.0 (sin ZeroDivisionError)."""
        assert rule.times_applied == 0
        assert rule.times_succeeded == 0
        assert rule.success_rate == 0.0

    def test_all_successes(self, rule):
        rule.times_applied = 4
        rule.times_succeeded = 4
        assert rule.success_rate == 100.0

    def test_no_successes(self, rule):
        rule.times_applied = 3
        rule.times_succeeded = 0
        assert rule.success_rate == 0.0

    def test_partial_success(self, rule):
        rule.times_applied = 10
        rule.times_succeeded = 7
        assert rule.success_rate == 70.0


# ---------------------------------------------------------------------------
# increment_rule_usage — lógica principal del S1.1
# ---------------------------------------------------------------------------

class TestIncrementRuleUsage:
    """
    DoD: test unitario: 1 success, 1 fail → success_rate = 50%
    """

    def test_one_success_one_fail_is_50_percent(self, db, rule):
        """Caso exacto del DoD del roadmap S1.1."""
        RuleService.increment_rule_usage(rule.id, success=True)
        RuleService.increment_rule_usage(rule.id, success=False)

        rule.refresh_from_db()
        assert rule.times_applied == 2
        assert rule.times_succeeded == 1
        assert rule.success_rate == 50.0

    def test_success_increments_both_counters(self, db, rule):
        RuleService.increment_rule_usage(rule.id, success=True)

        rule.refresh_from_db()
        assert rule.times_applied == 1
        assert rule.times_succeeded == 1
        assert rule.success_rate == 100.0

    def test_failure_increments_only_times_applied(self, db, rule):
        RuleService.increment_rule_usage(rule.id, success=False)

        rule.refresh_from_db()
        assert rule.times_applied == 1
        assert rule.times_succeeded == 0
        assert rule.success_rate == 0.0

    def test_nonexistent_rule_does_not_raise(self, db):
        """La función no debe propagar DoesNotExist para reglas inexistentes."""
        RuleService.increment_rule_usage(rule_id=99999, success=True)  # no debe lanzar

    def test_multiple_successes_accumulate_correctly(self, db, rule):
        """3 successes + 1 fail = 75%."""
        for _ in range(3):
            RuleService.increment_rule_usage(rule.id, success=True)
        RuleService.increment_rule_usage(rule.id, success=False)

        rule.refresh_from_db()
        assert rule.times_applied == 4
        assert rule.times_succeeded == 3
        assert rule.success_rate == 75.0

    def test_counters_are_atomic(self, db, rule):
        """Verifica que F() expressions producen incrementos correctos incluso con valores pre-existentes."""
        # Simular estado previo directamente en DB
        ReconciliationRule.objects.filter(id=rule.id).update(
            times_applied=10, times_succeeded=5
        )

        RuleService.increment_rule_usage(rule.id, success=True)

        rule.refresh_from_db()
        assert rule.times_applied == 11
        assert rule.times_succeeded == 6
        assert rule.success_rate == pytest.approx(54.55, abs=0.01)


# ---------------------------------------------------------------------------
# get_rule_statistics
# ---------------------------------------------------------------------------

class TestGetRuleStatistics:
    def test_returns_correct_structure(self, db, rule):
        stats = RuleService.get_rule_statistics(rule.id)

        assert stats["rule_id"] == rule.id
        assert "times_applied" in stats
        assert "times_succeeded" in stats
        assert "success_rate" in stats
        assert "is_active" in stats
        assert "priority" in stats
        assert "auto_confirm" in stats

    def test_nonexistent_rule_returns_error(self, db):
        stats = RuleService.get_rule_statistics(99999)
        assert "error" in stats

    def test_statistics_reflect_increments(self, db, rule):
        RuleService.increment_rule_usage(rule.id, success=True)
        RuleService.increment_rule_usage(rule.id, success=False)

        stats = RuleService.get_rule_statistics(rule.id)
        assert stats["times_applied"] == 2
        assert stats["times_succeeded"] == 1
        assert stats["success_rate"] == 50.0
