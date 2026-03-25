import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from sales.models import SaleOrder, SaleLine
from contacts.models import Contact
from workflow.services import WorkflowService
from treasury.models import TreasuryMovement, TreasuryAccount, PaymentMethod
from decimal import Decimal
from workflow.models import Task
from django.utils import timezone

def verify():
    # 1. Setup minimal data
    contact = Contact.objects.first()
    if not contact:
        print("No contact found, please run setup_demo_data first.")
        return

    order = SaleOrder.objects.create(
        customer=contact,
        total=Decimal('1000'),
        status='CONFIRMED'
    )
    print(f"Created SaleOrder {order.id}")

    # 2. Add payment
    method = PaymentMethod.objects.first()
    acc = TreasuryAccount.objects.first()
    
    TreasuryMovement.objects.create(
        sale_order=order,
        amount=Decimal('1000'),
        movement_type='INBOUND',
        payment_method='CASH', # Cash doesn't need registration
        status='POSTED',
        date=timezone.now().date(),
        treasury_account=acc
    )
    print("Added full payment (CASH)")

    # 3. Sync Hub Tasks
    WorkflowService.sync_hub_tasks(order)
    print("Synced Hub Tasks")

    # 4. Check Treasury Task
    treasury_task_type = WorkflowService.HUB_STAGE_TASK_TYPES['treasury']
    task = Task.objects.filter(
        object_id=order.id,
        task_type=treasury_task_type
    ).first()

    if task:
        print(f"Treasury Task status: {task.status}")
        if task.status == Task.Status.COMPLETED:
            print("SUCCESS: Treasury task is COMPLETED.")
        else:
            print(f"FAILURE: Treasury task is {task.status}, expected COMPLETED.")
            # Debugging info
            print(f"Pending amount: {order.pending_amount}")
            print(f"Is stage complete? {WorkflowService.is_hub_stage_complete(order, 'treasury')}")
    else:
        print("FAILURE: Treasury task not found.")

if __name__ == "__main__":
    verify()
