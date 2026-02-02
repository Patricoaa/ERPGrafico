from django.contrib import admin
from .models import Payment, TreasuryAccount, BankStatement, BankStatementLine, ReconciliationRule


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['display_id', 'payment_type', 'payment_method', 'amount', 'date', 'treasury_account', 'is_reconciled']
    list_filter = ['payment_type', 'payment_method', 'is_reconciled', 'date']
    search_fields = ['reference', 'transaction_number', 'contact__name']
    readonly_fields = ['created_at', 'reconciled_at', 'reconciled_by']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('payment_type', 'payment_method', 'amount', 'date', 'reference')
        }),
        ('Tesorería y Contabilidad', {
            'fields': ('treasury_account', 'account', 'transaction_number', 'is_pending_registration')
        }),
        ('Asignación', {
            'fields': ('contact', 'invoice', 'sale_order', 'purchase_order', 'journal_entry')
        }),
        ('Reconciliación Bancaria', {
            'fields': ('is_reconciled', 'bank_statement_line', 'reconciled_at', 'reconciled_by'),
            'classes': ('collapse',)
        }),
        ('Metadatos', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(TreasuryAccount)
class TreasuryAccountAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'account_type', 'currency', 'account']
    list_filter = ['account_type', 'currency']
    search_fields = ['name', 'code']


@admin.register(BankStatement)
class BankStatementAdmin(admin.ModelAdmin):
    list_display = ['display_id', 'treasury_account', 'statement_date', 'state', 'total_lines', 'reconciled_lines', 'reconciliation_progress']
    list_filter = ['state', 'treasury_account', 'statement_date', 'bank_format']
    search_fields = ['notes']
    readonly_fields = ['display_id', 'imported_at', 'imported_by', 'reconciliation_progress']
    
    fieldsets = (
        ('Información de la cartola', {
            'fields': ('treasury_account', 'statement_date', 'state', 'bank_format')
        }),
        ('Balances', {
            'fields': ('opening_balance', 'closing_balance')
        }),
        ('Archivo', {
            'fields': ('file',)
        }),
        ('Estadísticas', {
            'fields': ('total_lines', 'reconciled_lines', 'reconciliation_progress'),
            'classes': ('collapse',)
        }),
        ('Notas', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadatos', {
            'fields': ('display_id', 'imported_at', 'imported_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(BankStatementLine)
class BankStatementLineAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'transaction_date', 'description', 'debit', 'credit', 'balance', 'reconciliation_state', 'matched_payment']
    list_filter = ['reconciliation_state', 'statement__treasury_account', 'transaction_date']
    search_fields = ['description', 'reference', 'transaction_id']
    readonly_fields = ['reconciled_at', 'reconciled_by', 'amount']
    
    fieldsets = (
        ('Cartola', {
            'fields': ('statement', 'line_number')
        }),
        ('Datos Bancarios', {
            'fields': ('transaction_date', 'value_date', 'description', 'reference', 'transaction_id')
        }),
        ('Montos', {
            'fields': ('debit', 'credit', 'balance', 'amount')
        }),
        ('Reconciliación', {
            'fields': ('reconciliation_state', 'matched_payment', 'reconciled_at', 'reconciled_by')
        }),
        ('Diferencias', {
            'fields': ('difference_amount', 'difference_reason', 'difference_journal_entry'),
            'classes': ('collapse',)
        }),
        ('Notas', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )


@admin.register(ReconciliationRule)
class ReconciliationRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'treasury_account', 'priority', 'is_active']
    list_filter = ['is_active', 'treasury_account']
    search_fields = ['name']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('name', 'treasury_account', 'priority', 'is_active')
        }),
        ('Configuración de Matching', {
            'fields': ('match_config',)
        }),
    )
