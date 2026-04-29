from django.db import models
from django.db.models import QuerySet
from django.db.models.functions import Replace

from .models import Contact


def list_contacts(*, params: dict) -> QuerySet:
    """
    Main contact list queryset. Handles:
    - RUT/tax_id normalization for search
    - type filtering (CUSTOMER / SUPPLIER / BOTH / NONE)
    - partner filtering
    - terminal payment method filtering
    """
    queryset = Contact.objects.all()

    search_param = params.get("search")
    if search_param:
        normalized_search = (
            search_param.replace(".", "").replace("-", "").replace(" ", "")
        )
        queryset = queryset.annotate(
            normalized_tax_id=Replace(
                Replace(
                    Replace(
                        "tax_id",
                        models.Value("."),
                        models.Value(""),
                    ),
                    models.Value("-"),
                    models.Value(""),
                ),
                models.Value(" "),
                models.Value(""),
            )
        ).filter(
            models.Q(name__icontains=search_param)
            | models.Q(email__icontains=search_param)
            | models.Q(contact_name__icontains=search_param)
            | models.Q(code__icontains=search_param)
            | models.Q(normalized_tax_id__icontains=normalized_search)
        )

    is_partner_param = params.get("is_partner")
    if is_partner_param:
        queryset = queryset.filter(is_partner=is_partner_param.lower() == "true")

    contact_type = params.get("type")
    if contact_type:
        contact_type = contact_type.upper()
        if contact_type == "CUSTOMER":
            queryset = queryset.filter(
                models.Q(sale_orders__isnull=False)
                | models.Q(sale_orders__isnull=True, purchase_orders__isnull=True)
            ).distinct()
        elif contact_type == "SUPPLIER":
            queryset = queryset.filter(
                models.Q(purchase_orders__isnull=False)
                | models.Q(sale_orders__isnull=True, purchase_orders__isnull=True)
            ).distinct()
        elif contact_type == "BOTH":
            queryset = queryset.filter(
                sale_orders__isnull=False, purchase_orders__isnull=False
            ).distinct()
        elif contact_type == "NONE":
            queryset = queryset.filter(
                sale_orders__isnull=True, purchase_orders__isnull=True
            )

    if params.get("has_terminal_payment_method") == "true":
        queryset = queryset.filter(terminal_providers__is_active=True).distinct()

    return queryset


def list_credit_portfolio(*, is_blacklist: bool) -> QuerySet:
    """
    Returns contacts relevant for the credit/cartera view.
    - is_blacklist=True → credit_blocked contacts only
    - is_blacklist=False → contacts with credit enabled, limit, or any sale orders
    """
    if is_blacklist:
        return Contact.objects.filter(credit_blocked=True).distinct()

    return Contact.objects.filter(
        models.Q(credit_enabled=True)
        | models.Q(credit_limit__isnull=False)
        | models.Q(sale_orders__isnull=False)
    ).filter(credit_blocked=False).distinct()
