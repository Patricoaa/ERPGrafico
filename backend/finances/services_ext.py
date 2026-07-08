class FinanceServiceExt:
    @staticmethod
    def handle_report_request(request, report_type, generator_func, default_start=None, default_end=None):
        from core.cache import cache_report
        from .views import _to_date
        end = request.query_params.get('end_date') or request.query_params.get('date') or default_end
        start = request.query_params.get('start_date', default_start)
        cend = request.query_params.get('comp_end_date')
        cstart = request.query_params.get('comp_start_date')
        fy_id_raw = request.query_params.get('fiscal_year_id')
        fy_id = int(fy_id_raw) if fy_id_raw and fy_id_raw.isdigit() else None
        if request.query_params.get('is_async', 'false').lower() == 'true':
            from celery import uuid
            from django.db import transaction
            from .tasks import generate_report_task
            tid = uuid()
            transaction.on_commit(lambda: generate_report_task.apply_async(kwargs={'report_type': report_type, 'end_date': str(end) if end else None, 'start_date': str(start) if start else None, 'comp_end_date': str(cend) if cend else None, 'comp_start_date': str(cstart) if cstart else None, 'fiscal_year_id': fy_id}, task_id=tid))
            return {'task_id': tid, 'status': 'PENDING'}
        cache_params = {'start': str(start) if start else None, 'end': str(end) if end else None, 'comp_start': str(cstart) if cstart else None, 'comp_end': str(cend) if cend else None}
        if fy_id:
            cache_params['fy'] = str(fy_id)
        extra_kw = {'fiscal_year_id': fy_id} if fy_id is not None else {}
        return cache_report(module='finances', endpoint=report_type, params=cache_params, timeout=90, generator=lambda: generator_func(_to_date(start), _to_date(end), _to_date(cstart), _to_date(cend), **extra_kw))
