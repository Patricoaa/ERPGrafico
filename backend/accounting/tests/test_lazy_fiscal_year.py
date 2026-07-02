import pytest
from datetime import date
from accounting.models import JournalEntry
from tax.models import AccountingPeriod

@pytest.mark.django_db
class TestLazyFiscalYearInitialization:
    def test_journal_entry_creates_accounting_period_lazily(self):
        """
        Verifica que al guardar un JournalEntry con una fecha para la cual
        no existe un período contable (AccountingPeriod), el sistema lo 
        cree automáticamente mediante "Lazy Initialization".
        """
        test_year = 2030
        test_month = 5
        
        # 1. Verificar que el período NO existe inicialmente
        period_exists = AccountingPeriod.objects.filter(year=test_year, month=test_month).exists()
        assert period_exists is False, "El período no debería existir al comienzo de la prueba"
        
        # 2. Crear un JournalEntry en ese nuevo año/mes
        entry = JournalEntry.objects.create(
            date=date(test_year, test_month, 15),
            description="Primer asiento del año",
            status=JournalEntry.Status.DRAFT,
        )
        
        # 3. Validar que el modelo interceptó el guardado y creó el período
        assert entry.accounting_period is not None
        assert entry.accounting_period.year == test_year
        assert entry.accounting_period.month == test_month
        
        # 4. Validar que el período ahora existe en la base de datos
        period_exists = AccountingPeriod.objects.filter(year=test_year, month=test_month).exists()
        assert period_exists is True, "El sistema debió crear el período contable de forma automática (Lazy Initialization)"
