from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', _('Administrador')
        ACCOUNTANT = 'ACCOUNTANT', _('Contador')
        OPERATOR = 'OPERATOR', _('Operador')

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OPERATOR,
        help_text=_("Rol del usuario en el sistema")
    )
    
    history = HistoricalRecords()

class CompanySettings(models.Model):
    name = models.CharField(_("Nombre de la Empresa"), max_length=255)
    tax_id = models.CharField(_("RUT/Tax ID"), max_length=20)
    address = models.TextField(_("Dirección"), blank=True)
    phone = models.CharField(_("Teléfono"), max_length=20, blank=True)
    email = models.EmailField(_("Email"), blank=True)
    website = models.URLField(_("Sitio Web"), blank=True)
    logo_url = models.URLField(_("URL del Logo"), blank=True)
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Configuración de Empresa")
        verbose_name_plural = _("Configuración de Empresa")

    def __str__(self):
        return self.name

class ActionLog(models.Model):
    class Type(models.TextChoices):
        LOGIN = 'LOGIN', _('Inicio de Sesión')
        LOGOUT = 'LOGOUT', _('Cierre de Sesión')
        EXPORT = 'EXPORT', _('Exportación de Datos')
        PRINT = 'PRINT', _('Impresión de Documento')
        SETTINGS_CHANGE = 'SETTINGS_CHANGE', _('Cambio de Configuración')
        SECURITY = 'SECURITY', _('Seguridad/Permisos')
        OTHER = 'OTHER', _('Otro')

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='action_logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    action_type = models.CharField(max_length=30, choices=Type.choices, default=Type.OTHER)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _("Log de Acción")
        verbose_name_plural = _("Logs de Acciones")
        ordering = ['-timestamp']

    def __str__(self):
        user_str = self.user.username if self.user else "System"
        return f"{self.timestamp} - {user_str}: {self.action_type}"
