from datetime import date

from celery.result import AsyncResult
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services import FinanceService
from .tasks import generate_report_task

# --- API Views (JSON) ---


@api_view(["GET"])
def get_report_status_data(request, task_id):
    """Check the status of an asynchronous report generation task."""
    task = AsyncResult(task_id)
    if task.state == "PENDING":
        return Response({"status": "PENDING"})
    elif task.state == "SUCCESS":
        return Response({"status": "SUCCESS", "data": task.result})
    elif task.state == "FAILURE":
        return Response({"status": "FAILURE", "error": str(task.info)}, status=500)
    return Response({"status": task.state})

def _to_date(d):
    if not d:
        return None
    if isinstance(d, date):
        return d
    from datetime import datetime
    try:
        return datetime.strptime(str(d), "%Y-%m-%d").date()
    except Exception:
        return None

def _handle_report_request(request, report_type, generator_func, default_start=None, default_end=None):
    from core.cache import cache_report
    
    end_date = request.query_params.get("end_date") or request.query_params.get("date") or default_end
    start_date = request.query_params.get("start_date", default_start)
    comp_end = request.query_params.get("comp_end_date")
    comp_start = request.query_params.get("comp_start_date")

    if request.query_params.get("is_async", "false").lower() == "true":
        from celery import uuid
        from django.db import transaction
        
        task_id = uuid()
        transaction.on_commit(lambda: generate_report_task.apply_async(
            kwargs={
                "report_type": report_type,
                "end_date": str(end_date) if end_date else None,
                "start_date": str(start_date) if start_date else None,
                "comp_end_date": str(comp_end) if comp_end else None,
                "comp_start_date": str(comp_start) if comp_start else None,
            },
            task_id=task_id
        ))
        return Response({"task_id": task_id, "status": "PENDING"})

    data = cache_report(
        module="finances",
        endpoint=report_type,
        params={
            "start": str(start_date) if start_date else None,
            "end": str(end_date) if end_date else None,
            "comp_start": str(comp_start) if comp_start else None,
            "comp_end": str(comp_end) if comp_end else None,
        },
        timeout=90,
        generator=lambda: generator_func(
            _to_date(start_date), _to_date(end_date), _to_date(comp_start), _to_date(comp_end)
        ),
    )
    return Response(data)

@api_view(["GET"])
def get_balance_sheet_data(request):
    """Returns the Balance Sheet data as JSON."""
    return _handle_report_request(
        request,
        "balance_sheet",
        FinanceService.get_balance_sheet,
        default_end=timezone.now().date(),
    )


@api_view(["GET"])
def get_income_statement_data(request):
    """Returns the Income Statement data as JSON."""
    return _handle_report_request(
        request,
        "income_statement",
        FinanceService.get_income_statement,
        default_start=date(timezone.now().date().year, 1, 1),
        default_end=timezone.now().date(),
    )


@api_view(["GET"])
def get_trial_balance_data(request):
    """Returns the Trial Balance data as JSON."""
    return _handle_report_request(
        request,
        "trial_balance",
        lambda start, end, cs, ce: FinanceService.get_trial_balance(start, end),
        default_end=timezone.now().date(),
    )


@api_view(["GET"])
def get_cash_flow_data(request):
    """Returns the Cash Flow data as JSON."""
    return _handle_report_request(
        request,
        "cash_flow",
        FinanceService.get_cash_flow,
        default_start=date(timezone.now().date().year, 1, 1),
        default_end=timezone.now().date(),
    )


@api_view(["GET"])
def get_financial_analysis_data(request):
    """Returns key financial ratios and structure for dashboards."""
    return _handle_report_request(
        request,
        "financial_analysis",
        lambda start, end, cs, ce: FinanceService.get_financial_analysis(start, end),
        default_end=timezone.now().date(),
    )


@api_view(["GET"])
def get_bi_analytics_data(request):
    """Returns real cross-module BI analytics data."""
    return _handle_report_request(
        request,
        "bi_analytics",
        lambda start, end, cs, ce: FinanceService.get_bi_analytics(start, end),
    )
