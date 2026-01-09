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
        Populates a robust standard IFRS Chart of Accounts and configures defaults.
        """
        from .models import BSCategory, ISCategory, CFCategory

        coa_data = [
            # CODE, NAME, TYPE, PARENT, IS_CAT, CF_CAT, BS_CAT
            # 1. ASSETS
            ('1', 'Activos', AccountType.ASSET, None, None, None, None),
            
            # 1.1 Current Assets
            ('1.1', 'Activos Corrientes', AccountType.ASSET, '1', None, None, BSCategory.CURRENT_ASSET),
            ('1.1.01', 'Efectivo y Equivalentes', AccountType.ASSET, '1.1', None, CFCategory.OPERATING, None),
            ('1.1.01.01', 'Caja General', AccountType.ASSET, '1.1.01', None, None, None),
            ('1.1.01.02', 'Banco Principal', AccountType.ASSET, '1.1.01', None, None, None),
            
            ('1.1.02', 'Deudores Comerciales', AccountType.ASSET, '1.1', None, CFCategory.OPERATING, None),
            ('1.1.02.01', 'Clientes Locales', AccountType.ASSET, '1.1.02', None, None, None),
            ('1.1.02.02', 'Anticipos a Proveedores', AccountType.ASSET, '1.1.02', None, None, None),
            
            ('1.1.03', 'Inventarios', AccountType.ASSET, '1.1', None, CFCategory.OPERATING, None),
            ('1.1.03.01', 'Mercaderías / Productos Terminados', AccountType.ASSET, '1.1.03', None, None, None),
            ('1.1.03.02', 'Materias Primas y Suministros', AccountType.ASSET, '1.1.03', None, None, None),
            
            ('1.1.04', 'Impuestos por Recuperar', AccountType.ASSET, '1.1', None, None, None),
            ('1.1.04.01', 'IVA Crédito Fiscal', AccountType.ASSET, '1.1.04', None, None, None),
            ('1.1.04.02', 'PPM por Recuperar', AccountType.ASSET, '1.1.04', None, None, None),
            
            ('1.1.06', 'Cuentas Puente Activo', AccountType.ASSET, '1.1', None, None, None),
            ('1.1.06.01', 'Salida de Stock (Pendiente de Facturar)', AccountType.ASSET, '1.1.06', None, None, None),

            # 1.2 Non-Current Assets
            ('1.2', 'Activos No Corrientes', AccountType.ASSET, '1', None, None, BSCategory.NON_CURRENT_ASSET),
            ('1.2.01', 'Propiedades, Planta y Equipo', AccountType.ASSET, '1.2', None, CFCategory.INVESTING, None),
            ('1.2.01.01', 'Maquinaria y Equipos', AccountType.ASSET, '1.2.01', None, None, None),
            ('1.2.01.02', 'Vehículos', AccountType.ASSET, '1.2.01', None, None, None),
            ('1.2.01.03', 'Equipos Computacionales', AccountType.ASSET, '1.2.01', None, None, None),
            ('1.2.02', 'Depreciación Acumulada', AccountType.ASSET, '1.2', None, CFCategory.DEP_AMORT, None),
            ('1.2.02.01', 'Depreciación Acumulada PPE', AccountType.ASSET, '1.2.02', None, None, None),

            # 2. LIABILITIES
            ('2', 'Pasivos', AccountType.LIABILITY, None, None, None, None),
            
            # 2.1 Current Liabilities
            ('2.1', 'Pasivos Corrientes', AccountType.LIABILITY, '2', None, None, BSCategory.CURRENT_LIABILITY),
            ('2.1.01', 'Cuentas por Pagar Comerciales', AccountType.LIABILITY, '2.1', None, CFCategory.OPERATING, None),
            ('2.1.01.01', 'Proveedores Locales', AccountType.LIABILITY, '2.1.01', None, None, None),
            ('2.1.01.02', 'Anticipos de Clientes', AccountType.LIABILITY, '2.1.01', None, None, None),
            
            ('2.1.02', 'Obligaciones por Impuestos', AccountType.LIABILITY, '2.1', None, None, None),
            ('2.1.02.01', 'IVA Débito Fiscal', AccountType.LIABILITY, '2.1.02', None, None, None),
            ('2.1.02.02', 'Retenciones de Impuestos', AccountType.LIABILITY, '2.1.02', None, None, None),
            
            ('2.1.03', 'Obligaciones Laborales', AccountType.LIABILITY, '2.1', None, CFCategory.OPERATING, None),
            ('2.1.03.01', 'Remuneraciones por Pagar', AccountType.LIABILITY, '2.1.03', None, None, None),
            ('2.1.03.02', 'Leyes Sociales por Pagar', AccountType.LIABILITY, '2.1.03', None, None, None),
            
            ('2.1.06', 'Cuentas Puente Pasivo', AccountType.LIABILITY, '2.1', None, None, None),
            ('2.1.06.01', 'Entrada de Stock (Pendiente de Recibir Factura)', AccountType.LIABILITY, '2.1.06', None, None, None),

            # 3. EQUITY
            ('3', 'Patrimonio', AccountType.EQUITY, None, None, None, BSCategory.EQUITY),
            ('3.1', 'Capital Pagado', AccountType.EQUITY, '3', None, CFCategory.FINANCING, None),
            ('3.1.01', 'Capital Social', AccountType.EQUITY, '3.1', None, None, None),
            ('3.2', 'Ganancias y Pérdidas', AccountType.EQUITY, '3', None, None, None),
            ('3.2.01', 'Resultados de Ejercicios Anteriores', AccountType.EQUITY, '3.2', None, None, None),
            ('3.2.02', 'Resultado del Ejercicio', AccountType.EQUITY, '3.2', None, None, None),

            # 4. INCOME
            ('4', 'Ingresos', AccountType.INCOME, None, ISCategory.REVENUE, CFCategory.OPERATING, None),
            ('4.1', 'Ingresos de Actividades Ordinarias', AccountType.INCOME, '4', None, None, None),
            ('4.1.01', 'Venta de Productos', AccountType.INCOME, '4.1', None, None, None),
            ('4.1.02', 'Venta de Servicios', AccountType.INCOME, '4.1', None, None, None),
            ('4.2', 'Otros Ingresos', AccountType.INCOME, '4', ISCategory.NON_OPERATING_REVENUE, None, None),
            ('4.2.01', 'Intereses Ganados', AccountType.INCOME, '4.2', None, None, None),

            # 5. EXPENSES
            ('5', 'Gastos', AccountType.EXPENSE, None, None, CFCategory.OPERATING, None),
            ('5.1', 'Costo de Ventas', AccountType.EXPENSE, '5', ISCategory.COST_OF_SALES, None, None),
            ('5.1.01', 'Costo de Productos Vendidos', AccountType.EXPENSE, '5.1', None, None, None),
            ('5.1.02', 'Costo de Servicios Prestados', AccountType.EXPENSE, '5.1', None, None, None),
            
            ('5.2', 'Gastos de Administración y Ventas', AccountType.EXPENSE, '5', ISCategory.OPERATING_EXPENSE, None, None),
            ('5.2.01', 'Sueldos y Remuneraciones', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.02', 'Arriendos', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.03', 'Servicios Básicos (Agua, Luz, Tel)', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.04', 'Honorarios Profesionales', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.05', 'Materiales y Suministros Consumibles', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.06', 'Gastos Generales', AccountType.EXPENSE, '5.2', None, None, None),
        ]
        
        created_count = 0
        for code, name, type_code, parent_code, is_cat, cf_cat, bs_cat in coa_data:
            parent = None
            if parent_code:
                parent = Account.objects.filter(code=parent_code).first()
            
            account, created = Account.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'account_type': type_code,
                    'parent': parent,
                    'is_category': is_cat,
                    'cf_category': cf_cat,
                    'bs_category': bs_cat,
                    'is_reconcilable': True if code.count('.') >= 2 else False
                }
            )
            if created:
                created_count += 1
            else:
                # Update categories for existing accounts
                account.is_category = is_cat
                account.cf_category = cf_cat
                account.bs_category = bs_cat
                account.save()
        
        # 2. Configure ALL System Defaults
        settings, _ = AccountingSettings.objects.get_or_create()
        
        # Helper to get account by code
        def get_acc(code): return Account.objects.filter(code=code).first()

        # Mapping dictionary for settings fields
        mapping = {
            'default_receivable_account': '1.1.02.01',
            'default_payable_account': '2.1.01.01',
            'default_revenue_account': '4.1.01',
            'default_expense_account': '5.2.06',
            'default_tax_receivable_account': '1.1.04.01',
            'default_tax_payable_account': '2.1.02.01',
            'default_inventory_account': '1.1.03.01',
            'stock_input_account': '2.1.06.01',
            'stock_output_account': '1.1.06.01',
            'default_consumable_account': '5.2.05',
            'default_prepayment_account': '1.1.02.02',
            'default_advance_payment_account': '2.1.01.02',
        }

        for field, code in mapping.items():
            account = get_acc(code)
            if account:
                setattr(settings, field, account)
        
        settings.save()
        
        return f"Plan de cuentas IFRS robusto cargado. {created_count} nuevas cuentas creadas. Mapeos de configuración actualizados."

