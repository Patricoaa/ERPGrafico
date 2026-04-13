from django.db import transaction
from django.core.exceptions import ValidationError
from .models import JournalEntry, JournalItem, Account, AccountType, AccountingSettings, Budget, BudgetItem

class JournalEntryService:
    @staticmethod
    @transaction.atomic
    def post_entry(entry: JournalEntry):
        """
        Validates and posts a Journal Entry.
        """
        if entry.status != JournalEntry.State.DRAFT:
            raise ValidationError("Solo se pueden publicar asientos en borrador.")

        # Validate lines
        if not entry.items.exists():
            raise ValidationError("El asiento debe tener al menos un apunte.")

        # Validate balance
        entry.check_balance()

        # Update state
        entry.status = JournalEntry.State.POSTED
        entry.save()

        # Here we could update denormalized balances if we had them.
        return entry

    @staticmethod
    @transaction.atomic
    def reverse_entry(entry: JournalEntry, description=None):
        """
        Creates a new Journal Entry that is the exact mirror of the original.
        Debit becomes Credit, Credit becomes Debit.
        Returns the new reversal entry.
        """
        if entry.status != JournalEntry.State.POSTED:
            raise ValidationError("Solo se pueden reversar asientos que han sido publicados.")

        from django.utils import timezone
        
        # 1. Create reversal entry
        reversal = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=description or f"REVERSO: {entry.description}",
            reference=f"REV-{entry.number or entry.id}",
            status=JournalEntry.State.DRAFT
        )
        
        # 2. Mirror items
        for item in entry.items.all():
            JournalItem.objects.create(
                entry=reversal,
                account=item.account,
                partner=item.partner,
                label=f"REV: {item.label}"[:255],
                debit=item.credit,
                credit=item.debit
            )
        
        # 3. Post reversal
        JournalEntryService.post_entry(reversal)
        
        # 4. Mark original as CANCELLED to indicate it shouldn't be touched/reversed again
        entry.status = JournalEntry.State.CANCELLED
        entry.save()
        
        return reversal

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
                # Handle account (could be ID or Account instance)
                account_val = item.pop('account', None)
                if account_val:
                     if hasattr(account_val, 'id'):
                         JournalItem.objects.create(entry=entry, account=account_val, **item)
                     else:
                         JournalItem.objects.create(entry=entry, account_id=account_val, **item)
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
            # 1.1 Current Assets
            ('1.1', 'Activos Corrientes', AccountType.ASSET, None, None, None, BSCategory.CURRENT_ASSET),
            ('1.1.01', 'Efectivo y Equivalentes', AccountType.ASSET, '1.1', None, CFCategory.OPERATING, None),
            ('1.1.01.01', 'Caja General', AccountType.ASSET, '1.1.01', None, None, None),
            ('1.1.01.02', 'Banco Principal', AccountType.ASSET, '1.1.01', None, None, None),
            ('1.1.01.03', 'Banco de Chile', AccountType.ASSET, '1.1.01', None, None, None),
            ('1.1.01.04', 'Caja Recepción', AccountType.ASSET, '1.1.01', None, None, None),
            
            ('1.1.02', 'Deudores Comerciales', AccountType.ASSET, '1.1', None, CFCategory.OPERATING, None),
            ('1.1.02.01', 'Clientes Locales', AccountType.ASSET, '1.1.02', None, None, None),
            ('1.1.02.02', 'Anticipos a Proveedores', AccountType.ASSET, '1.1.02', None, None, None),
            ('1.1.02.03', 'Anticipos de Remuneraciones', AccountType.ASSET, '1.1.02', None, None, None),
            
            ('1.1.03', 'Inventarios', AccountType.ASSET, '1.1', None, CFCategory.OPERATING, BSCategory.INVENTORY),
            ('1.1.03.01', 'Mercaderías / Productos Terminados', AccountType.ASSET, '1.1.03', None, None, None),
            ('1.1.03.02', 'Materias Primas y Suministros', AccountType.ASSET, '1.1.03', None, None, None),
            
            ('1.1.04', 'Impuestos por Recuperar', AccountType.ASSET, '1.1', None, None, None),
            ('1.1.04.01', 'IVA Crédito Fiscal', AccountType.ASSET, '1.1.04', None, None, None),
            ('1.1.04.02', 'IVA Remanente (Crédito Fiscal)', AccountType.ASSET, '1.1.04', None, None, None),
            ('1.1.04.03', 'Retenciones de Impuestos (Activo)', AccountType.ASSET, '1.1.04', None, None, None),
            ('1.1.04.04', 'PPM por Recuperar', AccountType.ASSET, '1.1.04', None, None, None),
            
            ('1.1.05', 'Cuentas por Cobrar Socios', AccountType.ASSET, '1.1', None, None, None),
            ('1.1.05.01', 'Capital por Cobrar (Activo)', AccountType.ASSET, '1.1.05', None, None, None),
            
            ('1.1.06', 'Cuentas Puente Activo', AccountType.ASSET, '1.1', None, None, None),
            ('1.1.06.01', 'Salida de Stock (Pendiente de Facturar)', AccountType.ASSET, '1.1.06', None, None, None),
            ('1.1.06.02', 'Comisiones Terminal (Puente)', AccountType.ASSET, '1.1.06', None, None, None),
            ('1.1.06.03', 'IVA Comisiones Terminal (Puente)', AccountType.ASSET, '1.1.06', None, None, None),

            # 1.2 Non-Current Assets
            ('1.2', 'Activos No Corrientes', AccountType.ASSET, None, None, None, BSCategory.NON_CURRENT_ASSET),
            ('1.2.01', 'Propiedades, Planta y Equipo', AccountType.ASSET, '1.2', None, CFCategory.INVESTING, None),
            ('1.2.01.01', 'Maquinaria y Equipos', AccountType.ASSET, '1.2.01', None, None, None),
            ('1.2.01.02', 'Vehículos', AccountType.ASSET, '1.2.01', None, None, None),
            ('1.2.01.03', 'Equipos Computacionales', AccountType.ASSET, '1.2.01', None, None, None),
            ('1.2.02', 'Depreciación Acumulada', AccountType.ASSET, '1.2', None, CFCategory.DEP_AMORT, None),
            ('1.2.02.01', 'Depreciación Acumulada PPE', AccountType.ASSET, '1.2.02', None, None, None),

            # 2.1 Current Liabilities
            ('2.1', 'Pasivos Corrientes', AccountType.LIABILITY, None, None, None, BSCategory.CURRENT_LIABILITY),
            ('2.1.01', 'Cuentas por Pagar Comerciales', AccountType.LIABILITY, '2.1', None, CFCategory.OPERATING, None),
            ('2.1.01.01', 'Proveedores Locales', AccountType.LIABILITY, '2.1.01', None, None, None),
            ('2.1.01.02', 'Anticipos de Clientes', AccountType.LIABILITY, '2.1.01', None, None, None),
            
            ('2.1.02', 'Obligaciones por Impuestos', AccountType.LIABILITY, '2.1', None, None, None),
            ('2.1.02.01', 'IVA Débito Fiscal', AccountType.LIABILITY, '2.1.02', None, None, None),
            ('2.1.02.02', 'IVA por Pagar (Neto)', AccountType.LIABILITY, '2.1.02', None, None, None),
            ('2.1.02.03', 'Retenciones Honorarios por Pagar', AccountType.LIABILITY, '2.1.02', None, None, None),
            ('2.1.02.04', 'Impuesto Único 2da Categoría', AccountType.LIABILITY, '2.1.02', None, None, None),
            ('2.1.02.05', 'Retención Préstamo Solidario', AccountType.LIABILITY, '2.1.02', None, None, None),
            ('2.1.02.06', 'Impuesto Adicional (ILA) por Pagar', AccountType.LIABILITY, '2.1.02', None, None, None),
            ('2.1.02.07', 'Retención IVA por Pagar', AccountType.LIABILITY, '2.1.02', None, None, None),
            
            ('2.1.03', 'Obligaciones Laborales', AccountType.LIABILITY, '2.1', None, CFCategory.OPERATING, None),
            ('2.1.03.01', 'Remuneraciones por Pagar', AccountType.LIABILITY, '2.1.03', None, None, None),
            ('2.1.03.02', 'Leyes Sociales por Pagar', AccountType.LIABILITY, '2.1.03', None, None, None),
            
            ('2.1.06', 'Cuentas Puente Pasivo', AccountType.LIABILITY, '2.1', None, None, None),
            ('2.1.06.01', 'Entrada de Stock (Pendiente de Recibir Factura)', AccountType.LIABILITY, '2.1.06', None, None, None),
            ('2.1.07', 'Dividendos por Pagar (Pasivo)', AccountType.LIABILITY, '2.1', None, CFCategory.FINANCING, None),

            # 2.2 Non-Current Liabilities
            ('2.2', 'Pasivos No Corrientes', AccountType.LIABILITY, None, None, None, BSCategory.NON_CURRENT_LIABILITY),
            ('2.2.01', 'Préstamos Bancarios Largo Plazo', AccountType.LIABILITY, '2.2', None, CFCategory.FINANCING, None),

            # 3. Patrimonio
            ('3', 'Patrimonio Neto', AccountType.EQUITY, None, None, None, BSCategory.EQUITY),
            ('3.1', 'Capital Pagado', AccountType.EQUITY, '3', None, CFCategory.FINANCING, None),
            ('3.1.01', 'Capital Social (Cuenta Maestra)', AccountType.EQUITY, '3.1', None, None, None),
            ('3.1.02', 'Aportes de Capital', AccountType.EQUITY, '3.1', None, None, None),
            ('3.1.03', 'Retiros de Socios', AccountType.EQUITY, '3.1', None, None, None),
            ('3.1.05', 'Retiros Provisorios de Socios', AccountType.EQUITY, '3.1', None, None, None),
            ('3.1.06', 'Utilidades del Ejercicio (Distribuciones)', AccountType.EQUITY, '3.1', None, None, None),
            ('3.2', 'Reservas y Ganancias', AccountType.EQUITY, '3', None, None, None),
            ('3.2.01', 'Utilidades Retenidas (Consolidada)', AccountType.EQUITY, '3.2', None, None, None),
            ('3.3', 'Resultados en Suspensión', AccountType.EQUITY, '3', None, None, None),
            ('3.4', 'Resultado Ejercicio Actual', AccountType.EQUITY, '3', None, None, None),
            ('3.4.01', 'Utilidad del Ejercicio Actual', AccountType.EQUITY, '3.4', None, None, None),

            # 4.1 Ordinary Activities Revenue
            ('4.1', 'Ingresos de Actividades Ordinarias', AccountType.INCOME, None, ISCategory.REVENUE, None, None),
            ('4.1.01', 'Venta de Productos', AccountType.INCOME, '4.1', None, None, None),
            ('4.1.02', 'Venta de Servicios', AccountType.INCOME, '4.1', None, None, None),
            ('4.2', 'Otros Ingresos', AccountType.INCOME, None, ISCategory.NON_OPERATING_REVENUE, None, None),
            ('4.2.01', 'Ajuste de Precios / Otros Ingresos', AccountType.INCOME, '4.2', None, None, None),
            ('4.2.02', 'Ganancia por Ajuste de Inventario', AccountType.INCOME, '4.2', None, None, None),
            ('4.2.03', 'Intereses Ganados', AccountType.INCOME, '4.2', None, None, None),
            ('4.2.04', 'Diferencia de Cambio (Ganancia)', AccountType.INCOME, '4.2', None, None, None),
            ('4.2.05', 'Otros Ingresos POS', AccountType.INCOME, '4.2', None, None, None),
            ('4.2.06', 'Propinas POS', AccountType.INCOME, '4.2', None, None, None),
            ('4.2.07', 'Ingreso por Corrección Monetaria', AccountType.INCOME, '4.2', None, None, None),

            # 5.1 Cost of Sales
            ('5.1', 'Costo de Ventas', AccountType.EXPENSE, None, ISCategory.COST_OF_SALES, None, None),
            ('5.1.01', 'Costo de Mercaderías Vendidas', AccountType.EXPENSE, '5.1', None, None, None),
            ('5.1.02', 'Costo de Productos Fabricados', AccountType.EXPENSE, '5.1', None, None, None),
            ('5.1.03', 'Costo de Servicios Prestados', AccountType.EXPENSE, '5.1', None, None, None),
            
            ('5.2', 'Gastos de Administración y Ventas', AccountType.EXPENSE, None, ISCategory.OPERATING_EXPENSE, None, None),
            ('5.2.01', 'Sueldos y Remuneraciones', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.01.01', 'Sueldo Base y Gratificaciones', AccountType.EXPENSE, '5.2.01', None, None, None),
            ('5.2.01.02', 'Cotizaciones Previsionales Patronales', AccountType.EXPENSE, '5.2.01', None, None, None),
            ('5.2.02', 'Arriendos', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.03', 'Servicios Básicos (Agua, Luz, Tel)', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.04', 'Honorarios Profesionales', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.05', 'Materiales y Suministros Consumibles', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.06', 'Gastos Generales', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.07', 'Pérdida por Ajuste de Inventario', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.08', 'Publicidad y Propaganda', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.09', 'Seguros', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.10', 'Comisiones Bancarias', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.11', 'Ajuste por Redondeo', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.12', 'Ajuste por Error', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.13', 'Comisión Tarjeta / Transbank', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.14', 'Faltante por Robo', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.15', 'Otros Egresos POS', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.16', 'Redondeo y Vueltos POS (Ajuste)', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.17', 'Errores de Conteo y Sistema POS', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.18', 'Asignaciones y Bonos No Imponibles', AccountType.EXPENSE, '5.2', None, None, None),
            ('5.2.99', 'Otros Gastos Varios', AccountType.EXPENSE, '5.2', None, None, None),

            # 5.3 Non-Operating Expenses
            ('5.3', 'Otros Gastos (No Operacionales)', AccountType.EXPENSE, None, ISCategory.NON_OPERATING_EXPENSE, None, None),
            ('5.3.01', 'Gastos Financieros / Intereses', AccountType.EXPENSE, '5.3', None, None, None),
            ('5.3.02', 'Diferencia de Cambio (Pérdida)', AccountType.EXPENSE, '5.3', None, None, None),

            # 5.4 Income Tax
            ('5.4', 'Impuesto a la Renta', AccountType.EXPENSE, None, ISCategory.TAX_EXPENSE, None, None),
            ('5.4.01', 'Gasto Impuesto a la Renta (Provisionado)', AccountType.EXPENSE, '5.4', None, None, None),
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
            'default_uncollectible_expense_account': '5.2.26',
            'partner_capital_social_account': '3.1.01',
            'partner_capital_contribution_account': '3.1.02',
            'partner_withdrawal_account': '3.1.03',
            'partner_provisional_withdrawal_account': '3.1.05',
            'partner_retained_earnings_account': '3.2.01',
            'partner_current_year_earnings_account': '3.4.01',
            'partner_dividends_payable_account': '2.1.07',
            'partner_capital_receivable_account': '1.1.05.01',
            
            # Cuentas de inventario
            'default_inventory_account': '1.1.03.01',  # Mantener para compatibilidad
            'storable_inventory_account': '1.1.03.01',  # NUEVO
            'manufacturable_inventory_account': '1.1.03.01',  # NUEVO
            'default_consumable_account': '5.2.05',
            'merchandise_cogs_account': '5.1.01',
            'manufactured_cogs_account': '5.1.02',
            
            'stock_input_account': '2.1.06.01',
            'stock_output_account': '1.1.06.01',
            'default_service_expense_account': '5.1.03',
            'default_service_revenue_account': '4.1.02',
            'default_subscription_expense_account': '5.1.03',
            'default_subscription_revenue_account': '4.1.02',
            'default_prepayment_account': '1.1.02.02',
            'default_advance_payment_account': '2.1.01.02',
            
            # POS Mappings
            'pos_cash_difference_gain_account': '4.2.05',
            'pos_cash_difference_loss_account': '5.2.15',
            'pos_theft_account': '5.2.14',
            'pos_partner_withdrawal_account': '3.1.03',
            'pos_other_inflow_account': '4.2.05',
            'pos_other_outflow_account': '5.2.15',
            'pos_tip_account': '4.2.06',
            'pos_cashback_error_account': '5.2.16',
            'pos_counting_error_account': '5.2.17',
            'pos_system_error_account': '5.2.17',
            'pos_rounding_adjustment_account': '5.2.16',

            # Terminal Bridge
            'terminal_commission_bridge_account': '1.1.06.02',
            'terminal_iva_bridge_account': '1.1.06.03',
            
            # F29 Tax Module
            'vat_payable_account': '2.1.02.02',
            'vat_carryforward_account': '1.1.04.02',
            'withholding_tax_account': '2.1.02.03',
            'ppm_account': '1.1.04.04',
            'second_category_tax_account': '2.1.02.04',
            'loan_retention_account': '2.1.02.05',
            'ila_tax_account': '2.1.02.06',
            'vat_withholding_account': '2.1.02.07',
            'correction_income_account': '4.2.07',

            # Inventory Adjustments (Missing)
            'adjustment_income_account': '4.2.02',  # Ganancia por Ajuste de Inventario (needs creation)
            'adjustment_expense_account': '5.2.07', # Pérdida por Ajuste de Inventario (needs creation)
            # initial_inventory_account removed — field deprecated
            'revaluation_account': '5.1.03',        # Ajuste por Revalorización (needs creation)

            # Treasury Reconciliation (Missing)
            'bank_commission_account': '5.2.10',
            'interest_income_account': '4.2.03',    # Intereses Ganados (needs creation)
            'exchange_difference_account': '4.2.04',# Diferencia de Cambio (needs creation)
            'rounding_adjustment_account': '5.2.11',
            'error_adjustment_account': '5.2.12',
            'miscellaneous_adjustment_account': '5.2.99', # Otros Gastos Varios (needs creation)
        }

        for field, code in mapping.items():
            account = get_acc(code)
            if account:
                setattr(settings, field, account)
        
        settings.save()

        return f"Plan de cuentas IFRS robusto cargado. {created_count} nuevas cuentas creadas. Mapeos de configuración actualizados (Contabilidad)."



