from rest_framework import serializers

from core.serializers import AttachmentSerializer, UserSerializer

from .models import (
    ApprovalPolicy,
    Comment,
    Notification,
    NotificationRule,
    Task,
    TaskAssignmentRule,
    TaskEvent,
    WorkflowSettings,
)


class TaskEventSerializer(serializers.ModelSerializer):
    """One entry of a task's history. Attachments are resolved from the task's own (prefetched) list."""

    user_name = serializers.SerializerMethodField()
    attachments_data = serializers.SerializerMethodField()

    class Meta:
        model = TaskEvent
        fields = ["id", "action", "user", "user_name", "notes", "confirmations", "attachments_data", "created_at"]

    def get_user_name(self, obj):
        if not obj.user:
            return None
        return obj.user.get_full_name() or obj.user.username

    def get_attachments_data(self, obj):
        if not obj.attachment_ids:
            return []
        wanted = set(obj.attachment_ids)
        return [
            {"id": a.id, "file": a.file.url if a.file else None, "original_filename": a.original_filename}
            for a in obj.task.attachments.all()
            if a.id in wanted
        ]


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_data = UserSerializer(source="assigned_to", read_only=True)
    created_by_data = UserSerializer(source="created_by", read_only=True)
    completed_by_data = UserSerializer(source="completed_by", read_only=True)
    attachments_data = AttachmentSerializer(source="attachments", many=True, read_only=True)
    events_data = TaskEventSerializer(source="events", many=True, read_only=True)

    # We might want group data too
    assigned_group_name = serializers.ReadOnlyField(source="assigned_group.name")

    # Expose attachments count/brief or full info if needed
    # For now let's just make sure all fields are here

    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = [
            "created_by",
            "created_at",
            "updated_at",
            "completed_at",
            "completed_by",
        ]

    def create(self, validated_data):
        # Auto-set created_by
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ["user", "created_at"]


class _GroupMinSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class TaskAssignmentRuleSerializer(serializers.ModelSerializer):
    assigned_user_data = UserSerializer(source="assigned_user", read_only=True)
    assigned_group_data = _GroupMinSerializer(source="assigned_group", read_only=True)

    class Meta:
        model = TaskAssignmentRule
        fields = "__all__"


class WorkflowSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowSettings
        fields = [
            "f29_creation_day",
            "f29_payment_day",
            "period_close_day",
            "low_margin_threshold_percent",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class NotificationRuleSerializer(serializers.ModelSerializer):
    assigned_user_data = UserSerializer(source="assigned_user", read_only=True)
    assigned_group_name = serializers.ReadOnlyField(source="assigned_group.name")

    class Meta:
        model = NotificationRule
        fields = "__all__"


class ApprovalPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalPolicy
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class CommentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    source_label = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "user", "user_name", "text", "created_at", "source_label"]
        read_only_fields = ["id", "user", "user_name", "created_at", "source_label"]

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return "Sistema"

    def get_source_label(self, obj):
        from core.prefix_registry import EntityPrefix
        model_name = obj.content_type.model if obj.content_type else ""
        if model_name == "workorder":
            return EntityPrefix.WORK_ORDER
        if model_name in ("saleorder", "invoice"):
            return EntityPrefix.SALE_ORDER
        return model_name.upper()
