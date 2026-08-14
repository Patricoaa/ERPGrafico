import datetime
from decimal import Decimal

from django.db.models import Q, Sum

from accounting.models import Account, AccountType, JournalEntry, JournalItem

MAPPING_TYPE_MAP = {"is": "is_category", "cf": "cf_category", "bs": "bs_category"}

def _load_account_chart(accounts_qs=None):
    """Carga el plan de cuentas (1 query) y construye índices en memoria."""
    from accounting.models import Account as _ChartAccount

    qs = accounts_qs if accounts_qs is not None else _ChartAccount.objects.all()
    accounts = list(qs)
    by_id = {acc.id: acc for acc in accounts}
    children = {}
    for acc in accounts:
        children.setdefault(acc.parent_id, []).append(acc)
    for acc_list in children.values():
        acc_list.sort(key=lambda acc: acc.code)
    return by_id, children


def _item_balances_by_account(account_ids, start_date=None, end_date=None):
    """Totales debit/credit por cuenta (1 query; statuses balance_affecting)."""
    qs = JournalItem.objects.filter(
        entry__status__in=JournalEntry.balance_affecting_statuses(),
        account_id__in=account_ids,
    )
    if end_date:
        qs = qs.filter(entry__date__lte=end_date)
    if start_date:
        qs = qs.filter(entry__date__gte=start_date)
    rows = qs.values("account_id").annotate(d=Sum("debit"), c=Sum("credit"))
    return {
        row["account_id"]: (row["d"] or Decimal("0.00"), row["c"] or Decimal("0.00"))
        for row in rows
    }


def _leaf_balance_map(by_id, start_date=None, end_date=None):
    """Balance propio por cuenta (sin agregar descendientes). 1-2 queries."""
    ids = list(by_id)
    to_end = _item_balances_by_account(ids, end_date=end_date)
    before = {}
    if start_date:
        pnl_ids = [
            acc_id
            for acc_id, acc in by_id.items()
            if acc.account_type in (AccountType.INCOME, AccountType.EXPENSE)
        ]
        before = _item_balances_by_account(
            pnl_ids, end_date=start_date - datetime.timedelta(days=1)
        )
    balances = {}
    for acc_id, acc in by_id.items():
        d, c = to_end.get(acc_id, (Decimal("0.00"), Decimal("0.00")))
        if acc.account_type in (AccountType.INCOME, AccountType.EXPENSE) and start_date:
            pre_d, pre_c = before.get(acc_id, (Decimal("0.00"), Decimal("0.00")))
            d, c = d - pre_d, c - pre_c
        if acc.account_type in (AccountType.ASSET, AccountType.EXPENSE):
            balances[acc_id] = d - c
        else:
            balances[acc_id] = c - d
    return balances


def _make_category_resolver(by_id, report_type, fiscal_year_id=None):
    """Resuelve la categoría efectiva por cuenta sin queries (vivo o fiscal).

    Modo vivo: hereda del ancestro más cercano con categoría propia (como las
    properties `effective_*_category`). Modo fiscal: solo el mapeo propio de la
    cuenta (sin herencia), igual que `_resolve_category` con fiscal_year_id.
    """
    field = MAPPING_TYPE_MAP[report_type]
    fy_map = None
    if fiscal_year_id is not None:
        from accounting.models import FiscalYearAccountMapping

        fy_map = {
            mapping.account_id: getattr(mapping, field)
            for mapping in FiscalYearAccountMapping.objects.filter(
                fiscal_year_id=fiscal_year_id
            )
        }
    cache = {}

    def resolve(account_id):
        if account_id in cache:
            return cache[account_id]
        if fy_map is not None:
            cache[account_id] = fy_map.get(account_id)
            return cache[account_id]
        value = None
        acc = by_id.get(account_id)
        while acc:
            own = getattr(acc, field, None)
            if own:
                value = own
                break
            acc = by_id.get(acc.parent_id)
        cache[account_id] = value
        return value

    return resolve


def _make_aggregator(by_id, children, leaf_balances, category_resolve=None):
    """Devuelve agg(account_id, category_type, category_value) memoizado (0 queries).

    Semántica idéntica a `_get_aggregated_balance`: en hojas suma el balance
    propio (filtrado por categoría si `category_type`); en grupos suma el
    agregado de sus hijos. Pase único en memoria: Θ(n) como peor caso de tiempo
    con la caché, sin round-trips a la BD.
    """
    cache = {}

    def agg(account_id, category_type, category_value):
        key = (account_id, category_type, category_value)
        if key in cache:
            return cache[key]
        child_ids = children.get(account_id) or []
        if child_ids:
            total = Decimal("0.00")
            for child in child_ids:
                total += agg(child.id, category_type, category_value)
        else:
            total = leaf_balances.get(account_id, Decimal("0.00"))
            if category_type and category_resolve is not None:
                if category_resolve(account_id) != category_value:
                    total = Decimal("0.00")
        cache[key] = total
        return total

    return agg



