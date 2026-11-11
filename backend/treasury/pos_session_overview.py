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
    """Importe en pesos chilenos con separador de miles: $10.000 (los negativos: -$10.000)."""
    amount = Decimal(value)
    return ("-" if amount < 0 else "") + "$" + f"{abs(amount):,.0f}".replace(",", ".")


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
            "collected": net, "pending": None,
        })
    return rows


def _collected_by_order(order_ids: list[int]) -> dict[int, Decimal]:
    """Cobrado neto de reembolsos por orden (una consulta, sin importar cuántas ordenes)."""
    if not order_ids:
        return {}
    totals: dict[int, Decimal] = {}
    rows = (
        TreasuryMovement.objects.filter(sale_order_id__in=order_ids)
        .exclude(status="CANCELLED")
        .values_list("sale_order_id", "movement_type", "amount")
    )
    for order_id, kind, amount in rows:
        signed = amount if kind == TreasuryMovement.Type.INBOUND else -amount if kind == TreasuryMovement.Type.OUTBOUND else ZERO
        totals[order_id] = totals.get(order_id, ZERO) + signed
    return totals


def _returned_by_order(order_ids: list[int]) -> dict[int, Decimal]:
    """Devuelto (no anulado) por orden: se descuenta de lo que queda por cobrar."""
    from django.db.models import Sum

    from sales.models import SaleReturn

    if not order_ids:
        return {}
    rows = (
        SaleReturn.objects.filter(sale_order_id__in=order_ids)
        .exclude(status=SaleReturn.Status.CANCELLED)
        .values("sale_order_id")
        .annotate(total=Sum("total"))
    )
    return {r["sale_order_id"]: r["total"] or ZERO for r in rows}


