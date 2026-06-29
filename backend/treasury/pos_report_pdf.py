from django.template.loader import render_to_string
from django.utils import timezone
from django.conf import settings

from .selectors import POSSelector


def render_pos_report_pdf(session, request, report_type="X", audit=None):
    """Generate a POS X/Z report PDF using WeasyPrint."""
    try:
        from weasyprint import HTML
    except ImportError:
        raise Exception("WeasyPrint is not installed.")

    summary = POSSelector.get_summary(session)

    from core.models import CompanySettings

    company = CompanySettings.objects.first()
    logo_url = None
    company_name = ""
    if company:
        company_name = company.trade_name or company.name
        if company.logo and request:
            logo_url = request.build_absolute_uri(company.logo.url)

    user_name = session.user.get_full_name() or session.user.username
    terminal_name = session.terminal.name if session.terminal else ""

    manual_movements = summary.get("manual_movements", [])
    sales_by_category = summary.get("sales_by_category", [])

    context = {
        "logo_url": logo_url,
        "company_name": company_name,
        "company_address": company.address if company else "",
        "company_phone": company.phone if company else "",
        "company_email": company.email if company else "",
        "report_type": report_type,
        "title": "Informe de Cierre (Z)" if report_type == "Z" else "Informe Parcial (X)",
        "session_id": session.id,
        "user_name": user_name,
        "terminal_name": terminal_name,
        "opened_at": session.opened_at,
        "closed_at": session.closed_at,
        "generated_at": timezone.now(),
        "opening_balance": summary.get("opening_balance", 0),
        "total_cash_sales": summary.get("total_cash_sales", 0),
        "total_card_terminal_sales": summary.get("total_card_terminal_sales", 0),
        "total_card_manual_sales": summary.get("total_card_sales", 0) - summary.get("total_card_terminal_sales", 0),
        "total_card_sales": summary.get("total_card_sales", 0),
        "total_transfer_sales": summary.get("total_transfer_sales", 0),
        "total_credit_sales": summary.get("total_credit_sales", 0),
        "total_check_sales": summary.get("total_check_sales", 0),
        "total_sales": summary.get("total_sales", 0),
        "expected_cash": summary.get("expected_cash", 0),
        "total_manual_inflow": summary.get("total_manual_inflow", 0),
        "total_manual_outflow": summary.get("total_manual_outflow", 0),
        "sale_order_count": summary.get("sale_order_count", 0),
        "dte_breakdown": summary.get("dte_breakdown", []),
        "has_movements": bool(manual_movements),
        "manual_movements": manual_movements,
        "has_categories": bool(sales_by_category),
        "sales_by_category": sales_by_category,
        "audit": audit,
    }

    html_string = render_to_string("exports/pos_report.html", context)
    base_url = request.build_absolute_uri("/") if request else settings.SITE_URL
    pdf_bytes = HTML(string=html_string, base_url=base_url).write_pdf()

    return pdf_bytes
