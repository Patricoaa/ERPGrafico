from rest_framework import serializers
from .models import Contact


class ContactSerializer(serializers.ModelSerializer):
    """Full contact serializer with computed fields"""
    is_customer = serializers.BooleanField(read_only=True)
    is_supplier = serializers.BooleanField(read_only=True)
    contact_type = serializers.CharField(read_only=True)
    
    class Meta:
        model = Contact
        fields = [
            'id', 'code', 'display_id', 'name', 'tax_id', 'contact_name', 'email', 'phone', 'address',
            'account_receivable', 'account_payable',
            'is_customer', 'is_supplier', 'contact_type',
            'is_default_customer', 'is_default_vendor',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class ContactListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    contact_type = serializers.CharField(read_only=True)
    
    class Meta:
        model = Contact
        fields = ['id', 'display_id', 'name', 'tax_id', 'email', 'phone', 'contact_type', 'is_default_customer', 'is_default_vendor']
