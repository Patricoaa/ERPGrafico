from django.core.exceptions import ValidationError

CONFIGURABLE_DTE_TYPES = (
    "FACTURA",
    "FACTURA_EXENTA",
    "BOLETA",
    "BOLETA_EXENTA",
)

_FIELD_BY_SIDE = {
    "emit": "allowed_dte_types_emit",
    "receive": "allowed_dte_types_receive",
}


def validate_configured_dte_type(*, side: str, dte_type: str) -> None:
    """Reject a configurable DTE type disabled for its sales/purchase flow.

    Empty settings are the legacy default and mean that all supported types remain enabled.
    Non-configurable types (notes, purchase invoices, payment receipts) are handled by their
    own workflows and are intentionally outside these two selectors.
    """
    field = _FIELD_BY_SIDE.get(side)
    if field is None:
        raise ValidationError("El flujo DTE debe ser 'emit' o 'receive'.")
    if dte_type not in CONFIGURABLE_DTE_TYPES:
        return

    from accounting.models import AccountingSettings

    settings = AccountingSettings.get_solo()
    configured_types = getattr(settings, field) if settings else []
    allowed_types = configured_types or CONFIGURABLE_DTE_TYPES
    if dte_type not in allowed_types:
        flow = "emisión" if side == "emit" else "recepción"
        raise ValidationError(
            f"El tipo de documento {dte_type} está deshabilitado para la {flow}."
        )