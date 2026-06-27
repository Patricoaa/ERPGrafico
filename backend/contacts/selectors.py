from django.db import models
from django.db.models import QuerySet
from django.db.models.functions import Replace

from .models import Contact


def list_contacts(*, params: dict) -> QuerySet:
    """
    Main contact list queryset. Handles:
    - RUT/tax_id normalization for search
    - role filtering (CUSTOMER / SUPPLIER / RELATED / PARTNER / EMPLOYEE / USER)
    - partner filtering
    - terminal payment method filtering
    """
    queryset = Contact.objects.all()

    search_param = params.get("search")
    if search_param:
        normalized_search = search_param.replace(".", "").replace("-", "").replace(" ", "")
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

    contact_role = params.get("role")
    if contact_role:
        contact_role = contact_role.upper()
        if contact_role == "CUSTOMER":
            queryset = queryset.filter(sale_orders__isnull=False).distinct()
        elif contact_role == "SUPPLIER":
            queryset = queryset.filter(purchase_orders__isnull=False).distinct()
        elif contact_role == "RELATED":
            queryset = queryset.filter(related_work_orders__isnull=False).distinct()
        elif contact_role == "PARTNER":
            queryset = queryset.filter(is_partner=True)
        elif contact_role == "EMPLOYEE":
            queryset = queryset.filter(employees__isnull=False).distinct()
        elif contact_role == "USER":
            queryset = queryset.filter(system_user__isnull=False)

    if params.get("has_terminal_payment_method") == "true":
        queryset = queryset.filter(terminal_providers__is_active=True).distinct()

    queryset = queryset.annotate(
        last_sale_date=models.Max("sale_orders__date")
    )

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
        Contact.objects.filter(sale_orders__date__lte=cutoff_date)
        .exclude(sale_orders__status__in=["DRAFT", "CANCELLED"])
        .distinct()
    )

    for contact in contacts_with_sales:
        payment_term = contact.credit_days or 30
        buckets = {
            "current": Decimal("0"),
            "overdue_30": Decimal("0"),
            "overdue_60": Decimal("0"),
            "overdue_90": Decimal("0"),
            "overdue_90plus": Decimal("0"),
        }

        orders = contact.sale_orders.filter(date__lte=cutoff_date).exclude(
            status__in=["DRAFT", "CANCELLED"]
        )
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum(
                (p.amount for p in payments if p.movement_type in ["INBOUND", "ADJUSTMENT"]),
                Decimal("0"),
            )
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == "OUTBOUND"),
                Decimal("0"),
            )
            balance = order.effective_total - (paid_in - paid_out)

            if balance <= Decimal("0"):
                continue

            order_date = order.date if not hasattr(order.date, "date") else order.date.date()
            due_date = order_date + timedelta(days=payment_term)
            days_overdue = (cutoff_date - due_date).days

            if days_overdue <= 0:
                buckets["current"] += balance
            elif days_overdue <= 30:
                buckets["overdue_30"] += balance
            elif days_overdue <= 60:
                buckets["overdue_60"] += balance
            elif days_overdue <= 90:
                buckets["overdue_90"] += balance
            else:
                buckets["overdue_90plus"] += balance

        total = sum(buckets.values())
        if total <= Decimal("0"):
            continue

        results.append(
            {
                "contact_id": contact.id,
                "name": contact.name,
                "tax_id": contact.tax_id,
                "credit_days": payment_term,
                **buckets,
                "total": total,
            }
        )

    results.sort(key=lambda r: r["total"], reverse=True)
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
        Contact.objects.filter(purchase_orders__date__lte=cutoff_date)
        .exclude(purchase_orders__status__in=["DRAFT", "CANCELLED"])
        .distinct()
    )

    for contact in contacts_with_purchases:
        payment_term = contact.credit_days or 30
        buckets = {
            "current": Decimal("0"),
            "overdue_30": Decimal("0"),
            "overdue_60": Decimal("0"),
            "overdue_90": Decimal("0"),
            "overdue_90plus": Decimal("0"),
        }

        orders = contact.purchase_orders.filter(date__lte=cutoff_date).exclude(
            status__in=["DRAFT", "CANCELLED"]
        )
        for order in orders:
            # Payments on purchase orders are stored as TreasuryMovements
            # linked via order.payments (OUTBOUND = paying the supplier).
            payments = order.payments.filter(is_pending_registration=False)
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == "OUTBOUND"),
                Decimal("0"),
            )
            # Inbound refunds from supplier reduce the balance
            paid_in = sum(
                (p.amount for p in payments if p.movement_type == "INBOUND"),
                Decimal("0"),
            )
            balance = order.total - (paid_out - paid_in)

            if balance <= Decimal("0"):
                continue

            order_date = order.date if not hasattr(order.date, "date") else order.date.date()
            due_date = order_date + timedelta(days=payment_term)
            days_overdue = (cutoff_date - due_date).days

            if days_overdue <= 0:
                buckets["current"] += balance
            elif days_overdue <= 30:
                buckets["overdue_30"] += balance
            elif days_overdue <= 60:
                buckets["overdue_60"] += balance
            elif days_overdue <= 90:
                buckets["overdue_90"] += balance
            else:
                buckets["overdue_90plus"] += balance

        total = sum(buckets.values())
        if total <= Decimal("0"):
            continue

        results.append(
            {
                "contact_id": contact.id,
                "name": contact.name,
                "tax_id": contact.tax_id,
                "credit_days": payment_term,
                **buckets,
                "total": total,
            }
        )

    results.sort(key=lambda r: r["total"], reverse=True)
    return results[:limit]


