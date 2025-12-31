from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

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

class CompanySettings(models.Model):
    name = models.CharField(_("Nombre de la Empresa"), max_length=255)
    tax_id = models.CharField(_("RUT/Tax ID"), max_length=20)
    address = models.TextField(_("Dirección"), blank=True)
    phone = models.CharField(_("Teléfono"), max_length=20, blank=True)
    email = models.EmailField(_("Email"), blank=True)
    website = models.URLField(_("Sitio Web"), blank=True)
    logo_url = models.URLField(_("URL del Logo"), blank=True)

    class Meta:
        verbose_name = _("Configuración de Empresa")
        verbose_name_plural = _("Configuración de Empresa")

    def __str__(self):
        return self.name
