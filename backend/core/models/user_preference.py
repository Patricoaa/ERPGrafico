from django.db import models
from django.utils.translation import gettext_lazy as _


class UserPreference(models.Model):
    user = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="preferences", verbose_name=_("Usuario")
    )
    key = models.CharField(max_length=255, verbose_name=_("Clave"))
    value = models.JSONField(default=dict, blank=True, verbose_name=_("Valor"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Actualizado en"))

    class Meta:
        unique_together = ("user", "key")
        verbose_name = _("Preferencia de Usuario")
        verbose_name_plural = _("Preferencias de Usuario")

    def __str__(self):
        return f"{self.user.username}:{self.key}"
