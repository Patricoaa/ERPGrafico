import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from workflow.services import WorkflowService
from django.db import transaction

def sync_all():
    print("Iniciando sincronización global de tareas HUB...")
    
    # 1. Sync all Sale Orders (Confirmed or later)
    sales = SaleOrder.objects.exclude(status='DRAFT')
    print(f"Sincronizando {sales.count()} Notas de Venta...")
    for order in sales:
        try:
            with transaction.atomic():
                WorkflowService.sync_hub_tasks(order)
        except Exception as e:
            print(f"Error sincronizando NV {order.number}: {e}")

    # 2. Sync all Purchase Orders (Confirmed or later)
    purchases = PurchaseOrder.objects.exclude(status='DRAFT')
    print(f"Sincronizando {purchases.count()} Órdenes de Compra...")
    for order in purchases:
        try:
            with transaction.atomic():
                WorkflowService.sync_hub_tasks(order)
        except Exception as e:
            print(f"Error sincronizando OC {order.number}: {e}")

    print("Sincronización completada.")

if __name__ == "__main__":
    sync_all()
