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
    @transaction.atomic
    def reverse_entry(entry: JournalEntry, description=None):
        """
        Creates a new Journal Entry that is the exact mirror of the original.
        Debit becomes Credit, Credit becomes Debit.
        Returns the new reversal entry.
        """
        if entry.state != JournalEntry.State.POSTED:
            raise ValidationError("Solo se pueden reversar asientos que han sido publicados.")

        from django.utils import timezone
        
        # 1. Create reversal entry
        reversal = JournalEntry.objects.create(
            date=timezone.now().date(),
            description=description or f"REVERSO: {entry.description}",
            reference=f"REV-{entry.number or entry.id}",
            state=JournalEntry.State.DRAFT
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
        entry.state = JournalEntry.State.CANCELLED
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
            ('2.1.02.02', 'Retenciones de Impuestos', AccountType.LIABILITY, '2.1.02', None, None, None),
            
            ('2.1.03', 'Obligaciones Laborales', AccountType.LIABILITY, '2.1', None, CFCategory.OPERATING, None),
            ('2.1.03.01', 'Remuneraciones por Pagar', AccountType.LIABILITY, '2.1.03', None, None, None),
            ('2.1.03.02', 'Leyes Sociales por Pagar', AccountType.LIABILITY, '2.1.03', None, None, None),
            
            ('2.1.06', 'Cuentas Puente Pasivo', AccountType.LIABILITY, '2.1', None, None, None),
            ('2.1.06.01', 'Entrada de Stock (Pendiente de Recibir Factura)', AccountType.LIABILITY, '2.1.06', None, None, None),

            # 3.1 Paid-in Capital
            ('3.1', 'Capital Pagado', AccountType.EQUITY, None, None, CFCategory.FINANCING, None),
            ('3.1.01', 'Capital Social', AccountType.EQUITY, '3.1', None, None, None),
            ('3.2', 'Ganancias y Pérdidas', AccountType.EQUITY, None, None, None, None),
            ('3.2.01', 'Resultados de Ejercicios Anteriores', AccountType.EQUITY, '3.2', None, None, None),
            ('3.2.02', 'Resultado del Ejercicio', AccountType.EQUITY, '3.2', None, None, None),

            # 4.1 Ordinary Activities Revenue
            ('4.1', 'Ingresos de Actividades Ordinarias', AccountType.INCOME, None, None, None, None),
            ('4.1.01', 'Venta de Productos', AccountType.INCOME, '4.1', None, None, None),
            ('4.1.02', 'Venta de Servicios', AccountType.INCOME, '4.1', None, None, None),
            ('4.2', 'Otros Ingresos', AccountType.INCOME, None, ISCategory.NON_OPERATING_REVENUE, None, None),
            ('4.2.01', 'Intereses Ganados', AccountType.INCOME, '4.2', None, None, None),

            # 5.1 Cost of Sales
            ('5.1', 'Costo de Ventas', AccountType.EXPENSE, None, ISCategory.COST_OF_SALES, None, None),
            ('5.1.01', 'Costo de Productos Vendidos', AccountType.EXPENSE, '5.1', None, None, None),
            ('5.1.02', 'Costo de Servicios Prestados', AccountType.EXPENSE, '5.1', None, None, None),
            
            ('5.2', 'Gastos de Administración y Ventas', AccountType.EXPENSE, None, ISCategory.OPERATING_EXPENSE, None, None),
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
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        if not receivable_account:
             raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_grouping = {} # Account -> Amount
        for line in order.lines.all():
            rev_acc = line.product.get_income_account or settings.default_revenue_account
            if not rev_acc:
                raise ValidationError(f"Falta configurar cuenta de ingresos para el producto {line.product.code}.")
            revenue_grouping[rev_acc] = revenue_grouping.get(rev_acc, Decimal('0.00')) + line.subtotal

        items = [
            {'account': receivable_account, 'debit': order.total, 'credit': Decimal('0.00'), 'partner': order.customer.name},
        ]
        
        for acc, amount in revenue_grouping.items():
            items.append({'account': acc, 'debit': Decimal('0.00'), 'credit': amount, 'label': f"Venta {order.number}"})
        
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
        from decimal import Decimal
        debits = {}  # account object -> amount (for COGS)
        credits = {} # account object -> amount (for Inventory)
        
        for line in delivery.lines.all():
            if line.total_cost <= 0:
                continue
                
            product = line.product
            # COGS Account (always from finished product)
            cogs_account = product.get_expense_account or settings.default_expense_account
            if not cogs_account:
                raise ValidationError(f"Falta configuración de cuenta de costo/gasto para el producto {product.internal_code}.")
            
            # Add to groupings (Debits)
            debits[cogs_account] = debits.get(cogs_account, Decimal('0.00')) + line.total_cost

            # Inventory Account Credit
            # If it's a manufacturable product without direct inventory tracking, we credit the components used.
            if not product.track_inventory and product.product_type == 'MANUFACTURABLE':
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
        """
        order = invoice.sale_order
        receivable_account = order.customer.account_receivable or settings.default_receivable_account
        if not receivable_account:
             raise ValidationError("Falta configuración de cuenta por cobrar.")

        revenue_grouping = {} # Account -> Amount
        for line in order.lines.all():
            rev_acc = line.product.get_income_account or settings.default_revenue_account
            if not rev_acc:
                raise ValidationError(f"Falta configurar cuenta de ingresos para el producto {line.product.code}.")
            revenue_grouping[rev_acc] = revenue_grouping.get(rev_acc, Decimal('0.00')) + line.subtotal

        items = [
            {'account': receivable_account, 'debit': invoice.total, 'credit': Decimal('0.00'), 'partner': order.customer.name},
        ]
        
        for acc, amount in revenue_grouping.items():
            items.append({'account': acc, 'debit': Decimal('0.00'), 'credit': amount, 'label': f"Factura {invoice.number or ''}"})
        
        if invoice.total_tax > 0:
            tax_acc = settings.default_tax_payable_account
            items.append({'account': tax_acc, 'debit': Decimal('0.00'), 'credit': invoice.total_tax, 'label': "IVA Débito Fiscal"})
            
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
        is_boleta = invoice.dte_type == 'BOLETA'
        
        if is_boleta:
            # BOLETAS: Always capitalize VAT into product cost
            for line in order.lines.all():
                asset_account = line.product.get_asset_account() if callable(line.product.get_asset_account) else line.product.get_asset_account
                if not asset_account:
                    asset_account = settings.default_inventory_account
                
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
                'label': f"Contrapartida Recepción OC-{order.number}"
            })
            
        return f"Recepción OC-{order.number}", f"REC-{receipt.id}", items
