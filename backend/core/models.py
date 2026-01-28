from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from simple_history.models import HistoricalRecords
import os
import uuid

class User(AbstractUser):
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

def attachment_upload_path(instance, filename):
    ext = filename.split('.')[-1]
    name = f"{uuid.uuid4()}.{ext}"
    
    # Try to organize by model name if available
    try:
        if instance.content_type:
            model_name = instance.content_type.model
            return os.path.join('attachments', model_name, name)
    except:
        pass
    
    return os.path.join('attachments', 'general', name)

class Attachment(models.Model):
    file = models.FileField(_("Archivo"), upload_to=attachment_upload_path)
    original_filename = models.CharField(_("Nombre Original"), max_length=255)
    
    # Generic Relation
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='attachments')
    
    # Metadata
    file_size = models.PositiveIntegerField(_("Tamaño (Bytes)"), null=True, blank=True)
    mime_type = models.CharField(_("Tipo MIME"), max_length=100, null=True, blank=True)

    class Meta:
        verbose_name = _("Adjunto")
        verbose_name_plural = _("Adjuntos")
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_filename} ({self.content_type.model} #{self.object_id})"

    def save(self, *args, **kwargs):
        if self.file and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)
