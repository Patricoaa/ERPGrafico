import os
import django
from datetime import timedelta
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from treasury.models import BankStatementLine, TreasuryMovement, ReconciliationSettings
from treasury.matching_service import MatchingService

# Find the specific line and movement from the screenshot
# Line: PAGO: LO PRADO 2, Amount: 10000 (Cargo)
line = BankStatementLine.objects.filter(description__icontains='LO PRADO').first()
# Movement: RET-000003, Amount: 10000 (Egreso)
movement = TreasuryMovement.objects.filter(amount=10000, movement_type='OUTBOUND').first()

if line and movement:
    print(f"Line: {line.description}, Date: {line.transaction_date}, Amount: {line.credit - line.debit}")
    print(f"Movement: {movement.id}, Date: {movement.date}, Amount: {movement.amount}")
    
    account = line.statement.treasury_account
    settings = ReconciliationSettings.get_for_account(account)
    print(f"Settings used: {settings}")
    print(f"Date Range Days: {settings.date_range_days}")
    
    date_diff = abs((line.transaction_date - movement.date).days)
    print(f"Date Difference: {date_diff} days")
    
    if date_diff > settings.date_range_days:
        print("FAIL: Outside date range!")
    
    score_data = MatchingService._calculate_match_score(line, movement, settings=settings)
    print(f"Score Data: {score_data}")
else:
    print("Could not find line or movement")
