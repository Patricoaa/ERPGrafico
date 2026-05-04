from rest_framework import serializers
from .models import (TreasuryMovement, TreasuryAccount, BankStatement, BankStatementLine,  
                     ReconciliationSettings, POSTerminal, 
                     POSSessionAudit, Bank, PaymentMethod,
                     PaymentTerminalProvider, PaymentTerminalDevice)
# Remove top-level import to avoid circular dependency
# from accounting.serializers import JournalEntrySerializer

class BankSerializer(serializers.ModelSerializer):
    account_executives_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Bank
        fields = ['id', 'name', 'code', 'swift_code', 'is_active', 'account_executives', 'account_executives_details', 'created_at', 'updated_at']
    
    def get_account_executives_details(self, obj):
        from contacts.serializers import ContactSerializer
        return ContactSerializer(obj.account_executives.all(), many=True).data


class PaymentMethodSerializer(serializers.ModelSerializer):
    method_type_display = serializers.CharField(source='get_method_type_display', read_only=True)
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)

    # Ensure it's writable as ID
    treasury_account = serializers.PrimaryKeyRelatedField(
        queryset=TreasuryAccount.objects.all(),
        required=True
    )

    # Computed: true solo para CARD_TERMINAL con device vinculado — activa flujo TUU automatizado en POS
    is_terminal_integration = serializers.SerializerMethodField()
    settlement_account_name = serializers.CharField(source='effective_settlement_account.name', read_only=True, allow_null=True)

    def get_is_terminal_integration(self, obj):
        return obj.is_integrated

    class Meta:
        model = PaymentMethod
        fields = '__all__'


class TreasuryAccountSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    bank_name = serializers.CharField(source='bank.name', read_only=True, allow_null=True)
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    is_system_managed = serializers.SerializerMethodField()

    current_balance = serializers.DecimalField(max_digits=20, decimal_places=0, read_only=True)
    payment_methods = PaymentMethodSerializer(many=True, read_only=True)

    def get_is_system_managed(self, obj):
        return obj.account_type in TreasuryAccount._NON_CASH_EQUIVALENT_TYPES

    reconciliation_settings = serializers.SerializerMethodField()

    def get_reconciliation_settings(self, obj):
        # We use a method field to ensure it exists or returns default (Global fallback)
        from .models import ReconciliationSettings
        settings = ReconciliationSettings.get_for_account(obj)
        return ReconciliationSettingsSerializer(settings).data

    class Meta:
        model = TreasuryAccount
        fields = ['id', 'name', 'code', 'currency', 'account', 'account_name', 'account_code', 'account_type', 'account_type_display',
                  'bank', 'bank_name', 'account_number', 'allows_cash', 'allows_card', 'allows_transfer', 'allows_check',
                  'is_system_managed', 'current_balance', 'payment_methods', 'default_bank_format', 'reconciliation_settings']


