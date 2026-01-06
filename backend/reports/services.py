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
        Returns the Income Statement structure.
        """
        income = Account.objects.filter(account_type=AccountType.INCOME)
        income_tree = ReportService.build_account_tree(income, start_date, end_date, comp_start, comp_end)
        total_income = sum(node['balance'] for node in income_tree)
        total_income_comp = sum(node['comp_balance'] for node in income_tree)

        expenses = Account.objects.filter(account_type=AccountType.EXPENSE)
        expense_tree = ReportService.build_account_tree(expenses, start_date, end_date, comp_start, comp_end)
        total_expenses = sum(node['balance'] for node in expense_tree)
        total_expenses_comp = sum(node['comp_balance'] for node in expense_tree)

        return {
            'income': income_tree,
            'total_income': total_income,
            'total_income_comp': total_income_comp,
            'expenses': expense_tree,
            'total_expenses': total_expenses,
            'total_expenses_comp': total_expenses_comp,
            'net_income': total_income - total_expenses,
            'net_income_comp': total_income_comp - total_expenses_comp,
            'net_income_variance': (total_income - total_expenses) - (total_income_comp - total_expenses_comp)
        }

    @staticmethod
    def get_cash_flow(start_date, end_date):
        """
        Returns Cash Flow Statement (Indirect Method).
        """
        # 1. Operating Activities
        # Net Income
        pnl = ReportService.get_income_statement(start_date, end_date)
        net_income = pnl['net_income']
        
        operating_activities = []
        operating_activities.append({'name': 'Utilidad Neta', 'amount': net_income})
        
        # Adjustments for Non-Cash items (Depreciation)
        # Assuming we look for Expense accounts with "Depreciación" in name for now?
        # A more robust way would be a tag or specific account types.
        depreciation = 0
        # Iterate expenses to find depreciation
        def find_depreciation(nodes):
            total = 0
            for node in nodes:
                if 'depreciaci' in node['name'].lower():
                    # Add back depreciation (Exp is positive in P&L structure usually, but here balance returned is positive for Expense type)
                    # Expense reduces Net Income. To add it back, we take the positive expense amount.
                    # Wait, our _get_account_balance returns positive for Expense.
                    # So we just add it.
                    # HOWEVER, we need to be careful not to double count if we iterate tree which sums parents.
                    # We should look at leaf nodes or flatten list.
                    # Simplification: Query DB directly for accounts with name.
                    pass
                # But 'node' has the balance for the period.
            return total

        depreciation_accs = Account.objects.filter(
            account_type=AccountType.EXPENSE, 
            name__icontains='Depreciaci'
        )
        for acc in depreciation_accs:
            val = ReportService._get_account_balance(acc, start_date, end_date)
            if val > 0:
                depreciation += float(val)
                operating_activities.append({'name': f"Más: {acc.name}", 'amount': float(val)})

        # Changes in Working Capital (Receivables, Inventory, Payables)
        # We need the DELTA between start and end date (or previous end date vs current end date?)
        # For Cash Flow per period: Delta = Balance(End) - Balance(Start-1)
        # Essentially the movement during the period.
        
        # (Increase) in Assets -> Negative Cash
        # Increase in Liabilities -> Positive Cash
        
        # Receivables (Asset)
        receivables_acc = Account.objects.filter(code__startswith='1.1.02') # Standard IFRS simplified
        receivables_delta = 0
        for acc in receivables_acc:
             # Movement for the period is what we want?
             # _get_account_balance with start/end returns the net movement for Assets.
             # e.g. Debit (increase) 100, Credit (payed) 80 -> Net 20 increase.
             # Increase in Asset = Use of Cash -.
             val = ReportService._get_account_balance(acc, start_date, end_date)
             receivables_delta += float(val)
        
        if receivables_delta != 0:
            # If Assets increased (positive val), cash decreased (negative)
            operating_activities.append({'name': '(Aumento) Disminución Cuentas por Cobrar', 'amount': -receivables_delta})

        # Inventory (Asset)
        inventory_acc = Account.objects.filter(code__startswith='1.1.03')
        inventory_delta = 0
        for acc in inventory_acc:
             val = ReportService._get_account_balance(acc, start_date, end_date)
             inventory_delta += float(val)
             
        if inventory_delta != 0:
            operating_activities.append({'name': '(Aumento) Disminución Inventarios', 'amount': -inventory_delta})

        # Payables (Liability)
        payables_acc = Account.objects.filter(code__startswith='2.1.01')
        payables_delta = 0
        for acc in payables_acc:
             # Liability: Credit increase (positive val in our helper)
             # Increase in Liability = Source of Cash +.
             val = ReportService._get_account_balance(acc, start_date, end_date)
             payables_delta += float(val)
             
        if payables_delta != 0:
             operating_activities.append({'name': 'Aumento (Disminución) Proveedores', 'amount': payables_delta})
             
        # Taxes Payable
        tax_acc = Account.objects.filter(code__startswith='2.1.02')
        tax_delta = 0
        for acc in tax_acc:
             val = ReportService._get_account_balance(acc, start_date, end_date)
             tax_delta += float(val)
        if tax_delta != 0:
             operating_activities.append({'name': 'Aumento (Disminución) Impuestos', 'amount': tax_delta})


        total_operating = sum(item['amount'] for item in operating_activities)

        # 2. Investing Activities
        investing_activities = []
        # Purchase of Property, Plant, Equipment (Non-Current Assets)
        # Prefix 1.2 usually
        ppe_acc = Account.objects.filter(code__startswith='1.2')
        ppe_delta = 0
        for acc in ppe_acc:
            val = ReportService._get_account_balance(acc, start_date, end_date)
            ppe_delta += float(val)
        
        if ppe_delta != 0:
            # Asset Increase (Purchase) -> Cash Outflow
            investing_activities.append({'name': 'Compra de Propiedad y Equipo', 'amount': -ppe_delta})
            
        total_investing = sum(item['amount'] for item in investing_activities)

        # 3. Financing Activities
        financing_activities = []
        # Long Term Debt (2.2) + Equity (3.1 Capital) - Dividends
        loans_acc = Account.objects.filter(code__startswith='2.2')
        loans_delta = 0
        for acc in loans_acc:
            val = ReportService._get_account_balance(acc, start_date, end_date)
            loans_delta += float(val)
        
        if loans_delta != 0:
             financing_activities.append({'name': 'Préstamos a Largo Plazo', 'amount': loans_delta})

        capital_acc = Account.objects.filter(code__startswith='3.1')
        capital_delta = 0
        for acc in capital_acc:
            val = ReportService._get_account_balance(acc, start_date, end_date)
            capital_delta += float(val)
            
        if capital_delta != 0:
             financing_activities.append({'name': 'Aportes de Capital', 'amount': capital_delta})

        total_financing = sum(item['amount'] for item in financing_activities)

        net_cash_flow = total_operating + total_investing + total_financing

        return {
            'operating': operating_activities,
            'total_operating': total_operating,
            'investing': investing_activities,
            'total_investing': total_investing,
            'financing': financing_activities,
            'total_financing': total_financing,
            'net_cash_flow': net_cash_flow
        }
