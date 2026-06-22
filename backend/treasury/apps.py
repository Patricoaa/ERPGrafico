from django.apps import AppConfig

class TreasuryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'treasury'

    def ready(self):
        try:
            from core.permissions import PermissionRegistry
            PermissionRegistry.register('treasury', [
                ('view_dashboard_treasury', 'Can view treasury dashboard'),
            ])
        except ImportError:
            pass

        import treasury.signals  # noqa: F401 — register signal handlers

        try:
            from core.registry import UniversalRegistry, SearchableEntity
            from treasury.models import (
                TreasuryMovement, TreasuryAccount, BankStatement,
                Check, BankLoan, PaymentMethod, CreditCardStatement,
                CardPurchaseGroup, LoanInstallment,
            )
            UniversalRegistry.register(SearchableEntity(
                model=TreasuryMovement,
                label='treasury.treasurymovement',
                title_singular='Movimiento de Tesorería',
                title_plural='Movimientos de Tesorería',
                icon='landmark',
                search_fields=('transaction_number', 'contact__name', 'contact__tax_id'),
                short_display_template='TRX-{display_id}',
                display_template='TRX-{display_id}',
                subtitle_template='{contact.name} · {contact.tax_id}',
                extra_info_template='{payment_method}',
                list_url='/treasury/movements',
                detail_url_pattern='/treasury/movements/{id}',
                permission='treasury.view_treasurymovement',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=TreasuryAccount,
                label='treasury.treasuryaccount',
                title_singular='Cuenta de Tesorería',
                title_plural='Cuentas de Tesorería',
                icon='piggy-bank',
                search_fields=('name', 'account_number'),
                short_display_template='{name}',
                display_template='{name}',
                subtitle_template='{account_number} · {bank}',
                extra_info_template='{currency}',
                list_url='/treasury/accounts',
                detail_url_pattern='/treasury/accounts/{id}',
                permission='treasury.view_treasuryaccount',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=BankStatement,
                label='treasury.bankstatement',
                title_singular='Cartola Bancaria',
                title_plural='Cartolas Bancarias',
                icon='book-open',
                search_fields=('id', 'treasury_account__name'),
                short_display_template='CAR-{display_id}',
                display_template='CAR-{display_id}',
                subtitle_template='{treasury_account.name}',
                extra_info_template='{date}',
                list_url='/treasury/reconciliation?tab=statements',
                detail_url_pattern='/treasury/statements/{id}',
                permission='treasury.view_bankstatement',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=Check,
                label='treasury.check',
                title_singular='Cheque',
                title_plural='Cheques',
                icon='banknote',
                search_fields=('check_number', 'bank__name', 'counterparty__name'),
                short_display_template='CHQ-{check_number}',
                display_template='CHQ-{check_number}',
                subtitle_template='{bank.name} · {counterparty.name}',
                extra_info_template='{amount}',
                list_url='/treasury/operaciones/movements',
                detail_url_pattern='/treasury/operaciones/movements?check={id}',
                permission='treasury.view_check',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=BankLoan,
                label='treasury.bankloan',
                title_singular='Crédito Bancario',
                title_plural='Créditos Bancarios',
                icon='hand-coins',
                search_fields=('loan_number', 'lender__name'),
                short_display_template='CRE-{loan_number}',
                display_template='CRE-{loan_number}',
                subtitle_template='{lender.name} · {status}',
                extra_info_template='{principal}',
                list_url='/treasury/loans',
                detail_url_pattern='/treasury/loans/{id}',
                permission='treasury.view_bankloan',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=PaymentMethod,
                label='treasury.paymentmethod',
                title_singular='Método de Pago',
                title_plural='Métodos de Pago',
                icon='credit-card',
                search_fields=('name',),
                short_display_template='{name}',
                display_template='{name}',
                subtitle_template='{method_type}',
                extra_info_template='',
                list_url='/treasury/operaciones/methods',
                detail_url_pattern='/treasury/operaciones/methods?selected={id}',
                permission='treasury.view_paymentmethod',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=CreditCardStatement,
                label='treasury.creditcardstatement',
                title_singular='Estado de Cuenta Tarjeta',
                title_plural='Estados de Cuenta Tarjeta',
                icon='credit-card',
                search_fields=('card_account__name', 'period_year', 'period_month'),
                short_display_template='EST-{id}',
                display_template='EST-{id}',
                subtitle_template='{card_account.name} · {period_month}/{period_year}',
                extra_info_template='{status}',
                list_url='/treasury/bank-center',
                detail_url_pattern='/treasury/bank-center?statement={id}',
                permission='treasury.view_creditcardstatement',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=CardPurchaseGroup,
                label='treasury.cardpurchasegroup',
                title_singular='Compra en Cuotas',
                title_plural='Compras en Cuotas',
                icon='shopping-cart',
                search_fields=('partner__name',),
                short_display_template='{group_display_id}',
                display_template='{group_display_id}',
                subtitle_template='{partner.name}',
                extra_info_template='{total_amount}',
                list_url='/treasury/bank-center',
                detail_url_pattern='/treasury/bank-center',
                permission='treasury.view_cardpurchasegroup',
            ))
            UniversalRegistry.register(SearchableEntity(
                model=LoanInstallment,
                label='treasury.loaninstallment',
                title_singular='Cuota de Crédito',
                title_plural='Cuotas de Crédito',
                icon='calendar',
                search_fields=('loan__loan_number', 'number'),
                short_display_template='CUO-{id}',
                display_template='CUO-{id}',
                subtitle_template='{loan.loan_number} · Cuota {number}',
                extra_info_template='{total_amount} · {status}',
                list_url='/treasury/loans',
                detail_url_pattern='/treasury/loans?selected={loan}&installment={id}',
                permission='treasury.view_loaninstallment',
            ))
        except Exception:
            pass
