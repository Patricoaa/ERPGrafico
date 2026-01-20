from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from .models import User, CompanySettings, ActionLog

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise InvalidToken("User does not exist")

class UserSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active', 'is_superuser', 'permissions']
        read_only_fields = ['id']

    def get_permissions(self, obj):
        return list(obj.get_all_permissions())

class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySettings
        fields = '__all__'

class ActionLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)

    class Meta:
        model = ActionLog
        fields = ['id', 'user', 'user_name', 'timestamp', 'action_type', 'action_type_display', 'description', 'ip_address', 'metadata']

class HistoricalRecordSerializer(serializers.Serializer):
    history_id = serializers.IntegerField()
    history_date = serializers.DateTimeField()
    history_change_reason = serializers.CharField()
    history_type = serializers.CharField()
    history_user_id = serializers.IntegerField()
    history_user_username = serializers.SerializerMethodField()
    
    # We'll use a dynamic field for the model data
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Add the fields from the model
        model_fields = [f.name for f in instance._meta.fields if not f.name.startswith('history_')]
        for field in model_fields:
            ret[field] = getattr(instance, field)
        return ret

    def get_history_user_username(self, obj):
        return obj.history_user.username if obj.history_user else "System"
