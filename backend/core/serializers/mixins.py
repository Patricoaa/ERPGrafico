
from rest_framework import serializers

from core.edit_policy import frozen_fields, is_editable


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


class IsEditableField(serializers.ReadOnlyField):
    """Read-only ``is_editable`` from the model's edit_policy (ADR-0091)."""

    def __init__(self, **kwargs):
        super().__init__(source="*", **kwargs)

    def to_representation(self, instance):
        return is_editable(instance)


class FrozenFieldsField(serializers.ReadOnlyField):
    """Fields the form must disable because the record already has history (ADR-0091).

    Requires the viewset queryset to go through ``annotate_edit_usage``.
    """

    def __init__(self, **kwargs):
        super().__init__(source="*", **kwargs)

    def to_representation(self, instance):
        return frozen_fields(instance)
