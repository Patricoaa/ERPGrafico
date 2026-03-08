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
