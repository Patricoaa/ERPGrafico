from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import DraftCart
from .draft_cart_serializers import DraftCartSerializer

@receiver(post_save, sender=DraftCart)
def notify_draft_update(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    group_name = f'pos_session_{instance.pos_session_id}'
    
    # Serializamos el objeto completo para que el frontend no tenga que hacer GET
    serializer = DraftCartSerializer(instance)
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'pos_draft_update',
            'data': {
                'event': 'CREATED' if created else 'UPDATED',
                'draft': serializer.data
            }
        }
    )

@receiver(post_delete, sender=DraftCart)
def notify_draft_delete(sender, instance, **kwargs):
    channel_layer = get_channel_layer()
    group_name = f'pos_session_{instance.pos_session_id}'
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'pos_draft_update',
            'data': {
                'event': 'DELETED',
                'draft_id': instance.id,
            }
        }
    )

from .models import SaleOrder
@receiver(post_save, sender=SaleOrder)
@receiver(post_delete, sender=SaleOrder)
def handle_sale_order_cache_invalidation(sender, instance, **kwargs):
    from core.cache import invalidate_report_cache
    invalidate_report_cache('contacts')
