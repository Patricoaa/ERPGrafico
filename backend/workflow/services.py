from django.utils import timezone
from django.db import transaction

from .models import Task, Notification, TaskAssignmentRule, NotificationRule

class WorkflowService:
    """
    Central service to handle business logic for Workflows.
    """

    @staticmethod
    def get_assignee_for_task_type(task_type):
        """
        Finds the user or group assigned to this task type.
        Returns dict with keys 'user', 'group' or None.
        """
        try:
            rule = TaskAssignmentRule.objects.get(task_type=task_type)
            return {
                'user': rule.assigned_user,
                'group': rule.assigned_group
            }
        except TaskAssignmentRule.DoesNotExist:
            return None

    @staticmethod
    def create_task(task_type, title, description, content_object=None, priority=Task.Priority.MEDIUM, created_by=None, data=None, category=Task.Category.APPROVAL):
        """
        Creates a new task.
        If rule specifies a user, assigned_to is set.
        If rule specifies a group, assigned_to is None, but data['candidate_group'] is set (Pool Assignment).
        
        category: APPROVAL (default) for workflow approvals, TASK for operational tasks
        """
        assignee_info = WorkflowService.get_assignee_for_task_type(task_type)
        assigned_user = None
        candidate_group = None

        if assignee_info:
            assigned_user = assignee_info.get('user')
            candidate_group = assignee_info.get('group')

        # If data is None initialize it
        task_data = data or {}
        
        # If pool assignment (Group but no User)
        if candidate_group and not assigned_user:
            task_data = {**task_data, 'candidate_group': candidate_group}
        
        task = Task.objects.create(
            title=title,
            description=description,
            task_type=task_type,
            priority=priority,
            created_by=created_by,
            assigned_to=assigned_user,
            content_object=content_object,
            data=task_data,
            category=category
        )
        
        if assigned_user:
            WorkflowService.notify_assignment(task)
        elif candidate_group:
            WorkflowService.notify_group_assignment(task, candidate_group)
            
        return task

    # --- HUB Stage Tasks ---
    
    HUB_STAGES = [
        ('origin', 'Origen (Confirmación)'),
        ('logistics', 'Despacho / Recepción'),
        ('billing', 'Facturación'),
        ('treasury', 'Tesorería'),
    ]

    HUB_STAGE_TASK_TYPES = {
        'origin': 'HUB_ORIGIN',
        'logistics': 'HUB_LOGISTICS',
        'billing': 'HUB_BILLING',
        'treasury': 'HUB_TREASURY',
    }

    # Recurring F29 Tasks
    F29_CREATE = 'F29_CREATE'
    F29_PAY = 'F29_PAY'
    PERIOD_CLOSE = 'PERIOD_CLOSE'

    @staticmethod
    def is_hub_stage_complete(order, stage_key):
        """
        Calculates ground truth for a HUB stage completion.
        """
        if getattr(order, 'status', None) == 'CANCELLED':
            return True
            
        if stage_key == 'origin':
            # Origin is complete once confirmed (not DRAFT)
            return getattr(order, 'status', 'DRAFT') != 'DRAFT'
            
        if stage_key == 'logistics':
            # SaleOrder delivery
            if hasattr(order, 'delivery_status'):
                return order.delivery_status == 'DELIVERED'
            # PurchaseOrder receiving
            if hasattr(order, 'receiving_status'):
                return order.receiving_status == 'RECEIVED'
            return False
            
        if stage_key == 'billing':
            # Check for any POSTED or PAID invoice with a number.
            # PAID is the final state (after POSTED) so it must also be considered complete.
            # Convention: POSTED = published/confirmed, PAID = settled. Both mean billing is done.
            BILLED_STATUSES = ['POSTED', 'PAID']
            if hasattr(order, 'invoices'):
                return order.invoices.filter(status__in=BILLED_STATUSES).exclude(number='').exists()
            if hasattr(order, 'purchase_invoices'):
                return order.purchase_invoices.filter(status__in=BILLED_STATUSES).exclude(number='').exists()
            return False
            
        if stage_key == 'treasury':
            # Check if PAID status and no pending registration for Card/Transfer
            is_paid = getattr(order, 'status', None) == 'PAID' or getattr(order, 'payment_status', None) == 'PAID'
            if not is_paid:
                return False
                
            if hasattr(order, 'payments'):
                # Exact same logic as frontend: complete only if no payments are pending registration
                has_pending = order.payments.filter(
                    movement_type__in=['INBOUND', 'OUTBOUND', 'TRANSFER'],
                    payment_method__in=['CARD', 'TRANSFER'],
                    transaction_number__isnull=True
                ).exclude(transaction_number__exact='').exists()
                return not has_pending
            return True
            
        return False

    @staticmethod
    @transaction.atomic
    def sync_hub_tasks(order):
        """
        Centralized method to ensure HUB tasks match the actual order state.
        Ensures tasks exist and their status (Pending/Completed) is correct.
        """
        from django.contrib.contenttypes.models import ContentType
        
        # 1. Ensure tasks exist (reusing create_hub_stage_tasks logic)
        order_type = 'sale'
        if hasattr(order, 'supplier_id'): # simplistic check for PurchaseOrder
            order_type = 'purchase'
            
        WorkflowService.create_hub_stage_tasks(order, order_type)
        
        # 2. Re-evaluate all HUB tasks for this object
        content_type = ContentType.objects.get_for_model(order)
        tasks = Task.objects.filter(
            content_type=content_type,
            object_id=order.pk,
            task_type__in=WorkflowService.HUB_STAGE_TASK_TYPES.values()
        )
        
        # Build inversion map
        type_to_stage = {v: k for k, v in WorkflowService.HUB_STAGE_TASK_TYPES.items()}
        
        for task in tasks:
            stage_key = type_to_stage.get(task.task_type)
            if not stage_key: continue
            
            should_be_complete = WorkflowService.is_hub_stage_complete(order, stage_key)
            
            if should_be_complete and task.status != Task.Status.COMPLETED:
                task.status = Task.Status.COMPLETED
                task.completed_at = task.completed_at or timezone.now()
                task.save()
            elif not should_be_complete and task.status == Task.Status.COMPLETED:
                # Revert to pending if no longer complete (e.g. invoice deleted)
                task.status = Task.Status.PENDING
                task.completed_at = None
                task.save()

    @staticmethod
    def create_draft_purchase_order_task(order):
        """
        Creates only the HUB_ORIGIN task for a DRAFT purchase order.
        Called when a purchase order is created in DRAFT state
        (e.g. from replenishment proposals / subscriptions) so the
        assigned user knows they need to complete or delete it.
        The remaining 3 HUB tasks (logistics, billing, treasury) will
        be created later via sync_hub_tasks when the order is confirmed.
        """
        from django.contrib.contenttypes.models import ContentType

        content_type = ContentType.objects.get_for_model(order)

        # Avoid duplicates
        already_exists = Task.objects.filter(
            content_type=content_type,
            object_id=order.pk,
            task_type='HUB_ORIGIN',
        ).exists()
        if already_exists:
            return

        order_label = f"OC-{order.number}"
        contact_name = ''
        try:
            if hasattr(order, 'supplier') and order.supplier:
                contact_name = str(order.supplier.name)
        except Exception:
            pass

        order_total = float(order.total) if hasattr(order, 'total') else 0

        WorkflowService.create_task(
            task_type='HUB_ORIGIN',
            title=f"Origen (Confirmación): {order_label}",
            description=f"OC en borrador pendiente de completar o eliminar: {order_label}.",
            content_object=order,
            priority=Task.Priority.MEDIUM,
            data={
                'stage': 'origin',
                'order_type': 'purchase',
                'order_number': str(order.number),
                'contact_name': contact_name,
                'order_total': order_total,
                'is_draft': True,
            },
            category=Task.Category.TASK
        )

    @staticmethod
    def create_hub_stage_tasks(order, order_type):
        """
        Ensures the 4 HUB tasks are created for an order.
        """
        from django.contrib.contenttypes.models import ContentType
        content_type = ContentType.objects.get_for_model(order)
        
        # Get existing to avoid duplicates
        existing = set(Task.objects.filter(
            content_type=content_type,
            object_id=order.pk,
            task_type__in=WorkflowService.HUB_STAGE_TASK_TYPES.values()
        ).values_list('task_type', flat=True))
        
        order_label = f"{'NV' if order_type == 'sale' else 'OC'}-{order.number}"
        
        contact_name = ''
        try:
            if order_type == 'sale' and hasattr(order, 'customer'):
                contact_name = str(order.customer.name) if order.customer else ''
            elif order_type == 'purchase' and hasattr(order, 'supplier'):
                contact_name = str(order.supplier.name) if order.supplier else ''
        except Exception:
            pass
        
        order_total = float(order.total) if hasattr(order, 'total') else 0
        
        # Determine the relevant date (delivery_date for sales, receipt_date for purchases)
        order_delivery_date = ''
        if hasattr(order, 'delivery_date') and order.delivery_date:
            order_delivery_date = str(order.delivery_date)
        elif hasattr(order, 'receipt_date') and order.receipt_date:
            order_delivery_date = str(order.receipt_date)
        
        for stage_key, stage_name in WorkflowService.HUB_STAGES:
            task_type = WorkflowService.HUB_STAGE_TASK_TYPES[stage_key]
            
            if task_type in existing:
                continue
            
            # Use is_hub_stage_complete to set initial status
            is_complete = WorkflowService.is_hub_stage_complete(order, stage_key)
            
            task = WorkflowService.create_task(
                task_type=task_type,
                title=f"{stage_name}: {order_label}",
                description=f"Etapa '{stage_name}' pendiente para {order_label}.",
                content_object=order,
                priority=Task.Priority.MEDIUM,
                data={
                    'stage': stage_key,
                    'order_type': order_type,
                    'order_number': str(order.number),
                    'contact_name': contact_name,
                    'order_total': order_total,
                    'delivery_date': order_delivery_date,
                },
                category=Task.Category.TASK
            )
            
            if is_complete:
                task.status = Task.Status.COMPLETED
                task.completed_at = timezone.now()
                task.save()

    @staticmethod
    def complete_hub_stage_task(content_object, stage):
        """
        Auto-completes the pending HUB stage task for a given object.
        Called during stage transitions (dispatch, invoice, payment).
        """
        from django.contrib.contenttypes.models import ContentType
        
        task_type = WorkflowService.HUB_STAGE_TASK_TYPES.get(stage)
        if not task_type:
            return
        
        content_type = ContentType.objects.get_for_model(content_object)
        
        pending_tasks = Task.objects.filter(
            content_type=content_type,
            object_id=content_object.pk,
            task_type=task_type,
            category=Task.Category.TASK,
            status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS]
        )
        
        for task in pending_tasks:
            task.status = Task.Status.COMPLETED
            task.completed_at = timezone.now()
            task.save()

    @staticmethod
    def complete_periodic_task(task_type, year, month):
        """
        Completes a periodic task (F29_CREATE, F29_PAY, PERIOD_CLOSE) 
        for a specific period.
        """
        tasks = Task.objects.filter(
            task_type=task_type,
            status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
            data__year=year,
            data__month=month
        )
        for task in tasks:
            task.status = Task.Status.COMPLETED
            task.completed_at = timezone.now()
            task.save()

    @staticmethod
    def _get_link_for_task(task):
        """
        Generate smart links based on content object.
        """
        if task.content_type and task.content_object:
            model_name = task.content_type.model
            if model_name == 'workorder':
                return f"/production/orders/{task.object_id}"
            # Add other models here (e.g. saleorder, purchaseorder)
            
        return f"/workflow/tasks/{task.id}"

    @staticmethod
    def notify_group_assignment(task, group_name):
        """
        Notify all users in the specific group about a new unassigned task (Pool).
        """
        # Notifications disabled to focus only on credit approvals and subscription OCS
        pass

    @staticmethod
    def notify_assignment(task):
        """
        Creates an in-app notification for the user assigned to the task.
        """
        # Notifications disabled to focus only on credit approvals and subscription OCS
        pass

    @staticmethod
    def auto_complete_approval_tasks(content_object, user):
        """
        Auto-completes all pending approval tasks for a given object.
        Called during state transitions (e.g., WorkOrder advances to next stage).
        
        Args:
            content_object: The object (WorkOrder, SaleOrder, etc.) being transitioned
            user: The user performing the transition (for audit trail)
        """
        from django.contrib.contenttypes.models import ContentType
        from django.utils import timezone
        
        content_type = ContentType.objects.get_for_model(content_object)
        
        # Find all pending approval tasks for this object
        pending_approvals = Task.objects.filter(
            content_type=content_type,
            object_id=content_object.pk,
            category=Task.Category.APPROVAL,
            status=Task.Status.PENDING
        )
        
        for task in pending_approvals:
            task.status = Task.Status.COMPLETED
            task.completed_at = timezone.now()
            task.completed_by = user
            task.save()
            
            # Notify the assignee (if any) that the task was completed
            # Notifications disabled to focus only on credit approvals and subscription OCS
            pass

    @staticmethod
    def reset_tasks_for_object(content_object, stage_ids=None):
        """
        Resets completed approval tasks for a given object to PENDING.
        If stage_ids is provided, only tasks matching those stages (via task_type) are reset.
        """
        from django.contrib.contenttypes.models import ContentType
        
        content_type = ContentType.objects.get_for_model(content_object)
        
        query = Task.objects.filter(
            content_type=content_type,
            object_id=content_object.pk,
            category=Task.Category.APPROVAL,
            status=Task.Status.COMPLETED
        )
        
        # We assume OT_STAGE_ID_APPROVAL is the task type pattern
        if stage_ids:
            # Create a list of task types to match
            task_types = [f"OT_{stage}_APPROVAL" for stage in stage_ids]
            query = query.filter(task_type__in=task_types)
            
        reset_count = query.update(
            status=Task.Status.PENDING,
            completed_at=None,
            completed_by=None
        )
        return reset_count

    @staticmethod
    def send_notification(notification_type, title, message, link="", creator=None, content_object=None, level=Notification.Type.INFO):
        """
        Sends notifications based on configured NotificationRules.
        """
        try:
            rule = NotificationRule.objects.get(notification_type=notification_type)
            
            # 1. Notify Creator?
            if rule.notify_creator and creator:
                Notification.objects.create(
                    user=creator,
                    title=title,
                    message=message,
                    link=link,
                    type=level,
                    content_object=content_object
                )
            
            # 2. Notify assigned user?
            if rule.assigned_user:
                Notification.objects.create(
                    user=rule.assigned_user,
                    title=title,
                    message=message,
                    link=link,
                    type=level,
                    content_object=content_object
                )
            
            # 3. Notify assigned group?
            if rule.assigned_group:
                users = rule.assigned_group.user_set.all()
                for u in users:
                    Notification.objects.create(
                        user=u,
                        title=title,
                        message=message,
                        link=link,
                        type=level,
                        content_object=content_object
                    )
                    
        except NotificationRule.DoesNotExist:
            # Fallback for credit approvals if no rule defined: notify creator
            if notification_type == 'POS_CREDIT_APPROVAL' and creator:
                Notification.objects.create(
                    user=creator,
                    title=title,
                    message=message,
                    link=link,
                    type=level,
                    content_object=content_object
                )
            # Fallback for subscription OC if no rule: notify superusers
            elif notification_type == 'SUBSCRIPTION_OC_CREATED':
                from core.models import User
                superusers = User.objects.filter(is_superuser=True)
                for su in superusers:
                    Notification.objects.create(
                        user=su,
                        title=title,
                        message=message,
                        link=link,
                        type=level,
                        content_object=content_object
                    )
