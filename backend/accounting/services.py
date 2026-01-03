from django.db import transaction
from django.core.exceptions import ValidationError
from .models import JournalEntry, JournalItem, Account, AccountType, AccountingSettings

class JournalEntryService:
    @staticmethod
    @transaction.atomic
    def post_entry(entry: JournalEntry):
        """
        Validates and posts a Journal Entry.
        """
        if entry.state != JournalEntry.State.DRAFT:
            raise ValidationError("Solo se pueden publicar asientos en borrador.")

        # Validate lines
        if not entry.items.exists():
            raise ValidationError("El asiento debe tener al menos un apunte.")

        # Validate balance
        entry.check_balance()

        # Update state
        entry.state = JournalEntry.State.POSTED
        entry.save()

        # Here we could update denormalized balances if we had them.
        return entry

    @staticmethod
    def create_entry(data, items_data):
        """
        Creates a JournalEntry and its items.
        data: dict for JournalEntry fields
        items_data: list of dicts for JournalItem fields
        """
        with transaction.atomic():
            entry = JournalEntry.objects.create(**data)
            for item in items_data:
                # Handle account_id since we receive the ID as string
                account_id = item.pop('account', None)
                if account_id:
                     JournalItem.objects.create(entry=entry, account_id=account_id, **item)
            return entry

class AccountingService:
    @staticmethod
    @transaction.atomic
    def populate_ifrs_coa():
        """
        Populates a standard IFRS Chart of Accounts.
        """
        # 1. Clear existing accounts if needed? No, user might have some.
        # But for reset purposes, we usually start from zero.
        
        coa_data = [
            ('1.1', 'Activos Corrientes', 'ASSET', None),
            ('1.1.01', 'Caja y Equivalentes', 'ASSET', '1.1'),
            ('1.1.01.01', 'Caja General', 'ASSET', '1.1.01'),
            ('1.1.01.02', 'Banco Principal', 'ASSET', '1.1.01'),
            ('1.1.02', 'Cuentas por Cobrar', 'ASSET', '1.1'),
            ('1.1.02.01', 'Clientes Locales', 'ASSET', '1.1.02'),
            ('1.1.03', 'Inventarios', 'ASSET', '1.1'),
            ('1.1.03.01', 'Mercaderías', 'ASSET', '1.1.03'),
            ('1.1.04', 'IVA crédito fiscal', 'ASSET', '1.1'),
            
            ('2.1', 'Pasivos Corrientes', 'LIABILITY', None),
            ('2.1.01', 'Cuentas por Pagar', 'LIABILITY', '2.1'),
            ('2.1.01.01', 'Proveedores Locales', 'LIABILITY', '2.1.01'),
            ('2.1.02', 'Impuestos por Pagar', 'LIABILITY', '2.1'),
            ('2.1.02.01', 'IVA Débito Fiscal', 'LIABILITY', '2.1.02'),
            
            ('3.1', 'Capital Social', 'EQUITY', None),
            ('3.2', 'Resultados Acumulados', 'EQUITY', None),
            
            ('4.1', 'Ingresos por Ventas', 'INCOME', None),
            ('4.1.01', 'Ventas de Mercaderías', 'INCOME', '4.1'),
            
            ('5.1', 'Costo de Ventas', 'EXPENSE', None),
            ('5.1.01', 'Costo de Mercaderías Vendidas', 'EXPENSE', '5.1'),
            ('5.2', 'Gastos de Administración', 'EXPENSE', None),
            ('5.2.01', 'Arriendos', 'EXPENSE', '5.2'),
            ('5.2.02', 'Sueldos', 'EXPENSE', '5.2'),
        ]
        
        created_count = 0
        for code, name, type_code, parent_code in coa_data:
            parent = None
            if parent_code:
                parent = Account.objects.filter(code=parent_code).first()
            
            account, created = Account.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'account_type': type_code,
                    'parent': parent
                }
            )
            if created:
                created_count += 1
        
        # 2. Configure defaults if not set
        settings, _ = AccountingSettings.objects.get_or_create()
        if not settings.default_receivable_account:
            settings.default_receivable_account = Account.objects.filter(code='1.1.02.01').first()
        if not settings.default_payable_account:
            settings.default_payable_account = Account.objects.filter(code='2.1.01.01').first()
        if not settings.default_revenue_account:
            settings.default_revenue_account = Account.objects.filter(code='4.1.01').first()
        if not settings.default_tax_payable_account:
            settings.default_tax_payable_account = Account.objects.filter(code='2.1.02.01').first()
        if not settings.default_inventory_account:
            settings.default_inventory_account = Account.objects.filter(code='1.1.03.01').first()
        
        settings.save()
        
        return f"Plan de cuentas IFRS cargado. {created_count} nuevas cuentas creadas."
