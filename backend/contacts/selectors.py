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


def customer_aging_report(*, cutoff_date, limit: int = 20) -> list[dict]:
    """
    Aging de clientes (Auxiliar de Clientes) al corte `cutoff_date`.

    Retorna los `limit` clientes con mayor saldo pendiente, ordenados
    por total descendente. Cada entrada contiene:
        contact_id, name, tax_id, credit_days,
        current, overdue_30, overdue_60, overdue_90, overdue_90plus, total.

    Args:
        cutoff_date: fecha de corte (date). Las órdenes con fecha > cutoff_date
                     se ignoran para que el reporte sea determinista en snapshots.
        limit:       número máximo de contactos a devolver (default 20).

    Nota: usa `Contact.credit_aging` pero fijando `today = cutoff_date` para
    reproducibilidad. La propiedad usa `timezone.now().date()` internamente;
    aquí recalculamos la lógica directamente.
    """
    from datetime import timedelta
    from decimal import Decimal

    results = []

    contacts_with_sales = (
        Contact.objects
        .filter(sale_orders__date__lte=cutoff_date)
        .exclude(sale_orders__status__in=['DRAFT', 'CANCELLED'])
        .distinct()
    )

    for contact in contacts_with_sales:
        payment_term = contact.credit_days or 30
        buckets = {
            'current': Decimal('0'),
            'overdue_30': Decimal('0'),
            'overdue_60': Decimal('0'),
            'overdue_90': Decimal('0'),
            'overdue_90plus': Decimal('0'),
        }

        orders = contact.sale_orders.filter(date__lte=cutoff_date).exclude(
            status__in=['DRAFT', 'CANCELLED']
        )
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum(
                (p.amount for p in payments if p.movement_type in ['INBOUND', 'ADJUSTMENT']),
                Decimal('0'),
            )
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == 'OUTBOUND'),
                Decimal('0'),
            )
            balance = order.effective_total - (paid_in - paid_out)

            if balance <= Decimal('0'):
                continue

            order_date = order.date if not hasattr(order.date, 'date') else order.date.date()
            due_date = order_date + timedelta(days=payment_term)
            days_overdue = (cutoff_date - due_date).days

            if days_overdue <= 0:
                buckets['current'] += balance
            elif days_overdue <= 30:
                buckets['overdue_30'] += balance
            elif days_overdue <= 60:
                buckets['overdue_60'] += balance
            elif days_overdue <= 90:
                buckets['overdue_90'] += balance
            else:
                buckets['overdue_90plus'] += balance

        total = sum(buckets.values())
        if total <= Decimal('0'):
            continue

        results.append({
            'contact_id': contact.id,
            'name': contact.name,
            'tax_id': contact.tax_id,
            'credit_days': payment_term,
            **buckets,
            'total': total,
        })

    results.sort(key=lambda r: r['total'], reverse=True)
    return results[:limit]


def supplier_aging_report(*, cutoff_date, limit: int = 20) -> list[dict]:
    """
    Aging de proveedores (Auxiliar de Proveedores) al corte `cutoff_date`.

    Retorna los `limit` proveedores con mayor saldo pendiente, ordenados
    por total descendente. Cada entrada contiene:
        contact_id, name, tax_id, credit_days,
        current, overdue_30, overdue_60, overdue_90, overdue_90plus, total.

    La lógica es simétrica a `customer_aging_report` pero sobre PurchaseOrders:
    el saldo es lo que la empresa AÚN debe al proveedor (total de OC menos
    pagos OUTBOUND registrados).
    """
    from datetime import timedelta
    from decimal import Decimal

    results = []

    contacts_with_purchases = (
        Contact.objects
        .filter(purchase_orders__date__lte=cutoff_date)
        .exclude(purchase_orders__status__in=['DRAFT', 'CANCELLED'])
        .distinct()
    )

    for contact in contacts_with_purchases:
        payment_term = contact.credit_days or 30
        buckets = {
            'current': Decimal('0'),
            'overdue_30': Decimal('0'),
            'overdue_60': Decimal('0'),
            'overdue_90': Decimal('0'),
            'overdue_90plus': Decimal('0'),
        }

        orders = contact.purchase_orders.filter(date__lte=cutoff_date).exclude(
            status__in=['DRAFT', 'CANCELLED']
        )
        for order in orders:
            # Payments on purchase orders are stored as TreasuryMovements
            # linked via order.payments (OUTBOUND = paying the supplier).
            payments = order.payments.filter(is_pending_registration=False)
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == 'OUTBOUND'),
                Decimal('0'),
            )
            # Inbound refunds from supplier reduce the balance
            paid_in = sum(
                (p.amount for p in payments if p.movement_type == 'INBOUND'),
                Decimal('0'),
            )
            balance = order.total - (paid_out - paid_in)

            if balance <= Decimal('0'):
                continue

            order_date = order.date if not hasattr(order.date, 'date') else order.date.date()
            due_date = order_date + timedelta(days=payment_term)
            days_overdue = (cutoff_date - due_date).days

            if days_overdue <= 0:
                buckets['current'] += balance
            elif days_overdue <= 30:
                buckets['overdue_30'] += balance
            elif days_overdue <= 60:
                buckets['overdue_60'] += balance
            elif days_overdue <= 90:
                buckets['overdue_90'] += balance
            else:
                buckets['overdue_90plus'] += balance

        total = sum(buckets.values())
        if total <= Decimal('0'):
            continue

        results.append({
            'contact_id': contact.id,
            'name': contact.name,
            'tax_id': contact.tax_id,
            'credit_days': payment_term,
            **buckets,
            'total': total,
        })

    results.sort(key=lambda r: r['total'], reverse=True)
    return results[:limit]


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
