from django.urls import path
from .views import balance_sheet_view, income_statement_view

urlpatterns = [
    path('balance-sheet/', balance_sheet_view, name='balance-sheet'),
    path('income-statement/', income_statement_view, name='income-statement'),
]
