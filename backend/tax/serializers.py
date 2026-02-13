from rest_framework import serializers
from .models import TaxPeriod, F29Declaration, F29Payment, AccountingPeriod


class TaxPeriodSerializer(serializers.ModelSerializer):
    month_display = serializers.CharField(source='get_month_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True, allow_null=True)
    declaration_summary = serializers.SerializerMethodField()
    
    class Meta:
        model = TaxPeriod
        fields = [
            'id', 'year', 'month', 'month_display', 'status', 'status_display',
            'closed_at', 'closed_by', 'closed_by_name',
            'created_at', 'updated_at', 'declaration_summary'
        ]
        read_only_fields = ['closed_at', 'closed_by', 'created_at', 'updated_at']

    def get_declaration_summary(self, obj):
        declaration = obj.declarations.first()
        if not declaration:
            return None
            
        # Check if fully paid
        total_paid = sum(p.amount for p in declaration.payments.all())
        
        # Calculate final tax to pay (logic simplified from frontend)
        # Total Debits - Total Credits
        vat_debit = (declaration.sales_taxed * getattr(declaration, 'tax_rate', 19) / 100)
        vat_credit = (declaration.purchases_taxed * getattr(declaration, 'tax_rate', 19) / 100)
        
        # Add other taxes/retentions if necessary, but keep it simple for now or fetch exact logic
        # Ideally, we should reuse a service or property, but let's approximate or use stored fields if we had them.
        # Wait, F29Declaration DOES NOT store the final calculated 'vat_to_pay' separately, it's calculated on fly.
        
        # Let's use the same logic as frontend wizard for consistency:
        # Debits
        debits = declaration.net_taxed_sales * declaration.tax_rate / 100
        total_due = debits + declaration.withholding_tax + declaration.second_category_tax
        
        # Credits
        credits = (declaration.net_taxed_purchases * declaration.tax_rate / 100) + \
                 declaration.vat_credit_carryforward + \
                 declaration.vat_correction_amount + \
                 declaration.ppm_amount
                 
        vat_to_pay = max(0, total_due - credits)
        
        return {
            'id': declaration.id,
            'vat_to_pay': vat_to_pay,
            'total_paid': total_paid,
            'is_fully_paid': total_paid >= vat_to_pay and vat_to_pay > 0 or (vat_to_pay == 0),
            'folio_number': declaration.folio_number
        }


class AccountingPeriodSerializer(serializers.ModelSerializer):
    month_display = serializers.CharField(source='get_month_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True, allow_null=True)
    tax_period_id = serializers.IntegerField(source='tax_period.id', read_only=True, allow_null=True)
    tax_period_status = serializers.CharField(source='tax_period.status', read_only=True, allow_null=True)
    
    class Meta:
        model = AccountingPeriod
        fields = [
            'id', 'year', 'month', 'month_display', 'status', 'status_display',
            'closed_at', 'closed_by', 'closed_by_name',
            'tax_period', 'tax_period_id', 'tax_period_status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['closed_at', 'closed_by', 'tax_period', 'created_at', 'updated_at']


class F29DeclarationSerializer(serializers.ModelSerializer):
    tax_period_display = serializers.CharField(source='tax_period.__str__', read_only=True)
    tax_period_year = serializers.IntegerField(source='tax_period.year', read_only=True)
    tax_period_month = serializers.IntegerField(source='tax_period.month', read_only=True)
    
    # Calculated fields
    net_taxed_sales = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    net_taxed_purchases = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    vat_debit = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    vat_credit = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    total_amount_due = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    total_credits_available = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    vat_to_pay = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    vat_credit_balance = serializers.DecimalField(max_digits=15, decimal_places=0, read_only=True)
    is_registered = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = F29Declaration
        fields = [
            'id', 'tax_period', 'tax_period_display', 'tax_period_year', 'tax_period_month',
            'declaration_date', 'folio_number',
            # Debits (Sales)
            'sales_taxed', 'sales_exempt', 'debit_notes_taxed', 'credit_notes_taxed',
            # Credits (Purchases)
            'purchases_taxed', 'purchases_exempt', 'purchase_debit_notes', 'purchase_credit_notes',
            # Manual fields
            'ppm_amount', 'withholding_tax', 'vat_credit_carryforward', 
            'vat_correction_amount', 'second_category_tax',
            # Configuration
            'tax_rate', 'notes',
            # Calculated
            'net_taxed_sales', 'net_taxed_purchases',
            'vat_debit', 'vat_credit',
            'total_amount_due', 'total_credits_available',
            'vat_to_pay', 'vat_credit_balance',
            'is_registered',
            # System
            'journal_entry', 'created_at', 'updated_at'
        ]
        read_only_fields = ['journal_entry', 'created_at', 'updated_at']


class F29PaymentSerializer(serializers.ModelSerializer):
    declaration_display = serializers.CharField(source='declaration.__str__', read_only=True)
    treasury_account_name = serializers.CharField(source='treasury_account.name', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    
    class Meta:
        model = F29Payment
        fields = [
            'id', 'declaration', 'declaration_display',
            'payment_date', 'amount', 'payment_method', 'payment_method_display',
            'reference', 'treasury_account', 'treasury_account_name',
            'journal_entry', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['journal_entry', 'created_at', 'updated_at']


class F29CalculationRequestSerializer(serializers.Serializer):
    """Serializer for calculation request"""
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)


class F29RegistrationSerializer(serializers.Serializer):
    """Serializer for declaration registration"""
    folio_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    declaration_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
