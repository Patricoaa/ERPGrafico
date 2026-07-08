from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class PeriodReopenLog(models.Model):
    class PeriodType(models.TextChoices):
        ACCOUNTING = "ACCOUNTING", _("Periodo Contable")
        TAX = "TAX", _("Periodo Tributario (F29)")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="period_reopen_logs",
    )
    period_type = models.CharField(max_length=20, choices=PeriodType.choices)
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    period_id = models.PositiveIntegerField()
    reason = models.TextField(blank=True)
    status_before = models.CharField(max_length=30)
    status_after = models.CharField(max_length=30)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("Registro de Reapertura")
        verbose_name_plural = _("Registros de Reapertura")

    def __str__(self):
        user_str = self.user.username if self.user else "System"
        return (
            f"{user_str} reabrió {self.get_period_type_display()} "
            f"{self.month}/{self.year} ({self.status_before}→{self.status_after})"
        )
