from django.db.models import Sum, Q
from decimal import Decimal
from accounting.models import Account, AccountType, JournalItem

class FinanceService:
    @staticmethod
    def _get_account_balance(account, start_date=None, end_date=None):
        """
        Calculates the balance of an account for a given period or point in time.
        For Balance Sheet accounts (ASSET, LIABILITY, EQUITY), we usually want the accumulated balance up to end_date.
        For P&L accounts (INCOME, EXPENSE), we want the movement between start_date and end_date.
        """
        filters = Q(entry__state='POSTED')
        
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
        Supports comparison periods if comp_start and comp_end are provided.
        """
        from accounting.models import CFCategory
        
        is_report = FinanceService.get_income_statement(start_date, end_date)
        net_income = is_report['net_income']
        
        # Get comparison net income if comparison dates provided
        net_income_comp = 0
        if comp_start and comp_end:
            is_report_comp = FinanceService.get_income_statement(comp_start, comp_end)
            net_income_comp = is_report_comp['net_income']
        
        operating_activities = [{'name': 'Utilidad Neta', 'amount': net_income, 'amount_comp': net_income_comp}]
        
        # 1. Non-Cash Adjustments
        dep_accs = Account.objects.filter(cf_category=CFCategory.DEP_AMORT)
        for acc in dep_accs:
            val = float(FinanceService._get_account_balance(acc, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_account_balance(acc, comp_start, comp_end))
            if val != 0 or val_comp != 0:
                operating_activities.append({'name': f"Más: {acc.name}", 'amount': val, 'amount_comp': val_comp})

        # 2. Operating activities (WC Changes)
        op_accs = [acc for acc in Account.objects.filter(cf_category=CFCategory.OPERATING)]
        # Filter to only 'Mapping Roots' to avoid double counting
        op_roots = []
        for acc in op_accs:
            # Manual fallback to find mapping roots
            has_parent_mapped = False
            curr = acc.parent
            while curr:
                if curr.cf_category == CFCategory.OPERATING:
                    has_parent_mapped = True
                    break
                curr = curr.parent
            if not has_parent_mapped:
                op_roots.append(acc)

        for acc in op_roots:
            val = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.OPERATING, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.OPERATING, comp_start, comp_end))
            if val != 0 or val_comp != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                operating_activities.append({'name': f"Cambio en {acc.name}", 'amount': amount, 'amount_comp': amount_comp})

        total_operating = sum(item['amount'] for item in operating_activities)
        total_operating_comp = sum(item.get('amount_comp', 0) for item in operating_activities)

        # 3. Investing Activities
        investing_activities = []
        inv_roots = []
        all_inv = Account.objects.filter(cf_category=CFCategory.INVESTING)
        for acc in all_inv:
            has_parent = False
            curr = acc.parent
            while curr:
                if curr.cf_category == CFCategory.INVESTING:
                    has_parent = True
                    break
                curr = curr.parent
            if not has_parent:
                inv_roots.append(acc)

        for acc in inv_roots:
            val = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.INVESTING, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.INVESTING, comp_start, comp_end))
            if val != 0 or val_comp != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                investing_activities.append({'name': f"Cambio en {acc.name}", 'amount': amount, 'amount_comp': amount_comp})
        total_investing = sum(item['amount'] for item in investing_activities)
        total_investing_comp = sum(item.get('amount_comp', 0) for item in investing_activities)

        # 4. Financing Activities
        financing_activities = []
        fin_roots = []
        all_fin = Account.objects.filter(cf_category=CFCategory.FINANCING)
        for acc in all_fin:
            has_parent = False
            curr = acc.parent
            while curr:
                if curr.cf_category == CFCategory.FINANCING:
                    has_parent = True
                    break
                curr = curr.parent
            if not has_parent:
                fin_roots.append(acc)

        for acc in fin_roots:
            val = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.FINANCING, start_date, end_date))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(FinanceService._get_aggregated_balance(acc, 'cf', CFCategory.FINANCING, comp_start, comp_end))
            if val != 0 or val_comp != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                financing_activities.append({'name': f"Cambio en {acc.name}", 'amount': amount, 'amount_comp': amount_comp})
        total_financing = sum(item['amount'] for item in financing_activities)
        total_financing_comp = sum(item.get('amount_comp', 0) for item in financing_activities)

        net_increase = total_operating + total_investing + total_financing
        net_increase_comp = total_operating_comp + total_investing_comp + total_financing_comp

        return {
            'operating': operating_activities,
            'total_operating': total_operating,
            'total_operating_comp': total_operating_comp,
            'investing': investing_activities,
            'total_investing': total_investing,
            'total_investing_comp': total_investing_comp,
            'financing': financing_activities,
            'total_financing': total_financing,
            'total_financing_comp': total_financing_comp,
            'net_increase': net_increase,
            'net_increase_comp': net_increase_comp
        }
