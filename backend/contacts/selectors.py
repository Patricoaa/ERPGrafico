from django.db import models
from django.db.models import Exists, OuterRef, Prefetch, QuerySet, Subquery, Sum, DecimalField as Df, Value
from django.db.models.functions import Coalesce, Replace
from decimal import Decimal

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
        last_sale_date=models.Max("sale_orders__date"),
    )

    from sales.models import SaleOrder
    from purchasing.models import PurchaseOrder
    from production.models import WorkOrder
    from hr.models import Employee
    from core.models import User
    from treasury.models import TreasuryMovement as _TM

    credit_additions_sq = (
        _TM.objects.filter(
            contact_id=OuterRef("pk"),
            payment_method="CREDIT_BALANCE",
            movement_type="OUTBOUND",
            is_pending_registration=False,
        )
        .values("contact_id")
        .annotate(total=Sum("amount"))
        .values("total")
    )
    credit_consumptions_sq = (
        _TM.objects.filter(
            contact_id=OuterRef("pk"),
            payment_method="CREDIT_BALANCE",
            movement_type="INBOUND",
            is_pending_registration=False,
        )
        .values("contact_id")
        .annotate(total=Sum("amount"))
        .values("total")
    )
    queryset = queryset.annotate(
        _has_sales=Exists(SaleOrder.objects.filter(customer=OuterRef("pk"))),
        _has_purchases=Exists(PurchaseOrder.objects.filter(supplier=OuterRef("pk"))),
        _has_work_orders=Exists(WorkOrder.objects.filter(related_contact=OuterRef("pk"))),
        _has_employees=Exists(Employee.objects.filter(contact=OuterRef("pk"))),
        _has_system_user=Exists(User.objects.filter(contact=OuterRef("pk"))),
        _credit_balance_additions=Coalesce(
            Subquery(credit_additions_sq, output_field=Df()), Value(Decimal("0"), output_field=Df())
        ),
        _credit_balance_consumptions=Coalesce(
            Subquery(credit_consumptions_sq, output_field=Df()), Value(Decimal("0"), output_field=Df())
        ),
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

    Nota: replica la lógica de `Contact.credit_aging` fijando `today = cutoff_date`
    para reproducibilidad, pero iterando sobre órdenes prefetched (payments +
    invoices) → round-trips O(1) en vez de Θ(C+O).
    """
    from datetime import timedelta
    from decimal import Decimal

    from sales.models import SaleOrder

    results = []

    orders_qs = (
        SaleOrder.objects.filter(date__lte=cutoff_date)
        .exclude(status__in=["DRAFT", "CANCELLED"])
        .prefetch_related("payments", "invoices")
    )

    contacts_with_sales = (
        Contact.objects.filter(sale_orders__date__lte=cutoff_date)
        .exclude(sale_orders__status__in=["DRAFT", "CANCELLED"])
        .distinct()
        .prefetch_related(Prefetch("sale_orders", queryset=orders_qs))
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

        orders = contact.sale_orders.all()
        for order in orders:
            payments = [p for p in order.payments.all() if not p.is_pending_registration]
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

    from purchasing.models import PurchaseOrder

    results = []

    orders_qs = (
        PurchaseOrder.objects.filter(date__lte=cutoff_date)
        .exclude(status__in=["DRAFT", "CANCELLED"])
        .prefetch_related("payments")
    )

    contacts_with_purchases = (
        Contact.objects.filter(purchase_orders__date__lte=cutoff_date)
        .exclude(purchase_orders__status__in=["DRAFT", "CANCELLED"])
        .distinct()
        .prefetch_related(Prefetch("purchase_orders", queryset=orders_qs))
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

        orders = contact.purchase_orders.all()
        for order in orders:
            payments = [p for p in order.payments.all() if not p.is_pending_registration]
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == "OUTBOUND"),
                Decimal("0"),
            )
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
        from django.utils import timezone

        from treasury.models import TreasuryMovement
        from sales.models import SaleOrder

        contacts = list_credit_portfolio(is_blacklist=is_blacklist)

        write_offs_sq = (
            TreasuryMovement.objects.filter(
                contact_id=OuterRef("pk"),
                payment_method="WRITE_OFF",
                is_pending_registration=False,
            )
            .values("contact_id")
            .annotate(total=Sum("amount"))
            .values("total")
        )
        recoveries_sq = (
            TreasuryMovement.objects.filter(
                contact_id=OuterRef("pk"),
                reference="RECUPERACION",
                is_pending_registration=False,
            )
            .values("contact_id")
            .annotate(total=Sum("amount"))
            .values("total")
        )

        orders_qs = (
            SaleOrder.objects.exclude(status__in=["DRAFT", "CANCELLED"]).prefetch_related(
                "payments", "invoices"
            )
        )
        contacts = contacts.prefetch_related(Prefetch("sale_orders", queryset=orders_qs)).annotate(
            _write_offs=Coalesce(
                Subquery(write_offs_sq, output_field=Df()),
                Value(Decimal("0"), output_field=Df()),
            ),
            _recoveries=Coalesce(
                Subquery(recoveries_sq, output_field=Df()),
                Value(Decimal("0"), output_field=Df()),
            ),
        )

        today = timezone.now().date()
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
            if is_blacklist:
                balance_used = contact._write_offs - contact._recoveries
                quantize_balance = False
            else:
                balance_used = _credit_balance_used_from_orders(contact.sale_orders.all())
                quantize_balance = True

            aging = _aging_buckets(
                contact.sale_orders.all(),
                payment_term=contact.credit_days or 30,
                today=today,
            )

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

                contact_list.append(
                    _portfolio_contact_payload(
                        contact, balance_used=balance_used, aging=aging, quantize_balance=quantize_balance
                    )
                )

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

        today = timezone.now().date()
        payment_term = contact.credit_days or 30

        orders = (
            contact.sale_orders.exclude(status__in=["DRAFT", "CANCELLED"])
            .order_by("-date")
            .prefetch_related("payments", "invoices")
        )

        ledger_data = []
        for order in orders:
            payments = [p for p in order.payments.all() if not p.is_pending_registration]
            paid_in = sum(
                (p.amount for p in payments if p.movement_type in ["INBOUND", "ADJUSTMENT"]),
                Decimal("0"),
            )
            paid_out = sum(
                (p.amount for p in payments if p.movement_type == "OUTBOUND"), Decimal("0")
            )
            payments_net = paid_in - paid_out
            balance = order.effective_total - payments_net

            is_written_off = any(p.payment_method == "WRITE_OFF" for p in payments)

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
                        "id": order.id,
                        "number": order.number,
                        "date": order.date,
                        "effective_total": str(order.effective_total),
                        "paid_amount": str(payments_net),
                        "balance": str(balance),
                        "due_date": due_date,
                        "days_overdue": max(0, days_overdue),
                        "aging_bucket": aging_bucket,
                        "status": order.status,
                        "credit_assignment_origin": order.credit_assignment_origin,
                        "credit_assignment_origin_display": (
                            order.get_credit_assignment_origin_display()
                            if order.credit_assignment_origin
                            else None
                        ),
                    }
                )
        return ledger_data

    @staticmethod
    def filter_suggestions(query: str) -> list:
        if len(query) < 2:
            return []
        names = (
            Contact.objects.filter(name__icontains=query)
            .values_list("name", flat=True)
            .distinct()
            .order_by("name")[:10]
        )
        return list(names)

    @staticmethod
    def list_customers():
        return Contact.objects.filter(sale_orders__isnull=False).distinct()

    @staticmethod
    def list_suppliers():
        return Contact.objects.filter(purchase_orders__isnull=False).distinct()

    @staticmethod
    def list_partners():
        return Contact.objects.filter(is_partner=True).distinct().prefetch_related(
            "partner_transactions",
        )

    @staticmethod
    def list_partner_payloads():
        partners = list(Contact.objects.filter(is_partner=True).order_by("name"))
        metrics = _partner_metrics_map([p.id for p in partners])
        payload = []
        for partner in partners:
            m = metrics.get(partner.id, {})
            payload.append(
                {
                    "id": partner.id,
                    "name": partner.name,
                    "tax_id": partner.tax_id,
                    "partner_equity_percentage": (
                        str(partner.partner_equity_percentage)
                        if partner.partner_equity_percentage is not None
                        else None
                    ),
                    "partner_since": partner.partner_since.isoformat() if partner.partner_since else None,
                    "partner_total_contributions": str(
                        m.get("partner_total_contributions", Decimal("0"))
                    ),
                    "partner_total_paid_in": str(m.get("partner_total_paid_in", Decimal("0"))),
                    "partner_pending_capital": str(m.get("partner_pending_capital", Decimal("0"))),
                    "partner_excess_capital": str(m.get("partner_excess_capital", Decimal("0"))),
                    "partner_provisional_withdrawals_balance": str(
                        m.get("partner_provisional_withdrawals_balance", Decimal("0"))
                    ),
                    "partner_total_withdrawals": str(
                        m.get("partner_total_withdrawals", Decimal("0"))
                    ),
                    "partner_earnings_balance": str(
                        m.get("partner_earnings_balance", Decimal("0"))
                    ),
                    "partner_dividends_payable_balance": str(
                        m.get("partner_dividends_payable_balance", Decimal("0"))
                    ),
                    "partner_net_equity": str(m.get("partner_net_equity", Decimal("0"))),
                }
            )
        return payload

    @staticmethod
    def get_credit_history(contact):
        from sales.models import SaleOrder
        from sales.serializers import SaleOrderSerializer

        history = (
            SaleOrder.objects.filter(
                customer=contact, credit_assignment_origin__isnull=False
            )
            .order_by("-date", "-created_at")
            .select_related("pos_session", "credit_approval_task")
            .prefetch_related("payments", "invoices", "lines", "deliveries", "work_orders")
        )
        return SaleOrderSerializer(history, many=True).data

    @staticmethod
    def list_partner_transactions(partner):
        from .partner_models import PartnerTransaction
        from .serializers import PartnerTransactionSerializer

        return PartnerTransaction.objects.filter(partner=partner).order_by("-date", "-created_at")

    @staticmethod
    def get_equity_stakes_history(partner_id: int | None = None):
        from .partner_models import PartnerEquityStake
        from .serializers import PartnerEquityStakeSerializer

        qs = PartnerEquityStake.objects.all().select_related("partner", "source_transaction")
        if partner_id:
            qs = qs.filter(partner_id=partner_id)
        return PartnerEquityStakeSerializer(qs, many=True).data


def _partner_metrics_map(partner_ids) -> dict:
    """
    Calcula todas las métricas de socio (equity, aportes, retiros, utilidades)
    para los contactos `partner_ids` en UNA consulta agrupada por transaction_type,
    replicando las fórmulas de `Contact.partner_*` sin sus ~4-5 agregados por propiedad.
    """
    from django.db.models import Q

    from .partner_models import PartnerTransaction

    if not partner_ids:
        return {}

    T = PartnerTransaction.Type

    def _sum(filters):
        return Sum("amount", filter=Q(**filters))

    rows = (
        PartnerTransaction.objects.filter(partner_id__in=list(partner_ids))
        .values("partner_id")
        .annotate(
            subs=_sum({"transaction_type": T.EQUITY_SUBSCRIPTION}),
            reds=_sum({"transaction_type": T.EQUITY_REDUCTION}),
            trans_out=_sum({"transaction_type": T.EQUITY_TRANSFER_OUT}),
            trans_in=_sum({"transaction_type": T.EQUITY_TRANSFER_IN}),
            reinvest=_sum({"transaction_type": T.REINVESTMENT}),
            paid_in_total=_sum(
                {
                    "transaction_type__in": [
                        T.CAPITAL_CONTRIBUTION_CASH,
                        T.CAPITAL_CONTRIBUTION_INVENTORY,
                        T.REINVESTMENT,
                        T.CAPITAL_CONTRIBUTION_TRANSFER_IN,
                    ]
                }
            ),
            paid_out_total=_sum({"transaction_type": T.CAPITAL_CONTRIBUTION_TRANSFER_OUT}),
            provisional=_sum(
                {
                    "transaction_type": T.PROVISIONAL_WITHDRAWAL,
                    "distribution_resolution__isnull": True,
                }
            ),
            dividends=_sum({"transaction_type": T.DIVIDEND}),
            dividends_paid=_sum({"transaction_type": T.DIVIDEND_PAYMENT}),
            retained=_sum({"transaction_type": T.RETAINED}),
            losses=_sum(
                {
                    "transaction_type__in": [
                        T.LOSS_ABSORPTION,
                        T.RETAINED_MOBILIZATION,
                    ]
                }
            ),
            balance_in=_sum(
                {
                    "transaction_type__in": [
                        T.CAPITAL_CONTRIBUTION_CASH,
                        T.CAPITAL_CONTRIBUTION_INVENTORY,
                        T.LOAN_TO_COMPANY,
                    ]
                }
            ),
            balance_out=_sum(
                {
                    "transaction_type__in": [
                        T.PROVISIONAL_WITHDRAWAL,
                        T.WITHDRAWAL,
                        T.LOAN_FROM_COMPANY,
                        T.CAPITAL_RETURN,
                        T.DIVIDEND_PAYMENT,
                    ]
                }
            ),
            formal_withdrawals=_sum(
                {
                    "transaction_type__in": [
                        T.WITHDRAWAL,
                        T.CAPITAL_RETURN,
                        T.DIVIDEND_PAYMENT,
                    ]
                }
            ),
        )
    )

    def _d(value):
        return Decimal(value) if value is not None else Decimal("0")

    result = {}
    for row in rows:
        contrib = (
            _d(row["subs"])
            - _d(row["reds"])
            - _d(row["trans_out"])
            + _d(row["trans_in"])
            + _d(row["reinvest"])
        )
        paid_in = _d(row["paid_in_total"]) - _d(row["paid_out_total"])
        provisional = _d(row["provisional"])
        earnings = _d(row["retained"]) - _d(row["losses"])
        result[row["partner_id"]] = {
            "partner_balance": _d(row["balance_in"]) - _d(row["balance_out"]),
            "partner_total_contributions": contrib,
            "partner_total_paid_in": paid_in,
            "partner_pending_capital": max(Decimal("0"), contrib - paid_in),
            "partner_excess_capital": max(Decimal("0"), paid_in - contrib),
            "partner_provisional_withdrawals_balance": provisional,
            "partner_total_withdrawals": _d(row["formal_withdrawals"]),
            "partner_earnings_balance": earnings,
            "partner_dividends_payable_balance": _d(row["dividends"]) - _d(row["dividends_paid"]),
            "partner_net_equity": paid_in - provisional + earnings,
        }
    return result


def _order_balance(order) -> Decimal:
    """
    Saldo pendiente de una orden: total efectivo menos pagos netos.
    Lee `order.payments.all()` / `order.invoices.all()` desde el prefetch
    (no dispara queries por orden).
    """
    from decimal import Decimal

    payments = [p for p in order.payments.all() if not p.is_pending_registration]
    paid_in = sum(
        (p.amount for p in payments if p.movement_type in ["INBOUND", "ADJUSTMENT"]),
        Decimal("0"),
    )
    paid_out = sum(
        (p.amount for p in payments if p.movement_type == "OUTBOUND"),
        Decimal("0"),
    )
    return order.effective_total - (paid_in - paid_out)


def _credit_balance_used_from_orders(orders) -> Decimal:
    """
    Suma de saldos pendientes positivos (semántica de `Contact.credit_balance_used`)
    computada sobre órdenes prefetched, sin N+1.
    """
    from decimal import Decimal

    balance = Decimal("0")
    for order in orders:
        order_balance = _order_balance(order)
        if order_balance > Decimal("0"):
            balance += order_balance
    return balance


def _aging_buckets(orders, *, payment_term: int, today) -> dict:
    """
    Bucketiza el saldo pendiente de las órdenes `orders` (prefetched) en
    rangos de morosidad, replicando la lógica de `Contact.credit_aging` sin
    disparar queries por orden (usa `order.payments.all()` / `order.invoices.all()`
    desde el prefetch).
    """
    from datetime import timedelta
    from decimal import Decimal

    buckets = {
        "current": Decimal("0"),
        "overdue_30": Decimal("0"),
        "overdue_60": Decimal("0"),
        "overdue_90": Decimal("0"),
        "overdue_90plus": Decimal("0"),
    }

    for order in orders:
        balance = _order_balance(order)

        if balance <= Decimal("0"):
            continue

        order_date = order.date
        if hasattr(order_date, "date"):
            order_date = order_date.date()
        due_date = order_date + timedelta(days=payment_term)
        days_overdue = (today - due_date).days

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

    return buckets


def _portfolio_contact_payload(contact, *, balance_used, aging, quantize_balance: bool = True) -> dict:
    """
    Payload ligero de contacto para la cartera de crédito, sin pasar por
    `ContactSerializer` (que disparaba ~10+ queries por contacto al evaluar
    properties como credit_aging/credit_balance_used).

    Mantiene el contrato previo: en la ruta normal los montos se cuantizan a
    0 decimales (como el DecimalField del serializer); en blacklist
    `credit_balance_used` se serializa crudo (override previo del view).
    """
    from decimal import Decimal

    available = Decimal("0")
    if contact.credit_limit:
        available = contact.credit_limit - balance_used
        if available < Decimal("0"):
            available = Decimal("0")

    quantizer = Decimal("1")

    return {
        "id": contact.id,
        "code": contact.code,
        "display_id": contact.display_id,
        "name": contact.name,
        "tax_id": contact.tax_id,
        "email": contact.email,
        "phone": contact.phone,
        "credit_enabled": contact.credit_enabled,
        "credit_blocked": contact.credit_blocked,
        "credit_auto_blocked": contact.credit_auto_blocked,
        "credit_risk_level": contact.credit_risk_level,
        "credit_last_evaluated": contact.credit_last_evaluated,
        "credit_days": contact.credit_days,
        "credit_limit": (
            str(contact.credit_limit.quantize(quantizer)) if contact.credit_limit is not None else None
        ),
        "is_default_customer": contact.is_default_customer,
        "credit_balance_used": (
            str(balance_used.quantize(quantizer)) if quantize_balance else str(balance_used)
        ),
        "credit_available": str(available.quantize(quantizer)),
        "credit_aging": aging,
    }

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
        from .partner_service import PartnerService
        transactions = (
            PartnerTransaction.objects.filter(partner=contact)
            .select_related("partner", "journal_entry", "created_by")
            .order_by("-date", "-created_at")
        )
        try:
            account = PartnerService._resolve_partner_receivable_account(contact)
            account_detail = {'id': account.id, 'name': account.name, 'code': account.code} if account else None
        except Exception:
            account_detail = None
        metrics = _partner_metrics_map([contact.id]).get(contact.id, {})
        return {
            'contact': serializer_class(contact).data,
            'summary': {
                'equity_percentage': str(contact.partner_equity_percentage or 0),
                'balance': str(metrics.get("partner_balance", Decimal("0"))),
                'total_contributions': str(metrics.get("partner_total_contributions", Decimal("0"))),
                'total_paid_in': str(metrics.get("partner_total_paid_in", Decimal("0"))),
                'pending_capital': str(metrics.get("partner_pending_capital", Decimal("0"))),
                'provisional_withdrawals': str(metrics.get("partner_provisional_withdrawals_balance", Decimal("0"))),
                'total_formal_withdrawals': str(metrics.get("partner_total_withdrawals", Decimal("0"))),
                'earnings_balance': str(metrics.get("partner_earnings_balance", Decimal("0"))),
            },
            'partner_account_detail': account_detail,
            'transactions': PartnerTransactionSerializer(transactions, many=True).data
        }