class FinanceService:
    @staticmethod
    def _get_account_balance(account, start_date=None, end_date=None):
        """
        Calculates the balance of an account for a given period or point in time.
        For Balance Sheet accounts (ASSET, LIABILITY, EQUITY), we usually want the accumulated balance up to end_date.
        For P&L accounts (INCOME, EXPENSE), we want the movement between start_date and end_date.
        """
        filters = Q(entry__status__in=JournalEntry.balance_affecting_statuses())

        if end_date:
            filters &= Q(entry__date__lte=end_date)

        if start_date and account.account_type in [AccountType.INCOME, AccountType.EXPENSE]:
            filters &= Q(entry__date__gte=start_date)

        qs = JournalItem.objects.filter(account=account).filter(filters)

        result = qs.aggregate(debit=Sum("debit"), credit=Sum("credit"))

        debit = result["debit"] or Decimal("0.00")
        credit = result["credit"] or Decimal("0.00")

        # Determine sign based on account type
        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return debit - credit
        else:
            return credit - debit

    @staticmethod
    def _resolve_category(account, report_type, fiscal_year_id=None):
        """Resuelve la categoría de reporte para una cuenta.

        Si fiscal_year_id se provee, consulta el snapshot histórico.
        Si no, usa el valor efectivo vivo (con herencia del padre).
        """
        if fiscal_year_id is not None:
            from accounting.models import FiscalYearAccountMapping
            try:
                mapping = FiscalYearAccountMapping.objects.get(
                    fiscal_year_id=fiscal_year_id, account=account
                )
                return getattr(mapping, MAPPING_TYPE_MAP[report_type])
            except FiscalYearAccountMapping.DoesNotExist:
                return None
        return getattr(account, f"effective_{report_type}_category")

    @staticmethod
    def _get_accounts_by_cf_category(category_value, fiscal_year_id=None):
        """Retorna cuentas con la cf_category indicada, viva o histórica."""
        if fiscal_year_id is not None:
            from accounting.models import FiscalYearAccountMapping
            account_ids = FiscalYearAccountMapping.objects.filter(
                fiscal_year_id=fiscal_year_id, cf_category=category_value
            ).values_list("account_id", flat=True)
            return Account.objects.filter(id__in=account_ids)
        return Account.objects.filter(cf_category=category_value)

    @staticmethod
    def _get_aggregated_balance(
        account, category_type=None, category_value=None, start_date=None, end_date=None,
        fiscal_year_id=None,
    ):
        """
        Calculates balance including descendants.
        If category_type is provided, ONLY adds up accounts that resolve to category_value.
        If category_type is NOT provided, adds up all descendants.
        """
        by_id, children = _load_account_chart()
        balances = _leaf_balance_map(by_id, start_date=start_date, end_date=end_date)
        resolver = (
            _make_category_resolver(by_id, category_type, fiscal_year_id)
            if category_type
            else None
        )
        agg = _make_aggregator(by_id, children, balances, resolver)
        return agg(account.id, category_type, category_value)

    @staticmethod
    def build_account_tree(
        accounts,
        category_type=None,
        category_value=None,
        start_date=None,
        end_date=None,
        comp_start=None,
        comp_end=None,
        fiscal_year_id=None,
        _chart=None,
        _balances=None,
        _comp_balances=None,
        _category_resolve=None,
    ):
        """
        Builds a hierarchical tree of accounts.
        If category_type/value are provided, filters/maps by category.
        Otherwise, uses the natural hierarchy of 'accounts'.

        Parámetros internos `_chart`/`_balances`/`_comp_balances`/`_category_resolve`
        permiten a los reportes precalcular el plan de cuentas y los balances
        agregados UNA vez y reutilizarlos en las 3-6 llamadas de build_account_tree
        que hacen (mapa de complejidad: "reportes reutilizan balances preagregados").
        """
        if _chart is None:
            by_id, children = _load_account_chart()
        else:
            by_id, children = _chart

        if _balances is None:
            leaf_balances = _leaf_balance_map(by_id, start_date=start_date, end_date=end_date)
        else:
            leaf_balances = _balances

        if _comp_balances is None:
            comp_balances = (
                _leaf_balance_map(by_id, start_date=comp_start, end_date=comp_end)
                if comp_end
                else {}
            )
        else:
            comp_balances = _comp_balances

        if _category_resolve is None:
            category_resolve = (
                _make_category_resolver(by_id, category_type, fiscal_year_id)
                if category_type
                else None
            )
        else:
            category_resolve = _category_resolve

        agg = _make_aggregator(by_id, children, leaf_balances, category_resolve)
        agg_comp = _make_aggregator(by_id, children, comp_balances, category_resolve)

        def process_account(account):
            balance = agg(account.id, category_type, category_value)
            comp_balance = Decimal("0.00")
            if comp_end:
                comp_balance = agg_comp(account.id, category_type, category_value)

            node = {
                "id": account.id,
                "code": account.code,
                "name": account.name,
                "type": account.account_type,
                "balance": float(balance),
                "comp_balance": float(comp_balance),
                "variance": float(balance - comp_balance),
                "children": [],
            }

            for child in children.get(account.id) or []:
                # In category mode, only include if child or descendants are in category
                if category_type:
                    child_balance = agg(child.id, category_type, category_value)
                    explicit_cat = category_resolve(child.id)

                    if child_balance != 0 or (explicit_cat == category_value):
                        if explicit_cat and explicit_cat != category_value:
                            continue
                        node["children"].append(process_account(child))
                else:
                    # In normal mode (Balance Sheet), only include if there's a balance or comparison balance
                    b = agg(child.id, None, None)
                    cb = Decimal("0.00")
                    if comp_end:
                        cb = agg_comp(child.id, None, None)

                    if b != 0 or cb != 0:
                        node["children"].append(process_account(child))

            return node

        if category_type:
            if fiscal_year_id is not None:
                from accounting.models import FiscalYearAccountMapping
                cat_field = MAPPING_TYPE_MAP[category_type]
                account_ids = FiscalYearAccountMapping.objects.filter(
                    fiscal_year_id=fiscal_year_id, **{cat_field: category_value}
                ).values_list("account_id", flat=True)
                all_in_cat = accounts.filter(id__in=account_ids)
            else:
                field = MAPPING_TYPE_MAP[category_type]
                all_in_cat = accounts.filter(**{field: category_value})

            start_accounts = []
            for acc in all_in_cat:
                has_parent_mapped_same = False
                curr_id = acc.parent_id
                while curr_id:
                    curr_acc = by_id.get(curr_id)
                    if curr_acc is None:
                        break
                    if category_resolve(curr_id) == category_value:
                        has_parent_mapped_same = True
                        break
                    curr_id = curr_acc.parent_id
                if not has_parent_mapped_same:
                    start_accounts.append(acc)
        else:
            # BS Mode: Top-level accounts in this set
            start_accounts = accounts.filter(parent__isnull=True)

        tree = []
        for account in sorted(start_accounts, key=lambda x: x.code):
            tree.append(process_account(account))

        return tree

    @staticmethod
    def get_balance_sheet(end_date, start_date=None, comp_end=None, comp_start=None, fiscal_year_id=None):
        """
        Returns the Balance Sheet structure.
        """
        by_id, children = _load_account_chart()
        balances = _leaf_balance_map(by_id, end_date=end_date)
        comp_balances = (
            _leaf_balance_map(by_id, start_date=comp_start, end_date=comp_end)
            if comp_end
            else {}
        )

        # Assets
        assets = Account.objects.filter(account_type=AccountType.ASSET)
        asset_tree = FinanceService.build_account_tree(
            assets, end_date=end_date, comp_start=comp_start, comp_end=comp_end,
            fiscal_year_id=fiscal_year_id,
            _chart=(by_id, children), _balances=balances, _comp_balances=comp_balances,
        )
        total_assets = sum(node["balance"] for node in asset_tree)
        total_assets_comp = sum(node["comp_balance"] for node in asset_tree)

        # Liabilities
        liabilities = Account.objects.filter(account_type=AccountType.LIABILITY)
        liability_tree = FinanceService.build_account_tree(
            liabilities, end_date=end_date, comp_start=comp_start, comp_end=comp_end,
            fiscal_year_id=fiscal_year_id,
            _chart=(by_id, children), _balances=balances, _comp_balances=comp_balances,
        )
        total_liabilities = sum(node["balance"] for node in liability_tree)
        total_liabilities_comp = sum(node["comp_balance"] for node in liability_tree)

        # Equity
        equity = Account.objects.filter(account_type=AccountType.EQUITY)
        equity_tree = FinanceService.build_account_tree(
            equity, end_date=end_date, comp_start=comp_start, comp_end=comp_end,
            fiscal_year_id=fiscal_year_id,
            _chart=(by_id, children), _balances=balances, _comp_balances=comp_balances,
        )

        # Calculate Current Year Earnings (Net Income)
        if not start_date:
            start_date = end_date.replace(month=1, day=1)

        earn_map = _leaf_balance_map(by_id, start_date=start_date, end_date=end_date)
        earn_comp_map = (
            _leaf_balance_map(by_id, start_date=comp_start, end_date=comp_end)
            if comp_end
            else {}
        )

        def get_earnings(s_date, e_date, leaf_map):
            t_income = 0
            t_expenses = 0
            for acc_id, acc in by_id.items():
                if acc.account_type == AccountType.INCOME:
                    t_income += float(leaf_map.get(acc_id, Decimal("0.00")))
                elif acc.account_type == AccountType.EXPENSE:
                    t_expenses += float(leaf_map.get(acc_id, Decimal("0.00")))
            return t_income - t_expenses

        current_earnings = get_earnings(start_date, end_date, earn_map)
        comp_earnings = 0
        if comp_end:
            if not comp_start:
                comp_start = comp_end.replace(month=1, day=1)
            comp_earnings = get_earnings(comp_start, comp_end, earn_comp_map)

        # Append "Resultado del Ejercicio" to Equity Tree artificially
        equity_tree.append(
            {
                "id": "computed-earnings",
                "code": "",
                "name": "Resultado del Ejercicio (Calculado)",
                "type": "EQUITY",
                "balance": current_earnings,
                "comp_balance": comp_earnings,
                "variance": current_earnings - comp_earnings,
                "children": [],
            }
        )

        total_equity = sum(node["balance"] for node in equity_tree)
        total_equity_comp = sum(node["comp_balance"] for node in equity_tree)

        return {
            "assets": asset_tree,
            "total_assets": total_assets,
            "total_assets_comp": total_assets_comp,
            "liabilities": liability_tree,
            "total_liabilities": total_liabilities,
            "total_liabilities_comp": total_liabilities_comp,
            "equity": equity_tree,
            "total_equity": total_equity,
            "total_equity_comp": total_equity_comp,
            "check": total_assets - (total_liabilities + total_equity),
            "check_comp": total_assets_comp - (total_liabilities_comp + total_equity_comp),
        }

    @staticmethod
    def get_income_statement(start_date, end_date, comp_start=None, comp_end=None, fiscal_year_id=None):
        """
        Returns a structured Income Statement based on ISCategory mapping.
        """
        from accounting.models import ISCategory

        by_id, children = _load_account_chart()
        balances = _leaf_balance_map(by_id, start_date=start_date, end_date=end_date)
        comp_balances = (
            _leaf_balance_map(by_id, start_date=comp_start, end_date=comp_end)
            if comp_end
            else {}
        )
        category_resolve = _make_category_resolver(by_id, "is", fiscal_year_id)

        def get_cat_data(cat):
            accounts = Account.objects.all()  # We need all to find mapping roots
            tree = FinanceService.build_account_tree(
                accounts, "is", cat, start_date, end_date, comp_start, comp_end,
                fiscal_year_id=fiscal_year_id,
                _chart=(by_id, children), _balances=balances,
                _comp_balances=comp_balances, _category_resolve=category_resolve,
            )
            total = sum(item["balance"] for item in tree)
            total_comp = sum(item["comp_balance"] for item in tree)
            return tree, float(total), float(total_comp)

        revenue_tree, total_rev, total_rev_comp = get_cat_data(ISCategory.REVENUE)
        cogs_tree, total_cogs, total_cogs_comp = get_cat_data(ISCategory.COST_OF_SALES)
        opex_tree, total_opex, total_opex_comp = get_cat_data(ISCategory.OPERATING_EXPENSE)
        non_rev_tree, total_non_rev, total_non_rev_comp = get_cat_data(
            ISCategory.NON_OPERATING_REVENUE
        )
        non_exp_tree, total_non_exp, total_non_exp_comp = get_cat_data(
            ISCategory.NON_OPERATING_EXPENSE
        )
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
            "sections": [
                {
                    "name": "Ingresos Operacionales",
                    "tree": revenue_tree,
                    "total": total_rev,
                    "total_comp": total_rev_comp,
                },
                {
                    "name": "Costo de Ventas",
                    "tree": cogs_tree,
                    "total": total_cogs,
                    "total_comp": total_cogs_comp,
                },
                {
                    "name": "Resultado Bruto",
                    "is_total": True,
                    "total": gross_result,
                    "total_comp": gross_result_comp,
                },
                {
                    "name": "Gastos Operacionales",
                    "tree": opex_tree,
                    "total": total_opex,
                    "total_comp": total_opex_comp,
                },
                {
                    "name": "Resultado Operacional",
                    "is_total": True,
                    "total": operating_result,
                    "total_comp": operating_result_comp,
                },
                {
                    "name": "Ingresos No Operacionales",
                    "tree": non_rev_tree,
                    "total": total_non_rev,
                    "total_comp": total_non_rev_comp,
                },
                {
                    "name": "Gastos No Operacionales",
                    "tree": non_exp_tree,
                    "total": total_non_exp,
                    "total_comp": total_non_exp_comp,
                },
                {
                    "name": "Resultado No Operacional",
                    "is_total": True,
                    "total": non_operating_result,
                    "total_comp": non_operating_result_comp,
                },
                {
                    "name": "Utilidad Antes de Impuestos",
                    "is_total": True,
                    "total": ebt,
                    "total_comp": ebt_comp,
                },
                {
                    "name": "Impuesto a la Renta",
                    "tree": tax_tree,
                    "total": total_tax,
                    "total_comp": total_tax_comp,
                },
                {
                    "name": "Utilidad Neta",
                    "is_total": True,
                    "total": net_income,
                    "total_comp": net_income_comp,
                },
            ],
            "net_income": net_income,
            "net_income_comp": net_income_comp,
        }

    @staticmethod
    def get_cash_flow(start_date, end_date, comp_start=None, comp_end=None, fiscal_year_id=None):
        """
        Returns Cash Flow Statement (Indirect Method) using CFCategory mapping.
        Integrates with Treasury (1.1.01 prefix) for baseline reconciliation.
        """
        from decimal import Decimal

        from accounting.models import Account, AccountType, CFCategory

        by_id, children = _load_account_chart()
        balances = _leaf_balance_map(by_id, start_date=start_date, end_date=end_date)
        comp_balances = (
            _leaf_balance_map(by_id, start_date=comp_start, end_date=comp_end)
            if comp_end
            else {}
        )
        category_resolve = _make_category_resolver(by_id, "cf", fiscal_year_id)

        # 0. Identify Cash Pool (The source of truth for liquid assets)
        cash_pool_accs = Account.get_cash_pool_accounts()
        cash_pool_ids = set(cash_pool_accs.values_list("id", flat=True))

        def get_pool_balance(date):
            if not date:
                return Decimal("0")
            pool_map = _leaf_balance_map(by_id, end_date=date)
            total = Decimal("0")
            for acc_id in cash_pool_ids:
                total += pool_map.get(acc_id, Decimal("0"))
            return total

        # Baseline Balances
        beginning_cash = get_pool_balance(start_date)
        ending_cash = get_pool_balance(end_date)
        actual_net_increase = ending_cash - beginning_cash

        # Comparison Baseline
        beginning_cash_comp = Decimal("0")
        ending_cash_comp = Decimal("0")
        if comp_start and comp_end:
            beginning_cash_comp = get_pool_balance(comp_start)
            ending_cash_comp = get_pool_balance(comp_end)

        actual_net_increase_comp = ending_cash_comp - beginning_cash_comp

        # 1. Activities Calculation (Indirect Method)
        is_report = FinanceService.get_income_statement(start_date, end_date, fiscal_year_id=fiscal_year_id)
        net_income = is_report["net_income"]

        net_income_comp = 0
        if comp_start and comp_end:
            is_report_comp = FinanceService.get_income_statement(comp_start, comp_end, fiscal_year_id=fiscal_year_id)
            net_income_comp = is_report_comp["net_income"]

        operating_activities = [
            {
                "name": "Utilidad Neta",
                "amount": float(net_income),
                "amount_comp": float(net_income_comp),
            }
        ]

        # Adjustments to Net Income (Non-cash)
        dep_accs = FinanceService._get_accounts_by_cf_category(CFCategory.DEP_AMORT, fiscal_year_id)
        for acc in dep_accs:
            val = float(balances.get(acc.id, Decimal("0.00")))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(comp_balances.get(acc.id, Decimal("0.00")))
            if val != 0 or val_comp != 0:
                operating_activities.append(
                    {
                        "name": f"Depreciación/Amortización: {acc.name}",
                        "amount": val,
                        "amount_comp": val_comp,
                    }
                )

        # Working Capital & Other Operating
        agg = _make_aggregator(by_id, children, balances, category_resolve)
        agg_comp = _make_aggregator(by_id, children, comp_balances, category_resolve)

        def _roots_for(category):
            cat_accs = FinanceService._get_accounts_by_cf_category(
                category, fiscal_year_id
            ).exclude(id__in=cash_pool_ids)
            roots = []
            for acc in cat_accs:
                has_parent = False
                curr_id = acc.parent_id
                while curr_id:
                    curr_acc = by_id.get(curr_id)
                    if curr_acc is None:
                        break
                    if category_resolve(curr_id) == category:
                        has_parent = True
                        break
                    curr_id = curr_acc.parent_id
                if not has_parent:
                    roots.append(acc)
            return roots

        def _activity_amounts(category):
            vals = []
            for acc in _roots_for(category):
                val = float(agg(acc.id, "cf", category))
                val_comp = 0
                if comp_start and comp_end:
                    val_comp = float(agg_comp(acc.id, "cf", category))
                if val != 0 or val_comp != 0:
                    vals.append((acc, val, val_comp))
            return vals

        op_accs = FinanceService._get_accounts_by_cf_category(CFCategory.OPERATING, fiscal_year_id).exclude(
            id__in=cash_pool_ids
        )
        op_roots = []
        for acc in op_accs:
            has_parent = False
            curr_id = acc.parent_id
            while curr_id:
                curr_acc = by_id.get(curr_id)
                if curr_acc is None:
                    break
                if category_resolve(curr_id) == CFCategory.OPERATING:
                    has_parent = True
                    break
                curr_id = curr_acc.parent_id
            if not has_parent:
                op_roots.append(acc)

        for acc in op_roots:
            # We use aggregated balance but ensuring we don't include cash pool internals
            val = float(agg(acc.id, "cf", CFCategory.OPERATING))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(agg_comp(acc.id, "cf", CFCategory.OPERATING))

            if val != 0 or val_comp != 0:
                # Assets: Increase is use of cash (-) / Liabilities: Increase is source of cash (+)
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                operating_activities.append(
                    {"name": f"Cambio en {acc.name}", "amount": amount, "amount_comp": amount_comp}
                )

        total_operating = sum(item["amount"] for item in operating_activities)

        # 2. Investing Activities
        investing_activities = []
        inv_accs = FinanceService._get_accounts_by_cf_category(CFCategory.INVESTING, fiscal_year_id).exclude(
            id__in=cash_pool_ids
        )
        inv_roots = []
        for acc in inv_accs:
            has_parent = False
            curr_id = acc.parent_id
            while curr_id:
                curr_acc = by_id.get(curr_id)
                if curr_acc is None:
                    break
                if category_resolve(curr_id) == CFCategory.INVESTING:
                    has_parent = True
                    break
                curr_id = curr_acc.parent_id
            if not has_parent:
                inv_roots.append(acc)

        for acc in inv_roots:
            val = float(agg(acc.id, "cf", CFCategory.INVESTING))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(agg_comp(acc.id, "cf", CFCategory.INVESTING))
            if val != 0 or val_comp != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                investing_activities.append(
                    {
                        "name": f"Actividad de Inversión: {acc.name}",
                        "amount": amount,
                        "amount_comp": amount_comp,
                    }
                )

        total_investing = sum(item["amount"] for item in investing_activities)

        # 3. Financing Activities
        financing_activities = []
        fin_accs = FinanceService._get_accounts_by_cf_category(CFCategory.FINANCING, fiscal_year_id).exclude(
            id__in=cash_pool_ids
        )
        fin_roots = []
        for acc in fin_accs:
            has_parent = False
            curr_id = acc.parent_id
            while curr_id:
                curr_acc = by_id.get(curr_id)
                if curr_acc is None:
                    break
                if category_resolve(curr_id) == CFCategory.FINANCING:
                    has_parent = True
                    break
                curr_id = curr_acc.parent_id
            if not has_parent:
                fin_roots.append(acc)

        for acc in fin_roots:
            val = float(agg(acc.id, "cf", CFCategory.FINANCING))
            val_comp = 0
            if comp_start and comp_end:
                val_comp = float(agg_comp(acc.id, "cf", CFCategory.FINANCING))
            if val != 0 or val_comp != 0:
                amount = -val if acc.account_type == AccountType.ASSET else val
                amount_comp = -val_comp if acc.account_type == AccountType.ASSET else val_comp
                financing_activities.append(
                    {
                        "name": f"Actividad de Financiamiento: {acc.name}",
                        "amount": amount,
                        "amount_comp": amount_comp,
                    }
                )

        total_financing = sum(item["amount"] for item in financing_activities)

        total_operating_comp = sum(item.get("amount_comp", 0) for item in operating_activities)
        total_investing_comp = sum(item.get("amount_comp", 0) for item in investing_activities)
        total_financing_comp = sum(item.get("amount_comp", 0) for item in financing_activities)

        # 4. Reconciliation & Anomaly Detection
        calculated_net_increase = total_operating + total_investing + total_financing
        calculated_net_increase_comp = total_operating_comp + total_investing_comp + total_financing_comp
        discrepancy = float(actual_net_increase) - calculated_net_increase

        culprit_accounts = []
        if abs(discrepancy) > 0.01:
            # Find accounts with movements that are NOT mapped and NOT in cash pool
            if fiscal_year_id is not None:
                from accounting.models import FiscalYearAccountMapping
                mapped_ids = FiscalYearAccountMapping.objects.filter(
                    fiscal_year_id=fiscal_year_id, cf_category__isnull=True
                ).values_list("account_id", flat=True)
                unmapped_accs = Account.objects.filter(id__in=mapped_ids).exclude(
                    pk__in=cash_pool_ids
                ).exclude(account_type__in=[AccountType.INCOME, AccountType.EXPENSE])
            else:
                unmapped_accs = Account.objects.filter(cf_category__isnull=True).exclude(
                    pk__in=cash_pool_ids
                ).exclude(account_type__in=[AccountType.INCOME, AccountType.EXPENSE])
            for acc in unmapped_accs:
                if not acc.is_selectable:
                    continue  # parent accounts logic
                variation = float(balances.get(acc.id, Decimal("0.00")))
                if abs(variation) > 0.01:
                    culprit_accounts.append(
                        {
                            "code": acc.code,
                            "name": acc.name,
                            "variation": variation,
                            "type": acc.account_type,
                        }
                    )

        return {
            "beginning_cash": float(beginning_cash),
            "ending_cash": float(ending_cash),
            "beginning_cash_comp": float(beginning_cash_comp),
            "ending_cash_comp": float(ending_cash_comp),
            "operating": operating_activities,
            "total_operating": total_operating,
            "investing": investing_activities,
            "total_investing": total_investing,
            "financing": financing_activities,
            "total_financing": total_financing,
            "net_increase": float(actual_net_increase),
            "net_increase_comp": float(actual_net_increase_comp),
            "calculated_net_increase": calculated_net_increase,
            "calculated_net_increase_comp": calculated_net_increase_comp,
            "discrepancy": discrepancy,
            "culprit_accounts": culprit_accounts,
            "is_balanced": abs(discrepancy) < 0.01,
        }

    @staticmethod
    def get_financial_analysis(start_date=None, end_date=None, fiscal_year_id=None):
        bs = FinanceService.get_balance_sheet(end_date, start_date, fiscal_year_id=fiscal_year_id)

        total_assets = bs["total_assets"]
        total_liabilities = bs["total_liabilities"]
        total_equity = bs["total_equity"]

        debt_ratio = (total_liabilities / total_assets) if total_assets else 0
        equity_ratio = (total_equity / total_assets) if total_assets else 0
        debt_to_equity = (total_liabilities / total_equity) if total_equity else 0

        # Efficient Category Aggregation to avoid N+1 queries
        filters = Q(entry__status="POSTED")
        if end_date:
            filters &= Q(entry__date__lte=end_date)

        aggregations = (
            JournalItem.objects.filter(filters)
            .values("account_id", "account__account_type")
            .annotate(debit=Sum("debit"), credit=Sum("credit"))
        )

        balances = {}
        for row in aggregations:
            d = row["debit"] or 0
            c = row["credit"] or 0
            if row["account__account_type"] in [AccountType.ASSET, AccountType.EXPENSE]:
                balances[row["account_id"]] = d - c
            else:
                balances[row["account_id"]] = c - d

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
        acid_test = (
            ((current_assets - inventory) / current_liabilities) if current_liabilities else 0
        )
        solvency_ratio = (total_assets / total_liabilities) if total_liabilities else 0

        # Extract income statement totals for margin calculations
        # get_income_statement returns {"sections": [...], "net_income": float}
        # We need to extract revenue/profit from the sections list by name.
        is_res = FinanceService.get_income_statement(start_date, end_date, fiscal_year_id=fiscal_year_id)

        sections_by_name = {s["name"]: s for s in is_res.get("sections", [])}
        total_revenue = sections_by_name.get("Ingresos Operacionales", {}).get("total", 0) or 0
        total_cogs = sections_by_name.get("Costo de Ventas", {}).get("total", 0) or 0
        gross_profit = sections_by_name.get("Resultado Bruto", {}).get("total", total_revenue - total_cogs)
        operating_profit = sections_by_name.get("Resultado Operacional", {}).get("total", 0) or 0
        net_income = is_res.get("net_income", 0) or 0

        # Margin calculations
        gross_margin = (gross_profit / total_revenue) if total_revenue else 0
        operating_margin = (operating_profit / total_revenue) if total_revenue else 0
        net_margin = (net_income / total_revenue) if total_revenue else 0

        return {
            "structure": {
                "total_assets": total_assets,
                "total_liabilities": total_liabilities,
                "total_equity": total_equity,
                "debt_ratio": debt_ratio,
                "equity_ratio": equity_ratio,
                "debt_to_equity": debt_to_equity,
            },
            "liquidity": {
                "current_assets": current_assets,
                "current_liabilities": current_liabilities,
                "current_ratio": current_ratio,
                "acid_test": acid_test,
            },
            "solvency": {"solvency_ratio": solvency_ratio},
            "profitability": {
                "total_revenue": total_revenue,
                "gross_profit": gross_profit,
                "operating_profit": operating_profit,
                "net_income": net_income,
                "gross_margin": gross_margin,
                "operating_margin": operating_margin,
                "net_margin": net_margin,
            },
        }

    @staticmethod
    @staticmethod
    def get_bi_analytics(start_date=None, end_date=None):
        from .bi_analytics import BIAnalyticsService
        return BIAnalyticsService.get_bi_analytics(start_date, end_date)

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
        from datetime import date, datetime
        from decimal import Decimal

        from django.db.models import Sum

        # Parse string dates if necessary
        def to_date(d):
            if not d:
                return None
            if isinstance(d, date):
                return d
            try:
                return datetime.strptime(d, "%Y-%m-%d").date()
            except Exception:
                return None

        start = to_date(start_date)
        end = to_date(end_date)

        # Get accounts that have items to ensure we don't drop balances due to dirty data
        active_accounts = (
            Account.objects.filter(journal_items__isnull=False).distinct().order_by("code")
        )
        active_ids = [acc.id for acc in active_accounts]

        def _collect(qs):
            return {
                row["account_id"]: (row["d"] or Decimal("0.00"), row["c"] or Decimal("0.00"))
                for row in qs.values("account_id")
                .annotate(d=Sum("debit"), c=Sum("credit"))
            }

        base_qs = JournalItem.objects.filter(
            entry__status="POSTED", account_id__in=active_ids
        )
        period_qs = base_qs
        init_qs = JournalItem.objects.none()
        if start:
            period_qs = period_qs.filter(entry__date__gte=start)
            init_qs = base_qs.filter(entry__date__lt=start)
        if end:
            period_qs = period_qs.filter(entry__date__lte=end)

        period_map = _collect(period_qs)
        init_map = _collect(init_qs) if start else {}

        trial_balance = []
        total_global_debit = Decimal("0.00")
        total_global_credit = Decimal("0.00")
        total_saldo_deudor = Decimal("0.00")
        total_saldo_acreedor = Decimal("0.00")

        for account in active_accounts:
            # ---------------------------------------------
            # 1. Movimientos del Período
            # ---------------------------------------------
            p_debit, p_credit = period_map.get(
                account.id, (Decimal("0.00"), Decimal("0.00"))
            )

            # ---------------------------------------------
            # 2. Saldo Inicial
            # ---------------------------------------------
            initial_balance = Decimal("0.00")
            if start:
                i_debit, i_credit = init_map.get(
                    account.id, (Decimal("0.00"), Decimal("0.00"))
                )

                if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                    initial_balance = i_debit - i_credit
                else:
                    initial_balance = i_credit - i_debit

            # ---------------------------------------------
            # 3. Saldo Final y Tipificación Funcional
            # ---------------------------------------------
            if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
                closing_balance = initial_balance + p_debit - p_credit
                saldo_deudor = closing_balance if closing_balance > 0 else Decimal("0.00")
                saldo_acreedor = abs(closing_balance) if closing_balance < 0 else Decimal("0.00")
            else:
                closing_balance = initial_balance + p_credit - p_debit
                saldo_acreedor = closing_balance if closing_balance > 0 else Decimal("0.00")
                saldo_deudor = abs(closing_balance) if closing_balance < 0 else Decimal("0.00")

            # Omite la cuenta si no hay movimientos ni saldos históricos
            if p_debit == 0 and p_credit == 0 and initial_balance == 0:
                continue

            total_global_debit += p_debit
            total_global_credit += p_credit
            total_saldo_deudor += saldo_deudor
            total_saldo_acreedor += saldo_acreedor

            trial_balance.append(
                {
                    "id": account.id,
                    "code": account.code,
                    "name": account.name,
                    "type": account.account_type,
                    "initial_balance": float(initial_balance),
                    "debit": float(p_debit),
                    "credit": float(p_credit),
                    "closing_balance": float(closing_balance),
                    "saldo_deudor": float(saldo_deudor),
                    "saldo_acreedor": float(saldo_acreedor),
                }
            )

        return {
            "accounts": trial_balance,
            "total_debit": float(total_global_debit),
            "total_credit": float(total_global_credit),
            "total_saldo_deudor": float(total_saldo_deudor),
            "total_saldo_acreedor": float(total_saldo_acreedor),
            "is_balanced": total_global_debit == total_global_credit
            and total_saldo_deudor == total_saldo_acreedor,
        }
