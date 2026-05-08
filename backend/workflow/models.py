from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import Group
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from core.models import User, TimeStampedModel

class TaskAssignmentRule(models.Model):
    """
    Defines who gets assigned to specific types of tasks.
    Configurable via frontend.
    """
    task_type = models.CharField(_("Tipo de Tarea"), max_length=100, unique=True, help_text="Identificador único del tipo (ej: OT_PREPRESS_APPROVAL)")
    description = models.CharField(_("Descripción"), max_length=255, blank=True)
    
    assigned_user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='assignment_rules',
        verbose_name=_("Usuario Asignado por Defecto")
    )
    
    assigned_group = models.CharField(
        _("Grupo Asignado (Legacy)"), 
        max_length=100, 
        blank=True, 
        help_text="Si no hay usuario, se puede usar un string para lógica custom"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Regla de Asignación")
        verbose_name_plural = _("Reglas de Asignación")

    def __str__(self):
        return f"{self.task_type} -> {self.assigned_user or self.assigned_group}"


class Task(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        IN_PROGRESS = 'IN_PROGRESS', _('En Proceso')
        COMPLETED = 'COMPLETED', _('Completada')
        REJECTED = 'REJECTED', _('Rechazada')
        CANCELLED = 'CANCELLED', _('Cancelada')

    class Priority(models.TextChoices):
        LOW = 'LOW', _('Baja')
        MEDIUM = 'MEDIUM', _('Media')
        HIGH = 'HIGH', _('Alta')
        CRITICAL = 'CRITICAL', _('Crítica')

    class Category(models.TextChoices):
        APPROVAL = 'APPROVAL', _('Aprobación de Flujo')
        TASK = 'TASK', _('Tarea Operativa')

    title = models.CharField(_("Título"), max_length=255)
    description = models.TextField(_("Descripción"), blank=True)
    
    task_type = models.CharField(_("Tipo"), max_length=100, db_index=True)
    status = models.CharField(_("Estado"), max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    priority = models.CharField(_("Prioridad"), max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    
    # Assignment
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    assigned_group = models.ForeignKey(
        Group, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='assigned_tasks',
        verbose_name=_("Grupo Asignado")
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_tasks')
    completed_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='completed_tasks',
        verbose_name=_("Completada por"),
        help_text="Usuario que completó/aprobó esta tarea"
    )
    
    # Category
    category = models.CharField(
        _("Categoría"), 
        max_length=20, 
        choices=Category.choices, 
        default=Category.APPROVAL,
        db_index=True,
        help_text="APPROVAL: Aprobación de flujo | TASK: Tarea operativa"
    )
    
    # Generic Link to any object (OT, OC, Invoice, etc)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Extra data (JSON)
    data = models.JSONField(default=dict, blank=True)
    
    notes = models.TextField(_("Notas"), blank=True)
    attachments = GenericRelation('core.Attachment')

    due_date = models.DateTimeField(_("Fecha Vencimiento"), null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Tarea")
        verbose_name_plural = _("Tareas")
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.status}] {self.title}"


class Notification(models.Model):
    class Type(models.TextChoices):
        INFO = 'INFO', _('Información')
        SUCCESS = 'SUCCESS', _('Éxito')
        WARNING = 'WARNING', _('Advertencia')
        ERROR = 'ERROR', _('Error')

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(_("Título"), max_length=255)
    message = models.TextField(_("Mensaje"))
    
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.INFO)
    read = models.BooleanField(_("Leída"), default=False)
    
    link = models.CharField(_("Enlace"), max_length=500, blank=True, help_text="URL relativa para redirigir al usuario")
    data = models.JSONField(default=dict, blank=True)
    notification_type = models.CharField(_("Tipo de Evento"), max_length=100, blank=True, db_index=True)
    
    # Construct link context
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Notificación")
        verbose_name_plural = _("Notificaciones")
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user}: {self.title}"


class WorkflowSettings(TimeStampedModel):
    """
    Singleton model for global workflow configurations.
    NOTE: created_at / updated_at heredados de TimeStampedModel (T-14).
    WorkflowSettings tenía updated_at manual; ahora heredado. Se añade created_at.
    """
    # F29 Recurring Task Days
    f29_creation_day = models.PositiveIntegerField(
        _("Día Creación F29"),
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(28)],
        help_text=_("Día del mes para generar la tarea de creación del F29")
    )
    f29_payment_day = models.PositiveIntegerField(
        _("Día Pago F29"),
        default=20,
        validators=[MinValueValidator(1), MaxValueValidator(28)],
        help_text=_("Día del mes para generar la tarea de pago del F29")
    )
    period_close_day = models.PositiveIntegerField(
        _("Día Cierre Periodo"),
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(28)],
        help_text=_("Día del mes para generar la tarea de cierre de periodo contable")
    )
    
    # Notification Settings
    low_margin_threshold_percent = models.DecimalField(
        _("Umbral de Margen Bajo (%)"),
        max_digits=5,
        decimal_places=2,
        default=10.00,
        validators=[MinValueValidator(0)],
        help_text=_("Si el margen de un producto baja de este porcentaje, se envía una notificación (0 para desactivar).")
    )

    # updated_at heredado de TimeStampedModel; campo manual eliminado (T-14).

    class Meta:
        verbose_name = _("Configuración de Flujo")
        verbose_name_plural = _("Configuración de Flujos")

    class FormMeta:
        exclude_fields = []  # Sin campos sensibles — días de ciclo y umbrales numéricos.

    def __str__(self):
        return "Configuración de Flujo Global"

    def save(self, *args, **kwargs):
        self.pk = 1  # Force singleton
        super().save(*args, **kwargs)
        # Invalidate Redis cache
        from core.cache import invalidate_singleton, CACHE_KEY_WORKFLOW_SETTINGS
        invalidate_singleton(CACHE_KEY_WORKFLOW_SETTINGS)

    @classmethod
    def get_settings(cls):
        from core.cache import cached_singleton, CACHE_KEY_WORKFLOW_SETTINGS
        return cached_singleton(cls, CACHE_KEY_WORKFLOW_SETTINGS)

class NotificationRule(models.Model):
    """
    Defines who gets notified for specific system events.
    """
    notification_type = models.CharField(
        _("Tipo de Notificación"), 
        max_length=100, 
        unique=True, 
        help_text="Identificador único (ej: POS_CREDIT_APPROVAL, SUBSCRIPTION_OC_CREATED)"
    )
    description = models.CharField(_("Descripción"), max_length=255, blank=True)
    
    notify_creator = models.BooleanField(
        _("Notificar al Creador"), 
        default=True,
        help_text="Si está marcado, se notificará al usuario que inició la acción (ej: quien pidió el crédito)."
    )

    assigned_user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='notification_rules',
        verbose_name=_("Usuario Extra a Notificar")
    )
    
    assigned_group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notification_rules',
        verbose_name=_("Grupo Extra a Notificar")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Regla de Notificación")
        verbose_name_plural = _("Reglas de Notificación")

    def __str__(self):
        destinatarios = []
        if self.notify_creator: destinatarios.append("Creador")
        if self.assigned_user: destinatarios.append(str(self.assigned_user))
        if self.assigned_group: destinatarios.append(f"Grupo:{self.assigned_group.name}")
        return f"{self.notification_type} -> {', '.join(destinatarios)}"
