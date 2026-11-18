"""Estados del cuadre entre registros externos (TUU, RCV) y facturas (ADR-0138 D6)."""

from django.db import models
from django.utils.translation import gettext_lazy as _


class PartState(models.TextChoices):
    """Estado de una parte (ERP, TUU, RCV) dentro de un grupo de cuadre."""

    MATCHED = "MATCHED", _("Cuadrado")
    PENDING = "PENDING", _("Pendiente")
    MISSING = "MISSING", _("Falta")
    DIFF = "DIFF", _("Diferencia")
    AMBIGUOUS = "AMBIGUOUS", _("Ambiguo")
    NOT_APPLICABLE = "NOT_APPLICABLE", _("No aplica")
    SUMMARY_ONLY = "SUMMARY_ONLY", _("Solo resumen")


class FiscalMatchStatus(models.TextChoices):
    """Estado derivado del grupo de cuadre."""

    MATCHED = "MATCHED", _("Cuadrado")
    PENDING = "PENDING", _("Pendiente")
    DIFF = "DIFF", _("Con diferencia")
    AMBIGUOUS = "AMBIGUOUS", _("Ambiguo")
    MISSING_ERP = "MISSING_ERP", _("Falta en el ERP")
    MISSING_EXTERNAL = "MISSING_EXTERNAL", _("Falta en SII/TUU")
    EXCLUDED = "EXCLUDED", _("Excluido")


def derive_group_status(erp: str, tuu: str, rcv: str, *, has_invoice: bool, excluded: bool) -> str:
    """Deriva el estado del grupo. Prioridad: EXCLUDED > AMBIGUOUS > DIFF > MISSING_ERP >
    MISSING_EXTERNAL > PENDING > MATCHED (spec §5.2)."""
    parts = (erp, tuu, rcv)
    if excluded:
        return FiscalMatchStatus.EXCLUDED.value
    if PartState.AMBIGUOUS in parts:
        return FiscalMatchStatus.AMBIGUOUS.value
    if PartState.DIFF in parts:
        return FiscalMatchStatus.DIFF.value
    if not has_invoice and erp == PartState.MISSING:
        return FiscalMatchStatus.MISSING_ERP.value
    if PartState.MISSING in parts:
        return FiscalMatchStatus.MISSING_EXTERNAL.value
    if PartState.PENDING in parts:
        return FiscalMatchStatus.PENDING.value
    return FiscalMatchStatus.MATCHED.value
