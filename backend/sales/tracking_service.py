"""Seguimiento por paso de las ventas POS (spec 2026-11-10 §5.6)."""

from __future__ import annotations

import json
from typing import Any

from django.utils import timezone

from .models import DraftCart, SaleTrackingEvent

Step = SaleTrackingEvent.Step

# Claves de wizard_state que corresponden a un paso. El resto (step, isLoading,
# banderas de espera, phaseId…) es ruido de navegación y no genera seguimiento.
WIZARD_STEP_KEYS = {
    "dteData": Step.DTE,
    "paymentData": Step.PAYMENT,
    "deliveryData": Step.DELIVERY,
}
# Campos del ítem que escribe Step2_ManufacturingDetails (frontend).
MANUFACTURING_ITEM_FIELDS = ("manufacturing_data",)


def _norm(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str)


def _as_int(value: Any) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _split_item(item: Any) -> tuple[str, str]:
    if not isinstance(item, dict):
        return _norm(item), ""
    mfg = {k: item.get(k) for k in MANUFACTURING_ITEM_FIELDS if k in item}
    rest = {k: v for k, v in item.items() if k not in MANUFACTURING_ITEM_FIELDS}
    return _norm(rest), _norm(mfg)


class SaleTrackingService:
    @staticmethod
    def changed_steps(old: DraftCart | None, *, items, customer_id, wizard_state) -> set[str]:
        """Pasos cuyo contenido difiere entre lo guardado (`old`) y lo recibido."""
        new_ws = wizard_state or {}
        steps: set[str] = set()
        if old is None:
            steps.add(Step.CART)
            if _as_int(customer_id) is not None:
                steps.add(Step.CUSTOMER)
            steps.update(step for key, step in WIZARD_STEP_KEYS.items() if new_ws.get(key))
            return steps

        if _as_int(customer_id) != old.customer_id:
            steps.add(Step.CUSTOMER)
        old_ws = old.wizard_state or {}
        for key, step in WIZARD_STEP_KEYS.items():
            if _norm(old_ws.get(key)) != _norm(new_ws.get(key)):
                steps.add(step)

        old_items, new_items = list(old.items or []), list(items or [])
        if len(old_items) != len(new_items):
            steps.add(Step.CART)
            return steps
        for before, after in zip(old_items, new_items):
            (b_rest, b_mfg), (a_rest, a_mfg) = _split_item(before), _split_item(after)
            if b_rest != a_rest:
                steps.add(Step.CART)
            if b_mfg != a_mfg:
                steps.add(Step.MANUFACTURING)
        return steps

    @staticmethod
    def record_draft_steps(*, draft: DraftCart, steps: set[str], actor) -> None:
        """Una fila por (borrador, paso), actualizada con el último operador."""
        now = timezone.now()
        for step in steps:
            SaleTrackingEvent.objects.update_or_create(
                draft_ref=draft.pk,
                step=step,
                sale_order=None,
                defaults={
                    "operator": actor.operator,
                    "device_user": actor.device_user,
                    "pos_session_id": draft.pos_session_id,
                    "operator_pass": actor.operator_pass,
                    "occurred_at": now,
                },
            )

    @staticmethod
    def transfer_to_order(*, draft_id: int | None, order, actor) -> None:
        """Liga a la orden las filas del borrador (si hubo) y agrega el evento de cobro."""
        if draft_id is not None:
            SaleTrackingEvent.objects.filter(draft_ref=draft_id, sale_order__isnull=True).update(
                sale_order=order
            )
        SaleTrackingEvent.objects.create(
            draft_ref=draft_id,
            sale_order=order,
            pos_session_id=getattr(order, "pos_session_id", None),
            step=Step.CHECKOUT,
            operator=actor.operator,
            device_user=actor.device_user,
            operator_pass=actor.operator_pass,
        )

    @staticmethod
    def record_document_edit(
        *,
        actor,
        pos_session,
        entity_type: str,
        entity_id: int | None,
        detail: str,
        sale_order=None,
        sale_order_id: int | None = None,
    ) -> None:
        SaleTrackingEvent.objects.create(
            sale_order=sale_order,
            sale_order_id=sale_order_id if sale_order is None else None,
            pos_session=pos_session,
            step=Step.DOCUMENT_EDIT,
            operator=actor.operator,
            device_user=actor.device_user,
            operator_pass=actor.operator_pass,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=detail[:255],
        )