from decimal import Decimal

class AccountingMapper:
    """
    Centralized mapper to generate standard Accounting Entries (JournalItems)
    from business entities (Orders, Deliveries, etc).
    """
    @staticmethod
    def get_entries_for_sale_order(order, settings):
        """
        SaleOrder: Receivable (Dr) vs Revenue (Cr) + Tax (Cr)
        """
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        if not receivable_account:
             raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = {} # Account -> Gross Amount
        for line in order.lines.all():
            rev_acc = line.product.get_income_account or settings.default_revenue_account
            if not rev_acc:
                raise ValidationError(f"Falta configurar cuenta de ingresos para el producto {line.product.code}.")
            revenue_gross_grouping[rev_acc] = revenue_gross_grouping.get(rev_acc, Decimal('0.00')) + line.subtotal

        items = [
            {'account': receivable_account, 'debit': order.total, 'credit': Decimal('0.00'), 'partner': order.customer, 'partner_name': order.customer.name},
        ]
        
        # Distribute Total Net across accounts based on Gross grouping
        # This ensures Sum(Revenue) == total_net, preventing rounding imbalances
        total_net_remaining = order.total_net
        accounts = list(revenue_gross_grouping.items())
        
        tax_divisor = Decimal('1') + (settings.default_tax_rate / Decimal('100.00'))
        
        for i, (acc, gross_amount) in enumerate(accounts):
            if i == len(accounts) - 1:
                # Last account takes the remainder to ensure exact match
                net_amount = total_net_remaining
            else:
                # Calculate Net for this bucket: Gross / tax_divisor
                net_amount = (gross_amount / tax_divisor).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
            
            if net_amount != 0:
                items.append({'account': acc, 'debit': Decimal('0.00'), 'credit': net_amount, 'label': f"Venta {order.number}"})
                total_net_remaining -= net_amount
        
        if order.total_tax > 0:
            tax_acc = settings.default_tax_payable_account
            items.append({'account': tax_acc, 'debit': Decimal('0.00'), 'credit': order.total_tax, 'label': "IVA Débito Fiscal"})
            
        return f"Venta NV-{order.number}", f"SO-{order.id}", items

    @staticmethod
    def get_entries_for_purchase_order(order, settings):
        """
        PurchaseOrder: Stock Input Bridge (Cr) vs Expense/Inventory (Dr) + Tax (Dr)
        """
        payable_account = order.supplier.account_payable or settings.default_payable_account
        # For Orders we usually use the "Stock Input Bridge" or direct inventory
        clearing_account = settings.stock_input_account or settings.default_payable_account
        
        if not payable_account or not clearing_account:
             raise ValidationError("Falta configuración de cuentas para Compras.")

        items = [
            {'account': payable_account, 'debit': Decimal('0.00'), 'credit': order.total, 'partner': order.supplier, 'partner_name': order.supplier.name},
            {'account': clearing_account, 'debit': order.total_net, 'credit': Decimal('0.00')}
        ]
        
        if order.total_tax > 0:
            tax_acc = settings.default_tax_receivable_account # For Purchases it is Usually Receivable (IVA Crédito)
            items.append({'account': tax_acc, 'debit': order.total_tax, 'credit': Decimal('0.00')})

        return f"Compra OCS-{order.number}", f"PO-{order.id}", items

    @staticmethod
    def get_entries_for_delivery(delivery, settings):
        """
        SaleDelivery: Inventory (Cr) vs COGS (Dr)
        """
        from decimal import Decimal
        debits = {}  # account object -> amount (for COGS)
        credits = {} # account object -> amount (for Inventory)
        
        for line in delivery.lines.all():
            if line.total_cost <= 0:
                continue
                
            product = line.product
            
            # Inventory Account Credit
            # If it's a manufacturable product without direct inventory tracking, we credit the components used.
            if not product.track_inventory and product.product_type == 'MANUFACTURABLE':
                # Check if this product has a work order (advanced manufacturing)
                # If so, the cost was already expensed during OT finalization
                if line.sale_line.work_orders.exists():
                    # Cost was already expensed during OT finalization
                    # Skip accounting entry creation to avoid duplication
                    print(f"DEBUG: Skipping COGS entry for {product.internal_code} - already expensed in OT")
                    continue
            
            # COGS Account (always from finished product)
            cogs_account = product.get_expense_account or settings.default_expense_account
            if not cogs_account:
                raise ValidationError(f"Falta configuración de cuenta de costo/gasto para el producto {product.internal_code}.")
            
            # Add to groupings (Debits)
            debits[cogs_account] = debits.get(cogs_account, Decimal('0.00')) + line.total_cost

            if not product.track_inventory and product.product_type == 'MANUFACTURABLE':
                
                # Continue with existing BOM explosion logic for express manufacturing
                from production.models import BillOfMaterials
                from inventory.services import UoMService
                active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
                
                if active_bom:
                    line_total_accounted = Decimal('0.00')
                    bom_lines = list(active_bom.lines.all())
                    
                    if not bom_lines:
                         # Fallback if BOM has no lines
                         inventory_account = product.get_asset_account or settings.default_inventory_account
                         if not inventory_account:
                            raise ValidationError(f"Falta configuración de cuenta de inventario para el producto {product.internal_code}.")
                         credits[inventory_account] = credits.get(inventory_account, Decimal('0.00')) + line.total_cost
                         continue

                    for bom_line in bom_lines:
                        component = bom_line.component
                        # Calculate component's contribution to cost (same logic as SalesService.confirm_delivery)
                        comp_qty = line.quantity * bom_line.quantity
                        try:
                            base_comp_qty = UoMService.convert_quantity(
                                comp_qty,
                                from_uom=bom_line.uom,
                                to_uom=component.uom
                            )
                        except ValidationError:
                            # Incompatible UoMs, skip but the cost will be missing from credits
                            continue
                            
                        comp_cost = (base_comp_qty * component.cost_price).quantize(Decimal('0.01'))
                        
                        # Asset account for this specific component
                        comp_inventory_account = component.get_asset_account or settings.default_inventory_account
                        if not comp_inventory_account:
                             raise ValidationError(f"Falta configuración de cuenta de inventario para el componente {component.internal_code}.")
                        
                        credits[comp_inventory_account] = credits.get(comp_inventory_account, Decimal('0.00')) + comp_cost
                        line_total_accounted += comp_cost
                    
                    # Adjustment for rounding to ensure it matches exactly line.total_cost
                    diff = line.total_cost - line_total_accounted
                    if diff != 0:
                        last_comp = bom_lines[-1].component
                        last_acc = last_comp.get_asset_account or settings.default_inventory_account
                        credits[last_acc] = credits.get(last_acc, Decimal('0.00')) + diff
                else:
                    # No active BOM, fallback to finished product's inventory account
                    inventory_account = product.get_asset_account or settings.default_inventory_account
                    if not inventory_account:
                        raise ValidationError(f"Falta configuración de cuenta de inventario para el producto {product.internal_code}.")
                    credits[inventory_account] = credits.get(inventory_account, Decimal('0.00')) + line.total_cost
            else:
                # Standard case (Tracked Inventory or Service with explicit cost)
                inventory_account = product.get_asset_account or settings.default_inventory_account
                if not inventory_account:
                    raise ValidationError(f"Falta configuración de cuenta de inventario para el producto {product.internal_code}.")
                credits[inventory_account] = credits.get(inventory_account, Decimal('0.00')) + line.total_cost
            
        if not debits:
            # No cost to record (e.g., manufacturable products without BOM)
            return f"Costo de Venta GD-{delivery.number} (Diferido)", f"SD-{delivery.id}", []

        items = []
        # Create summarized items
        for account, amount in debits.items():
            items.append({'account': account, 'debit': amount, 'credit': Decimal('0.00'), 'label': f"COGS: GD-{delivery.number}"})
            
        for account, amount in credits.items():
            items.append({'account': account, 'debit': Decimal('0.00'), 'credit': amount, 'label': f"Inv: GD-{delivery.number}"})
            
        return f"Costo de Venta GD-{delivery.number}", f"SD-{delivery.id}", items

    @staticmethod
    def get_entries_for_sale_invoice(invoice, settings):
        """
        Sale Invoice: Receivable (Dr) vs Revenue (Cr) + Tax (Cr)
        Modified to support tax-exempt documents (no IVA)
        """
        order = invoice.sale_order
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        if not receivable_account:
             raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_gross_grouping = {} # Account -> Gross Amount
        for line in order.lines.all():
            rev_acc = line.product.get_income_account or settings.default_revenue_account
            if not rev_acc:
                raise ValidationError(f"Falta configurar cuenta de ingresos para el producto {line.product.code}.")
            revenue_gross_grouping[rev_acc] = revenue_gross_grouping.get(rev_acc, Decimal('0.00')) + line.subtotal

        items = [
            {'account': receivable_account, 'debit': invoice.total, 'credit': Decimal('0.00'), 'partner': order.customer, 'partner_name': order.customer.name},
        ]
        
        # Check if document is tax-exempt
        is_tax_exempt = invoice.is_tax_exempt
        
        if is_tax_exempt:
            # Tax-exempt documents: Total = Net (no IVA separation)
            for acc, gross_amount in revenue_gross_grouping.items():
                if gross_amount != 0:
                    items.append({
                        'account': acc,
                        'debit': Decimal('0.00'),
                        'credit': gross_amount,
                        'label': f"Venta Exenta {invoice.number or ''}"
                    })
        else:
            # Standard taxable documents: Separate Net and IVA
            # Distribute Total Net across accounts based on Gross grouping
            total_net_remaining = invoice.total_net
            accounts = list(revenue_gross_grouping.items())
            tax_divisor = Decimal('1') + (settings.default_tax_rate / Decimal('100.00'))
            
            for i, (acc, gross_amount) in enumerate(accounts):
                if i == len(accounts) - 1:
                     # Last account takes the remainder
                     net_amount = total_net_remaining
                else:
                     net_amount = (gross_amount / tax_divisor).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                
                if net_amount != 0:
                    items.append({'account': acc, 'debit': Decimal('0.00'), 'credit': net_amount, 'label': f"Factura {invoice.number or ''}"})
                    total_net_remaining -= net_amount
            
            # Add IVA only for taxable documents
            if invoice.total_tax > 0:
                tax_acc = settings.default_tax_payable_account
                items.append({'account': tax_acc, 'debit': Decimal('0.00'), 'credit': invoice.total_tax, 'label': "IVA Débito Fiscal"})
            
        return f"{invoice.get_dte_type_display()} {invoice.number or ''} - Pedido {order.number}", f"{invoice.dte_type[:3]}-{order.number}", items


    @staticmethod
    def get_entries_for_purchase_bill(invoice, settings):
        """
        Purchase Bill: Payable (Cr) vs Clearing (Dr) + Tax (Dr) or Capitalized Tax (Dr)
        Modified to support tax-exempt documents (no IVA)
        """
        order = invoice.purchase_order
        payable_account = order.supplier.account_payable or settings.default_payable_account
        stock_input_account = settings.stock_input_account or settings.default_inventory_account
        tax_account = settings.default_tax_receivable_account
        
        if not payable_account or not stock_input_account:
             raise ValidationError("Falta configuración de cuentas para Factura de Compra.")

        items = [
            {'account': payable_account, 'debit': Decimal('0.00'), 'credit': invoice.total, 'partner': order.supplier, 'partner_name': order.supplier.name},
            {'account': stock_input_account, 'debit': invoice.total_net, 'credit': Decimal('0.00'), 'label': "Limpieza Cuenta Puente Recepción"}
        ]
        
        # Handle Taxes vs Capitalization
        is_tax_exempt = invoice.is_tax_exempt
        is_boleta = invoice.dte_type == 'BOLETA'
        
        if not is_tax_exempt:
            if is_boleta:
                # BOLETAS: Tax is capitalized into inventory, Net goes to bridge
                # This ensures balance even if receipt was recorded at Net
                if invoice.total_tax > 0:
                    items.append({
                        'account': settings.default_inventory_account,
                        'debit': invoice.total_tax,
                        'credit': Decimal('0.00'),
                        'label': "IVA Capitalizado (Boleta)"
                    })
            else:
                # FACTURAS: Record VAT as tax receivable
                if invoice.total_tax > 0 and tax_account:
                     items.append({
                        'account': tax_account,
                        'debit': invoice.total_tax,
                        'credit': Decimal('0.00'),
                        'label': "IVA Compras (Crédito Fiscal)"
                     })

        return f"{invoice.get_dte_type_display()} Compra {invoice.number or '(Pendiente)'} - OC {order.number}", f"FCP-{invoice.id}", items


    @staticmethod
    def get_entries_for_receipt(receipt, settings):
        """
        Purchase Receipt: Inventory (Dr) vs Stock Input Bridge (Cr)
        """
        order = receipt.purchase_order
        stock_input_account = settings.stock_input_account or settings.default_inventory_account
        
        if not stock_input_account:
             raise ValidationError("Falta configuración de cuenta puente de entrada de stock.")

        items = []
        total_amount = Decimal('0.00')
        for line in receipt.lines.all():
            # Choose account based on product type
            if line.product.product_type == 'CONSUMABLE':
                target_account = settings.default_consumable_account or line.product.get_expense_account
                if not target_account:
                    # Fallback to asset if no expense account found
                    target_account = line.product.get_asset_account if not callable(line.product.get_asset_account) else line.product.get_asset_account()
            elif line.product.product_type in ['SERVICE', 'SUBSCRIPTION']:
                target_account = line.product.get_expense_account or settings.default_service_expense_account
                if not target_account:
                     # Fallback to asset/inventory if no expense found
                     target_account = line.product.get_asset_account if not callable(line.product.get_asset_account) else line.product.get_asset_account()
            else:
                target_account = line.product.get_asset_account if not callable(line.product.get_asset_account) else line.product.get_asset_account()
            
            if not target_account:
                target_account = settings.default_inventory_account
            
            if not target_account:
                continue

            line_total = line.total_cost
            total_amount += line_total
            
            label = f"Ingreso Inventario: {line.product.code}"
            if line.product.product_type == 'CONSUMABLE':
                label = f"Gasto Consumible: {line.product.code}"
            elif line.product.product_type == 'SERVICE':
                label = f"Gasto Servicio: {line.product.code}"

            items.append({
                'account': target_account,
                'debit': line_total,
                'credit': Decimal('0.00'),
                'label': label
            })
            
        if total_amount > 0:
            items.append({
                'account': stock_input_account,
                'debit': Decimal('0.00'),
                'credit': total_amount,
                'label': f"Contrapartida Recepción OCS-{order.number}"
            })
            
        return f"Recepción OC-{order.number}", f"REC-{receipt.id}", items

