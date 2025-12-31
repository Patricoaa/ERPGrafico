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

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