class POSTerminalSerializer(serializers.ModelSerializer):
    # Computed field (read-only)
    allowed_payment_method_types = serializers.SerializerMethodField()
    
    # Nested serialization for reading (detailed account info)
    allowed_treasury_accounts = TreasuryAccountSerializer(many=True, read_only=True)
    
    # Write field (just IDs)
    allowed_treasury_account_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=TreasuryAccount.objects.all(),
        source='allowed_treasury_accounts',
        required=False,
        write_only=True
    )

    # New Granular Payment Methods
    allowed_payment_methods = PaymentMethodSerializer(many=True, read_only=True)
    allowed_payment_method_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=PaymentMethod.objects.all(),
        source='allowed_payment_methods',
        required=False,
        write_only=True
    )
    
    # Support for default account
    default_treasury_account = serializers.PrimaryKeyRelatedField(
        queryset=TreasuryAccount.objects.all(),
        required=False,
        allow_null=True
    )
    
    default_treasury_account_name = serializers.CharField(
        source='default_treasury_account.name',
        read_only=True,
        allow_null=True
    )
    default_treasury_account_code = serializers.CharField(
        source='default_treasury_account.code',
        read_only=True,
        allow_null=True
    )
    default_treasury_account_balance = serializers.DecimalField(
        source='default_treasury_account.current_balance',
        max_digits=20,
        decimal_places=0,
        read_only=True,
        allow_null=True
    )
    
    payment_terminal_device_name = serializers.CharField(
        source='payment_terminal_device.name',
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = POSTerminal
        fields = [
            'id', 'name', 'code', 'location', 'is_active',
            'default_treasury_account', 'default_treasury_account_name', 
            'default_treasury_account_code', 'default_treasury_account_balance',
            'allowed_treasury_accounts',  # Read (full objects)
            'allowed_treasury_account_ids',  # Write (only IDs)
            'allowed_payment_methods',  # Read (full objects)
            'allowed_payment_method_ids', # Write (only IDs)
            'allowed_payment_method_types',  # Computed types
            'payment_terminal_device', 'payment_terminal_device_name',
            'serial_number', 'ip_address',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_allowed_payment_method_types(self, obj):
        """
        Returns the computed list of allowed payment method TYPES.
        """
        return obj.allowed_payment_method_types
    
    def validate(self, attrs):
        """
        Ensure default_treasury_account is compatible with the terminal's allowed methods.
        """
        # Get the default account from attrs or current instance
        default_account = attrs.get('default_treasury_account')
        if default_account is None and self.instance:
            default_account = self.instance.default_treasury_account
        
        # If no default account is set or being set, validation passes
        if not default_account:
            return attrs

        # Get allowed accounts from either current attrs (new selection) or database
        # Note: We use the source names here
        allowed_methods = attrs.get('allowed_payment_methods')
        
        allowed_account_ids = set()
        
        # If methods are being updated, use new ones
        if allowed_methods is not None:
            allowed_account_ids.update(m.treasury_account_id for m in allowed_methods)
        elif self.instance:
            # Fallback to current methods if not in attrs
            allowed_account_ids.update(self.instance.allowed_payment_methods.values_list('treasury_account_id', flat=True))
            
        # Also check legacy field if provided (for backward compatibility during migration)
        allowed_accounts_legacy = attrs.get('allowed_treasury_accounts')
        if allowed_accounts_legacy is not None:
            allowed_account_ids.update(a.id for a in allowed_accounts_legacy)
        elif self.instance and allowed_methods is None: # Only fallback if not sending new methods
            allowed_account_ids.update(self.instance.allowed_treasury_accounts.values_list('id', flat=True))

        if allowed_account_ids and default_account.id not in allowed_account_ids:
            raise serializers.ValidationError({
                'default_treasury_account':
                'La cuenta predeterminada debe ser una de las cuentas asociadas a los métodos de pago permitidos.'
            })
        
        return attrs



class PaymentAllocationSerializer(serializers.ModelSerializer):
    invoice_display_id = serializers.CharField(source='invoice.display_id', read_only=True, allow_null=True)
    sale_order_display_id = serializers.CharField(source='sale_order.display_id', read_only=True, allow_null=True)
    purchase_order_display_id = serializers.CharField(source='purchase_order.display_id', read_only=True, allow_null=True)
    bank_statement_line_display = serializers.CharField(source='bank_statement_line.description', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, allow_null=True)

    class Meta:
        from .models import PaymentAllocation
        model = PaymentAllocation
        fields = [
            'id', 'treasury_movement', 'amount', 'notes',
            'invoice', 'invoice_display_id',
            'sale_order', 'sale_order_display_id',
            'purchase_order', 'purchase_order_display_id',
            'bank_statement_line', 'bank_statement_line_display',
            'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_at', 'created_by']

class TreasuryMovementSerializer(serializers.ModelSerializer):
    partner_name = serializers.SerializerMethodField()
    partner_id = serializers.SerializerMethodField()
    account_name = serializers.CharField(source='account.name', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    movement_type_display = serializers.CharField(source='get_movement_type_display', read_only=True)
    payment_type = serializers.CharField(source='movement_type', read_only=True)
    # Helper to distinguish direction in transfers
    is_inbound = serializers.SerializerMethodField()
    # Account Names
    from_account_name = serializers.CharField(source='from_account.name', read_only=True, allow_null=True)
    from_account_account_id = serializers.IntegerField(source='from_account.account.id', read_only=True, allow_null=True)
    from_account_code = serializers.CharField(source='from_account.account.code', read_only=True, allow_null=True)
    to_account_name = serializers.CharField(source='to_account.name', read_only=True, allow_null=True)
    to_account_account_id = serializers.IntegerField(source='to_account.account.id', read_only=True, allow_null=True)
    to_account_code = serializers.CharField(source='to_account.account.code', read_only=True, allow_null=True)
    
    payment_method_new_name = serializers.CharField(source='payment_method_new.name', read_only=True, allow_null=True)

    
    # Legacy/Display fields for frontend compatibility
    journal_name = serializers.SerializerMethodField()

    code = serializers.SerializerMethodField()
    display_id = serializers.CharField(read_only=True)
    document_info = serializers.SerializerMethodField()
    
    # Reconciliation data
    reconciled_by_name = serializers.CharField(source='reconciled_by.username', read_only=True, allow_null=True)
    bank_statement_info = serializers.SerializerMethodField()
    
    # Additional Context
    justify_reason_display = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    terminal_batch_display = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    def get_status(self, obj):
        if obj.is_reconciled:
            return 'RECONCILED'
        if obj.is_pending_registration:
            return 'PENDING'
        return 'POSTED'

    def get_is_inbound(self, obj):
        # Determine if it's an inflow to the account being considered
        # Since we don't have the context account here, we use a heuristic:
        # If it's INBOUND, it's inbound.
        # If it's TRANSFER, it could be either. 
        # But for the purpose of the ReconciliationPanel (which SELECTS logically),
        # we can just return the movement_type and let the frontend decide based on the treasuryAccountId it has.
        return obj.movement_type == 'INBOUND'

    invoice_display_id = serializers.SerializerMethodField()
    sale_order_display_id = serializers.SerializerMethodField()
    purchase_order_display_id = serializers.SerializerMethodField()
    journal_entry_display_id = serializers.SerializerMethodField()

    class Meta:
        model = TreasuryMovement
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'history', 'is_pending_registration']
    
    def get_invoice_display_id(self, obj):
        return obj.invoice.display_id if obj.invoice else None

    def get_sale_order_display_id(self, obj):
        return obj.sale_order.display_id if obj.sale_order else None

    def get_purchase_order_display_id(self, obj):
        return obj.purchase_order.display_id if obj.purchase_order else None

    def get_journal_entry_display_id(self, obj):
        return obj.journal_entry.display_id if obj.journal_entry else None

    def get_journal_name(self, obj):
        # Return the name of the primary treasury account involved
        if obj.treasury_account:
            return obj.treasury_account.name
        return None

    def get_partner_name(self, obj):
        # 1. Direct contact
        if obj.contact:
            return obj.contact.name
        
        # 2. From Invoice or its linked orders
        if obj.invoice:
            if obj.invoice.contact:
                return obj.invoice.contact.name
            if obj.invoice.sale_order and obj.invoice.sale_order.customer:
                return obj.invoice.sale_order.customer.name
            if obj.invoice.purchase_order and obj.invoice.purchase_order.supplier:
                return obj.invoice.purchase_order.supplier.name
        
        # 3. Direct Order links
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.name
        if obj.purchase_order and obj.purchase_order.supplier:
            return obj.purchase_order.supplier.name
            
        return 'Particular'

    def get_partner_id(self, obj):
        # 1. Direct contact
        if obj.contact:
            return obj.contact.id
        
        # 2. From Invoice or its linked orders
        if obj.invoice:
            if obj.invoice.contact:
                return obj.invoice.contact.id
            if obj.invoice.sale_order and obj.invoice.sale_order.customer:
                return obj.invoice.sale_order.customer.id
            if obj.invoice.purchase_order and obj.invoice.purchase_order.supplier:
                return obj.invoice.purchase_order.supplier.id
        
        # 3. Direct Order links
        if obj.sale_order and obj.sale_order.customer:
            return obj.sale_order.customer.id
        if obj.purchase_order and obj.purchase_order.supplier:
            return obj.purchase_order.supplier.id
            
        return None

    def get_journal_entry(self, obj):
        if obj.journal_entry:
            from accounting.serializers import JournalEntrySerializer
            return JournalEntrySerializer(obj.journal_entry).data
        return None

    def get_code(self, obj):
        return obj.display_id

    def get_justify_reason_display(self, obj):
        if not obj.justify_reason:
            return None
        # Robust check to avoid AttributeError during migrations/refactors
        if hasattr(obj, 'get_justify_reason_display'):
            return obj.get_justify_reason_display()
        return obj.justify_reason

    def get_document_info(self, obj):
        info = {
            'type': None,
            'id': None,
            'number': None,
            'label': None,
            'display_id': None
        }
        if obj.invoice:
            info['type'] = 'invoice'
            info['id'] = obj.invoice.id
            info['number'] = obj.invoice.number
            info['display_id'] = obj.invoice.display_id
            info['label'] = obj.invoice.display_id
        elif obj.purchase_order:
            info['type'] = 'purchase_order'
            info['id'] = obj.purchase_order.id
            info['number'] = obj.purchase_order.number
            info['display_id'] = obj.purchase_order.display_id
            info['label'] = obj.purchase_order.display_id
        elif obj.sale_order:
            info['type'] = 'sale_order'
            info['id'] = obj.sale_order.id
            info['number'] = obj.sale_order.number
            info['display_id'] = obj.sale_order.display_id
            info['label'] = obj.sale_order.display_id
        elif obj.journal_entry:
            info['type'] = 'journal_entry'
            info['id'] = obj.journal_entry.id
            info['number'] = obj.journal_entry.number
            info['display_id'] = obj.journal_entry.display_id
            info['label'] = obj.journal_entry.display_id
        
        return info if info['type'] else None
    
    def get_bank_statement_info(self, obj):
        if obj.bank_statement_line:
            return {
                'line_id': obj.bank_statement_line.id,
                'statement_id': obj.bank_statement_line.statement.id,
                'statement_display_id': obj.bank_statement_line.statement.display_id,
            }
        return None

    def get_terminal_batch_display(self, obj):
        if obj.terminal_batch:
            return obj.terminal_batch.display_id
        return None


class POSSessionSerializer(serializers.ModelSerializer):
    """Serializer for POS Sessions"""
    from .models import POSSession
    
    user_name = serializers.SerializerMethodField()
    terminal_name = serializers.CharField(source='terminal.name', read_only=True, allow_null=True)
    terminal_details = POSTerminalSerializer(source='terminal', read_only=True)
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    expected_cash = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2)
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True, allow_null=True)
    cash_movements = TreasuryMovementSerializer(source='movements', many=True, read_only=True)
    
    class Meta:
        from .models import POSSession
        model = POSSession
        fields = '__all__'
    
    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class POSSessionAuditSerializer(serializers.ModelSerializer):
    """Serializer for POS Session Audits (Arqueos)"""
    
    class Meta:
        model = POSSessionAudit
        fields = '__all__'




