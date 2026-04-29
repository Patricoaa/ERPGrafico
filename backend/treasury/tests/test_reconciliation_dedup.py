import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from treasury.reconciliation_service import ReconciliationService
from treasury.models import BankStatement, BankStatementLine, TreasuryAccount
from accounting.models import Account
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.mark.django_db
class TestReconciliationDedup:
    def setup_method(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        
        # Crear cuenta contable necesaria para TreasuryAccount
        # Nota: Usamos código 1.1.01 para cumplir con las validaciones del modelo
        self.accounting_account = Account.objects.create(
            name="Caja Test",
            code="1.1.01.999",
            account_type="ASSET"
        )
        
        self.account = TreasuryAccount.objects.create(
            name="Test Account",
            account_type="CASH",
            currency="CLP",
            account=self.accounting_account
        )
        # Crear un archivo CSV mínimo válido que pase la validación de balance (sumatoria 0)
        self.csv_content = (
            "Fecha,Descripción,Referencia,Cargo,Abono,Saldo\n"
            "2026-04-28,Movimiento Prueba,,0,0,0\n"
        ).encode('utf-8')
        
        self.file1 = SimpleUploadedFile("cartola1.csv", self.csv_content, content_type="text/csv")
        self.file2 = SimpleUploadedFile("cartola2.csv", self.csv_content, content_type="text/csv") # Mismo contenido

    def test_duplicate_import_fails(self):
        """Verifica que importar el mismo archivo dos veces falle."""
        # Primera importación (debe pasar)
        result1 = ReconciliationService.import_statement(
            file=self.file1,
            treasury_account_id=self.account.id,
            bank_format='GENERIC_CSV',
            user=self.user
        )
        assert result1['statement'].id is not None
        assert BankStatement.objects.count() == 1
        
        # Segunda importación con el MISMO CONTENIDO (debe fallar)
        with pytest.raises(ValueError) as excinfo:
            ReconciliationService.import_statement(
                file=self.file2,
                treasury_account_id=self.account.id,
                bank_format='GENERIC_CSV',
                user=self.user
            )
        
        assert "ya ha sido importado anteriormente" in str(excinfo.value)
        assert BankStatement.objects.count() == 1

    def test_different_files_pass(self):
        """Verifica que archivos con diferente contenido se importen correctamente."""
        # Primera importación
        result1 = ReconciliationService.import_statement(
            file=self.file1,
            treasury_account_id=self.account.id,
            bank_format='GENERIC_CSV',
            user=self.user
        )
        
        # Segunda importación con CONTENIDO DIFERENTE (pero balance consistente)
        diff_content = (
            "Fecha,Descripción,Referencia,Cargo,Abono,Saldo\n"
            "29-04-2026,Otro Movimiento,,0,0,0\n"
        ).encode('utf-8')
        file_diff = SimpleUploadedFile("cartola_diff.csv", diff_content, content_type="text/csv")
        # Segundo archivo (diferente contenido)
        result2 = ReconciliationService.import_statement(
            file=file_diff,
            treasury_account_id=self.account.id,
            bank_format='GENERIC_CSV',
            user=self.user
        )
        
        assert result2['statement'].id != result1['statement'].id
        assert result2['statement'].file_hash != result1['statement'].file_hash

    def test_duplicate_transaction_id_within_file_skipped(self):
        """Verifica que transacciones con ID duplicado en el mismo archivo sean omitidas con warning."""
        csv_with_dups = (
            "Fecha,Descripción,Referencia,Cargo,Abono,Saldo,ID Transacción\n"
            "28-04-2026,Mov 1,,0,0,0,TX123\n"
            "28-04-2026,Mov 2,,0,0,0,TX123\n" # Duplicado
            "28-04-2026,Mov 3,,0,0,0,TX456\n"
        ).encode('utf-8')
        
        file = SimpleUploadedFile("cartola_dup_tx.csv", csv_with_dups, content_type="text/csv")
        
        # Configuración para que el parser asocie la columna 6 con transaction_id
        custom_config = {
            'columns': {
                'date': 0,
                'description': 1,
                'reference': 2,
                'debit': 3,
                'credit': 4,
                'balance': 5,
                'transaction_id': 6
            }
        }
        
        result = ReconciliationService.import_statement(
            file=file,
            treasury_account_id=self.account.id,
            bank_format='GENERIC_CSV',
            user=self.user,
            custom_config=custom_config
        )
        
        # Deben haber 2 líneas creadas (Mov 1 y Mov 3), Mov 2 omitido
        assert result['total_lines'] == 2
        
        # Validar que advierta las 2 duplicadas ignoradas (si implementas esa validación)
        assert any("ID de transacción duplicado" in w['message'] for w in result['warnings'])
        
        # Verificar en DB
        statement = result['statement']
        assert statement.lines.count() == 2
        assert statement.lines.filter(transaction_id='TX123').count() == 1
        assert statement.lines.filter(transaction_id='TX456').count() == 1

    def test_db_constraint_unique_transaction_id(self):
        """Verifica que la restricción de integridad de la DB funcione."""
        from django.utils import timezone
        from django.db import IntegrityError
        
        from django.db import transaction
        
        statement = BankStatement.objects.create(
            treasury_account=self.account,
            statement_date=timezone.now().date(),
            opening_balance=0,
            closing_balance=0,
            imported_by=self.user
        )
        
        # Verificar que transaction_id vacío NO causa colisión
        BankStatementLine.objects.create(
            statement=statement,
            line_number=1,
            transaction_date=timezone.now().date(),
            description="Test Empty 1",
            transaction_id="", # Vacío
            debit=0, credit=0, balance=0
        )
        BankStatementLine.objects.create(
            statement=statement,
            line_number=2,
            transaction_date=timezone.now().date(),
            description="Test Empty 2",
            transaction_id="", # Otro vacío, no debe fallar
            debit=0, credit=0, balance=0
        )
        
        # Crear primera línea con ID
        BankStatementLine.objects.create(
            statement=statement,
            line_number=3,
            transaction_date=timezone.now().date(),
            description="Test 1",
            transaction_id="DUPE123",
            debit=0, credit=0, balance=0
        )
        
        # Intentar crear duplicado (debe fallar)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                BankStatementLine.objects.create(
                    statement=statement,
                    line_number=4,
                    transaction_date=timezone.now().date(),
                    description="Test 2",
                    transaction_id="DUPE123", # Duplicado
                    debit=0, credit=0, balance=0
                )
