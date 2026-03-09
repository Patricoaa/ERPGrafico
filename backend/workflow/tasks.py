from celery import shared_task
from django.utils import timezone
from datetime import date, timedelta
from .models import WorkflowSettings, Task
from .services import WorkflowService

@shared_task
def daily_workflow_checks():
    """
    Daily task to check and generate recurring tasks.
    Runs every day and checks WorkflowSettings.
    """
    settings = WorkflowSettings.get_settings()
    today = timezone.now().date()
    current_day = today.day
    
    # We reference the "Tax Period" which is usually the PREVIOUS month
    # because F29 is declared in the month following the operations.
    first_of_month = today.replace(day=1)
    prev_month_last_day = first_of_month - timedelta(days=1)
    target_year = prev_month_last_day.year
    target_month = prev_month_last_day.month
    
    # 1. F29 Creation Task
    if current_day == settings.f29_creation_day:
        _create_f29_periodic_task(
            task_type=WorkflowService.F29_CREATE,
            title=f"Crear Declaración F29 - {target_month}/{target_year}",
            description=f"Generar y subir la declaración F29 correspondiente al periodo {target_month}/{target_year}.",
            year=target_year,
            month=target_month
        )
        
    # 2. F29 Payment Task
    if current_day == settings.f29_payment_day:
        _create_f29_periodic_task(
            task_type=WorkflowService.F29_PAY,
            title=f"Pagar F29 - {target_month}/{target_year}",
            description=f"Registrar el pago de la declaración F29 del periodo {target_month}/{target_year}.",
            year=target_year,
            month=target_month
        )
        
    # 3. Period Closure Task (usually for the previous month)
    if current_day == settings.period_close_day:
        _create_f29_periodic_task(
            task_type=WorkflowService.PERIOD_CLOSE,
            title=f"Cierre Periodo Contable - {target_month}/{target_year}",
            description=f"Realizar el cierre del periodo contable {target_month}/{target_year}.",
            year=target_year,
            month=target_month
        )

def _create_f29_periodic_task(task_type, title, description, year, month):
    """Helper to create task only if it doesn't exist for that period"""
    # Check if task already exists for this type and period in 'data'
    # Since we don't have a direct link to a model yet (declaration doesn't exist),
    # we use the 'data' field to store period info.
    existing = Task.objects.filter(
        task_type=task_type,
        data__year=year,
        data__month=month
    ).exists()
    
    if not existing:
        WorkflowService.create_task(
            task_type=task_type,
            title=title,
            description=description,
            priority=Task.Priority.HIGH,
            category=Task.Category.TASK,
            data={
                'year': year,
                'month': month,
                'is_recurring': True
            }
        )
