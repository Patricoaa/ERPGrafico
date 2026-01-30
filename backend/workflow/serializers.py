from rest_framework import serializers
from .models import Task, Notification, TaskAssignmentRule
from core.serializers import UserSerializer, AttachmentSerializer

class TaskSerializer(serializers.ModelSerializer):
    assigned_to_data = UserSerializer(source='assigned_to', read_only=True)
    created_by_data = UserSerializer(source='created_by', read_only=True)
    completed_by_data = UserSerializer(source='completed_by', read_only=True)
    attachments_data = AttachmentSerializer(source='attachments', many=True, read_only=True)
    
    # We might want group data too
    assigned_group_name = serializers.ReadOnlyField(source='assigned_group.name')
    
    # Expose attachments count/brief or full info if needed
    # For now let's just make sure all fields are here
    
    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'completed_at', 'completed_by']
        
    def create(self, validated_data):
        # Auto-set created_by
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
        return super().create(validated_data)

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['user', 'created_at']

class TaskAssignmentRuleSerializer(serializers.ModelSerializer):
    assigned_user_data = UserSerializer(source='assigned_user', read_only=True)
    
    class Meta:
        model = TaskAssignmentRule
        fields = '__all__'
