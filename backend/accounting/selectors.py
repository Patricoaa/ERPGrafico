from decimal import Decimal

from django.db.models import Count, F, Q, QuerySet, Sum, Window

from .models import Account, AccountType, JournalEntry


def balance_affecting_statuses():
    return JournalEntry.balance_affecting_statuses()


DEFAULT_LEDGER_LIMIT = 200


def list_accounts(*, params: dict) -> QuerySet:
    """Base account list with optimized totals annotation."""
    queryset = Account.objects.all()

    # Annotate with posted totals to avoid N+1 queries during serialization
    queryset = queryset.annotate(
        annotated_debit_total=Sum(
            "journal_items__debit",
            filter=Q(journal_items__entry__status__in=balance_affecting_statuses()),
        ),
        annotated_credit_total=Sum(
            "journal_items__credit",
            filter=Q(journal_items__entry__status__in=balance_affecting_statuses()),
        ),
        annotated_children_count=Count("children"),
        annotated_posted_items_count=Count(
            "journal_items",
            filter=Q(journal_items__entry__status__in=balance_affecting_statuses()),
            distinct=True,
        ),
    )

    if params.get("is_leaf", "").lower() == "true":
        queryset = queryset.filter(children__isnull=True)

    if search := params.get("search"):
        queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))

    if account_type := params.get("account_type"):
        queryset = queryset.filter(account_type=account_type)

    return queryset


def list_budgetable_accounts(*, account_types: str | None) -> QuerySet:
    """
    Accounts suitable for budgeting.
    account_types: comma-separated AccountType values (optional).
    Returns leaf accounts only, ordered by code.
    """
    from .models import CFCategory

    if account_types:
        types = account_types.split(",")
        queryset = Account.objects.filter(account_type__in=types)
    else:
        queryset = Account.objects.filter(
            Q(account_type__in=[AccountType.INCOME, AccountType.EXPENSE])
            | Q(cf_category=CFCategory.INVESTING)
        )
    return queryset.filter(children__isnull=True).order_by("code")


def get_account_ledger(
    *, account: Account, start_date: str | None, end_date: str | None, limit: int | None = None
) -> dict:
    """
    Computes the libro mayor for an account.
    Returns opening_balance, period_debit, period_credit, closing_balance, movements list.
    """
    page_size = DEFAULT_LEDGER_LIMIT
    if limit is not None:
        try:
            page_size = min(max(int(limit), 1), DEFAULT_LEDGER_LIMIT)
        except (TypeError, ValueError):
            page_size = DEFAULT_LEDGER_LIMIT

    base_items = account.journal_items.filter(
        entry__status__in=balance_affecting_statuses()
    ).select_related("entry", "partner")

    opening_balance = Decimal("0")
    if start_date:
        totals = base_items.filter(entry__date__lt=start_date).aggregate(
            total_debit=Sum("debit"),
            total_credit=Sum("credit"),
        )
        debit = totals.get("total_debit") or Decimal("0")
        credit = totals.get("total_credit") or Decimal("0")
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            opening_balance = debit - credit
        else:
            opening_balance = credit - debit

    items = base_items.order_by("entry__date", "entry__id")
    if start_date:
        items = items.filter(entry__date__gte=start_date)
    if end_date:
        items = items.filter(entry__date__lte=end_date)

    totals = items.aggregate(total_debit=Sum("debit"), total_credit=Sum("credit"))
    period_debit = totals.get("total_debit") or Decimal("0")
    period_credit = totals.get("total_credit") or Decimal("0")

    if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
        closing_balance = opening_balance + period_debit - period_credit
    else:
        closing_balance = opening_balance + period_credit - period_debit

    full_count = items.count()

    windowed = items.annotate(
        _cum_debit=Window(
            Sum("debit"), order_by=[F("entry__date"), F("entry__id"), F("id")]
        ),
        _cum_credit=Window(
            Sum("credit"), order_by=[F("entry__date"), F("entry__id"), F("id")]
        ),
    )
    page_items = windowed[:page_size]

    movements = []
    for item in page_items:
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            balance = opening_balance + item._cum_debit - item._cum_credit
        else:
            balance = opening_balance + item._cum_credit - item._cum_debit

        movements.append(
            {
                "id": item.id,
                "date": item.entry.date,
                "entry_id": item.entry.id,
                "created_at": item.entry.created_at,
                "reference": item.entry.reference,
                "description": item.entry.description,
                "debit": float(item.debit),
                "credit": float(item.credit),
                "balance": float(balance),
                "partner": item.partner.name if item.partner else "",
                "label": item.label or "",
                "source": item.entry.source_info,
            }
        )

    return {
        "opening_balance": float(opening_balance),
        "period_debit": float(period_debit),
        "period_credit": float(period_credit),
        "closing_balance": float(closing_balance),
        "movements": movements,
        "truncated": full_count > page_size,
    }
