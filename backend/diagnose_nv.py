import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from sales.models import SaleOrder
from workflow.models import Task
from django.contrib.contenttypes.models import ContentType

def diagnose():
    order_number = '000010'
    order = SaleOrder.objects.filter(number__icontains=order_number).first()
    
    if not order:
        print(f"Error: SaleOrder with number containing '{order_number}' not found.")
        # Try finding any SaleOrder
        last_orders = SaleOrder.objects.order_by('-id')[:5]
        print("Recent orders:")
        for o in last_orders:
            print(f" - {o.number} (ID: {o.id})")
        return

    print(f"Order Number: {order.number}")
    print(f"Order ID: {order.id}")
    print(f"Order Status: {order.status}")
    
    ct = ContentType.objects.get_for_model(order)
    tasks = Task.objects.filter(content_type=ct, object_id=order.id)
    print(f"\nTasks found: {tasks.count()}")
    for t in tasks:
        print(f" - Task ID: {t.id}")
        print(f"   Title: {t.title}")
        print(f"   Type: {t.task_type}")
        print(f"   Status: {t.status}")
        print(f"   Category: {t.category}")
        print(f"   Completed At: {t.completed_at}")

    print(f"\nInvoices found: {order.invoices.count()}")
    for inv in order.invoices.all():
        print(f" - Invoice Number: '{inv.number}'")
        print(f"   Status: {inv.status}")
        print(f"   Type: {inv.type}")

if __name__ == "__main__":
    diagnose()