class CashFlowSerializer(serializers.Serializer):
    """
    Serializer unificado para vista de flujo de efectivo.
    Combina Payments y CashMovements relevantes.
    """
    id = serializers.IntegerField()
    source = serializers.ChoiceField(choices=['PAYMENT', 'CASH_MOVEMENT'])
    type = serializers.CharField()  # payment_type o movement_type
    date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    description = serializers.CharField()
    treasury_account_name = serializers.CharField()
    partner_name = serializers.CharField(allow_null=True)
    reference = serializers.CharField()
    is_internal = serializers.BooleanField()  # True para traspasos


class BankStatementLineSerializer(serializers.ModelSerializer):
    reconciled_by_name = serializers.CharField(source='reconciled_by.username', read_only=True, allow_null=True)
    amount = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    
    class Meta:
        model = BankStatementLine
        fields = '__all__'


class BankStatementSerializer(serializers.ModelSerializer):
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)
    imported_by_name = serializers.CharField(source='imported_by.username', read_only=True)
    reconciliation_progress = serializers.FloatField(read_only=True)
    display_id = serializers.CharField(read_only=True)
    lines = BankStatementLineSerializer(many=True, read_only=True)

    class Meta:
        model = BankStatement
        fields = '__all__'


class BankStatementListSerializer(serializers.ModelSerializer):
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)
    imported_by_name = serializers.CharField(source='imported_by.username', read_only=True)
    reconciliation_progress = serializers.FloatField(read_only=True)
    display_id = serializers.CharField(read_only=True)
    reconciled_lines = serializers.IntegerField(read_only=True)

    class Meta:
        model = BankStatement
        fields = [
            'id', 'display_id', 'treasury_account', 'treasury_account_name',
            'statement_date', 'opening_balance', 'closing_balance',
            'status', 'total_lines', 'reconciled_lines', 
            'reconciliation_progress', 'imported_at', 'imported_by_name'
        ]


