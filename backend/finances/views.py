from django.db.models import Sum, Q
from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from datetime import date
from django.utils import timezone
from accounting.models import Account, AccountType, JournalItem, BSCategory
from .services import FinanceService
from celery.result import AsyncResult
from .tasks import generate_report_task

# --- API Views (JSON) ---


@api_view(['GET'])
def get_report_status_data(request, task_id):
    """
    Check the status of an asynchronous report generation task.
    """
    task = AsyncResult(task_id)
    if task.state == 'PENDING':
        return Response({'status': 'PENDING'})
    elif task.state == 'SUCCESS':
        return Response({'status': 'SUCCESS', 'data': task.result})
    elif task.state == 'FAILURE':
        return Response({'status': 'FAILURE', 'error': str(task.info)}, status=500)
    else:
        return Response({'status': task.state})

@api_view(['GET'])
def get_balance_sheet_data(request):
    """
    Returns the Balance Sheet data as JSON.
    Query Params: end_date (YYYY-MM-DD), start_date (YYYY-MM-DD)
    Cached in Redis for 90s.
    """
    from core.cache import cache_report
    end_date = request.query_params.get('end_date', timezone.now().date())
    # Allow legacy 'date' param too
    if request.query_params.get('date'):
        end_date = request.query_params.get('date')
        
    start_date = request.query_params.get('start_date') # can be None
    
    is_async = request.query_params.get('is_async', 'false').lower() == 'true'
    if is_async:
        task = generate_report_task.delay(
            report_type='balance_sheet',
            end_date=str(end_date) if end_date else None,
            start_date=str(start_date) if start_date else None,
            comp_end_date=request.query_params.get('comp_end_date'),
            comp_start_date=request.query_params.get('comp_start_date')
        )
        return Response({'task_id': task.id, 'status': 'PENDING'})
    
    comp_end = request.query_params.get('comp_end_date')
    comp_start = request.query_params.get('comp_start_date')
    
    def to_date(d):
        if not d: return None
        if isinstance(d, date): return d
        from datetime import datetime
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except:
            return None

    end_date_obj = to_date(end_date)
    start_date_obj = to_date(start_date)
    comp_end_obj = to_date(comp_end)
    comp_start_obj = to_date(comp_start)
    data = cache_report(
        module='finances',
        endpoint='balance_sheet',
        params={'start': start_date, 'end': str(end_date), 'comp_start': comp_start, 'comp_end': comp_end},
        timeout=90,
        generator=lambda: FinanceService.get_balance_sheet(end_date_obj, start_date_obj, comp_end_obj, comp_start_obj),
    )
    return Response(data)

@api_view(['GET'])
def get_income_statement_data(request):
    """
    Returns the Income Statement data as JSON.
    Query Params: start_date, end_date (YYYY-MM-DD)
    """
    end_date = request.query_params.get('end_date', timezone.now().date())
    default_start = date(timezone.now().date().year, 1, 1)
    start_date = request.query_params.get('start_date', default_start)
    
    comp_end = request.query_params.get('comp_end_date')
    comp_start = request.query_params.get('comp_start_date')

    is_async = request.query_params.get('is_async', 'false').lower() == 'true'
    if is_async:
        task = generate_report_task.delay(
            report_type='income_statement',
            end_date=str(end_date),
            start_date=str(start_date),
            comp_end_date=comp_end,
            comp_start_date=comp_start
        )
        return Response({'task_id': task.id, 'status': 'PENDING'})

    def to_date(d):
        if not d: return None
        if isinstance(d, date): return d
        from datetime import datetime
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except:
            return None

    from core.cache import cache_report
    data = cache_report(
        module='finances',
        endpoint='income_statement',
        params={'start': str(start_date), 'end': str(end_date), 'comp_start': comp_start, 'comp_end': comp_end},
        timeout=90,
        generator=lambda: FinanceService.get_income_statement(
            to_date(start_date), 
            to_date(end_date), 
            to_date(comp_start), 
            to_date(comp_end)
        ),
    )
    return Response(data)

