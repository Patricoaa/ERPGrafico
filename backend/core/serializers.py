from rest_framework import serializers
from .models import User, CompanySettings

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
