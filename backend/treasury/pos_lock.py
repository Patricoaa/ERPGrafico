"""Bloqueo de la configuración del POS mientras hay una sesión abierta.

Una Caja POS con sesión abierta, sus métodos de pago, las cuentas de tesorería que usa y las
cuentas contables vinculadas no pueden modificarse ni archivarse: cambiarlas a mitad de turno
descuadraría el arqueo y los cobros ya registrados. Se corrige cerrando la sesión.

Protege la edición por API (``PosSessionLockMixin``); los servicios del sistema escriben
directamente. ``annotate_pos_lock`` precalcula el estado en los listados (sin N+1) y
``PosSessionLockedField`` lo expone al formulario.
"""

from __future__ import annotations

from django.db.models import BooleanField, Exists, ExpressionWrapper, OuterRef, Q
from rest_framework import serializers

from core.edit_policy import DocumentLockedError

ANNOTATION = "_pos_session_locked"

MESSAGES = {
    "posterminal": "La Caja POS tiene una sesión abierta; no se puede modificar ni archivar hasta cerrarla.",
    "paymentmethod": "El método de pago lo usa una Caja POS con sesión abierta; no se puede modificar ni archivar hasta cerrarla.",
    "treasuryaccount": "La cuenta de tesorería la usa una Caja POS con sesión abierta; no se puede modificar ni archivar hasta cerrarla.",
    "account": "La cuenta contable está vinculada a una Caja POS con sesión abierta; no se puede modificar ni archivar hasta cerrarla.",
}


def _open_sessions():
    from .models import POSSession

    return POSSession.objects.filter(status=POSSession.Status.OPEN)


def _terminals_with_open_session():
    from .models import POSTerminal

    return POSTerminal.objects.filter(sessions__status="OPEN")


def _wrap(condition):
    return ExpressionWrapper(condition, output_field=BooleanField())


def _terminal_expr():
    return _wrap(Exists(_open_sessions().filter(terminal=OuterRef("pk"))))


def _payment_method_expr():
    return _wrap(Exists(_terminals_with_open_session().filter(allowed_payment_methods=OuterRef("pk"))))


def _treasury_account_expr():
    uses_account = (
        Q(default_treasury_account=OuterRef("pk"))
        | Q(allowed_treasury_accounts=OuterRef("pk"))
        | Q(allowed_payment_methods__treasury_account=OuterRef("pk"))
        | Q(allowed_payment_methods__settlement_account=OuterRef("pk"))
    )
    return _wrap(
        Exists(_open_sessions().filter(treasury_account=OuterRef("pk")))
        | Exists(_terminals_with_open_session().filter(uses_account))
    )


def _account_expr():
    from accounting.models import AccountingSettings

    from .models import TreasuryAccount

    pos_fields = [
        f.name for f in AccountingSettings._meta.get_fields()
        if f.name.startswith("pos_") and f.name.endswith("_account") and f.many_to_one
    ]
    in_pos_settings = Q()
    for name in pos_fields:
        in_pos_settings |= Q(**{name: OuterRef("pk")})
    linked_treasury = (
        TreasuryAccount.objects.filter(account=OuterRef("pk"))
        .annotate(_locked=_treasury_account_expr())
        .filter(_locked=True)
    )
    return _wrap(
        Exists(linked_treasury)
        | (Exists(AccountingSettings.objects.filter(in_pos_settings)) & Exists(_open_sessions()))
    )


def _expression_for(model):
    return {
        "posterminal": _terminal_expr,
        "paymentmethod": _payment_method_expr,
        "treasuryaccount": _treasury_account_expr,
        "account": _account_expr,
    }.get(model._meta.model_name)


def annotate_pos_lock(queryset):
    """Precalcula ``_pos_session_locked`` (una sola consulta, sin N+1 en listados)."""
    build = _expression_for(queryset.model)
    return queryset if build is None else queryset.annotate(**{ANNOTATION: build()})


def is_locked_by_open_session(instance) -> bool:
    if instance.pk is None:
        return False
    annotated = getattr(instance, ANNOTATION, None)
    if annotated is not None:
        return bool(annotated)
    build = _expression_for(type(instance))
    if build is None:
        return False
    return bool(
        type(instance)._default_manager.filter(pk=instance.pk)
        .annotate(**{ANNOTATION: build()})
        .values_list(ANNOTATION, flat=True)
        .first()
    )


def assert_not_locked_by_open_session(instance) -> None:
    if is_locked_by_open_session(instance):
        raise DocumentLockedError(MESSAGES[instance._meta.model_name])


class PosSessionLockMixin:
    """ViewSet: rechaza editar/archivar/eliminar mientras haya una sesión POS abierta que lo use."""

    def perform_update(self, serializer):
        assert_not_locked_by_open_session(serializer.instance)
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        assert_not_locked_by_open_session(instance)
        super().perform_destroy(instance)

    def get_queryset(self):
        return annotate_pos_lock(super().get_queryset())


class PosSessionLockedField(serializers.ReadOnlyField):
    """``pos_session_locked``: el formulario deshabilita la edición mientras la sesión siga abierta.

    Lee la anotación del queryset del viewset; sin ella (serializer anidado) no consulta y es ``False``.
    """

    def __init__(self, **kwargs):
        super().__init__(source="*", **kwargs)

    def to_representation(self, instance):
        return bool(getattr(instance, ANNOTATION, False))
