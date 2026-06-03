from django.db.models import Sum, Q
from django.http import JsonResponse
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from datetime import date
from django.utils import timezone
from accounting.models import Account, AccountType, JournalItem, BSCategory
from .services import FinanceService, IndicatorService
from .models import IndicatorValue
from .serializers import IndicatorValueSerializer
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


# ── IndicatorValue CRUD (Fase 2 — F2.1) ──────────────────────────────────

class IndicatorValueViewSet(viewsets.ModelViewSet):
    """CRUD de valores de indicadores económicos (UF, UTM, USD).

    list filtrable por `indicator`. `lookup_value` retorna el valor
    más reciente (o el vigente en una fecha dada vía `?on=YYYY-MM-DD`).
    `fetch_feed` invoca el feed opcional de mindicador.cl.
    """
    queryset = IndicatorValue.objects.all().order_by('-date', 'indicator')
    serializer_class = IndicatorValueSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        indicator = self.request.query_params.get('indicator')
        if indicator:
            qs = qs.filter(indicator=indicator)
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        """Retorna el valor vigente de un indicador en una fecha."""
        indicator = request.query_params.get('indicator')
        on_str = request.query_params.get('on')
        if not indicator:
            return Response({'detail': 'Parámetro "indicator" requerido.'}, status=400)
        from datetime import datetime as _dt
        on_date = _dt.strptime(on_str, '%Y-%m-%d').date() if on_str else timezone.now().date()
        try:
            value = IndicatorValue.get_value(indicator, on_date)
        except IndicatorValue.DoesNotExist:
            return Response({'detail': f'Sin valor cargado para {indicator}.'}, status=404)
        return Response({
            'indicator': indicator,
            'date': on_date,
            'value': str(value),
        })

    @action(detail=False, methods=['post'])
    def fetch_feed(self, request):
        """Intenta descargar valores desde mindicador.cl (no rompe si no hay red)."""
        indicator = request.data.get('indicator') if hasattr(request, 'data') else None
        if not indicator:
            return Response({'detail': 'Parámetro "indicator" requerido.'}, status=400)
        if indicator not in IndicatorValue.Indicator.values:
            return Response({'detail': f'Indicador {indicator} no soportado.'}, status=400)
        inserted = IndicatorService.fetch_from_mindicador(indicator)
        return Response({'inserted': inserted, 'indicator': indicator})
