from django.urls import path
from .views import (
    balance_sheet_view, 
    income_statement_view,
    get_balance_sheet_data,
    get_income_statement_data,
    get_cash_flow_data,
    get_financial_analysis_data,
    get_bi_analytics_data,
    get_report_status_data
)

urlpatterns = [
    # Legacy PDF Downloads
    path('balance-sheet/', balance_sheet_view, name='balance-sheet-pdf'),
    path('income-statement/', income_statement_view, name='income-statement-pdf'),
    
    # API Data
    path('api/balance-sheet/', get_balance_sheet_data, name='api-balance-sheet'),
    path('api/income-statement/', get_income_statement_data, name='api-income-statement'),
    path('api/cash-flow/', get_cash_flow_data, name='api-cash-flow'),
    path('api/analysis/', get_financial_analysis_data, name='api-analysis'),
    path('api/bi-analytics/', get_bi_analytics_data, name='api-bi-analytics'),
    
    # Async Status Endpoint
    path('api/report-status/<str:task_id>/', get_report_status_data, name='api-report-status'),
]
