import logging
from celery import shared_task
from .services import FinanceService
from datetime import datetime

logger = logging.getLogger(__name__)

def _to_date(d):
    if not d: return None
    if isinstance(d, str):
        try:
            return datetime.strptime(d, '%Y-%m-%d').date()
        except ValueError:
            return None
    return d

@shared_task(bind=True, name='finances.generate_report')
def generate_report_task(self, report_type, **kwargs):
    """
    Celery task that computes heavy finance reports.
    Delegates to FinanceService based on report_type.
    """
    try:
        if report_type == 'trial_balance':
            end_date = _to_date(kwargs.get('end_date'))
            start_date = _to_date(kwargs.get('start_date'))
            return FinanceService.get_trial_balance(start_date, end_date)
            
        elif report_type == 'balance_sheet':
            end_date = _to_date(kwargs.get('end_date'))
            start_date = _to_date(kwargs.get('start_date'))
            comp_end = _to_date(kwargs.get('comp_end_date'))
            comp_start = _to_date(kwargs.get('comp_start_date'))
            return FinanceService.get_balance_sheet(end_date, start_date, comp_end, comp_start)
            
        elif report_type == 'income_statement':
            end_date = _to_date(kwargs.get('end_date'))
            start_date = _to_date(kwargs.get('start_date'))
            comp_end = _to_date(kwargs.get('comp_end_date'))
            comp_start = _to_date(kwargs.get('comp_start_date'))
            return FinanceService.get_income_statement(start_date, end_date, comp_start, comp_end)
            
        elif report_type == 'cash_flow':
            end_date = _to_date(kwargs.get('end_date'))
            start_date = _to_date(kwargs.get('start_date'))
            comp_end = _to_date(kwargs.get('comp_end_date'))
            comp_start = _to_date(kwargs.get('comp_start_date'))
            return FinanceService.get_cash_flow(start_date, end_date, comp_start, comp_end)
            
        elif report_type == 'financial_analysis':
            year = kwargs.get('year')
            month = kwargs.get('month')
            return FinanceService.get_financial_analysis(year, month)
            
        elif report_type == 'bi_analytics':
            return FinanceService.get_bi_analytics()
            
        else:
            raise ValueError(f"Unknown report type: {report_type}")
            
    except Exception as e:
        logger.error(f"Error generating {report_type}: {str(e)}", exc_info=True)
        raise e
