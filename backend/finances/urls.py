from django.urls import path
from .views import (
    get_balance_sheet_data,
    get_income_statement_data,
    get_cash_flow_data,
    get_financial_analysis_data,
    get_bi_analytics_data,
    get_report_status_data,
    get_trial_balance_data
)

urlpatterns = [

    # API Data
    path('api/balance-sheet/', get_balance_sheet_data, name='api-balance-sheet'),
    path('api/trial-balance/', get_trial_balance_data, name='api-trial-balance'),
    path('api/income-statement/', get_income_statement_data, name='api-income-statement'),
    path('api/cash-flow/', get_cash_flow_data, name='api-cash-flow'),
    path('api/analysis/', get_financial_analysis_data, name='api-analysis'),
    path('api/bi-analytics/', get_bi_analytics_data, name='api-bi-analytics'),
    
    # Async Status Endpoint
    path('api/report-status/<str:task_id>/', get_report_status_data, name='api-report-status'),
]
