import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erpgrafico.settings')
django.setup()

from inventory.tasks import check_product_margin_task
from inventory.models import Product
from workflow.models import WorkflowSettings

def verify_margin_check():
    # 1. Update settings
    settings = WorkflowSettings.get_settings()
    settings.low_margin_threshold_percent = 20.0 # Set threshold to 20%
    settings.save()
    print(f"Set threshold to: {settings.low_margin_threshold_percent}%")

    # 2. Find a STORABLE product with fixed pricing
    product = Product.objects.filter(
        product_type=Product.Type.STORABLE, 
        is_dynamic_pricing=False,
        sale_price__gt=0,
        cost_price__gt=0
    ).first()

    if not product:
        print("No suitable product found for testing.")
        return

    print(f"Testing with Product {product.id} ({product.name})")
    print(f"Current Cost: {product.cost_price}")
    print(f"Current Sale Price: {product.sale_price}")

    # Calculate actual margin
    sale_price = float(product.sale_price)
    cost_price = float(product.cost_price)
    margin = ((sale_price - cost_price) / sale_price) * 100
    print(f"Actual Margin: {margin:.2f}%")

    # 3. Temporarily change cost to force a low margin (e.g. 5%)
    # Let's say we want 5% margin => cost = sale_price * 0.95
    new_cost = sale_price * 0.95
    
    # Bypass signals to avoid celery delay, simply test the task function directly
    product.cost_price = new_cost
    product.save(update_fields=['cost_price'])
    
    print(f"--- Updated Cost to {new_cost} (Expected margin: 5%) ---")
    
    # 4. Call the task directly (synchronously)
    print("Calling check_product_margin_task...")
    check_product_margin_task(product.id)
    print("Task execution finished.")

if __name__ == '__main__':
    verify_margin_check()
