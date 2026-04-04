"""
Custom DRF throttle classes for ERPGrafico.

Uses Redis-backed cache for distributed rate limiting
(works correctly across multiple gunicorn workers).
"""

from rest_framework.throttling import UserRateThrottle


class HeavyReportThrottle(UserRateThrottle):
    """
    Stricter throttle for computationally expensive endpoints like
    stock_report, credit_portfolio, reconciliation_dashboard, insights.

    Rate is defined in settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['heavy_report'].
    """
    scope = 'heavy_report'
