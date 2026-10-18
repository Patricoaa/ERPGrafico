"""
Helpers shared by the list analytics services (sales/analytics.py, purchasing/analytics.py; ADR-0087).

Money is accumulated as Decimal and converted once at the end (`to_json`); period buckets are the
first day of the period, labelled by the client with `granularityKey`.
"""
from datetime import date
from decimal import Decimal

GRANULARITIES = ("day", "month", "year")


def bucket(day: date, granularity: str) -> date:
    """Representative date of the period (first day)."""
    if granularity == "day":
        return day
    if granularity == "year":
        return date(day.year, 1, 1)
    return date(day.year, day.month, 1)


def previous_bucket(current: date, granularity: str) -> date:
    if granularity == "day":
        return date.fromordinal(current.toordinal() - 1)
    if granularity == "year":
        return date(current.year - 1, 1, 1)
    return date(current.year - 1, 12, 1) if current.month == 1 else date(current.year, current.month - 1, 1)


def num(value) -> Decimal:
    """Exact sums: any amount as Decimal."""
    return value if isinstance(value, Decimal) else Decimal(str(value or 0))


def to_json(value):
    """Decimal → float and date → ISO for the JSON response, recursively."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: to_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_json(item) for item in value]
    return value


def ranked(counts: dict) -> list[dict]:
    """`{id: value}` → `[{id, value}]`, largest first."""
    return sorted(({"id": key, "value": value} for key, value in counts.items()), key=lambda r: r["value"], reverse=True)
