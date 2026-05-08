from django.db.models import Q, QuerySet, Sum, FilteredRelation, Count


from .models import Account, AccountType


def list_accounts(*, params: dict) -> QuerySet:
    """Base account list with optimized totals annotation."""
    queryset = Account.objects.all()
    
    # Annotate with posted totals to avoid N+1 queries during serialization
    queryset = queryset.annotate(
        annotated_debit_total=Sum(
            'journal_items__debit',
            filter=Q(journal_items__entry__status='POSTED')
        ),
        annotated_credit_total=Sum(
            'journal_items__credit',
            filter=Q(journal_items__entry__status='POSTED')
        ),
        annotated_children_count=Count('children'),
    )

    if params.get("is_leaf", "").lower() == "true":
        queryset = queryset.filter(children__isnull=True)
    
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


def get_account_ledger(*, account: Account, start_date: str | None, end_date: str | None) -> dict:
    """
    Computes the libro mayor for an account.
    Returns opening_balance, period_debit, period_credit, closing_balance, movements list.
    """
    base_items = account.journal_items.filter(entry__status="POSTED").select_related("entry")

    opening_balance = 0
    if start_date:
        opening_items = base_items.filter(entry__date__lt=start_date)
        totals = opening_items.aggregate(
            total_debit=Sum("debit"),
            total_credit=Sum("credit"),
        )
        debit = totals.get("total_debit") or 0
        credit = totals.get("total_credit") or 0
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            opening_balance = debit - credit
        else:
            opening_balance = credit - debit

    items = base_items.order_by("entry__date", "entry__id")
    if start_date:
        items = items.filter(entry__date__gte=start_date)
    if end_date:
        items = items.filter(entry__date__lte=end_date)

    balance = float(opening_balance)
    period_debit = 0
    period_credit = 0
    movements = []

    for item in items:
        d = float(item.debit)
        c = float(item.credit)
        period_debit += d
        period_credit += c

        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            balance += d - c
        else:
            balance += c - d

        movements.append(
            {
                "id": item.id,
                "date": item.entry.date,
                "entry_id": item.entry.id,
                "reference": item.entry.reference,
                "description": item.entry.description,
                "debit": d,
                "credit": c,
                "balance": float(balance),
                "partner": item.partner.name if item.partner else "",
                "label": item.label or "",
                "source_document": item.entry.get_source_document,
            }
        )

    return {
        "opening_balance": float(opening_balance),
        "period_debit": float(period_debit),
        "period_credit": float(period_credit),
        "closing_balance": float(balance),
        "movements": movements,
    }
