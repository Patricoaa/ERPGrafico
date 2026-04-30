import pytest
from rest_framework.test import APIClient
from decimal import Decimal
from django.urls import reverse
from treasury.models import TreasuryAccount, BankStatement, BankStatementLine
from django.core.files.uploadedfile import SimpleUploadedFile
import hashlib
from datetime import date

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def treasury_account(db):
    return TreasuryAccount.objects.create(
        name="Test Account",
        currency="CLP",
        account_type="CHECKING"
    )

@pytest.fixture
def test_csv_file():
    content = b"""date,description,debit,credit,balance,reference
01-01-2026,Initial Match,0,100000,100000,REF001
02-01-2026,Service Fee,5000,0,95000,REF002
"""
    return SimpleUploadedFile("test_statement.csv", content, content_type="text/csv")


def get_custom_config():
    import json
    return json.dumps({
        "columns": {
            "date": "date",
            "description": "description",
            "debit": "debit",
            "credit": "credit",
            "balance": "balance",
            "reference": "reference"
        },
        "header_row": 0,
        "delimiter": ","
    })


@pytest.mark.django_db
def test_dry_run_returns_summary_without_persisting(client, user, treasury_account, test_csv_file):
    client.force_authenticate(user=user)
    
    response = client.post('/api/treasury/statements/dry_run/', {
        'file': test_csv_file,
        'treasury_account_id': treasury_account.id,
        'bank_format': 'GENERIC_CSV',
        'custom_config': get_custom_config()
    }, format='multipart')

    assert response.status_code == 200
    data = response.json()
    
    assert data['total_lines'] == 2
    assert data['period_start'] == '2026-01-01'
    assert data['period_end'] == '2026-01-02'
    assert not data['is_duplicate']
    assert data['can_import'] is True
    
    # Assert DB is unchanged
    assert BankStatement.objects.count() == 0
    assert BankStatementLine.objects.count() == 0


@pytest.mark.django_db
def test_dry_run_detects_duplicate(client, user, treasury_account, test_csv_file):
    client.force_authenticate(user=user)
    
    # Manually calculate hash and create duplicate statement
    test_csv_file.seek(0)
    file_content = test_csv_file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()
    test_csv_file.seek(0)
    
    BankStatement.objects.create(
        treasury_account=treasury_account,
        statement_date=date(2026, 1, 31),
        opening_balance=0,
        closing_balance=95000,
        file_hash=file_hash,
        status='CONFIRMED'
    )
    
    response = client.post('/api/treasury/statements/dry_run/', {
        'file': test_csv_file,
        'treasury_account_id': treasury_account.id,
        'bank_format': 'GENERIC_CSV',
        'custom_config': get_custom_config()
    }, format='multipart')

    assert response.status_code == 200
    data = response.json()
    
    # is_duplicate should be true, but it's a warning, not a hard error unless overlaps
    assert data['is_duplicate'] is True
    warning_messages = [w['message'] for w in data['warnings']]
    assert any('importado anteriormente' in msg for msg in warning_messages)


@pytest.mark.django_db
def test_dry_run_requires_auth(client, treasury_account, test_csv_file):
    response = client.post('/api/treasury/statements/dry_run/', {
        'file': test_csv_file,
        'treasury_account_id': treasury_account.id,
        'bank_format': 'GENERIC_CSV'
    }, format='multipart')

    assert response.status_code == 401