def list_credit_portfolio(*, is_blacklist: bool) -> QuerySet:
    """
    Returns contacts relevant for the credit/cartera view.
    - is_blacklist=True → credit_blocked contacts only
    - is_blacklist=False → contacts with credit enabled, limit, or any sale orders
    """
    if is_blacklist:
        return Contact.objects.filter(credit_blocked=True).distinct()

    return (
        Contact.objects.filter(
            models.Q(credit_enabled=True)
            | models.Q(credit_limit__isnull=False)
            | models.Q(sale_orders__isnull=False)
        )
        .filter(credit_blocked=False)
        .distinct()
    )

class ContactSelector:
    @staticmethod
    def get_credit_portfolio_data(is_blacklist: bool) -> dict:
        from decimal import Decimal
        from .serializers import ContactSerializer
        
        contacts = list_credit_portfolio(is_blacklist=is_blacklist)

        contact_list = []
        summary = {
            "total_debt": Decimal("0"),
            "total_exposure": Decimal("0"),
            "potential_loss": Decimal("0"),
            "current": Decimal("0"),
            "overdue_30": Decimal("0"),
            "overdue_60": Decimal("0"),
            "overdue_90": Decimal("0"),
            "overdue_90plus": Decimal("0"),
            "count_with_credit": 0,
            "count_debtors": 0,
            "count_overdue": 0,
            "risk_distribution": {
                "LOW": 0,
                "MEDIUM": 0,
                "HIGH": 0,
                "CRITICAL": 0,
            },
        }

        for contact in contacts:
            balance_used = contact.credit_balance_used
            aging = contact.credit_aging

            if is_blacklist:
                from django.db.models import Sum

                write_offs = contact.treasury_movements.filter(
                    payment_method="WRITE_OFF", is_pending_registration=False
                ).aggregate(Sum("amount"))["amount__sum"] or Decimal("0")
                recoveries = contact.treasury_movements.filter(
                    reference="RECUPERACION", is_pending_registration=False
                ).aggregate(Sum("amount"))["amount__sum"] or Decimal("0")
                balance_used = write_offs - recoveries

            if (
                balance_used > 0
                or contact.credit_enabled
                or contact.credit_limit
                or is_blacklist
            ):
                summary["count_with_credit"] += 1

                if contact.credit_limit:
                    summary["total_exposure"] += contact.credit_limit

                risk_level = contact.credit_risk_level
                summary["risk_distribution"][risk_level] += 1

                if risk_level == "CRITICAL":
                    summary["potential_loss"] += balance_used

                if balance_used > 0:
                    summary["count_debtors"] += 1
                    summary["total_debt"] += balance_used
                    summary["current"] += aging["current"]
                    summary["overdue_30"] += aging["overdue_30"]
                    summary["overdue_60"] += aging["overdue_60"]
                    summary["overdue_90"] += aging["overdue_90"]
                    summary["overdue_90plus"] += aging["overdue_90plus"]

                    overdue = (
                        aging["overdue_30"]
                        + aging["overdue_60"]
                        + aging["overdue_90"]
                        + aging["overdue_90plus"]
                    )
                    if overdue > 0:
                        summary["count_overdue"] += 1

                data = ContactSerializer(contact).data
                if is_blacklist:
                    data["credit_balance_used"] = str(balance_used)
                contact_list.append(data)

        summary["utilization_rate"] = "0.00"
        if summary["total_exposure"] > 0:
            rate = (summary["total_debt"] / summary["total_exposure"]) * 100
            summary["utilization_rate"] = f"{rate:.2f}"

        for key in [
            "total_debt",
            "total_exposure",
            "potential_loss",
            "current",
            "overdue_30",
            "overdue_60",
            "overdue_90",
            "overdue_90plus",
        ]:
            summary[key] = str(summary[key])

        return {
            "contacts": contact_list,
            "summary": summary,
        }

    @staticmethod
    def get_credit_ledger(contact: Contact, include_all: bool = False) -> list:
        """
        Retorna la lista de órdenes a crédito pendientes o castigadas para el contacto,
        enriquecida con fechas de vencimiento y clasificación de riesgo (aging buckets).
        """
        from datetime import timedelta
        from decimal import Decimal
        from django.utils import timezone
        from sales.serializers import SaleOrderSerializer

        today = timezone.now().date()
        payment_term = contact.credit_days or 30

        orders = contact.sale_orders.exclude(status__in=["DRAFT", "CANCELLED"]).order_by("-date")

        ledger_data = []
        for order in orders:
            payments = order.payments.filter(is_pending_registration=False)
            paid_in = sum(
                (p.amount for p in payments if p.movement_type in ["INBOUND", "ADJUSTMENT"]),
                Decimal("0"),
            )
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == "OUTBOUND"), Decimal("0")
            )
            payments_net = paid_in - paid_out
            balance = order.effective_total - payments_net

            is_written_off = payments.filter(payment_method="WRITE_OFF").exists()

            if balance > 0 or (is_written_off and include_all):
                order_date = order.date
                if hasattr(order_date, "date"):
                    order_date = order_date.date()
                due_date = order_date + timedelta(days=payment_term)
                days_overdue = (today - due_date).days

                if balance <= 0 and is_written_off:
                    aging_bucket = "written_off"
                elif days_overdue <= 0:
                    aging_bucket = "current"
                elif days_overdue <= 30:
                    aging_bucket = "overdue_30"
                elif days_overdue <= 60:
                    aging_bucket = "overdue_60"
                elif days_overdue <= 90:
                    aging_bucket = "overdue_90"
                else:
                    aging_bucket = "overdue_90plus"

                ledger_data.append(
                    {
                        **SaleOrderSerializer(order).data,
                        "due_date": due_date,
                        "days_overdue": max(0, days_overdue),
                        "aging_bucket": aging_bucket,
                        "balance": str(balance),
                        "paid_amount": str(payments_net),
                    }
                )

        return ledger_data

