"""Estados del cuadre fiscal entre registros externos (TUU, RCV) y facturas (ADR-0138 D6)."""

from django.db import models
from django.utils.translation import gettext_lazy as _


class MatchStatus(models.TextChoices):
    """Resultado del cuadre. El valor vacío significa «no evaluado»."""

    MATCHED = "MATCHED", _("Cuadrado")
    AMOUNT_DIFF = "AMOUNT_DIFF", _("Diferencia de monto")
    TYPE_DIFF = "TYPE_DIFF", _("Diferencia de tipo")
    AMBIGUOUS = "AMBIGUOUS", _("Ambiguo")
    ONLY_EXTERNAL = "ONLY_EXTERNAL", _("Falta en el ERP")
    ONLY_ERP = "ONLY_ERP", _("Falta en el externo")
    EXCLUDED = "EXCLUDED", _("Excluido")
