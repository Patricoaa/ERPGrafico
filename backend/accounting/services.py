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
        revenue_account = getattr(order.customer.category, 'revenue_account', None) or settings.default_revenue_account
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        
        if not revenue_account or not receivable_account:
             raise ValidationError("Falta configuración de cuentas para Ventas.")

        items = [
            {'account': receivable_account, 'debit': order.total, 'credit': Decimal('0.00'), 'partner': order.customer.name},
            {'account': revenue_account, 'debit': Decimal('0.00'), 'credit': order.total_net}
        ]
        
        if order.total_tax > 0:
            tax_acc = settings.default_tax_payable_account # For Sales it is usually Payable (IVA Débito)
            items.append({'account': tax_acc, 'debit': Decimal('0.00'), 'credit': order.total_tax})
            
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
            {'account': payable_account, 'debit': Decimal('0.00'), 'credit': order.total, 'partner': order.supplier.name},
            {'account': clearing_account, 'debit': order.total_net, 'credit': Decimal('0.00')}
        ]
        
        if order.total_tax > 0:
            tax_acc = settings.default_tax_receivable_account # For Purchases it is Usually Receivable (IVA Crédito)
            items.append({'account': tax_acc, 'debit': order.total_tax, 'credit': Decimal('0.00')})

        return f"Compra OC-{order.number}", f"PO-{order.id}", items

    @staticmethod
    def get_entries_for_delivery(delivery, settings):
        """
        SaleDelivery: Inventory (Cr) vs COGS (Dr)
        """
        # This usually involves moving from Inventory to Cost of Sales
        inventory_account = settings.default_inventory_account
        cogs_account = settings.cost_of_sales_account or settings.default_expense_account
        
        if not inventory_account or not cogs_account:
            raise ValidationError("Falta configuración de cuentas para Despacho (Inventario/Costo).")

        items = [
            {'account': cogs_account, 'debit': delivery.total_net, 'credit': Decimal('0.00')},
            {'account': inventory_account, 'debit': Decimal('0.00'), 'credit': delivery.total_net}
        ]
        
        return f"Costo de Venta GD-{delivery.number}", f"SD-{delivery.id}", items

    @staticmethod
    def get_entries_for_sale_invoice(invoice, settings):
        """
        Sale Invoice: Receivable (Dr) vs Revenue (Cr) + Tax (Cr)
        """
        order = invoice.sale_order
        revenue_account = getattr(order.customer.category, 'revenue_account', None) or settings.default_revenue_account
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        
        if not revenue_account or not receivable_account:
             raise ValidationError("Falta configuración de cuentas para Factura de Venta.")

        items = [
            {'account': receivable_account, 'debit': invoice.total, 'credit': Decimal('0.00'), 'partner': order.customer.name},
            {'account': revenue_account, 'debit': Decimal('0.00'), 'credit': invoice.total_net}
        ]
        
        if invoice.total_tax > 0:
            tax_acc = settings.default_tax_payable_account
            items.append({'account': tax_acc, 'debit': Decimal('0.00'), 'credit': invoice.total_tax})
            
        return f"{invoice.get_dte_type_display()} {invoice.number or ''} - Pedido {order.number}", f"{invoice.dte_type[:3]}-{order.number}", items

    @staticmethod
    def get_entries_for_purchase_bill(invoice, settings):
        """
        Purchase Bill: Payable (Cr) vs Clearing (Dr) + Tax (Dr) or Capitalized Tax (Dr)
        """
        order = invoice.purchase_order
        payable_account = order.supplier.account_payable or settings.default_payable_account
        stock_input_account = settings.stock_input_account or settings.default_inventory_account
        tax_account = settings.default_tax_receivable_account
        
        if not payable_account or not stock_input_account:
             raise ValidationError("Falta configuración de cuentas para Factura de Compra.")

        items = [
            {'account': payable_account, 'debit': Decimal('0.00'), 'credit': invoice.total, 'partner': order.supplier.name},
            {'account': stock_input_account, 'debit': invoice.total_net, 'credit': Decimal('0.00'), 'label': "Limpieza Cuenta Puente Recepción"}
        ]
        
        # Handle Taxes vs Capitalization
        is_boleta = invoice.dte_type == 'BOLETA' # Assuming string or model constant
        
        if is_boleta:
            # BOLETAS: Always capitalize VAT into product cost
            for line in order.lines.all():
                asset_account = line.product.get_asset_account() or settings.default_inventory_account
                line_tax = (line.subtotal * (line.tax_rate / Decimal('100.0'))).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                if line_tax > 0 and asset_account:
                    items.append({
                        'account': asset_account,
                        'debit': line_tax,
                        'credit': Decimal('0.00'),
                        'label': f"IVA Capitalizado - {line.product.code}"
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
