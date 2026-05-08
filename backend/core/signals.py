from django.db.models.signals import post_save
from django.dispatch import receiver
from contacts.models import Contact
from .models import CompanySettings

@receiver(post_save, sender=Contact)
def sync_contact_to_company_settings(sender, instance, **kwargs):
    """
    Update CompanySettings if the modified contact is linked to it.
    Avoids infinite loops by checking values before saving.
    """
    settings = CompanySettings.objects.filter(contact=instance).first()
    if settings:
        updated = False
        if settings.name != instance.name:
            settings.name = instance.name
            updated = True
        if settings.tax_id != instance.tax_id:
            settings.tax_id = instance.tax_id
            updated = True
        if settings.email != instance.email:
            settings.email = instance.email
            updated = True
        if settings.phone != instance.phone:
            settings.phone = instance.phone
            updated = True
        if settings.address != instance.address:
            settings.address = instance.address
            updated = True
            
        if updated:
            # We use save() but carefully. 
            # The CompanySettings.save() will trigger another Contact.save(), 
            # but since we check values here, it should terminate.
            settings.save()

from django.db.models.signals import post_migrate
from django.core.cache import cache

@receiver(post_migrate)
def clear_schema_cache_on_migrate(sender, **kwargs):
    """
    Regla P-06: Limpia todas las cachés de schemas (schema:*) luego de una migración, 
    ya que los modelos, metadatos y permisos pueden haber cambiado drásticamente.
    """
    # Si se usa un caché compatible con wildcard (como Redis):
    try:
        cache.delete_pattern("schema:*")
    except AttributeError:
        # Fallback para locmem o memcached que no soportan delete_pattern.
        # Solo limpia todo si no hay delete_pattern.
        cache.clear()