class BudgetService:
    @staticmethod
    def get_variance_report(budget: Budget, year: int, month: int):
        """
        Calculates a highly detailed variance report comparing a selected month and YTD 
        against the budget definitions. Returns a hierarchical account tree.
        """
        from django.db.models import Sum, Q
        from decimal import Decimal
        from calendar import monthrange
        from datetime import date

        # 1. Period definitions
        _, last_day = monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, last_day)
        
        # YTD is from budget start to the end of the selected month
        ytd_start = budget.start_date
        ytd_end = month_end

        # 2. Get all relevant accounts (budgeted OR have actuals in period)
        budgeted_account_ids = budget.items.values_list('account_id', flat=True).distinct()
        actual_account_ids = JournalItem.objects.filter(
            entry__status='POSTED',
            entry__date__gte=ytd_start,
            entry__date__lte=ytd_end
        ).values_list('account_id', flat=True).distinct()
        
        all_account_ids = set(budgeted_account_ids) | set(actual_account_ids)
        
        # Get all parent accounts too to build the tree
        relevant_accounts = Account.objects.filter(id__in=all_account_ids)
        hierarchy_accounts_ids = set()
        for acc in relevant_accounts:
            hierarchy_accounts_ids.add(acc.id)
            curr = acc.parent
            while curr:
                hierarchy_accounts_ids.add(curr.id)
                curr = curr.parent
        
        all_relevant_accounts = Account.objects.filter(id__in=hierarchy_accounts_ids)

        # 3. Pre-fetch Data for performance
        # Monthly Actuals
        m_actuals_qs = JournalItem.objects.filter(
            entry__status='POSTED',
            entry__date__gte=month_start,
            entry__date__lte=month_end
        ).values('account_id').annotate(debit=Sum('debit'), credit=Sum('credit'))
        m_actuals = {i['account_id']: i for i in m_actuals_qs}

        # YTD Actuals
        y_actuals_qs = JournalItem.objects.filter(
            entry__status='POSTED',
            entry__date__gte=ytd_start,
            entry__date__lte=ytd_end
        ).values('account_id').annotate(debit=Sum('debit'), credit=Sum('credit'))
        y_actuals = {i['account_id']: i for i in y_actuals_qs}

        # Monthly Budget
        m_budget_qs = budget.items.filter(year=year, month=month).values('account_id').annotate(total=Sum('amount'))
        m_budget = {i['account_id']: float(i['total']) for i in m_budget_qs}

        # YTD Budget
        y_budget_qs = budget.items.filter(
            Q(year__lt=year) | Q(year=year, month__lte=month)
        ).values('account_id').annotate(total=Sum('amount'))
        y_budget = {i['account_id']: float(i['total']) for i in y_budget_qs}

        # 4. Tree Building Logic
        def get_node_data(account_id):
            acc = all_relevant_accounts.get(id=account_id)
            
            # Helper to calculate balance based on type
            def calc_bal(data):
                if not data: return 0.0
                d = float(data.get('debit') or 0)
                c = float(data.get('credit') or 0)
                if acc.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                    return d - c
                return c - d

            # If leaf, direct data. If group, sum of children.
            if not acc.children.exists():
                ma = calc_bal(m_actuals.get(account_id))
                mb = m_budget.get(account_id, 0.0)
                ya = calc_bal(y_actuals.get(account_id))
                yb = y_budget.get(account_id, 0.0)
            else:
                # Recurse children
                ma = mb = ya = yb = 0.0
                # We only sum children that are path of our 'all_account_ids' descendants
                # Or just sum all children from our prefetched relevant set
                children = all_relevant_accounts.filter(parent_id=account_id)
                for child in children:
                    cma, cmb, cya, cyb = get_node_sums(child.id)
                    ma += cma
                    mb += cmb
                    ya += cya
                    yb += cyb

            mv = ma - mb
            mp = (ma / mb * 100) if mb != 0 else (100.0 if ma != 0 else 0.0)
            
            yv = ya - yb
            yp = (ya / yb * 100) if yb != 0 else (100.0 if ya != 0 else 0.0)

            return {
                'id': acc.id,
                'code': acc.code,
                'name': acc.name,
                'type': acc.account_type,
                'month_actual': ma,
                'month_budget': mb,
                'month_variance': mv,
                'month_percentage': mp,
                'ytd_actual': ya,
                'ytd_budget': yb,
                'ytd_variance': yv,
                'ytd_percentage': yp,
                'is_unbudgeted': account_id not in budgeted_account_ids and (ma != 0 or ya != 0)
            }

        # Optimization: Memoize recursive sums
        memo_sums = {}
        def get_node_sums(account_id):
            if account_id in memo_sums: return memo_sums[account_id]
            
            acc = all_relevant_accounts.get(id=account_id)
            if not acc.children.exists():
                def calc_bal(data):
                    if not data: return 0.0
                    d = float(data.get('debit') or 0)
                    c = float(data.get('credit') or 0)
                    if acc.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                        return d - c
                    return c - d
                
                res = (
                    calc_bal(m_actuals.get(account_id)),
                    m_budget.get(account_id, 0.0),
                    calc_bal(y_actuals.get(account_id)),
                    y_budget.get(account_id, 0.0)
                )
            else:
                ma = mb = ya = yb = 0.0
                for child in all_relevant_accounts.filter(parent_id=account_id):
                    cma, cmb, cya, cyb = get_node_sums(child.id)
                    ma += cma
                    mb += cmb
                    ya += cya
                    yb += cyb
                res = (ma, mb, ya, yb)
            
            memo_sums[account_id] = res
            return res

        def build_recursive_tree(account_id):
            data = get_node_data(account_id)
            node = { **data, 'children': [] }
            for child in all_relevant_accounts.filter(parent_id=account_id).order_by('code'):
                node['children'].append(build_recursive_tree(child.id))
            return node

        # Start from top-level accounts in our relevant set
        tree = []
        roots = all_relevant_accounts.filter(parent__isnull=True).order_by('code')
        for root in roots:
            tree.append(build_recursive_tree(root.id))

        return tree

    @staticmethod
    def get_execution_report(budget: Budget):
        """
        Calculates the execution status of the budget.
        Groups by account to show total execution vs total budgeted for the period.
        """
        from django.db.models import Sum, Q

        # Aggregate budgeted amounts by account (considering all years in the budget period)
        budgeted_qs = budget.items.values('account').annotate(total_budgeted=Sum('amount'))
        
        report = []
        total_budgeted = 0
        total_actual = 0
        
        for b_item in budgeted_qs:
            account = Account.objects.get(id=b_item['account'])
            budgeted_amount = float(b_item['total_budgeted'])
            
            # Filter actual items for the entire budget period
            filters = Q(entry__status='POSTED', 
                        entry__date__gte=budget.start_date, 
                        entry__date__lte=budget.end_date,
                        account=account)
            
            result = JournalItem.objects.filter(filters).aggregate(
                debit=Sum('debit'),
                credit=Sum('credit')
            )
            
            debit = result['debit'] or 0
            credit = result['credit'] or 0
            
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                actual = float(debit - credit)
            else:
                actual = float(credit - debit)
                
            report.append({
                'account_id': account.id,
                'account_code': account.code,
                'account_name': account.name,
                'budgeted': budgeted_amount,
                'actual': actual,
                'variance': actual - budgeted_amount,
                'percentage': (actual / budgeted_amount * 100) if budgeted_amount != 0 else 0
            })
            
            total_budgeted += budgeted_amount
            total_actual += actual
            
        return {
            'items': report,
            'summary': {
                'total_budgeted': total_budgeted,
                'total_actual': total_actual,
                'total_variance': total_actual - total_budgeted
            }
        }

    @staticmethod
    @transaction.atomic
    def set_budget_items(budget: Budget, items_data: list):
        """
        Bulk update or replace budget items.
        Expected item: { account: 1, year: 2024, month: 1, amount: 1000 }
        """
        # For simple management, we replace all items. 
        # In the future, we could do partial updates.
        budget.items.all().delete()
        
        new_items = []
        for item in items_data:
            amount = float(item.get('amount', 0))
            if amount != 0:
                new_items.append(BudgetItem(
                    budget=budget,
                    account_id=item['account'],
                    year=item.get('year', budget.start_date.year),
                    month=item.get('month', 1),
                    amount=amount
                ))
        
        BudgetItem.objects.bulk_create(new_items)
        return len(new_items)

    @staticmethod
    def get_previous_year_actuals(budget: Budget):
        """
        Fetches actual execution data from the previous year relative to the budget's start date.
        Returns a list of dicts: [ { account: id, month: 1..12, amount: val }, ... ]
        """
        from django.db.models import Sum, ExtractMonth
        from datetime import date
        
        prev_year = budget.start_date.year - 1
        start_prev = date(prev_year, 1, 1)
        end_prev = date(prev_year, 12, 31)
        
        # Get all posted items for that year
        items_qs = JournalItem.objects.filter(
            entry__status='POSTED',
            entry__date__gte=start_prev,
            entry__date__lte=end_prev
        ).annotate(month=ExtractMonth('entry__date'))
        
        # Group by account and month
        grouped = items_qs.values('account', 'month').annotate(
            debit_sub=Sum('debit'),
            credit_sub=Sum('credit')
        )
        
        results = []
        # We need account types to calculate balance correctly
        accounts_map = {a.id: a for a in Account.objects.filter(id__in=[g['account'] for g in grouped])}
        
        for g in grouped:
            acc = accounts_map.get(g['account'])
            if not acc: continue
            
            debit = g['debit_sub'] or 0
            credit = g['credit_sub'] or 0
            
            if acc.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                amount = debit - credit
            else:
                amount = credit - debit
                
            if amount != 0:
                results.append({
                    'account': acc.id,
                    'year': budget.start_date.year, # We return it mapped to the current budget year
                    'month': g['month'],
                    'amount': float(amount)
                })
        
        return results

    @staticmethod
    def generate_execution_csv(budget: Budget):
        """
        Generates a CSV string with the execution report data.
        """
        import csv
        import io
        
        report_data = BudgetService.get_execution_report(budget)
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['Codigo Cuenta', 'Nombre Cuenta', 'Presupuestado', 'Ejecutado', 'Desviacion', '% Ejecucion'])
        
        for item in report_data['items']:
            writer.writerow([
                item['account_code'],
                item['account_name'],
                item['budgeted'],
                item['actual'],
                item['variance'],
                f"{item['percentage']:.2f}%"
            ])
            
        # Summary Row
        summary = report_data['summary']
        writer.writerow([])
        writer.writerow(['TOTALES', '', summary['total_budgeted'], summary['total_actual'], summary['total_variance'], ''])
        
        return output.getvalue()
