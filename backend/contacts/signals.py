from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Contact

@receiver(post_save, sender=Contact)
def handle_default_contact_flags(sender, instance, created, **kwargs):
    """
    Ensure that only one contact is marked as the default customer or vendor at any given time.
    Extracted from Contact.save() for T-23.
    """
    if instance.is_default_customer:
        Contact.objects.filter(is_default_customer=True).exclude(pk=instance.pk).update(is_default_customer=False)
        
    if instance.is_default_vendor:
        Contact.objects.filter(is_default_vendor=True).exclude(pk=instance.pk).update(is_default_vendor=False)
