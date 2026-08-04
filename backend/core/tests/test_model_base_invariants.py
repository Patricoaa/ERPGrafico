"""
Test de arquitectura: verifica que todo modelo de negocio hereda de TimeStampedModel.

Actualizar EXEMPT_MODELS al agregar excepciones documentadas via ADR.
"""
import pytest
from django.apps import apps
from core.models.abstracts import TimeStampedModel

# Modelos explícitamente exentos con su justificación
EXEMPT_MODELS = {
    # Sistema / infraestructura Django
    "auth.Permission", "auth.Group", "auth.User",
    "contenttypes.ContentType",
    "sessions.Session",
    "admin.LogEntry",
    # simple_history genera tablas históricas que no heredan TimeStampedModel
    # (se identifican por tener "historical" en el nombre de la tabla)
    # → filtrado automático abajo
    # Terceros sin modificación posible
    "django_celery_beat.ClockedSchedule",
    "django_celery_beat.CrontabSchedule",
    "django_celery_beat.IntervalSchedule",
    "django_celery_beat.SolarSchedule",
    "django_celery_beat.PeriodicTask",
    "django_celery_beat.PeriodicTasks",
    "django_celery_results.TaskResult",
    "django_celery_results.GroupResult",
    "django_celery_results.ChordCounter",
    "authtoken.Token",
    "authtoken.TokenProxy",
    "core.ActionLog",
    "core.Attachment",
    "core.CompanySettings",
    "core.GlobalSearchIndex",
    "core.IdempotencyRecord",
    "core.PeriodReopenLog",
    "core.User",
    "core.UserPreference",
    # Proyecto — excepciones con ADR
    # (vaciar esta lista es el objetivo; cada entrada requerirá ADR-ref a menos que se migre)
    # Resto de los eximidos
}

PROJECT_APPS = {
    "accounting", "billing", "contacts", "core",
    "finances", "hr", "inventory", "production",
    "purchasing", "sales", "tax", "treasury", "workflow",
}

def test_all_business_models_inherit_timestampedmodel():
    violations = []
    for model in apps.get_models():
        app_label = model._meta.app_label
        model_label = f"{app_label}.{model.__name__}"
        
        if app_label not in PROJECT_APPS:
            continue
        if model_label in EXEMPT_MODELS:
            continue
        # Filtrar tablas históricas de simple_history
        if model.__name__.startswith("Historical"):
            continue
        
        if not issubclass(model, TimeStampedModel):
            violations.append(model_label)
    
    assert not violations, (
        f"Los siguientes modelos no heredan de TimeStampedModel. "
        f"Migrar o agregar a EXEMPT_MODELS con justificación ADR:\n"
        + "\n".join(f"  - {v}" for v in sorted(violations))
    )