class ReconciliationSettingsSerializer(serializers.ModelSerializer):
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)

    class Meta:
        model = ReconciliationSettings
        fields = '__all__'









class PaymentTerminalProviderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    receivable_account_name = serializers.CharField(source='receivable_account.name', read_only=True)
    commission_expense_account_name = serializers.CharField(source='commission_expense_account.name', read_only=True)
    commission_iva_account_name = serializers.CharField(source='commission_iva_account.name', read_only=True)
    bank_treasury_account_name = serializers.CharField(source='bank_treasury_account.name', read_only=True)
    provider_type_display = serializers.CharField(source='get_provider_type_display', read_only=True)

    class Meta:
        model = PaymentTerminalProvider
        fields = '__all__'


class PaymentTerminalDeviceSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PaymentTerminalDevice
        fields = '__all__'

class TerminalBatchSerializer(serializers.ModelSerializer):
    """Serializer for Terminal Batch settlement information"""
    
    # Display fields
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    display_id = serializers.CharField(read_only=True)
    payment_count = serializers.IntegerField(read_only=True)
    
    # Nested objects for detailed view
    settlement_journal_entry_data = serializers.SerializerMethodField()
    bank_statement_line_data = serializers.SerializerMethodField()
    supplier_invoice_data = serializers.SerializerMethodField()
    
    # Writable fields
    provider = serializers.PrimaryKeyRelatedField(
        queryset=PaymentTerminalProvider.objects.all()
    )
    
    class Meta:
        from .models import TerminalBatch
        model = TerminalBatch
        fields = [
            'id', 'display_id', 'provider', 'provider_name',
            'sales_date', 'sales_date_end', 'settlement_date', 'deposit_date',
            'gross_amount', 'commission_base', 'commission_tax', 'commission_total', 'net_amount',
            'terminal_reference', 'status', 'status_display', 'payment_count',
            'settlement_journal_entry', 'settlement_journal_entry_data',
            'bank_statement_line', 'bank_statement_line_data',
            'supplier_invoice', 'supplier_invoice_data',
            'notes', 'created_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'created_by', 'settlement_journal_entry', 'bank_statement_line', 'supplier_invoice']
    
    def get_settlement_journal_entry_data(self, obj):
        if obj.settlement_journal_entry:
            from accounting.serializers import JournalEntrySerializer
            return JournalEntrySerializer(obj.settlement_journal_entry).data
        return None
    
    def get_bank_statement_line_data(self, obj):
        if obj.bank_statement_line:
            return {
                'id': obj.bank_statement_line.id,
                'statement_id': obj.bank_statement_line.statement.id,
                'statement_display_id': obj.bank_statement_line.statement.display_id,
                'transaction_date': obj.bank_statement_line.transaction_date,
                'description': obj.bank_statement_line.description,
                'amount': obj.bank_statement_line.credit or obj.bank_statement_line.debit
            }
        return None
    
    def get_supplier_invoice_data(self, obj):
        if obj.supplier_invoice:
            return {
                'id': obj.supplier_invoice.id,
                'number': obj.supplier_invoice.number,
                'total': obj.supplier_invoice.total,
                'status': obj.supplier_invoice.status
            }
        return None
