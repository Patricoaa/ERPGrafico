from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from .models import User, CompanySettings, ActionLog, Attachment

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

class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_at = serializers.DateTimeField(read_only=True)
    file_size_formatted = serializers.SerializerMethodField()
    user_name = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Attachment
        fields = [
            'id', 'file', 'original_filename', 'content_type', 
            'object_id', 'uploaded_at', 'user', 'user_name',
            'file_size', 'file_size_formatted', 'mime_type'
        ]
        read_only_fields = ['id', 'uploaded_at', 'file_size', 'mime_type']

    def get_file_size_formatted(self, obj):
        if not obj.file_size:
            return "0 B"
        size = float(obj.file_size)
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"

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
        for field in instance._meta.fields:
            name = field.name
            if name.startswith('history_'):
                continue
            
            value = getattr(instance, name)
            # If it's a model instance (Foreign Key), get its primary key
            if hasattr(value, 'pk') and hasattr(value, '_meta'):
                ret[name] = value.pk
            else:
                ret[name] = value
        return ret

    def get_history_user_username(self, obj):
        return obj.history_user.username if obj.history_user else "System"
