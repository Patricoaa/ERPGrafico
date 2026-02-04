from rest_framework import serializers
from .models import DraftCart


class DraftCartSerializer(serializers.ModelSerializer):
    """
    Serializer para borradores de carrito POS por sesión.
    Incluye información del cliente y usuarios que crearon/modificaron.
    """
    customer_name = serializers.CharField(
        source='customer.name',
        read_only=True,
        allow_null=True
    )
    
    created_by_username = serializers.CharField(
        source='created_by.username',
        read_only=True,
        allow_null=True
    )
    
    created_by_full_name = serializers.SerializerMethodField()
    
    last_modified_by_username = serializers.CharField(
        source='last_modified_by.username',
        read_only=True,
        allow_null=True
    )
    
    last_modified_by_full_name = serializers.SerializerMethodField()
    
    item_count = serializers.SerializerMethodField()
    
    class Meta:
        model = DraftCart
        fields = [
            'id',
            'pos_session',
            'name',
            'notes',
            'customer',
            'customer_name',
            'items',
            'wizard_state',
            'total_net',
            'total_gross',
            'item_count',
            'created_by',
            'created_by_username',
            'created_by_full_name',
            'last_modified_by',
            'last_modified_by_username',
            'last_modified_by_full_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'last_modified_by']
    
    def get_item_count(self, obj):
        """Retorna número de items en el carrito"""
        return len(obj.items) if obj.items else 0
    
    def get_created_by_full_name(self, obj):
        """Retorna nombre completo del usuario que creó el borrador"""
        if obj.created_by:
            full_name = obj.created_by.get_full_name()
            return full_name if full_name else obj.created_by.username
        return None
    
    def get_last_modified_by_full_name(self, obj):
        """Retorna nombre completo del usuario que modificó el borrador"""
        if obj.last_modified_by:
            full_name = obj.last_modified_by.get_full_name()
            return full_name if full_name else obj.last_modified_by.username
        return None