def _pending(total: Decimal, paid: Decimal, returned: Decimal) -> Decimal:
    return max(total - returned - paid, ZERO)


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
    collected = _collected_by_order([o.pk for o in orders])
    returned = _returned_by_order([o.pk for o in orders])
    rows = []
    for order in orders:
        paid = collected.get(order.pk, ZERO)
        rows.append({
            "key": f"sale-{order.pk}", "kind": "SALE", "id": order.pk, "label": "sales.saleorder",
            "display_id": order.display_id, "occurred_at": order.created_at,
            "customer_id": order.customer_id, "customer_name": order.customer.name,
            "is_walk_in": order.customer.is_default_customer,
            "payment_method": _order_method(order), "amount": order.total,
            "status": order.status, "status_display": order.get_status_display(),
            "counts": order.status != SaleOrder.Status.CANCELLED,
            "collected": paid,
            "pending": _pending(order.total, paid, returned.get(order.pk, ZERO)) if order.status != SaleOrder.Status.CANCELLED else ZERO,
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
            "collected": None, "pending": None,
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


def _closing_movements(session: POSSession) -> dict:
    """Movimientos que genera el cierre: ajuste por diferencia y retiro de efectivo (una consulta)."""
    from core.prefix_registry import EntityPrefix

    refs = {
        f"{EntityPrefix.POS_SESSION}-EXCEDENTE-{session.id}": "adjustment",
        f"{EntityPrefix.POS_SESSION}-RETIRO-{session.id}": "withdrawal",
    }
    found: dict[str, TreasuryMovement] = {}
    for mv in session.movements.filter(reference__in=refs).exclude(status="CANCELLED").select_related("to_account"):
        found[refs[mv.reference]] = mv
    return found


def _closing_movement_info(mv: TreasuryMovement | None, *, with_reason: bool = False) -> dict | None:
    if mv is None:
        return None
    info = {
        "id": mv.pk, "display_id": mv.display_id, "label": "treasury.treasurymovement", "amount": mv.amount,
        "destination": mv.to_account.name if mv.to_account_id else None,
    }
    if with_reason:
        info["reason"] = mv.justify_reason or None
        info["reason_display"] = mv.get_justify_reason_display() if mv.justify_reason else None
    return info


def _closing(session: POSSession) -> dict | None:
    audit = getattr(session, "audit", None)
    if session.closed_at is None:
        return None
    produced = _closing_movements(session)
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
        "adjustment": _closing_movement_info(produced.get("adjustment"), with_reason=True),
        "withdrawal": _closing_movement_info(produced.get("withdrawal")),
        "left_in_box": (counted - produced["withdrawal"].amount) if counted is not None and "withdrawal" in produced else counted,
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
            "collected": sum((r["collected"] for r in sales), ZERO),
            "pending": sum((r["pending"] for r in sales), ZERO),
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
    from sales.models import SaleOrder, SaleReturn, SaleTrackingEvent

    events: list[dict] = []

    def add(key, at, category, kind, description, actor=None, reference=None, amount=None):
        events.append({
            "key": key, "occurred_at": at, "category": category, "kind": kind,
            "description": description, "actor_id": actor.pk if actor else None,
            "actor_name": _name(actor), "reference": reference, "amount": amount,
        })

    def signed(mv):
        return mv.amount if mv.movement_type == TreasuryMovement.Type.INBOUND else -mv.amount

    session = POSSession.objects.select_related("user", "closed_by", "terminal").get(pk=session.pk)
    add("open", session.opened_at, "caja", "SESSION_OPENED",
        f"Apertura de la sesión con fondo inicial de {_clp(session.opening_balance)}", session.user)

    for p in POSOperatorPass.objects.filter(session=session).select_related("operator"):
        add(f"pass-{p.pk}", p.issued_at, "acceso", "OPERATOR_PASS",
            f"Identificación del operador para: {p.get_purpose_display().lower()}", p.operator)

    tracking = list(SaleTrackingEvent.objects.filter(pos_session=session).select_related("operator", "sale_order"))
    checkout_operator = {
        ev.sale_order_id: ev.operator
        for ev in tracking
        if ev.step == SaleTrackingEvent.Step.CHECKOUT and ev.sale_order_id
    }

    # Una fila por venta: quién la hizo, a quién, por cuánto y cómo se cobró (incluye cobros parciales).
    orders = list(
        SaleOrder.objects.filter(pos_session=session)
        .exclude(status=SaleOrder.Status.DRAFT)
        .select_related("customer", "salesperson", "payment_method_ref")
    )
    paid_by_order = _collected_by_order([o.pk for o in orders])
    returned_by_order = _returned_by_order([o.pk for o in orders])
    for order in orders:
        paid = paid_by_order.get(order.pk, ZERO)
        owed = _pending(order.total, paid, returned_by_order.get(order.pk, ZERO))
        text = f"Venta {order.display_id} a {order.customer.name} por {_clp(order.total)} — {_order_method(order)}"
        if order.status == SaleOrder.Status.CANCELLED:
            text += " (anulada)"
        elif owed > 0:
            text += f"; cobrado {_clp(paid)}, pendiente {_clp(owed)}"
        add(f"sale-{order.pk}", order.created_at, "venta", "SALE", text,
            checkout_operator.get(order.pk) or order.salesperson,
            {"label": "sales.saleorder", "id": order.pk, "display_id": order.display_id}, order.total)

    for ev in tracking:
        if ev.step == SaleTrackingEvent.Step.CHECKOUT and ev.sale_order_id:
            continue  # ya está en la fila de la venta
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
    movements = session.movements.exclude(status="CANCELLED").select_related("created_by", "to_account")
    produced = _closing_movements(session)
    adjustment = produced.get("adjustment")
    close_withdrawal = produced.get("withdrawal")
    for mv in movements.filter(sale_order__isnull=True, invoice__isnull=True):
        if adjustment is not None and mv.pk == adjustment.pk:
            continue  # se muestra junto a la diferencia detectada
        ref = {"label": "treasury.treasurymovement", "id": mv.pk, "display_id": mv.display_id}
        if close_withdrawal is not None and mv.pk == close_withdrawal.pk:
            dest = f" hacia {mv.to_account.name}" if mv.to_account_id else ""
            add(f"mov-{mv.pk}", mv.created_at, "cierre", "CLOSE_WITHDRAWAL",
                f"Retiro de efectivo al cerrar de {_clp(mv.amount)}{dest}", mv.created_by, ref, -mv.amount)
            continue
        withdrawal = mv.justify_reason == TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL
        sign = "Ingreso" if mv.movement_type == TreasuryMovement.Type.INBOUND else "Salida"
        reason = mv.get_justify_reason_display() if mv.justify_reason else ""
        detail = " — ".join(part for part in (reason, mv.notes) if part)
        add(f"mov-{mv.pk}", mv.created_at, "caja", "PARTNER_WITHDRAWAL" if withdrawal else "CASH_MOVEMENT",
            f"{'Retiro de socio' if withdrawal else sign} de {_clp(mv.amount)}" + (f" — {detail}" if detail else ""),
            mv.created_by, ref, signed(mv))

    for order, mvs in _collected_elsewhere(session):
        for mv in mvs:
            incoming = mv.movement_type == TreasuryMovement.Type.INBOUND
            add(f"collect-{mv.pk}", mv.created_at, "caja", "SALE_COLLECTION",
                f"{'Cobro' if incoming else 'Reembolso'} de la venta {order.display_id} por {_clp(mv.amount)}",
                mv.created_by, {"label": "sales.saleorder", "id": order.pk, "display_id": order.display_id}, signed(mv))

    for ret in SaleReturn.objects.filter(sale_order__pos_session=session).select_related("sale_order"):
        add(f"ret-{ret.pk}", ret.created_at, "venta", "RETURN", f"Devolución sobre la venta {ret.sale_order.display_id}", None,
            {"label": "sales.salereturn", "id": ret.pk, "display_id": ret.display_id}, -ret.total)

    for wo in WorkOrder.objects.filter(sale_order__pos_session=session).select_related("sale_order"):
        add(f"wo-{wo.pk}", wo.created_at, "venta", "WORK_ORDER", f"Orden de trabajo creada para la venta {wo.sale_order.display_id}", None,
            {"label": "production.workorder", "id": wo.pk, "display_id": wo.number})

    if session.closed_at:
        closing = _closing(session)
        summary = ""
        if closing and closing["counted_cash"] is not None:
            summary = f" — esperado {_clp(closing['expected_cash'])}, declarado {_clp(closing['counted_cash'])}"
        add("close", session.closed_at, "cierre", "SESSION_CLOSED", "Cierre de la sesión" + summary, session.closed_by)
        if closing and closing["difference"]:
            diff = closing["difference"]
            adj = closing["adjustment"]
            reason = f" — {adj['reason_display']}" if adj and adj.get("reason_display") else ""
            add("difference", session.closed_at, "cierre", "CASH_DIFFERENCE",
                f"{'Faltante' if diff < 0 else 'Sobrante'} de caja de {_clp(abs(diff))}{reason}", session.closed_by,
                {"label": adj["label"], "id": adj["id"], "display_id": adj["display_id"]} if adj else None, diff)

    events.sort(key=lambda e: (e["occurred_at"], e["key"]), reverse=True)
    return events
