from django.contrib.auth.models import Group
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
    groups_list = serializers.SlugRelatedField(
        many=True,
        slug_field='name',
        queryset=Group.objects.all(),
        source='groups',
        required=False
    )
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    contact = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.none(), # Set in __init__
        required=True, 
        allow_null=False
    )
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'is_active', 'is_superuser', 'permissions', 'groups_list', 'password',
            'contact'
        ]
        read_only_fields = ['id', 'is_superuser']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from contacts.models import Contact
        self.fields['contact'].queryset = Contact.objects.all()

    def get_permissions(self, obj):
        return list(obj.get_all_permissions())

    def _sync_contact_data(self, validated_data):
        contact = validated_data.get('contact')
        if contact:
            # Sync personal info from contact
            validated_data['email'] = contact.email
            # Split contact_name or name if needed, or just use as is
            # Contact model has 'name' (Razon Social) and 'contact_name' (Persona)
            # We'll use contact_name for first_name if available, otherwise name
            full_name = contact.contact_name or contact.name
            parts = full_name.split(' ', 1)
            validated_data['first_name'] = parts[0]
            validated_data['last_name'] = parts[1] if len(parts) > 1 else ""
        return validated_data

    def create(self, validated_data):
        groups_data = validated_data.pop('groups', [])
        password = validated_data.pop('password', None)
        validated_data = self._sync_contact_data(validated_data)
        
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        user.groups.set(groups_data)
        return user

    def update(self, instance, validated_data):
        groups_data = validated_data.pop('groups', None)
        password = validated_data.pop('password', None)
        validated_data = self._sync_contact_data(validated_data)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if password:
            instance.set_password(password)
            
        instance.save()
        
        if groups_data is not None:
            instance.groups.set(groups_data)
            
        return instance

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
            
            # Use attname for relations to avoid DB lookup and DoesNotExist errors
            # This is critical for historical records where the related object might have been deleted
            if field.is_relation and field.attname:
                try:
                    value = getattr(instance, field.attname)
                except Exception:
                    value = None
            else:
                value = getattr(instance, name)

            # If it's a model instance (Foreign Key) that somehow got resolved, get its primary key
            if hasattr(value, 'pk') and hasattr(value, '_meta'):
                ret[name] = value.pk
            else:
                ret[name] = value
        return ret

    def get_history_user_username(self, obj):
        return obj.history_user.username if obj.history_user else "System"
