from celery import shared_task
from django.db import transaction
from inventory.models import Product
from workflow.models import WorkflowSettings
from workflow.services import WorkflowService

import logging
logger = logging.getLogger(__name__)

@shared_task
def check_product_margin_task(product_id):
    """
    Checks if a product's current margin has fallen below the configured threshold.
    If so, triggers a LOW_MARGIN_ALERT notification.
    """
    try:
        product = Product.objects.get(id=product_id)
        
        # We only care about storable products with fixed pricing
        if product.product_type != Product.Type.STORABLE or product.is_dynamic_pricing:
            return
            
        # Ensure we have valid prices
        if not product.sale_price or product.sale_price <= 0:
            return
            
        settings = WorkflowSettings.get_settings()
        threshold = settings.low_margin_threshold_percent
        
        # If threshold is 0, the feature is manually disabled
        if not threshold or threshold <= 0:
            return
            
        sale_price = float(product.sale_price)
        cost_price = float(product.cost_price)
        
        # Calculate Margin: ((Sale - Cost) / Sale) * 100
        margin_percent = ((sale_price - cost_price) / sale_price) * 100
        
        if margin_percent < float(threshold):
            # Create the link to the product editing page
            # This points to the products tab, and standardizes 'action=edit' so the frontend opens the modal
            link = f"/inventory/products?tab=products&action=edit&id={product.id}"
            title = "Alerta de Margen Bajo"
            message = (
                f"El margen del producto {product.internal_code} - {product.name} "
                f"ha caído a {margin_percent:.1f}%, lo cual está por debajo del umbral configurado "
                f"({threshold}%).\n"
                f"Costo Promedio: ${cost_price:,.0f}\n"
                f"Precio de Venta (Neto): ${sale_price:,.0f}\n"
            )
            
            # Send notification using the service (will follow rules configured in UI)
            # Level WARNING because it requires attention
            WorkflowService.send_notification(
                notification_type='LOW_MARGIN_ALERT',
                title=title,
                message=message,
                link=link,
                level='WARNING'
            )
            logger.info(f"Sent low margin alert for product {product.id} (Margin: {margin_percent:.1f}%)")
            
    except Product.DoesNotExist:
        logger.warning(f"Product {product_id} not found in check_product_margin_task")
    except Exception as e:
        logger.error(f"Error checking margin for product {product_id}: {str(e)}")