class ContactSelectorExt:
    @staticmethod
    def get_insights(contact):
        from production.serializers import WorkOrderSerializer
        from purchasing.serializers import PurchaseOrderSerializer
        from sales.serializers import SaleOrderSerializer
        from .serializers import ContactSerializer
        sos = contact.sale_orders.all().order_by('-date')
        pos = contact.purchase_orders.all().order_by('-date')
        wor = contact.related_work_orders.exclude(sale_order__customer=contact).order_by('-created_at')
        return {
            'contact': ContactSerializer(contact).data,
            'sales': {'count': sos.count(), 'orders': SaleOrderSerializer(sos[:50], many=True).data},
            'purchases': {'count': pos.count(), 'orders': PurchaseOrderSerializer(pos[:50], many=True).data},
            'work_orders': {'count': wor.count(), 'orders': WorkOrderSerializer(wor[:50], many=True).data}
        }

    @staticmethod
    def get_credit_portfolio_data_cached(request, view):
        from core.api.throttles import HeavyReportThrottle
        from core.cache import cache_report
        from rest_framework.exceptions import Throttled
        if not HeavyReportThrottle().allow_request(request, view):
            raise Throttled(detail='Demasiadas solicitudes al reporte de crédito. Intente en un momento.')
        
        from .selectors import ContactSelector
        is_blacklist = request.query_params.get('blacklist', 'false') == 'true'
        return cache_report(
            module='contacts', endpoint='credit_portfolio', 
            params={'blacklist': str(is_blacklist)}, timeout=120, 
            generator=lambda: ContactSelector.get_credit_portfolio_data(is_blacklist)
        )

    @staticmethod
    def get_partner_statement(contact, serializer_class):
        from rest_framework.exceptions import ValidationError
        if not contact.is_partner: raise ValidationError('El contacto no está marcado como socio.')
        from .partner_models import PartnerTransaction
        from .serializers import PartnerTransactionSerializer
        transactions = PartnerTransaction.objects.filter(partner=contact).order_by('-date', '-created_at')
        return {
            'contact': serializer_class(contact).data,
            'summary': {
                'equity_percentage': str(contact.partner_equity_percentage or 0),
                'balance': str(contact.partner_balance),
                'total_contributions': str(contact.partner_total_contributions),
                'total_paid_in': str(contact.partner_total_paid_in),
                'pending_capital': str(contact.partner_pending_capital),
                'provisional_withdrawals': str(contact.partner_provisional_withdrawals_balance),
                'total_formal_withdrawals': str(contact.partner_total_withdrawals)
            },
            'transactions': PartnerTransactionSerializer(transactions, many=True).data
        }
