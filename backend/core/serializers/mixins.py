from rest_framework import serializers

class CreatedByMixin:
    """
    Mixin for DRF serializers to automatically populate the 'created_by' field
    with the current authenticated user on creation.
    """
    def create(self, validated_data):
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)