@api_view(['GET'])
def get_trial_balance_data(request):
    """
    Returns the Trial Balance data as JSON.
    Query Params: start_date, end_date (YYYY-MM-DD)
    """
    end_date = request.query_params.get('end_date', timezone.now().date())
    start_date = request.query_params.get('start_date')  # Optional
    
    is_async = request.query_params.get('is_async', 'false').lower() == 'true'
    if is_async:
        task = generate_report_task.delay(
            report_type='trial_balance',
            end_date=str(end_date) if end_date else None,
            start_date=str(start_date) if start_date else None
        )
        return Response({'task_id': task.id, 'status': 'PENDING'})

    def to_date(d):
        if not d: return None
        if isinstance(d, date): return d
        from datetime import datetime
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except:
            return None

    end_date_obj = to_date(end_date)
    start_date_obj = to_date(start_date)
    
    from core.cache import cache_report
    data = cache_report(
        module='finances',
        endpoint='trial_balance',
        params={'start': str(start_date_obj) if start_date_obj else None, 'end': str(end_date_obj) if end_date_obj else None},
        timeout=90,
        generator=lambda: FinanceService.get_trial_balance(start_date_obj, end_date_obj),
    )
    return Response(data)

@api_view(['GET'])
def get_cash_flow_data(request):
    """
    Returns the Cash Flow data as JSON.
    Query Params: start_date, end_date, comp_start_date, comp_end_date (YYYY-MM-DD)
    """
    end_date = request.query_params.get('end_date', timezone.now().date())
    default_start = date(timezone.now().date().year, 1, 1)
    start_date = request.query_params.get('start_date', default_start)
    
    # Get comparison dates if provided
    comp_start = request.query_params.get('comp_start_date')
    comp_end = request.query_params.get('comp_end_date')
    
    is_async = request.query_params.get('is_async', 'false').lower() == 'true'
    if is_async:
        task = generate_report_task.delay(
            report_type='cash_flow',
            end_date=str(end_date),
            start_date=str(start_date),
            comp_end_date=comp_end,
            comp_start_date=comp_start
        )
        return Response({'task_id': task.id, 'status': 'PENDING'})
    
    from core.cache import cache_report
    data = cache_report(
        module='finances',
        endpoint='cash_flow',
        params={'start': str(start_date), 'end': str(end_date), 'comp_start': comp_start, 'comp_end': comp_end},
        timeout=90,
        generator=lambda: FinanceService.get_cash_flow(start_date, end_date, comp_start, comp_end),
    )
    return Response(data)

@api_view(['GET'])
def get_financial_analysis_data(request):
    """
    Returns key financial ratios and structure for dashboards.
    """
    end_date = request.query_params.get('end_date', timezone.now().date())
    if request.query_params.get('date'):
         end_date = request.query_params.get('date')
    
    start_date = request.query_params.get('start_date')

    is_async = request.query_params.get('is_async', 'false').lower() == 'true'
    if is_async:
        task = generate_report_task.delay(
            report_type='financial_analysis',
            end_date=str(end_date) if end_date else None,
            start_date=str(start_date) if start_date else None
        )
        return Response({'task_id': task.id, 'status': 'PENDING'})

    def to_date(d):
        if not d: return None
        if isinstance(d, date): return d
        from datetime import datetime
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except:
            return None

    end_date_obj = to_date(end_date)
    start_date_obj = to_date(start_date)

    from core.cache import cache_report
    data = cache_report(
        module='finances',
        endpoint='analysis',
        params={'start': start_date, 'end': str(end_date)},
        timeout=90,
        generator=lambda start_date_obj=start_date_obj, end_date_obj=end_date_obj: FinanceService.get_financial_analysis(start_date_obj, end_date_obj),
    )
    return Response(data)

@api_view(['GET'])
def get_bi_analytics_data(request):
    """
    Returns real cross-module BI analytics data.
    """
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    is_async = request.query_params.get('is_async', 'false').lower() == 'true'
    if is_async:
        task = generate_report_task.delay(
            report_type='bi_analytics',
            start_date=str(start_date) if start_date else None,
            end_date=str(end_date) if end_date else None
        )
        return Response({'task_id': task.id, 'status': 'PENDING'})
    
    def to_date(d):
        if not d: return None
        if isinstance(d, date): return d
        from datetime import datetime
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except:
            return None

    from core.cache import cache_report
    data = cache_report(
        module='finances',
        endpoint='bi_analytics',
        params={'start': start_date, 'end': end_date},
        timeout=120,
        generator=lambda: FinanceService.get_bi_analytics(to_date(start_date), to_date(end_date)),
    )
    return Response(data)
