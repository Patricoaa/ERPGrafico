"""Datos de lectura de la ficha de una sesión POS: resumen, ventas, cierre y actividad.

Solo lectura. Cada función hace un número fijo de consultas, sin importar cuántas ventas,
movimientos o eventos tenga la sesión (zero N+1).
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings

from .models import POSOperatorPass, POSSession, TreasuryMovement

ZERO = Decimal("0")



def _clp(value) -> str:
    """Importe en pesos chilenos con separador de miles: $10.000."""
    return "$" + f"{Decimal(value):,.0f}".replace(",", ".")


# Frase en español de cada paso del seguimiento (la fila se muestra con su responsable aparte).
STEP_PHRASE = {
    "CART": "carrito actualizado",
    "CUSTOMER": "cliente asignado",
    "DTE": "documento tributario definido",
    "MANUFACTURING": "detalles de fabricación registrados",
    "PAYMENT": "pago registrado",
    "DELIVERY": "entrega definida",
}
METHOD_VERB = {"POST": "Registro en", "PUT": "Edición de", "PATCH": "Edición de", "DELETE": "Eliminación de"}


def _entity_title(label: str) -> str:
    """Nombre en español de una entidad (`app.model`); cae al nombre del modelo."""
    from django.apps import apps

    from core.registry import UniversalRegistry

    try:
        return UniversalRegistry.get(label).title_singular
    except Exception:  # noqa: BLE001 — la etiqueta es informativa
        try:
            return str(apps.get_model(label)._meta.verbose_name)
        except (LookupError, ValueError):
            return "documento"


def _name(user) -> str | None:
    if user is None:
        return None
    return user.get_full_name() or user.username


def _order_method(order) -> str:
    ref = order.payment_method_ref
    return ref.name if ref is not None else order.get_payment_method_display()


def _collected_elsewhere(session: POSSession):
    """Ventas de otro origen (crédito, otro canal) cuyo cobro se registró en esta sesión.

    Devuelve ``[(orden, [movimientos de la sesión])]``. Dos consultas, sin importar cuántas ventas.
    """
    from sales.models import SaleOrder

    movements = list(
        session.movements.filter(sale_order__isnull=False)
        .exclude(status="CANCELLED")
        .exclude(sale_order__pos_session=session)
        .order_by("created_at", "id")
    )
    ids = {m.sale_order_id for m in movements}
    orders = {
        o.pk: o
        for o in SaleOrder.objects.filter(pk__in=ids).select_related("customer")
    }
    grouped: dict[int, list] = {}
    for mv in movements:
        grouped.setdefault(mv.sale_order_id, []).append(mv)
    return [(orders[pk], mvs) for pk, mvs in grouped.items() if pk in orders]


def _collection_rows(session: POSSession) -> list[dict]:
    rows = []
    for order, mvs in _collected_elsewhere(session):
        net = sum(
            (m.amount if m.movement_type == TreasuryMovement.Type.INBOUND else -m.amount for m in mvs), ZERO
        )
        methods = sorted({str(TreasuryMovement.Method(m.payment_method).label) for m in mvs})
        rows.append({
            "key": f"collection-{order.pk}", "kind": "COLLECTION", "id": order.pk, "label": "sales.saleorder",
            "display_id": order.display_id, "occurred_at": mvs[0].created_at,
            "customer_id": order.customer_id, "customer_name": order.customer.name,
            "is_walk_in": order.customer.is_default_customer,
            "payment_method": ", ".join(methods), "amount": net,
            "status": "COLLECTED", "status_display": "Cobro en la sesión", "counts": False,
        })
    return rows


def _sales_rows(session: POSSession):
    """Ventas (importe positivo) y devoluciones (negativo) de las OV de la sesión."""
    from sales.models import SaleOrder, SaleReturn

    orders = list(
        SaleOrder.objects.filter(pos_session=session)
        .exclude(status=SaleOrder.Status.DRAFT)
        .select_related("customer", "payment_method_ref")
        .order_by("created_at", "id")
    )
    returns = list(
        SaleReturn.objects.filter(sale_order__pos_session=session)
        .select_related("sale_order", "sale_order__customer", "sale_order__payment_method_ref")
        .order_by("created_at", "id")
    )
    rows = []
    for order in orders:
        rows.append({
            "key": f"sale-{order.pk}", "kind": "SALE", "id": order.pk, "label": "sales.saleorder",
            "display_id": order.display_id, "occurred_at": order.created_at,
            "customer_id": order.customer_id, "customer_name": order.customer.name,
            "is_walk_in": order.customer.is_default_customer,
            "payment_method": _order_method(order), "amount": order.total,
            "status": order.status, "status_display": order.get_status_display(),
            "counts": order.status != SaleOrder.Status.CANCELLED,
        })
    for ret in returns:
        order = ret.sale_order
        rows.append({
            "key": f"return-{ret.pk}", "kind": "RETURN", "id": ret.pk, "label": "sales.salereturn",
            "display_id": ret.display_id, "occurred_at": ret.created_at,
            "customer_id": order.customer_id, "customer_name": order.customer.name,
            "is_walk_in": order.customer.is_default_customer,
            "payment_method": _order_method(order), "amount": -ret.total,
            "status": ret.status, "status_display": ret.get_status_display(),
            "counts": ret.status != type(ret).Status.CANCELLED,
        })
    rows.extend(_collection_rows(session))
    rows.sort(key=lambda r: (r["occurred_at"], r["key"]))
    return rows, orders


def _net_collections(session: POSSession) -> list[dict]:
    """Cobros netos de reembolsos por método de pago real.

    Parte de los métodos habilitados hoy para la Caja POS (aunque no hayan cobrado) y suma los
    métodos que cobraron en la sesión y ya no están habilitados (``enabled=False``). Los
    movimientos sin método configurado (datos antiguos) se agrupan por su tipo.
    """
    from .models import PaymentMethod
    from .selectors import POSSelector

    entries: dict[str, dict] = {}

    def entry(key, method_id, method_type, label, enabled):
        return entries.setdefault(key, {
            "key": key, "method_id": method_id, "method": method_type, "label": label,
            "enabled": enabled, "amount": ZERO,
        })

    terminal = session.terminal
    enabled = list(POSSelector.get_payment_methods_for_terminal(terminal, operation="sales")) if terminal else []
    for pm in enabled:
        entry(f"pm-{pm.pk}", pm.pk, pm.method_type, pm.name, True)

    movements = session.movements.filter(sale_order__isnull=False).exclude(status="CANCELLED")
    rows = list(movements.values_list("payment_method_new_id", "payment_method", "movement_type", "amount"))
    known = {
        pm.pk: pm for pm in PaymentMethod.objects.filter(pk__in={r[0] for r in rows if r[0]})
    }
    for method_id, method_type, kind, amount in rows:
        if method_id and method_id in known:
            pm = known[method_id]
            target = entry(f"pm-{pm.pk}", pm.pk, pm.method_type, pm.name, pm.pk in {e.pk for e in enabled})
        else:
            target = entry(f"type-{method_type}", None, method_type, str(TreasuryMovement.Method(method_type).label), False)
        if kind == TreasuryMovement.Type.INBOUND:
            target["amount"] += amount
        elif kind == TreasuryMovement.Type.OUTBOUND:
            target["amount"] -= amount

    grand = sum((e["amount"] for e in entries.values()), ZERO)
    return [
        {**e, "share": (e["amount"] / grand * 100) if grand else ZERO}
        for e in sorted(entries.values(), key=lambda e: (-e["amount"], e["label"]))
    ]


def _closing(session: POSSession) -> dict | None:
    audit = getattr(session, "audit", None)
    if session.closed_at is None:
        return None
    expected = audit.expected_amount if audit else session.expected_cash
    counted = audit.actual_amount if audit else None
    difference = audit.difference if audit else None
    return {
        "closed_at": session.closed_at,
        "closed_by_id": session.closed_by_id,
        "closed_by_name": _name(session.closed_by),
        "expected_cash": expected,
        "counted_cash": counted,
        "difference": difference,
        # «Coincide» es una comparación de importes; no implica revisión de un supervisor.
        "result": None if difference is None else ("MATCH" if difference == 0 else "DIFFERENCE"),
        "notes": audit.notes if audit else "",
        "notes_author": _name(session.closed_by),
        "notes_at": audit.created_at if audit else session.closed_at,
    }


def build_overview(session: POSSession) -> dict:
    rows, orders = _sales_rows(session)
    sales = [r for r in rows if r["kind"] == "SALE" and r["counts"]]
    returns = [r for r in rows if r["kind"] == "RETURN" and r["counts"]]
    gross = sum((r["amount"] for r in sales), ZERO)
    returned = -sum((r["amount"] for r in returns), ZERO)
    closing = _closing(session)

    alerts = []
    if closing and closing["difference"]:
        alerts.append({
            "code": "CASH_DIFFERENCE", "severity": "destructive", "tab": "closing",
            "amount": closing["difference"],
            "message": "El efectivo contado es " + ("inferior" if closing["difference"] < 0 else "superior") + " al esperado.",
        })
    pending = [o for o in orders if o.status == o.Status.PAYMENT_PENDING]
    if pending:
        alerts.append({
            "code": "PAYMENT_PENDING", "severity": "warning", "tab": "sales", "count": len(pending),
            "message": f"{len(pending)} venta(s) con cobro pendiente en terminal.",
        })

    return {
        "timezone": settings.TIME_ZONE,
        "alerts": alerts,
        "sales": {
            "gross": gross, "returns_total": returned, "net": gross - returned,
            "sale_count": len(sales), "return_count": len(returns), "includes_tax": True,
            "average_ticket": (gross / len(sales)) if sales else ZERO,
            # Cobros de ventas que nacieron fuera de la sesión: no suman a las ventas, sí a los cobros.
            "collection_count": sum(1 for r in rows if r["kind"] == "COLLECTION"),
            "rows": rows,
        },
        "collections": _net_collections(session),
        "closing": closing,
    }


def build_activity(session: POSSession) -> list[dict]:
    """Línea de tiempo (más reciente primero) de todo lo ocurrido en la sesión.

    Toda descripción va en español; ``reference`` identifica el documento relacionado
    (``label``, ``id``, ``display_id``) para enlazarlo.
    """
    from production.models import WorkOrder
    from sales.models import SaleReturn, SaleTrackingEvent

    events: list[dict] = []

    def add(key, at, category, kind, description, actor=None, reference=None):
        events.append({
            "key": key, "occurred_at": at, "category": category, "kind": kind,
            "description": description, "actor_id": actor.pk if actor else None,
            "actor_name": _name(actor), "reference": reference,
        })

    session = POSSession.objects.select_related("user", "closed_by", "terminal").get(pk=session.pk)
    add("open", session.opened_at, "caja", "SESSION_OPENED",
        f"Apertura de la sesión con fondo inicial de {_clp(session.opening_balance)}", session.user)

    for p in POSOperatorPass.objects.filter(session=session).select_related("operator"):
        add(f"pass-{p.pk}", p.issued_at, "acceso", "OPERATOR_PASS",
            f"Identificación del operador para: {p.get_purpose_display().lower()}", p.operator)

    for ev in SaleTrackingEvent.objects.filter(pos_session=session).select_related("operator", "sale_order"):
        ref = None
        order = ev.sale_order
        if order is not None:
            ref = {"label": "sales.saleorder", "id": order.pk, "display_id": order.display_id}
        if ev.step == SaleTrackingEvent.Step.CHECKOUT:
            text = f"Cobro de la venta {order.display_id}" if order else "Cobro de una venta"
        elif ev.step == SaleTrackingEvent.Step.PARTNER_WITHDRAWAL:
            text = "Retiro de socio procesado" + (f" — {ev.detail}" if ev.detail else "")
        elif ev.step == SaleTrackingEvent.Step.DOCUMENT_EDIT:
            method = (ev.detail or "").split(" ", 1)[0]
            title = _entity_title(ev.entity_type) if ev.entity_type else "documento"
            text = f"{METHOD_VERB.get(method, 'Cambio en')} {title.lower()}"
            if order is not None:
                text += f" {order.display_id}"
            elif ev.entity_type and ev.entity_id:
                ref = {"label": ev.entity_type, "id": ev.entity_id, "display_id": f"{title} #{ev.entity_id}"}
        else:
            phrase = STEP_PHRASE.get(ev.step, ev.get_step_display().lower())
            text = (f"Borrador #{ev.draft_ref}: " if ev.draft_ref else "Venta: ") + phrase
        add(f"track-{ev.pk}", ev.occurred_at, "venta", f"STEP_{ev.step}", text, ev.operator, ref)

    # Todos los movimientos de tesorería de la sesión que no son cobros de una venta
    # (esos están en Ventas): ingresos, salidas y retiros.
    movements = session.movements.exclude(status="CANCELLED").select_related("created_by")
    for mv in movements.filter(sale_order__isnull=True, invoice__isnull=True):
        withdrawal = mv.justify_reason == TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL
        sign = "Ingreso" if mv.movement_type == TreasuryMovement.Type.INBOUND else "Salida"
        reason = mv.get_justify_reason_display() if mv.justify_reason else ""
        detail = " — ".join(part for part in (reason, mv.notes) if part)
        add(f"mov-{mv.pk}", mv.created_at, "caja", "PARTNER_WITHDRAWAL" if withdrawal else "CASH_MOVEMENT",
            f"{'Retiro de socio' if withdrawal else sign} de {_clp(mv.amount)}" + (f" — {detail}" if detail else ""),
            mv.created_by, {"label": "treasury.treasurymovement", "id": mv.pk, "display_id": mv.display_id})

    for order, mvs in _collected_elsewhere(session):
        for mv in mvs:
            incoming = mv.movement_type == TreasuryMovement.Type.INBOUND
            add(f"collect-{mv.pk}", mv.created_at, "caja", "SALE_COLLECTION",
                f"{'Cobro' if incoming else 'Reembolso'} de la venta {order.display_id} por {_clp(mv.amount)}",
                mv.created_by, {"label": "sales.saleorder", "id": order.pk, "display_id": order.display_id})

    for ret in SaleReturn.objects.filter(sale_order__pos_session=session).select_related("sale_order"):
        add(f"ret-{ret.pk}", ret.created_at, "venta", "RETURN", f"Devolución sobre la venta {ret.sale_order.display_id}", None,
            {"label": "sales.salereturn", "id": ret.pk, "display_id": ret.display_id})

    for wo in WorkOrder.objects.filter(sale_order__pos_session=session).select_related("sale_order"):
        add(f"wo-{wo.pk}", wo.created_at, "venta", "WORK_ORDER", f"Orden de trabajo creada para la venta {wo.sale_order.display_id}", None,
            {"label": "production.workorder", "id": wo.pk, "display_id": wo.number})

    if session.closed_at:
        closing = _closing(session)
        add("close", session.closed_at, "cierre", "SESSION_CLOSED", "Cierre de la sesión", session.closed_by)
        if closing and closing["difference"]:
            add("difference", session.closed_at, "cierre", "CASH_DIFFERENCE",
                f"Diferencia de caja detectada: {_clp(closing['difference'])}", session.closed_by)

    events.sort(key=lambda e: (e["occurred_at"], e["key"]), reverse=True)
    return events
