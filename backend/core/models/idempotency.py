from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class IdempotencyRecord(models.Model):
    """
    Registro de operación idempotente por clave + scope.

    Ver docs/20-contracts/idempotency.md y docs/30-playbooks/add-bulk-import.md.

    Consumida por el decorador @idempotent_endpoint (core.idempotency).
    No se registra en simple_history: TTL 24h, los registros se purgan a diario.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("En proceso")
        DONE = "done", _("Completado")
        ERROR = "error", _("Error")

    key = models.CharField(
        _("Clave"),
        max_length=64,
        help_text=_("UUID generado por el cliente en el handler que origina la acción."),
    )
    scope = models.CharField(
        _("Scope"),
        max_length=128,
        help_text=_("Identificador del endpoint, e.g. 'billing.invoice.create'."),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="idempotency_records",
        verbose_name=_("Usuario"),
    )
    body_hash = models.CharField(
        _("Hash del body"),
        max_length=64,
        help_text=_("SHA-256 hex del request body — detecta reuso del key con payload distinto."),
    )
    response_status = models.IntegerField(
        _("HTTP status cacheado"),
        null=True,
        blank=True,
    )
    response_payload = models.JSONField(
        _("Payload cacheado"),
        null=True,
        blank=True,
    )
    status = models.CharField(
        _("Estado"),
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(
        _("Creado el"),
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        verbose_name = _("Registro de Idempotencia")
        verbose_name_plural = _("Registros de Idempotencia")
        constraints = [
            models.UniqueConstraint(
                fields=["key", "scope"],
                name="uniq_idempotency_key_scope",
            ),
        ]
        indexes = [
            models.Index(fields=["created_at"], name="idx_idempotency_created"),
        ]

    def __str__(self) -> str:
        return f"{self.scope}:{self.key}[{self.status}]"
