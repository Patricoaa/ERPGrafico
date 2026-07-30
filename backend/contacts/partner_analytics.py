from __future__ import annotations

from collections import OrderedDict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils.timezone import now

from .partner_models import PartnerTransaction


class PartnerAnalyticsService:
    """Read-only analytics for partner/shareholder evolution."""

    CATEGORY_MAP: dict[str, list[str]] = {
        "contributions": [
            PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH,
            PartnerTransaction.Type.CAPITAL_CONTRIBUTION_INVENTORY,
            PartnerTransaction.Type.EQUITY_SUBSCRIPTION,
        ],
        "withdrawals": [
            PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL,
            PartnerTransaction.Type.WITHDRAWAL,
            PartnerTransaction.Type.CAPITAL_RETURN,
            PartnerTransaction.Type.EQUITY_REDUCTION,
        ],
        "earnings": [
            PartnerTransaction.Type.REINVESTMENT,
            PartnerTransaction.Type.RETAINED,
        ],
        "earnings_out": [
            PartnerTransaction.Type.RETAINED_MOBILIZATION,
        ],
        "dividends": [
            PartnerTransaction.Type.DIVIDEND,
            PartnerTransaction.Type.DIVIDEND_PAYMENT,
        ],
        "loss_absorption": [
            PartnerTransaction.Type.LOSS_ABSORPTION,
        ],
        "loans_in": [
            PartnerTransaction.Type.LOAN_TO_COMPANY,
        ],
        "loans_out": [
            PartnerTransaction.Type.LOAN_FROM_COMPANY,
        ],
        "transfers": [
            PartnerTransaction.Type.EQUITY_TRANSFER_IN,
            PartnerTransaction.Type.EQUITY_TRANSFER_OUT,
        ],
    }

    @staticmethod
    def _sign_for_category(category: str) -> int:
        if category in ("contributions", "earnings", "loans_in"):
            return 1
        if category in ("withdrawals", "earnings_out", "dividends", "loss_absorption", "loans_out"):
            return -1
        return 0

    @staticmethod
    def get_evolution(months: int = 24, granularity: str = "month") -> dict:
        """
        Returns monthly (or daily/yearly) snapshots of partner metrics.
        """
        from django.db.models.functions import TruncMonth, TruncDay, TruncYear

        trunc_map = {
            "month": TruncMonth,
            "day": TruncDay,
            "year": TruncYear,
        }
        trunc_fn = trunc_map.get(granularity, TruncMonth)

        cutoff = (now() - timedelta(days=months * 31)).date()

        qs = (
            PartnerTransaction.objects
            .filter(date__gte=cutoff)
            .annotate(period=trunc_fn("date"))
            .values("period", "transaction_type")
            .annotate(total=Sum("amount"))
            .order_by("period", "transaction_type")
        )

        # Build category reverse-map: transaction_type -> category
        type_to_cat: dict[str, str] = {}
        for cat, types in PartnerAnalyticsService.CATEGORY_MAP.items():
            for t in types:
                type_to_cat[t] = cat

        # Group by period with category breakdown
        period_buckets: OrderedDict[str, dict] = OrderedDict()
        partner_periods: OrderedDict[str, set[int]] = OrderedDict()

        for row in qs:
            period = row["period"].isoformat() if row["period"] else ""
            if not period:
                continue
            if period not in period_buckets:
                period_buckets[period] = {
                    "contributions": Decimal("0"),
                    "withdrawals": Decimal("0"),
                    "earnings": Decimal("0"),
                    "dividends": Decimal("0"),
                    "net_flow": Decimal("0"),
                }
                partner_periods[period] = set()

            cat = type_to_cat.get(row["transaction_type"], "other")
            amount = row["total"] or Decimal("0")
            signed = amount * PartnerAnalyticsService._sign_for_category(cat)

            if cat in period_buckets[period]:
                period_buckets[period][cat] += amount

            period_buckets[period]["net_flow"] += signed

        # Compute partner count per period (cumulative distinct partners seen so far)
        all_partner_ids = set()
        cumulative_partner_ids = set()
        partner_first_seen: dict[int, str] = {}

        all_txs = (
            PartnerTransaction.objects
            .filter(date__gte=cutoff)
            .annotate(period=trunc_fn("date"))
            .values("partner_id", "period")
            .distinct()
            .order_by("period")
        )

        for row in all_txs:
            pid = row["partner_id"]
            p = row["period"].isoformat() if row["period"] else ""
            if pid not in partner_first_seen or p < partner_first_seen[pid]:
                partner_first_seen[pid] = p

        for period in period_buckets:
            for pid, first_seen in partner_first_seen.items():
                if first_seen <= period:
                    cumulative_partner_ids.add(pid)
            period_buckets[period]["partner_count"] = len(cumulative_partner_ids)

        # Build cumulative running totals
        running = {
            "net_equity": Decimal("0"),
            "total_contributions": Decimal("0"),
            "total_withdrawals": Decimal("0"),
            "total_earnings": Decimal("0"),
            "total_dividends": Decimal("0"),
        }

        periods = []
        for period, bucket in period_buckets.items():
            running["net_equity"] += bucket["net_flow"]
            running["total_contributions"] += bucket["contributions"]
            running["total_withdrawals"] += bucket["withdrawals"]
            running["total_earnings"] += bucket["earnings"]
            running["total_dividends"] += bucket["dividends"]

            periods.append({
                "period": period,
                "net_equity": str(running["net_equity"]),
                "total_contributions": str(running["total_contributions"]),
                "total_withdrawals": str(running["total_withdrawals"]),
                "total_earnings": str(running["total_earnings"]),
                "total_dividends": str(running["total_dividends"]),
                "period_contributions": str(bucket["contributions"]),
                "period_withdrawals": str(bucket["withdrawals"]),
                "period_earnings": str(bucket["earnings"]),
                "period_dividends": str(bucket["dividends"]),
                "period_net_flow": str(bucket["net_flow"]),
                "partner_count": bucket["partner_count"],
            })

        return {"periods": periods}
