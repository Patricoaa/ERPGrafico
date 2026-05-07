from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from workflow.models import Notification

@receiver(post_save, sender=Notification)
def push_notification_to_channels(sender, instance, created, **kwargs):
    """
    Automatically sends a WebSocket message when a new notification is created.
    """
    if created:
        channel_layer = get_channel_layer()
        group_name = f"notifications_user_{instance.user.id}"
        
        # Prepare payload
        payload = {
            "id": instance.id,
            "title": instance.title,
            "message": instance.message,
            "type": instance.type,
            "notification_type": instance.notification_type,
            "link": instance.link,
            "data": instance.data,
            "created_at": instance.created_at.isoformat(),
            "read": instance.read
        }
        
        # Send to Channels
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "send_notification",
                "notification": payload
            }
        )
