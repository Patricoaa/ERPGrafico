"""Conteo de diferencias del cuadre para el F29 y el cierre contable (spec §5.6).

Solo lectura y una consulta agregada: el número de consultas no crece con los grupos
(ADR-0118). El resumen mensual 39/41/48 y la lista de pendientes de folio se retiraron
por decisión del usuario (ADR-0141).
"""

from django.db.models import Count

from core.fiscal_match import FiscalMatchStatus
from tax.models import FiscalMatch

MISMATCH_STATUSES = (
    FiscalMatchStatus.DIFF,
    FiscalMatchStatus.AMBIGUOUS,
    FiscalMatchStatus.MISSING_ERP,
    FiscalMatchStatus.MISSING_EXTERNAL,
)


def fiscal_mismatch_counts(year: int, month: int) -> dict:
    """Grupos con diferencia del ``fiscal_period``; una consulta agregada. Solo informa (no bloquea)."""
    by_status = {str(s): 0 for s in MISMATCH_STATUSES}
    rows = (
        FiscalMatch.objects.filter(fiscal_period=f"{year}{month:02d}", status__in=MISMATCH_STATUSES)
        .values("status")
        .annotate(n=Count("id"))
        .order_by()
    )
    for row in rows:
        by_status[str(row["status"])] = row["n"]
    return {"count": sum(by_status.values()), "by_status": by_status}
