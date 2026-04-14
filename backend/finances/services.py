from django.db.models import Sum, Q, Count
from decimal import Decimal
from accounting.models import Account, AccountType, JournalItem
from django.db.models.functions import TruncMonth
from django.utils import timezone
import datetime

class FinanceService:
    @staticmethod
    def _get_account_balance(account, start_date=None, end_date=None):
        """
        Calculates the balance of an account for a given period or point in time.
        For Balance Sheet accounts (ASSET, LIABILITY, EQUITY), we usually want the accumulated balance up to end_date.
        For P&L accounts (INCOME, EXPENSE), we want the movement between start_date and end_date.
        """
        filters = Q(entry__status='POSTED')
        
        if end_date:
            filters &= Q(entry__date__lte=end_date)
            
        if start_date and account.account_type in [AccountType.INCOME, AccountType.EXPENSE]:
            filters &= Q(entry__date__gte=start_date)

        qs = JournalItem.objects.filter(account=account).filter(filters)
        
        result = qs.aggregate(
            debit=Sum('debit'),
            credit=Sum('credit')
        )
        
        debit = result['debit'] or Decimal('0.00')
        credit = result['credit'] or Decimal('0.00')
        
        # Determine sign based on account type
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return debit - credit
        else:
            return credit - debit

    @staticmethod
    def _get_aggregated_balance(account, category_type=None, category_value=None, start_date=None, end_date=None):
        """
        Calculates balance including descendants.
        If category_type is provided, ONLY adds up accounts that resolve to category_value.
        If category_type is NOT provided, adds up all descendants.
        """
        total = Decimal('0.00')
        
        # If it's a leaf account, just get its balance
        if not account.children.exists():
            if category_type:
                eff = getattr(account, f'effective_{category_type}_category')
                if eff == category_value:
                    return FinanceService._get_account_balance(account, start_date, end_date)
                return Decimal('0.00')
            else:
                return FinanceService._get_account_balance(account, start_date, end_date)

        # If it's a group, sum up children
        for child in account.children.all():
            total += FinanceService._get_aggregated_balance(child, category_type, category_value, start_date, end_date)
            
        return total

    @staticmethod
    def build_account_tree(accounts, category_type=None, category_value=None, start_date=None, end_date=None, comp_start=None, comp_end=None):
        """
        Builds a hierarchical tree of accounts.
        If category_type/value are provided, filters/maps by category.
        Otherwise, uses the natural hierarchy of 'accounts'.
        """
        tree = []
        
        def process_account(account):
            balance = FinanceService._get_aggregated_balance(account, category_type, category_value, start_date, end_date)
            comp_balance = Decimal('0.00')
            if comp_end:
                comp_balance = FinanceService._get_aggregated_balance(account, category_type, category_value, comp_start, comp_end)
            
            node = {
                'id': account.id,
                'code': account.code,
                'name': account.name,
                'type': account.account_type,
                'balance': float(balance),
                'comp_balance': float(comp_balance),
                'variance': float(balance - comp_balance),
                'children': []
            }
            
            # Recursively process children
            for child in account.children.all().order_by('code'):
                # In category mode, only include if child or descendants are in category
                if category_type:
                    child_balance = FinanceService._get_aggregated_balance(child, category_type, category_value, start_date, end_date)
                    att_name = 'is_category' if category_type == 'is' else 'cf_category'
                    explicit_cat = getattr(child, att_name)
                    
                    if child_balance != 0 or (explicit_cat == category_value):
                        if explicit_cat and explicit_cat != category_value:
                            continue 
                        node['children'].append(process_account(child))
                else:
                    # In normal mode (Balance Sheet), only include if there's a balance or comparison balance
                    b = FinanceService._get_aggregated_balance(child, start_date=start_date, end_date=end_date)
                    cb = Decimal('0.00')
                    if comp_end:
                        cb = FinanceService._get_aggregated_balance(child, start_date=comp_start, end_date=comp_end)
                    
                    if b != 0 or cb != 0:
                        node['children'].append(process_account(child))
                
            return node

        # Identify starting accounts
        if category_type:
            all_in_cat = accounts.filter(**{f"{'is_category' if category_type == 'is' else 'cf_category'}": category_value})
            
            start_accounts = []
            for acc in all_in_cat:
                has_parent_mapped_same = False
                curr = acc.parent
                while curr:
                    if getattr(curr, 'is_category' if category_type == 'is' else 'cf_category') == category_value:
                        has_parent_mapped_same = True
                        break
                    curr = curr.parent
                if not has_parent_mapped_same:
                    start_accounts.append(acc)
        else:
            # BS Mode: Top-level accounts in this set
            start_accounts = accounts.filter(parent__isnull=True)

        for account in sorted(start_accounts, key=lambda x: x.code):
            tree.append(process_account(account))
            
        return tree

    @staticmethod
    def get_balance_sheet(end_date, start_date=None, comp_end=None, comp_start=None):
        """
        Returns the Balance Sheet structure.
        """
        # Assets
        assets = Account.objects.filter(account_type=AccountType.ASSET)
        asset_tree = FinanceService.build_account_tree(assets, end_date=end_date, comp_start=comp_start, comp_end=comp_end)
        total_assets = sum(node['balance'] for node in asset_tree)
        total_assets_comp = sum(node['comp_balance'] for node in asset_tree)

        # Liabilities
        liabilities = Account.objects.filter(account_type=AccountType.LIABILITY)
        liability_tree = FinanceService.build_account_tree(liabilities, end_date=end_date, comp_start=comp_start, comp_end=comp_end)
        total_liabilities = sum(node['balance'] for node in liability_tree)
        total_liabilities_comp = sum(node['comp_balance'] for node in liability_tree)

        # Equity
        equity = Account.objects.filter(account_type=AccountType.EQUITY)
        equity_tree = FinanceService.build_account_tree(equity, end_date=end_date, comp_start=comp_start, comp_end=comp_end)
        
        # Calculate Current Year Earnings (Net Income)
        if not start_date:
            start_date = end_date.replace(month=1, day=1)
            
        income_accs = Account.objects.filter(account_type=AccountType.INCOME)
        expense_accs = Account.objects.filter(account_type=AccountType.EXPENSE)
        
        def get_earnings(s_date, e_date):
            t_income = 0
            for acc in income_accs:
                t_income += float(FinanceService._get_account_balance(acc, start_date=s_date, end_date=e_date))
            t_expenses = 0
            for acc in expense_accs:
                t_expenses += float(FinanceService._get_account_balance(acc, start_date=s_date, end_date=e_date))
            return t_income - t_expenses

        current_earnings = get_earnings(start_date, end_date)
        comp_earnings = 0
        if comp_end:
            if not comp_start:
                comp_start = comp_end.replace(month=1, day=1)
            comp_earnings = get_earnings(comp_start, comp_end)
        
        # Append "Resultado del Ejercicio" to Equity Tree artificially
        equity_tree.append({
            'id': 'computed-earnings',
            'code': '',
            'name': 'Resultado del Ejercicio (Calculado)',
            'type': 'EQUITY',
            'balance': current_earnings,
            'comp_balance': comp_earnings,
            'variance': current_earnings - comp_earnings,
            'children': []
        })

        total_equity = sum(node['balance'] for node in equity_tree)
        total_equity_comp = sum(node['comp_balance'] for node in equity_tree)

        return {
            'assets': asset_tree,
            'total_assets': total_assets,
            'total_assets_comp': total_assets_comp,
            'liabilities': liability_tree,
            'total_liabilities': total_liabilities,
            'total_liabilities_comp': total_liabilities_comp,
            'equity': equity_tree,
            'total_equity': total_equity,
            'total_equity_comp': total_equity_comp,
            'check': total_assets - (total_liabilities + total_equity),
            'check_comp': total_assets_comp - (total_liabilities_comp + total_equity_comp)
        }

    @staticmethod
    def get_income_statement(start_date, end_date, comp_start=None, comp_end=None):
        """
        Returns a structured Income Statement based on ISCategory mapping.
        """
        from accounting.models import ISCategory
        
        def get_cat_data(cat):
            accounts = Account.objects.all() # We need all to find mapping roots
            tree = FinanceService.build_account_tree(accounts, 'is', cat, start_date, end_date, comp_start, comp_end)
            total = sum(item['balance'] for item in tree)
            total_comp = sum(item['comp_balance'] for item in tree)
            return tree, float(total), float(total_comp)

        revenue_tree, total_rev, total_rev_comp = get_cat_data(ISCategory.REVENUE)
        cogs_tree, total_cogs, total_cogs_comp = get_cat_data(ISCategory.COST_OF_SALES)
        opex_tree, total_opex, total_opex_comp = get_cat_data(ISCategory.OPERATING_EXPENSE)
        non_rev_tree, total_non_rev, total_non_rev_comp = get_cat_data(ISCategory.NON_OPERATING_REVENUE)
        non_exp_tree, total_non_exp, total_non_exp_comp = get_cat_data(ISCategory.NON_OPERATING_EXPENSE)
        tax_tree, total_tax, total_tax_comp = get_cat_data(ISCategory.TAX_EXPENSE)

        gross_result = total_rev - total_cogs
        gross_result_comp = total_rev_comp - total_cogs_comp
        
        operating_result = gross_result - total_opex
        operating_result_comp = gross_result_comp - total_opex_comp
        
        non_operating_result = total_non_rev - total_non_exp
        non_operating_result_comp = total_non_rev_comp - total_non_exp_comp
        
        ebt = operating_result + non_operating_result
        ebt_comp = operating_result_comp + non_operating_result_comp
        
        net_income = ebt - total_tax
        net_income_comp = ebt_comp - total_tax_comp

        return {
            'sections': [
                {'name': 'Ingresos Operacionales', 'tree': revenue_tree, 'total': total_rev, 'total_comp': total_rev_comp},
                {'name': 'Costo de Ventas', 'tree': cogs_tree, 'total': total_cogs, 'total_comp': total_cogs_comp},
                {'name': 'Resultado Bruto', 'is_total': True, 'total': gross_result, 'total_comp': gross_result_comp},
                {'name': 'Gastos Operacionales', 'tree': opex_tree, 'total': total_opex, 'total_comp': total_opex_comp},
                {'name': 'Resultado Operacional', 'is_total': True, 'total': operating_result, 'total_comp': operating_result_comp},
                {'name': 'Ingresos No Operacionales', 'tree': non_rev_tree, 'total': total_non_rev, 'total_comp': total_non_rev_comp},
                {'name': 'Gastos No Operacionales', 'tree': non_exp_tree, 'total': total_non_exp, 'total_comp': total_non_exp_comp},
                {'name': 'Resultado No Operacional', 'is_total': True, 'total': non_operating_result, 'total_comp': non_operating_result_comp},
                {'name': 'Utilidad Antes de Impuestos', 'is_total': True, 'total': ebt, 'total_comp': ebt_comp},
                {'name': 'Impuesto a la Renta', 'tree': tax_tree, 'total': total_tax, 'total_comp': total_tax_comp},
                {'name': 'Utilidad Neta', 'is_total': True, 'total': net_income, 'total_comp': net_income_comp},
            ],
            'net_income': net_income,
            'net_income_comp': net_income_comp
        }

    @staticmethod
    def get_cash_flow(start_date, end_date, comp_start=None, comp_end=None):
        """
        Returns Cash Flow Statement (Indirect Method) using CFCategory mapping.
        Integrates with Treasury (1.1.01 prefix) for baseline reconciliation.
        """
        from accounting.models import CFCategory, Account, AccountType
        from decimal import Decimal
        
        # 0. Identify Cash Pool (The source of truth for liquid assets)
        CASH_PREFIX = '1.1.01'
        cash_pool_accs = Account.objects.filter(code__startswith=CASH_PREFIX)
        cash_pool_ids = set(cash_pool_accs.values_list('id', flat=True))
        
        def get_pool_balance(date):
            if not date: return Decimal('0')
            total = Decimal('0')
            for acc in cash_pool_accs:
                total += FinanceService._get_account_balance(acc, end_date=date)
            return total

        # Baseline Balances
        beginning_cash = get_pool_balance(start_date)
        ending_cash = get_pool_balance(end_date)
        actual_net_increase = ending_cash - beginning_cash

        # Comparison Baseline
        beginning_cash_comp = Decimal('0')
        ending_cash_comp = Decimal('0')
        if comp_start and comp_end:
            beginning_cash_comp = get_pool_balance(comp_start)
            ending_cash_comp = get_pool_balance(comp_end)
        
        actual_net_increase_comp = ending_cash_comp - beginning_cash_comp

        # 1. Activities Calculation (Indirect Method)
        is_report = FinanceService.get_income_statement(start_date, end_date)
        net_income = is_report['net_income']
        
        net_income_comp = 0
        if comp_start and comp_end:
            is_report_comp = FinanceService.get_income_statement(comp_start, comp_end)
            net_income_comp = is_report_comp['net_income']
        
        operating_activities = [{'name': 'Utilidad Neta', 'amount': float(net_income), 'amount_comp': float(net_income_comp)}]
        
        # Adjustments to Net Income (Non-cash)
        dep_accs = Account.objects.filter(cf_category=CFCategory.DEP_AMORT)
        for acc in dep_accs:
            val = float(FinanceService._get_account_balance(acc, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_account_balance(acc, comp_start, comp_end))
            if val != 0 or val_comp != 0:
                operating_activities.append({'name': f"Depreciación/Amortización: {acc.name}", 'amount': val, 'amount_comp': val_comp})

        # Working Capital & Other Operating
        op_accs = Account.objects.filter(cf_category=CFCategory.OPERATING).exclude(id__in=cash_pool_ids)
        op_roots = []
        for acc in op_accs:
            has_parent = False
            curr = acc.parent
            while curr:
                if curr.cf_category == CFCategory.OPERATING:
                    has_parent = True
                    break
                curr = curr.parent
            if not has_parent:
                op_roots.append(acc)

        for acc in op_roots:
            # We use aggregated balance but ensuring we don't include cash pool internals
            val = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.OPERATING, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.OPERATING, comp_start, comp_end))
            
            if val != 0 or val_comp != 0:
                # Assets: Increase is use of cash (-) / Liabilities: Increase is source of cash (+)
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                operating_activities.append({'name': f"Cambio en {acc.name}", 'amount': amount, 'amount_comp': amount_comp})

        total_operating = sum(item['amount'] for item in operating_activities)
        total_operating_comp = sum(item.get('amount_comp', 0) for item in operating_activities)

        # 2. Investing Activities
        investing_activities = []
        inv_accs = Account.objects.filter(cf_category=CFCategory.INVESTING).exclude(id__in=cash_pool_ids)
        inv_roots = [acc for acc in inv_accs if not any(p.cf_category == CFCategory.INVESTING for p in acc.get_parents())]

        for acc in inv_roots:
            val = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.INVESTING, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.INVESTING, comp_start, comp_end))
            if val != 0 or val_comp != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                investing_activities.append({'name': f"Actividad de Inversión: {acc.name}", 'amount': amount, 'amount_comp': amount_comp})
        
        total_investing = sum(item['amount'] for item in investing_activities)
        total_investing_comp = sum(item.get('amount_comp', 0) for item in investing_activities)

        # 3. Financing Activities
        financing_activities = []
        fin_accs = Account.objects.filter(cf_category=CFCategory.FINANCING).exclude(id__in=cash_pool_ids)
        fin_roots = [acc for acc in fin_accs if not any(p.cf_category == CFCategory.FINANCING for p in acc.get_parents())]

        for acc in fin_roots:
            val = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.FINANCING, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.FINANCING, comp_start, comp_end))
            if val != 0 or val_comp != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                financing_activities.append({'name': f"Actividad de Financiamiento: {acc.name}", 'amount': amount, 'amount_comp': amount_comp})
        
        total_financing = sum(item['amount'] for item in financing_activities)
        total_financing_comp = sum(item.get('amount_comp', 0) for item in financing_activities)

        # 4. Reconciliation & Anomaly Detection
        calculated_net_increase = total_operating + total_investing + total_financing
        discrepancy = float(actual_net_increase) - calculated_net_increase
        
        culprit_accounts = []
        if abs(discrepancy) > 0.01:
            # Find accounts with movements that are NOT mapped and NOT in cash pool
            unmapped_accs = Account.objects.filter(cf_category__isnull=True).exclude(code__startswith=CASH_PREFIX)
            for acc in unmapped_accs:
                if not acc.is_selectable: continue # parent accounts logic
                variation = float(FinanceService._get_account_balance(acc, start_date, end_date))
                if abs(variation) > 0.01:
                    culprit_accounts.append({
                        'code': acc.code,
                        'name': acc.name,
                        'variation': variation,
                        'type': acc.account_type
                    })

        return {
            'beginning_cash': float(beginning_cash),
            'ending_cash': float(ending_cash),
            'beginning_cash_comp': float(beginning_cash_comp),
            'ending_cash_comp': float(ending_cash_comp),
            'operating': operating_activities,
            'total_operating': total_operating,
            'investing': investing_activities,
            'total_investing': total_investing,
            'financing': financing_activities,
            'total_financing': total_financing,
            'net_increase': float(actual_net_increase),
            'net_increase_comp': float(actual_net_increase_comp),
            'calculated_net_increase': calculated_net_increase,
            'discrepancy': discrepancy,
            'culprit_accounts': culprit_accounts,
            'is_balanced': abs(discrepancy) < 0.01
        }

    @staticmethod
    def get_financial_analysis(start_date=None, end_date=None):
        bs = FinanceService.get_balance_sheet(end_date, start_date)
        
        total_assets = bs['total_assets']
        total_liabilities = bs['total_liabilities']
        total_equity = bs['total_equity']
        
        debt_ratio = (total_liabilities / total_assets) if total_assets else 0
        equity_ratio = (total_equity / total_assets) if total_assets else 0
        debt_to_equity = (total_liabilities / total_equity) if total_equity else 0
        
        # Efficient Category Aggregation to avoid N+1 queries
        filters = Q(entry__status='POSTED')
        if end_date:
            filters &= Q(entry__date__lte=end_date)

        aggregations = JournalItem.objects.filter(filters).values('account_id', 'account__account_type').annotate(
            debit=Sum('debit'),
            credit=Sum('credit')
        )
        
        balances = {}
        for row in aggregations:
            d = row['debit'] or 0
            c = row['credit'] or 0
            if row['account__account_type'] in [AccountType.ASSET, AccountType.EXPENSE]:
                balances[row['account_id']] = d - c
            else:
                balances[row['account_id']] = c - d

        all_accounts = Account.objects.all()
        acc_dict = {a.id: a for a in all_accounts}

        from accounting.models import BSCategory
        def get_effective_bs(acc_id):
            curr = acc_dict.get(acc_id)
            while curr:
                if curr.bs_category:
                    return curr.bs_category
                curr = acc_dict.get(curr.parent_id)
            return None

        current_assets = 0
        inventory = 0
        current_liabilities = 0
        
        for acc_id, bal in balances.items():
            if bal == 0:
                continue
            cat = get_effective_bs(acc_id)
            if cat in [BSCategory.CURRENT_ASSET, BSCategory.INVENTORY]:
                current_assets += float(bal)
                if cat == BSCategory.INVENTORY:
                    inventory += float(bal)
            elif cat == BSCategory.CURRENT_LIABILITY:
                current_liabilities += float(bal)
                    
        current_ratio = (current_assets / current_liabilities) if current_liabilities else 0
        acid_test = ((current_assets - inventory) / current_liabilities) if current_liabilities else 0
        solvency_ratio = (total_assets / total_liabilities) if total_liabilities else 0

        # Extract income statement totals for margin calculations
        is_res = FinanceService.get_income_statement(start_date, end_date)
        
        total_revenue = is_res.get('total_revenue', 0)
        gross_profit = is_res.get('gross_profit', 0)
        operating_profit = is_res.get('operating_profit', 0)
        net_income = is_res.get('net_income', 0)
        
        # Margin calculations
        gross_margin = (gross_profit / total_revenue) if total_revenue else 0
        operating_margin = (operating_profit / total_revenue) if total_revenue else 0
        net_margin = (net_income / total_revenue) if total_revenue else 0

        return {
            'structure': {
                'total_assets': total_assets,
                'total_liabilities': total_liabilities,
                'total_equity': total_equity,
                'debt_ratio': debt_ratio,
                'equity_ratio': equity_ratio,
                'debt_to_equity': debt_to_equity
            },
            'liquidity': {
                'current_assets': current_assets,
                'current_liabilities': current_liabilities,
                'current_ratio': current_ratio,
                'acid_test': acid_test
            },
            'solvency': {
                'solvency_ratio': solvency_ratio
            },
            'profitability': {
                'total_revenue': total_revenue,
                'gross_margin': gross_margin,
                'operating_margin': operating_margin,
                'net_margin': net_margin
            }
        }

    @staticmethod
    def get_bi_analytics(start_date=None, end_date=None):
        """
        Aggregates cross-module data for BI Analytics.
        """
        from sales.models import SaleOrder
        from inventory.models import Product, ProductCategory, StockMove
        from purchasing.models import PurchaseOrder
        from billing.models import Invoice
        
        if not end_date:
            end_date = timezone.now().date()
        if not start_date:
            start_date = end_date - datetime.timedelta(days=180) # Last 6 months by default

        # 1. Sales Analytics
        sales_qs = SaleOrder.objects.filter(date__range=(start_date, end_date), status__in=['CONFIRMED', 'INVOICED', 'PAID'])
        total_sales = sales_qs.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
        sales_count = sales_qs.count()
        avg_ticket = total_sales / sales_count if sales_count > 0 else Decimal('0.00')

        # Monthly Trend
        monthly_sales = sales_qs.annotate(month=TruncMonth('date')).values('month').annotate(total=Sum('total')).order_by('month')
        trend = []
        for ms in monthly_sales:
            trend.append({
                'month': ms['month'].strftime('%b'),
                'sales': float(ms['total'])
            })

        # Top Customers
        top_customers_qs = sales_qs.values('customer__name').annotate(total=Sum('total')).order_by('-total')[:5]
        top_customers = [{'name': c['customer__name'], 'amount': float(c['total'])} for c in top_customers_qs]

        # 2. Inventory Analytics
        # Get all storable products
        products = Product.objects.filter(product_type='STORABLE', track_inventory=True)
        
        asset_vals = {}
        for product in products:
            total_qty = StockMove.objects.filter(product=product).aggregate(
                total=Sum('quantity')
            )['total'] or Decimal('0')
            
            if total_qty != Decimal('0'):
                val = total_qty * product.cost_price
                asset_vals[product.id] = val

        # Breakdown by category
        dist = []
        categories = ProductCategory.objects.all()
        total_inventory_value = Decimal('0')
        for cat in categories:
            cat_products = Product.objects.filter(category=cat, product_type='STORABLE', track_inventory=True)
            cat_val = 0
            items_count = 0
            for p in cat_products:
                balance = StockMove.objects.filter(product=p, date__lte=end_date).aggregate(total=Sum('quantity'))['total'] or 0
                cat_val += float(balance) * float(p.cost_price)
                if balance > 0:
                    items_count += 1
            if cat_val > 0:
                dist.append({
                    'category': cat.name,
                    'value': cat_val,
                    'items': items_count
                })

        # 3. Production Analytics
        from production.models import WorkOrder
        wo_qs = WorkOrder.objects.all()
        wo_status_dist = wo_qs.values('status').annotate(count=Count('id'))
        finished_wo = wo_qs.filter(status='FINISHED').count()
        total_wo = wo_qs.count()
        prod_efficiency = (finished_wo / total_wo * 100) if total_wo > 0 else 0

        # 4. Performance / Finance Indicators
        # Accounts Receivable (Invoices POSTED but not PAID)
        ar_total = Invoice.objects.filter(
            status='POSTED', 
            sale_order__isnull=False
        ).aggregate(total=Sum('total'))['total'] or 0
        
        # Accounts Payable
        ap_total = Invoice.objects.filter(
            status='POSTED', 
            purchase_order__isnull=False
        ).aggregate(total=Sum('total'))['total'] or 0

        # Purchase Volume
        purchase_vol = PurchaseOrder.objects.filter(
            date__range=(start_date, end_date), 
            status__in=['CONFIRMED', 'RECEIVED', 'INVOICED', 'PAID']
        ).aggregate(total=Sum('total'))['total'] or 0

        return {
            'sales': {
                'total_sales': float(total_sales),
                'sales_count': sales_count,
                'average_ticket': float(avg_ticket),
                'monthly_trend': trend,
                'top_customers': top_customers,
                'growth': 0 
            },
            'inventory': {
                'total_value': float(total_inventory_value),
                'item_count': products.count(),
                'stock_distribution': dist,
                'turnover_ratio': 0,
                'low_stock_alerts': 0 
            },
            'production': {
                'total_wo': total_wo,
                'finished_wo': finished_wo,
                'efficiency': round(prod_efficiency, 1),
                'status_distribution': list(wo_status_dist)
            },
            'performance': {
                'ar_total': float(ar_total),
                'ap_total': float(ap_total),
                'purchase_total': float(purchase_vol)
            }
        }

    @staticmethod
    def get_trial_balance(start_date=None, end_date=None):
        """
        Returns the Trial Balance (Balance de comprobación y saldos).
        Fetches all leaf accounts.
        For each, calculates:
         - Initial Balance (up to start_date)
         - Debit total (in period)
         - Credit total (in period)
         - Closing Balance
         - Saldo Deudor / Saldo Acreedor
        """
        from datetime import datetime, date
        from decimal import Decimal
        from django.db.models import Sum, Q

        # Parse string dates if necessary
        def to_date(d):
            if not d: return None
            if isinstance(d, date): return d
            try:
                return datetime.strptime(d, '%Y-%m-%d').date()
            except Exception:
                return None
                
        start = to_date(start_date)
        end = to_date(end_date)
        
        # Get accounts that have items to ensure we don't drop balances due to dirty data
        active_accounts = Account.objects.filter(journal_items__isnull=False).distinct().order_by('code')
        
        trial_balance = []
        total_global_debit = Decimal('0.00')
        total_global_credit = Decimal('0.00')
        total_saldo_deudor = Decimal('0.00')
        total_saldo_acreedor = Decimal('0.00')
        
        for account in active_accounts:
            # ---------------------------------------------
            # 1. Movimientos del Período
            # ---------------------------------------------
            period_qs = JournalItem.objects.filter(
                account=account, 
                entry__status='POSTED'
            )
            if start:
                period_qs = period_qs.filter(entry__date__gte=start)
            if end:
                period_qs = period_qs.filter(entry__date__lte=end)
                
            period_agg = period_qs.aggregate(debit=Sum('debit'), credit=Sum('credit'))
            p_debit = period_agg['debit'] or Decimal('0.00')
            p_credit = period_agg['credit'] or Decimal('0.00')
            
            # ---------------------------------------------
            # 2. Saldo Inicial
            # ---------------------------------------------
            initial_balance = Decimal('0.00')
            if start:
                init_qs = JournalItem.objects.filter(
                    account=account, 
                    entry__status='POSTED',
                    entry__date__lt=start
                )
                init_agg = init_qs.aggregate(debit=Sum('debit'), credit=Sum('credit'))
                i_debit = init_agg['debit'] or Decimal('0.00')
                i_credit = init_agg['credit'] or Decimal('0.00')
                
                if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                    initial_balance = i_debit - i_credit
                else:
                    initial_balance = i_credit - i_debit
                    
            # ---------------------------------------------
            # 3. Saldo Final y Tipificación Funcional
            # ---------------------------------------------
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                closing_balance = initial_balance + p_debit - p_credit
                saldo_deudor = closing_balance if closing_balance > 0 else Decimal('0.00')
                saldo_acreedor = abs(closing_balance) if closing_balance < 0 else Decimal('0.00')
            else:
                closing_balance = initial_balance + p_credit - p_debit
                saldo_acreedor = closing_balance if closing_balance > 0 else Decimal('0.00')
                saldo_deudor = abs(closing_balance) if closing_balance < 0 else Decimal('0.00')
                
            # Omite la cuenta si no hay movimientos ni saldos históricos
            if p_debit == 0 and p_credit == 0 and initial_balance == 0:
                continue
                
            total_global_debit += p_debit
            total_global_credit += p_credit
            total_saldo_deudor += saldo_deudor
            total_saldo_acreedor += saldo_acreedor
            
            trial_balance.append({
                'id': account.id,
                'code': account.code,
                'name': account.name,
                'type': account.account_type,
                'initial_balance': float(initial_balance),
                'debit': float(p_debit),
                'credit': float(p_credit),
                'closing_balance': float(closing_balance),
                'saldo_deudor': float(saldo_deudor),
                'saldo_acreedor': float(saldo_acreedor)
            })
            
        return {
            'accounts': trial_balance,
            'total_debit': float(total_global_debit),
            'total_credit': float(total_global_credit),
            'total_saldo_deudor': float(total_saldo_deudor),
            'total_saldo_acreedor': float(total_saldo_acreedor),
            'is_balanced': total_global_debit == total_global_credit and total_saldo_deudor == total_saldo_acreedor
        }
