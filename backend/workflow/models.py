from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from core.models import User

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
