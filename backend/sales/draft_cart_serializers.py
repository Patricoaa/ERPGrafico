from rest_framework import serializers
from .models import DraftCart


class DraftCartSerializer(serializers.ModelSerializer):
    """
    Serializer completo para borradores de carrito POS por sesión.
    Incluye información del cliente, usuarios y estado de lock.
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
    
    # Lock fields
    is_locked = serializers.SerializerMethodField()
    locked_by_name = serializers.SerializerMethodField()
    
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
            'is_locked',
            'locked_by',
            'locked_by_name',
            'locked_at',
            'lock_session_key',
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
    
    def get_is_locked(self, obj):
        """Retorna si el borrador está activamente bloqueado"""
        if not obj.locked_by:
            return False
        # Check if lock has expired
        from django.utils import timezone
        from .draft_cart_service import LOCK_TIMEOUT_SECONDS
        if obj.locked_at:
            elapsed = (timezone.now() - obj.locked_at).total_seconds()
            if elapsed > LOCK_TIMEOUT_SECONDS:
                return False
        return True
    
    def get_locked_by_name(self, obj):
        """Retorna nombre del usuario que tiene el lock"""
        if obj.locked_by and self.get_is_locked(obj):
            full_name = obj.locked_by.get_full_name()
            return full_name if full_name else obj.locked_by.username
        return None
