from rest_framework import serializers
from .models import Subscription, Product
from contacts.models import Contact


class SubscriptionSerializer(serializers.ModelSerializer):
    """
    Serializer for Subscription model with enriched data for management UI.
    """
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_id = serializers.IntegerField(source='supplier.id', read_only=True)
    recurrence_display = serializers.CharField(source='get_recurrence_period_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Payment configuration from product
    payment_day_type = serializers.CharField(source='product.payment_day_type', read_only=True)
    payment_day = serializers.IntegerField(source='product.payment_day', read_only=True)
    payment_interval_days = serializers.IntegerField(source='product.payment_interval_days', read_only=True)
    
    class Meta:
        model = Subscription
        fields = [
            'id',
            'product',
            'product_name',
            'product_code',
            'supplier',
            'supplier_name',
            'supplier_id',
            'start_date',
            'end_date',
            'next_payment_date',
            'amount',
            'currency',
            'status',
            'status_display',
            'recurrence_period',
            'recurrence_display',
            'payment_day_type',
            'payment_day',
            'payment_interval_days',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
