from django.db import models
from django.utils.translation import gettext_lazy as _

from .abstracts import TimeStampedModel


class BackgroundJob(TimeStampedModel):
    """
    Motor global para procesos asíncronos pesados (importaciones, exportaciones masivas,
    cálculos de reportes que superan el timeout de HTTP).
    """

    class JobType(models.TextChoices):
        IMPORT = "IMPORT", _("Importación")
        EXPORT = "EXPORT", _("Exportación")
        REPORT = "REPORT", _("Reporte Pesado")

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pendiente")
        PROCESSING = "PROCESSING", _("Procesando")
        COMPLETED = "COMPLETED", _("Completado")
        FAILED = "FAILED", _("Fallido")
        CANCELLED = "CANCELLED", _("Cancelado")

    user = models.ForeignKey(
        "core.User", on_delete=models.CASCADE, related_name="background_jobs"
    )
    job_type = models.CharField(_("Tipo"), max_length=20, choices=JobType.choices)
    status = models.CharField(
        _("Estado"), max_length=20, choices=Status.choices, default=Status.PENDING
    )

    title = models.CharField(_("Título"), max_length=255, help_text="Ej: Exportación de Productos")
    progress_percent = models.PositiveIntegerField(_("Progreso %"), default=0)

    # URL to the generated file in S3/MinIO
    result_file_url = models.URLField(_("URL de Resultado"), blank=True, null=True, max_length=1024)
    
    # Store stack trace or user friendly error
    error_message = models.TextField(_("Mensaje de Error"), blank=True)

    completed_at = models.DateTimeField(_("Completado el"), null=True, blank=True)

    class Meta:
        verbose_name = _("Trabajo en Segundo Plano")
        verbose_name_plural = _("Trabajos en Segundo Plano")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_job_type_display()} - {self.status} ({self.progress_percent}%)"
