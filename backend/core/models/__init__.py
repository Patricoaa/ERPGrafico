from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from simple_history.models import HistoricalRecords
import os
import uuid
from core.validators import validate_file_size, validate_file_extension, validate_image_extension
from core.storages import PublicMediaStorage, PrivateMediaStorage

from .abstracts import TimeStampedModel, AuditedModel, TransactionalDocument

__all__ = [
    'User',
    'CompanySettings',
    'ActionLog',
    'Attachment',
    'attachment_upload_path',
    'TimeStampedModel',
    'AuditedModel',
    'TransactionalDocument',
]


class User(AbstractUser):
    pos_pin = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        help_text=_("PIN para Punto de Venta (hasheado)")
    )

    def set_pos_pin(self, raw_pin):
        from django.contrib.auth.hashers import make_password
        self.pos_pin = make_password(raw_pin)

    def check_pos_pin(self, raw_pin):
        if not self.pos_pin:
            return False
        from django.contrib.auth.hashers import check_password
        return check_password(raw_pin, self.pos_pin)
    contact = models.OneToOneField(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='system_user',
        help_text=_("Vínculo con la entidad física de Contacto")
    )
    history = HistoricalRecords()

class CompanySettings(models.Model):
    name = models.CharField(_("Razón Social"), max_length=255)
    trade_name = models.CharField(_("Nombre de Fantasía"), max_length=255, blank=True)
    tax_id = models.CharField(_("RUT/Tax ID"), max_length=20)
    address = models.TextField(_("Dirección"), blank=True)
    phone = models.CharField(_("Teléfono"), max_length=20, blank=True)
    email = models.EmailField(_("Email"), blank=True)
    website = models.URLField(_("Sitio Web"), blank=True)
    logo_url = models.URLField(_("URL del Logo"), blank=True)
    logo = models.ImageField(
        _("Logo"),
        upload_to='company/logos/',
        storage=PublicMediaStorage(),
        null=True,
        blank=True,
        validators=[validate_file_size, validate_image_extension]
    )

    # Association with Contact
    contact = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='company_settings',
        help_text=_("Vínculo con el contacto que representa a esta empresa")
    )

    # Corporate Identity
    business_activity = models.CharField(_("Giro / Actividad Económica"), max_length=255, blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Configuración de Empresa")
        verbose_name_plural = _("Configuración de Empresa")

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Enforce "Single Source of Truth":
        # If a contact is linked, company details MUST match that contact.
        # We pull from contact instead of pushing to it, to avoid overwriting
        # contact data with stale or empty company settings data.
        if self.contact:
            c = self.contact
            self.name = c.name
            self.tax_id = c.tax_id
            self.email = c.email
            self.phone = c.phone
            self.address = c.address

        super().save(*args, **kwargs)

        # Invalidate Redis cache
        from core.cache import invalidate_singleton, CACHE_KEY_COMPANY_SETTINGS
        invalidate_singleton(CACHE_KEY_COMPANY_SETTINGS)

    @classmethod
    def get_solo(cls):
        from core.cache import cached_singleton, CACHE_KEY_COMPANY_SETTINGS
        return cached_singleton(cls, CACHE_KEY_COMPANY_SETTINGS)

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
    file = models.FileField(
        _("Archivo"),
        upload_to=attachment_upload_path,
        storage=PrivateMediaStorage(),
        validators=[validate_file_size, validate_file_extension]
    )
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
