import pytest
from decimal import Decimal
from datetime import date
from django.utils import timezone
from accounting.models import (
    Account, AccountType, JournalEntry, JournalItem, AccountingSettings, FiscalYear
)
from tax.models import AccountingPeriod
from accounting.fiscal_year_service import FiscalYearClosingService

@pytest.mark.django_db
class TestFiscalYearClosingAndOpening:
    @pytest.fixture(autouse=True)
    def setup_data(self, django_user_model):
        self.user = django_user_model.objects.create_user(username="test_admin", password="password")
        
        # 1. Configurar cuentas requeridas
        self.income_acc = Account.objects.create(
            code="4.1", name="Ventas", account_type=AccountType.INCOME
        )
        self.expense_acc = Account.objects.create(
            code="5.1", name="Gastos Operativos", account_type=AccountType.EXPENSE
        )
        self.asset_acc = Account.objects.create(
            code="1.1", name="Caja", account_type=AccountType.ASSET
        )
        
        # Cuentas Patrimoniales para el cierre
        self.current_earnings_acc = Account.objects.create(
            code="3.4.01", name="Utilidad del Ejercicio", account_type=AccountType.EQUITY
        )
        self.retained_earnings_acc = Account.objects.create(
            code="3.4.02", name="Resultados Acumulados", account_type=AccountType.EQUITY
        )
        
        # Configurar settings globales
        settings = AccountingSettings.get_solo()
        settings.partner_current_year_earnings_account = self.current_earnings_acc
        settings.partner_retained_earnings_account = self.retained_earnings_acc
        settings.save()
        
        # 2. Generar períodos contables necesarios
        AccountingPeriod.objects.create(year=2026, month=12)
        AccountingPeriod.objects.create(year=2027, month=1)
        
        # 3. Crear Asiento simulando operaciones (Ventas > Gastos = Utilidad)
        entry = JournalEntry.objects.create(
            date=date(2026, 12, 15),
            description="Operaciones del año",
            status=JournalEntry.Status.POSTED,
            accounting_period=AccountingPeriod.objects.get(year=2026, month=12)
        )
        # Ingreso por $1000 (Crédito)
        JournalItem.objects.create(entry=entry, account=self.income_acc, debit=Decimal("0"), credit=Decimal("1000"))
        # Gasto por $600 (Débito)
        JournalItem.objects.create(entry=entry, account=self.expense_acc, debit=Decimal("600"), credit=Decimal("0"))
        # El dinero ingresa a Caja por $400 (Débito) para cuadrar
        JournalItem.objects.create(entry=entry, account=self.asset_acc, debit=Decimal("400"), credit=Decimal("0"))

    def test_close_fiscal_year_generates_correct_opening_entry(self):
        """
        Al cerrar el año, se debe generar un asiento de apertura automático para el
        próximo año donde la Utilidad del Ejercicio pase a Resultados Acumulados.
        """
        # Mockear validaciones pre-cierre para aislar la lógica del asiento
        import unittest.mock
        with unittest.mock.patch('accounting.fiscal_year_service.FiscalYearClosingService._run_preclosing_validations', return_value={}):
            # Ejecutar cierre
            fiscal_year = FiscalYearClosingService.close_fiscal_year(2026, self.user)
        
        # 1. Validar el estado del cierre
        assert fiscal_year.status == FiscalYear.Status.CLOSED
        assert fiscal_year.net_result == Decimal("400") # 1000 - 600
        
        # 2. Validar que el asiento de cierre cancela ingresos y transfiere a Utilidad Ejercicio
        closing_entry = fiscal_year.closing_entry
        assert closing_entry is not None
        assert closing_entry.is_manual is False
        
        closing_items = closing_entry.items.all()
        # Debe haber 1 para ingreso, 1 para gasto, 1 para el resultado = 3 items
        assert closing_items.count() == 3
        utilidad_item = closing_items.get(account=self.current_earnings_acc)
        # La utilidad es Crédito patrimonial
        assert utilidad_item.credit == Decimal("400")
        assert utilidad_item.debit == Decimal("0")
        
        # 3. Validar el ASIENTO DE APERTURA (El más importante de esta prueba)
        fiscal_year.refresh_from_db()
        opening_entry = fiscal_year.opening_entry
        assert opening_entry is not None
        assert opening_entry.date == date(2027, 1, 1)
        assert opening_entry.is_manual is False
        
        opening_items = opening_entry.items.all()
        # Caja = 400 (Débito)
        caja_item = opening_items.get(account=self.asset_acc)
        assert caja_item.debit == Decimal("400")
        
        # La cuenta "Utilidad del Ejercicio" NO debe estar en el asiento de apertura
        assert not opening_items.filter(account=self.current_earnings_acc).exists()
        
        # La utilidad debe haber sido trasladada a "Resultados Acumulados" (Crédito)
        retained_item = opening_items.get(account=self.retained_earnings_acc)
        assert retained_item.credit == Decimal("400")
        assert retained_item.debit == Decimal("0")
        assert "Traslado" in retained_item.label # Verificar que le pusimos la glosa especial
