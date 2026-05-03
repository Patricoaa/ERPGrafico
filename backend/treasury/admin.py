from django.contrib import admin
from .models import (TreasuryMovement, TreasuryAccount, BankStatement, BankStatementLine,
                     ReconciliationSettings, TerminalBatch, PaymentTerminalProvider,
                     PaymentTerminalDevice, POSTerminal, PaymentMethod)


@admin.register(TreasuryMovement)
class TreasuryMovementAdmin(admin.ModelAdmin):
    list_display = ['display_id', 'movement_type', 'payment_method', 'terminal_device', 'amount', 'date', 'is_reconciled']
    list_filter = ['movement_type', 'payment_method', 'terminal_device', 'is_reconciled', 'date']
    search_fields = ['reference', 'transaction_number', 'contact__name']
    readonly_fields = ['created_at', 'reconciled_at', 'reconciled_by']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('movement_type', 'payment_method', 'amount', 'date', 'reference', 'justify_reason')
        }),
        ('Tesorería y Contabilidad', {
            'fields': ('from_account', 'to_account', 'treasury_account', 'journal_entry', 'terminal_device', 'transaction_number', 'is_pending_registration')
        }),
        ('Asignación', {
            'fields': ('contact', 'invoice', 'sale_order', 'purchase_order')
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
    list_display = ['display_id', 'treasury_account', 'statement_date', 'status', 'total_lines', 'reconciled_lines', 'reconciliation_progress']
    list_filter = ['status', 'treasury_account', 'statement_date', 'bank_format']
    search_fields = ['notes']
    readonly_fields = ['display_id', 'imported_at', 'imported_by', 'reconciliation_progress', 'reconciled_lines']
    
    fieldsets = (
        ('Información de la cartola', {
            'fields': ('treasury_account', 'statement_date', 'status', 'bank_format')
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
    list_display = ['__str__', 'transaction_date', 'description', 'debit', 'credit', 'balance', 'reconciliation_status']
    list_filter = ['reconciliation_status', 'statement__treasury_account', 'transaction_date']
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
            'fields': ('reconciliation_status', 'reconciled_at', 'reconciled_by')
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


@admin.register(ReconciliationSettings)
class ReconciliationSettingsAdmin(admin.ModelAdmin):
    list_display = ['treasury_account', 'confidence_threshold', 'date_range_days', 'auto_confirm']
    list_filter = ['auto_confirm']
    search_fields = ['treasury_account__name']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('treasury_account', 'auto_confirm')
        }),
        ('Pesos de Scoring', {
            'fields': ('amount_weight', 'date_weight', 'reference_weight', 'contact_weight')
        }),
        ('Lógica del Motor', {
            'fields': ('confidence_threshold', 'date_range_days')
        }),
    )



@admin.register(PaymentTerminalProvider)
class PaymentTerminalProviderAdmin(admin.ModelAdmin):
    list_display = ['name', 'provider_type', 'supplier', 'is_active']
    list_filter = ['provider_type', 'is_active']
    search_fields = ['name']

@admin.register(PaymentTerminalDevice)
class PaymentTerminalDeviceAdmin(admin.ModelAdmin):
    list_display = ['name', 'provider', 'serial_number', 'status', 'supported_payment_methods']
    list_filter = ['status', 'provider']
    search_fields = ['name', 'serial_number']

@admin.register(TerminalBatch)
class TerminalBatchAdmin(admin.ModelAdmin):
    list_display = ['display_id', 'provider', 'sales_date', 'gross_amount', 'commission_total', 'net_amount', 'status', 'payment_count']
    list_filter = ['status', 'provider', 'sales_date']
    search_fields = ['terminal_reference', 'notes']
    readonly_fields = ['display_id', 'payment_count', 'created_at', 'created_by']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('provider', 'terminal_reference', 'status')
        }),
        ('Fechas', {
            'fields': ('sales_date', 'settlement_date', 'deposit_date')
        }),
        ('Montos', {
            'fields': ('gross_amount', 'commission_base', 'commission_tax', 'commission_total', 'net_amount')
        }),
        ('Vinculaciones', {
            'fields': ('settlement_journal_entry', 'bank_statement_line', 'supplier_invoice'),
            'classes': ('collapse',)
        }),
        ('Estadísticas', {
            'fields': ('payment_count',),
            'classes': ('collapse',)
        }),
        ('Notas', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadatos', {
            'fields': ('display_id', 'created_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )

@admin.register(POSTerminal)
class POSTerminalAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'location', 'is_active', 'payment_terminal_device']
    list_filter = ['is_active', 'location']
    search_fields = ['name', 'code', 'serial_number']
    filter_horizontal = ['allowed_payment_methods']

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['name', 'method_type', 'treasury_account', 'is_active']
    list_filter = ['method_type', 'is_active', 'treasury_account']
    search_fields = ['name']

