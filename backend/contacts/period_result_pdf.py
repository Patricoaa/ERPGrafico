from django.conf import settings
from django.core.exceptions import ValidationError
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime


def _flatten(tree, depth=0):
    """Árbol de cuentas → filas planas con su nivel de sangría."""
    for node in tree:
        yield {"code": node["code"], "name": node["name"], "balance": node["balance"], "depth": depth}
        yield from _flatten(node.get("children") or [], depth + 1)


def render_period_result_pdf(resolution, request=None) -> bytes:
    """
    PDF del estado de resultados del ejercicio de una distribución, desde la copia congelada al cerrarlo
    (``FiscalYear.income_statement_snapshot``): no se recalcula, así que no cambia con asientos posteriores.
    """
    try:
        from weasyprint import HTML
    except ImportError:
        raise Exception("WeasyPrint is not installed.")

    fiscal_year = resolution.fiscal_year_obj
    snapshot = fiscal_year.income_statement_snapshot if fiscal_year else None
    if not snapshot:
        raise ValidationError(
            "El ejercicio no tiene una copia del estado de resultados: se cerró antes de que se guardara. "
            "Reábralo y ciérrelo de nuevo para generarla."
        )

    from core.models import CompanySettings

    company = CompanySettings.objects.first()
    sections = [
        {
            "name": s["name"],
            "is_total": bool(s.get("is_total")),
            "total": s["total"],
            "rows": list(_flatten(s.get("tree") or [])),
        }
        for s in snapshot["statement"]["sections"]
    ]
    context = {
        "company_name": (company.trade_name or company.name) if company else "",
        "title": f"Estado de resultados {fiscal_year.year}",
        "display_id": resolution.display_id,
        "start_date": parse_date(snapshot["start_date"]),
        "end_date": parse_date(snapshot["end_date"]),
        "captured_at": parse_datetime(snapshot["captured_at"]),
        "generated_at": timezone.now(),
        "sections": sections,
        "net_income": snapshot["statement"]["net_income"],
    }
    html_string = render_to_string("exports/period_result.html", context)
    base_url = request.build_absolute_uri("/") if request else settings.SITE_URL
    return HTML(string=html_string, base_url=base_url).write_pdf()
