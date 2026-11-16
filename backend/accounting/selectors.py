from datetime import date, datetime, time
from decimal import Decimal

from django.db.models import Count, F, Q, QuerySet, Sum, Value, Window
from django.db.models.functions import Coalesce, NullIf
from django.utils import timezone

from core.crypto import CryptoError

from .models import (
    Account,
    AccountType,
    JournalEntry,
    RCVApiKey,
    RCVDocument,
    RCVImport,
    RCVImportAttempt,
)


def balance_affecting_statuses():
    return JournalEntry.balance_affecting_statuses()


DEFAULT_LEDGER_LIMIT = 200


def list_accounts(*, params: dict) -> QuerySet:
    """Base account list with optimized totals annotation."""
    # Default: filter active accounts; allow ?is_active=all or ?is_active=false
    active_param = params.get("is_active")
    if active_param == "all":
        queryset = Account.objects.all()
    elif active_param == "false":
        queryset = Account.objects.filter(is_active=False)
    else:
        queryset = Account.objects.filter(is_active=True)

    # Posted totals are materialized on Account (ADR-0115): no join over journal items here.
    # A join with journal items AND children would multiply each sum by the children count.
    queryset = queryset.annotate(annotated_children_count=Count("children"))

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


def rcv_key_usage(month_start: date) -> dict[int, int]:
    """Peticiones HTTP por API key RCV desde ``month_start`` (hora local), en una query."""
    since = timezone.make_aware(datetime.combine(month_start, time.min))
    rows = (
        RCVImportAttempt.objects.filter(created_at__gte=since, api_key__isnull=False)
        .values("api_key_id")
        .annotate(uses=Count("id"))
        .order_by()
    )
    return {row["api_key_id"]: row["uses"] for row in rows}


def _local_start(day: date) -> datetime:
    return timezone.make_aware(datetime.combine(day, time.min))


def _filter_period(qs: QuerySet, filters: dict) -> QuerySet:
    if filters.get("year") is not None:
        qs = qs.filter(year=filters["year"])
    if filters.get("month") is not None:
        qs = qs.filter(month=filters["month"])
    return qs


def with_terminal_sale(qs: QuerySet[RCVDocument]) -> QuerySet[RCVDocument]:
    """Venta TUU de la boleta (ADR-0139) en la misma consulta.

    El vínculo es único por boleta (``terminalsale_rcv_document_uniq``), así el
    LEFT JOIN no duplica filas.
    """
    return qs.annotate(
        terminal_sale_pk=F("terminal_sales__id"),
        terminal_sale_ref=Coalesce(
            NullIf(F("terminal_sales__sale_id"), Value("")), F("terminal_sales__sequence_number")
        ),
    )


def rcv_documents_queryset(filters: dict) -> QuerySet[RCVDocument]:
    """Listado de documentos RCV con filtros ya validados (``RCVDocumentFilterSerializer``).

    Sin joins a importaciones (``is_missing`` usa solo la FK) y sin ``raw``.
    """
    qs = with_terminal_sale(RCVDocument.objects.select_related("matched_invoice").defer("raw"))
    year, month = filters.get("year"), filters.get("month")
    if year is not None and month is not None:
        qs = qs.filter(period=f"{year:04d}{month:02d}")
    elif year is not None:
        qs = qs.filter(period__startswith=f"{year:04d}")
    elif month is not None:
        qs = qs.filter(period__endswith=f"{month:02d}")
    for field in ("direction", "dte_type", "status", "acknowledgement", "match_status"):
        if filters.get(field) not in (None, ""):
            qs = qs.filter(**{field: filters[field]})
    if filters.get("missing"):
        qs = qs.filter(missing_since_import__isnull=filters["missing"] == "false")
    if filters.get("issue_date_from"):
        qs = qs.filter(issue_date__gte=filters["issue_date_from"])
    if filters.get("issue_date_to"):
        qs = qs.filter(issue_date__lte=filters["issue_date_to"])
    if search := (filters.get("search") or "").strip():
        term = Q(counterparty_rut__icontains=search.replace(".", "")) | Q(
            counterparty_name__icontains=search
        )
        if search.isdigit():
            term |= Q(folio=int(search))
        qs = qs.filter(term)
    return qs


_IMPORT_REFS = ("first_import", "last_import", "missing_since_import")


def rcv_document_detail_queryset() -> QuerySet[RCVDocument]:
    """Detalle: importaciones relacionadas sin su ``raw_response`` (solo se lee id + período)."""
    return with_terminal_sale(
        RCVDocument.objects.select_related(*_IMPORT_REFS, "matched_invoice").defer(
            *(f"{ref}__raw_response" for ref in _IMPORT_REFS)
        )
    )


def rcv_imports_queryset(filters: dict) -> QuerySet[RCVImport]:
    """Listado de importaciones sin la respuesta cruda."""
    qs = RCVImport.objects.select_related("api_key", "triggered_by").defer("raw_response")
    for field in ("direction", "status", "trigger"):
        if filters.get(field):
            qs = qs.filter(**{field: filters[field]})
    return _filter_period(qs, filters)


def rcv_import_detail_queryset() -> QuerySet[RCVImport]:
    return RCVImport.objects.select_related("api_key", "triggered_by").prefetch_related(
        "summaries", "attempts__api_key"
    )


def rcv_api_keys_queryset(month_start: date) -> QuerySet[RCVApiKey]:
    """API keys con ``used_this_month`` (intentos desde ``month_start`` local) anotado."""
    since = _local_start(month_start)
    return RCVApiKey.objects.annotate(
        used_this_month=Count("attempts", filter=Q(attempts__created_at__gte=since))
    ).order_by("id")


def rcv_total_monthly_quota() -> int:
    """Suma de ``monthly_limit`` de las API keys activas."""
    total = RCVApiKey.objects.filter(is_active=True).aggregate(total=Sum("monthly_limit"))["total"]
    return total or 0


def rcv_api_key_with_same_key(plain: str, exclude_pk: int | None = None) -> RCVApiKey | None:
    """Otra API key RCV cuyo valor descifrado es ``plain`` (o ``None``)."""
    if not plain:
        return None
    others = RCVApiKey.objects.all()
    if exclude_pk is not None:
        others = others.exclude(pk=exclude_pk)
    for other in others:
        try:
            if other.get_key() == plain:
                return other
        except CryptoError:
            continue  # key ilegible: no puede colisionar
    return None
