from django.db.models import Sum, Q
from decimal import Decimal
from accounting.models import Account, AccountType, JournalItem

class ReportService:
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
    def build_account_tree(accounts, start_date=None, end_date=None, comp_start=None, comp_end=None):
        """
        Builds a hierarchical tree of accounts with their balances.
        Supports comparison if comp_start/comp_end are provided.
        """
        tree = []
        
        def process_account(account):
            balance = ReportService._get_account_balance(account, start_date, end_date)
            comp_balance = 0
            if comp_end:
                comp_balance = ReportService._get_account_balance(account, comp_start, comp_end)
            
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
            children = account.children.all().order_by('code')
            for child in children:
                child_node = process_account(child)
                node['children'].append(child_node)
                node['balance'] += child_node['balance']
                node['comp_balance'] += child_node['comp_balance']
                node['variance'] += child_node['variance']
                
            return node

        # Start with top-level accounts (no parent)
        for account in accounts.filter(parent__isnull=True).order_by('code'):
            tree.append(process_account(account))
            
        return tree

    @staticmethod
    def get_balance_sheet(end_date, start_date=None, comp_end=None, comp_start=None):
        """
        Returns the Balance Sheet structure.
        """
        # Assets
        assets = Account.objects.filter(account_type=AccountType.ASSET)
        asset_tree = ReportService.build_account_tree(assets, end_date=end_date, comp_start=comp_start, comp_end=comp_end)
        total_assets = sum(node['balance'] for node in asset_tree)
        total_assets_comp = sum(node['comp_balance'] for node in asset_tree)

        # Liabilities
        liabilities = Account.objects.filter(account_type=AccountType.LIABILITY)
        liability_tree = ReportService.build_account_tree(liabilities, end_date=end_date, comp_start=comp_start, comp_end=comp_end)
        total_liabilities = sum(node['balance'] for node in liability_tree)
        total_liabilities_comp = sum(node['comp_balance'] for node in liability_tree)

        # Equity
        equity = Account.objects.filter(account_type=AccountType.EQUITY)
        equity_tree = ReportService.build_account_tree(equity, end_date=end_date, comp_start=comp_start, comp_end=comp_end)
        
        # Calculate Current Year Earnings (Net Income)
        if not start_date:
            start_date = end_date.replace(month=1, day=1)
            
        income_accs = Account.objects.filter(account_type=AccountType.INCOME)
        expense_accs = Account.objects.filter(account_type=AccountType.EXPENSE)
        
        def get_earnings(s_date, e_date):
            t_income = 0
            for acc in income_accs:
                t_income += float(ReportService._get_account_balance(acc, start_date=s_date, end_date=e_date))
            t_expenses = 0
            for acc in expense_accs:
                t_expenses += float(ReportService._get_account_balance(acc, start_date=s_date, end_date=e_date))
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
            accounts = Account.objects.filter(is_category=cat)
            tree = ReportService.build_account_tree(accounts, start_date, end_date, comp_start, comp_end)
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
    def get_cash_flow(start_date, end_date):
        """
        Returns Cash Flow Statement (Indirect Method) using CFCategory mapping.
        """
        from accounting.models import CFCategory
        
        is_report = ReportService.get_income_statement(start_date, end_date)
        net_income = is_report['net_income']
        
        operating_activities = [{'name': 'Utilidad Neta', 'amount': net_income}]
        
        # 1. Non-Cash Adjustments
        dep_accs = Account.objects.filter(cf_category=CFCategory.DEP_AMORT)
        for acc in dep_accs:
            val = float(ReportService._get_account_balance(acc, start_date, end_date))
            if val != 0:
                operating_activities.append({'name': f"Más: {acc.name}", 'amount': val})

        # 2. Operating activities (WC Changes)
        op_accs = Account.objects.filter(cf_category=CFCategory.OPERATING)
        for acc in op_accs:
            val = float(ReportService._get_account_balance(acc, start_date, end_date))
            if val != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                operating_activities.append({'name': f"Cambio en {acc.name}", 'amount': amount})

        total_operating = sum(item['amount'] for item in operating_activities)

        # 3. Investing Activities
        investing_activities = []
        inv_accs = Account.objects.filter(cf_category=CFCategory.INVESTING)
        for acc in inv_accs:
            val = float(ReportService._get_account_balance(acc, start_date, end_date))
            if val != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                investing_activities.append({'name': f"Cambio en {acc.name}", 'amount': amount})
        total_investing = sum(item['amount'] for item in investing_activities)

        # 4. Financing Activities
        financing_activities = []
        fin_accs = Account.objects.filter(cf_category=CFCategory.FINANCING)
        for acc in fin_accs:
            val = float(ReportService._get_account_balance(acc, start_date, end_date))
            if val != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                financing_activities.append({'name': f"Cambio en {acc.name}", 'amount': amount})
        total_financing = sum(item['amount'] for item in financing_activities)

        return {
            'operating': operating_activities,
            'total_operating': total_operating,
            'investing': investing_activities,
            'total_investing': total_investing,
            'financing': financing_activities,
            'total_financing': total_financing,
            'net_increase': total_operating + total_investing + total_financing
        }
