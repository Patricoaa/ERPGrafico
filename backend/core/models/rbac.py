from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.db import models


class GroupProfile(models.Model):
    ROLE = "ROLE"
    TEAM = "TEAM"
    KIND_CHOICES = [(ROLE, "Role"), (TEAM, "Team")]

    group = models.OneToOneField(Group, on_delete=models.CASCADE, related_name="profile")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default=TEAM)
    is_system = models.BooleanField(default=False)
    description = models.TextField(blank=True, default="")
    bundles = models.JSONField(default=list)
    extra_permissions = models.JSONField(default=list)
    excluded_permissions = models.JSONField(default=list)

    class Meta:
        verbose_name = "Group Profile"
        verbose_name_plural = "Group Profiles"

    def __str__(self):
        return f"{self.group.name} ({self.kind})"

    def clean(self):
        from core.rbac.bundles import BUNDLES
        from core.rbac.catalog import permission_catalog

        if self.kind == self.TEAM:
            if self.bundles or self.extra_permissions or self.excluded_permissions:
                raise ValidationError("A TEAM group cannot have bundles or permissions.")

        # Validate bundle keys exist
        for key in self.bundles:
            if key not in BUNDLES:
                raise ValidationError(f"Unknown bundle key: {key}")

        # Validate permission codes exist
        catalog = permission_catalog()
        for code in self.extra_permissions + self.excluded_permissions:
            if code not in catalog:
                raise ValidationError(f"Unknown permission code: {code}")
