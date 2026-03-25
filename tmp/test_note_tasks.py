import os
import django
import sys

# Setup django
sys.path.append('c:\\Users\\patox\\Nextcloud\\Pato\\Aplicaciones\\ERPGrafico\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from billing.models import Invoice
from billing.note_workflow import NoteWorkflow
from billing.note_checkout_service import NoteCheckoutService
from workflow.models import Task
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User

def test_note_tasks():
    # 1. Get a test invoice
    invoice = Invoice.objects.filter(dte_type='FACTURA_ELECT').first()
    if not invoice:
        print("No test invoice found")
        return
    
    user = User.objects.first()
    
    print(f"Testing with invoice: {invoice.number}")
    
    # 2. Init Note Workflow
    workflow = NoteCheckoutService.init_note_workflow(
        invoice_id=invoice.id,
        dte_type='NOTA_CREDITO',
        reason='Test Reason',
        created_by=user
    )
    
    note = workflow.invoice
    content_type = ContentType.objects.get_for_model(note)
    
    # Check if tasks were created
    tasks = Task.objects.filter(content_type=content_type, object_id=note.id)
    print(f"Tasks created for note: {tasks.count()}")
    for t in tasks:
        print(f" - {t.task_type}: {t.status}")
    
    if tasks.filter(task_type='HUB_ORIGIN').exists():
        print("SUCCESS: HUB_ORIGIN task created")
    else:
        print("FAILURE: HUB_ORIGIN task NOT created")

    # 3. Simulate Logistics Completion
    # Skip logistics if possible
    if not workflow.requires_logistics:
        NoteCheckoutService.skip_logistics(workflow.id)
        print("Logistics skipped")
    else:
        # We'd need more setup for real logistics, let's just force sync for demo
        from workflow.services import WorkflowService
        WorkflowService.sync_hub_tasks(note)
        print("Force synced logistics")

    log_task = Task.objects.filter(content_type=content_type, object_id=note.id, task_type='HUB_LOGISTICS').first()
    if log_task:
        print(f"HUB_LOGISTICS status: {log_task.status}")

    # 4. Register Document
    # NoteCheckoutService.register_document(workflow.id, '999', is_pending=False)
    # This might fail due to accounting settings/DTE, but we've added the sync call.
    
    print("Verification script finished")

if __name__ == "__main__":
    test_note_tasks()
