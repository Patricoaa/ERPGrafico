from django.db import transaction, models
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Invoice
from treasury.models import TreasuryMovement, TreasuryAccount
from accounting.models import JournalEntry, JournalItem, AccountingSettings, AccountType
from accounting.services import JournalEntryService, AccountingMapper
from sales.models import SaleOrder
from purchasing.models import PurchaseOrder
from decimal import Decimal
from tax.services import TaxPeriodService


class BillingService:
    @staticmethod
    def request_credit_approval(order_data, amount, payment_method, full_request_data, requesting_user):
        """
        Creates a CREDIT_POS_REQUEST task when a sale exceeds available credit.
        """
        if isinstance(order_data, list):
            order_data = order_data[0]
            
        if isinstance(order_data, str):
            import json
            order_data = json.loads(order_data)

        # Basic parsing to find the customer
        from sales.models import SaleOrder
        from contacts.models import Contact
        from decimal import Decimal
        
        customer_id = None
        # 1. Total calculation improvement
        if 'id' in order_data:
            order = SaleOrder.objects.get(id=order_data['id'])
            customer = order.customer
            total = order.total
        else:
            customer_id = order_data.get('customer')
            if not customer_id:
                raise ValidationError("Se requiere un cliente asociado para solicitar crédito.")
            customer = Contact.objects.get(id=customer_id)
            
            # Robust total calculation for POS:
            # We must account for gross prices and total discounts
            lines_total = Decimal('0')
            for item in order_data.get('lines', []):
                qty = Decimal(str(item.get('quantity', item.get('qty', 0))))
                price = Decimal(str(item.get('unit_price_gross', item.get('unit_price', 0))))
                lines_total += qty * price
            
            total_discount = Decimal(str(order_data.get('total_discount_amount', 0)))
            total = max(Decimal('0'), lines_total - total_discount)

        paid_amount = Decimal(str(amount)) if amount is not None else (Decimal('0') if payment_method == 'CREDIT' else total)
        required_credit = total - paid_amount

        from workflow.services import WorkflowService
        from workflow.models import Task
        
        # Calculate POS Fallback Credit
        from accounting.models import AccountingSettings
        acc_settings = AccountingSettings.get_solo()
        # Ensure we use a safe division and handle None/0
        fb_val = acc_settings.pos_default_credit_percentage if acc_settings else Decimal('0')
        fallback_percentage = Decimal(str(fb_val)) / Decimal('100.0')
        pos_credit = total * fallback_percentage

        description = (
            f"Venta POS requiere aprobación de crédito.\n"
            f"Cliente: {customer.name}\n"
            f"Línea de Crédito: ${customer.credit_available:,.0f}\n"
            f"Crédito POS (Fallback): ${pos_credit:,.0f}\n"
            f"Crédito Requerido: ${required_credit:,.0f}\n"
            f"Monto Total Venta: ${total:,.0f}"
        )
        
        # Save the full request data in the task payload so the frontend can retrieve it or the backend can process it.
        # Ensure we remove files from full_request_data if they exist, as they can't be JSON serialized.
        # The frontend handles file uploads separately or we assume POS credit requests don't have manufacturing files uploaded AT THIS POLLING STAGE.
        clean_request_data = {k: v for k, v in full_request_data.items() if not k.startswith('line_')}

        # Calculate POS Fallback Credit
        from accounting.models import AccountingSettings
        acc_settings = AccountingSettings.get_solo()
        fallback_percentage = (acc_settings.pos_default_credit_percentage if acc_settings else Decimal('0')) / Decimal('100.0')
        pos_credit = total * fallback_percentage

        task = WorkflowService.create_task(
            task_type='CREDIT_POS_REQUEST',
            title=f"Aprobación Crédito: {customer.name}",
            description=description,
            priority=Task.Priority.HIGH,
            created_by=requesting_user,
            data={
                'request_data': clean_request_data, 
                'customer_id': customer.id, 
                'customer_name': customer.name,
                'customer_tax_id': customer.tax_id,
                'is_default_customer': customer.is_default_customer,
                'customer_debt': str(customer.credit_balance_used),
                'required_credit': str(required_credit),
                'explicit_credit': str(customer.credit_available),
                'pos_credit': str(pos_credit)
            },
            category=Task.Category.APPROVAL
        )

        # Apply assignment rule if configured
        try:
            from workflow.models import TaskAssignmentRule
            rule = TaskAssignmentRule.objects.filter(task_type='CREDIT_POS_REQUEST').first()
            if rule:
                task.assigned_to = rule.assigned_user
                
                # Assign to group. task.assigned_group is a FK to Group, but rule.assigned_group is a CharField string in TaskAssignmentRule.
                if rule.assigned_group:
                    from django.contrib.auth.models import Group
                    group = Group.objects.filter(name=rule.assigned_group).first()
                    if group:
                        task.assigned_group = group
                
                task.save(update_fields=['assigned_to', 'assigned_group'])
        except Exception as e:
            # Silently fail assignment and leave it unassigned if rule processing errors
            pass

        return task

    @staticmethod
    def _validate_document_uniqueness(number, dte_type, supplier_id=None, exclude_id=None):
        """
        Validates that the document number is unique.
        - For Sales: Global uniqueness per DTE type.
        - For Purchases: Uniqueness per supplier and DTE type.
        """
        if not number or number == 'Draft' or number == '':
            return

        from .models import Invoice
        
        # Base query
        query = Invoice.objects.filter(number=number, dte_type=dte_type)
        
        if exclude_id:
            query = query.exclude(id=exclude_id)

        if supplier_id:
            # Purchase validation: unique per supplier
            query = query.filter(purchase_order__supplier_id=supplier_id)
        else:
            # Sale validation: global per DTE type (excluding purchases)
            query = query.filter(sale_order__isnull=False)

        if query.exists():
            if supplier_id:
                raise ValidationError(f"El folio {number} ya ha sido registrado para este proveedor en otro documento.")
            else:
                raise ValidationError(f"El folio {number} ya ha sido utilizado en otro documento de venta.")

    @staticmethod
    def _capitalize_tax_to_product_cost(product, tax_amount, unit_cost, quantity, order=None):
        """
        Capitalizes tax amount into product cost using weighted average.
        This is used for Boletas and Draft Facturas.
        """
        from inventory.models import StockMove
        total_stock = product.qty_on_hand
        
        if total_stock > 0:
            current_value = product.cost_price * total_stock
            product.cost_price = (current_value + tax_amount) / total_stock
        else:
            # No stock yet, set cost to unit cost + tax per unit
            product.cost_price = unit_cost + (tax_amount / quantity)
        product.save()

        # Retroactive Kardex Update: If an order is provided, update the moves that were recorded at Net
        if order:
            from purchasing.models import PurchaseReceiptLine
            # Find all confirmed receipt lines for this order and product
            receipt_lines = PurchaseReceiptLine.objects.filter(
                receipt__purchase_order=order,
                receipt__status='CONFIRMED',
                product=product,
                stock_move__isnull=False
            )
            
            for line in receipt_lines:
                move = line.stock_move
                # Capitalize the tax proportionally to this specific move's quantity
                # We use the tax_rate from the purchase line to be precise
                tax_rate = line.purchase_line.tax_rate
                
                # IVA = Net * (Rate/100)
                # Gross = Net + (Net * Rate/100) = Net * (1 + Rate/100)
                # We update the unit_cost in the Kardex (StockMove) to reflected the capitalized tax
                move.unit_cost = (move.unit_cost * (Decimal('1') + (tax_rate / Decimal('100.0')))).quantize(Decimal('1'))
                move.save(update_fields=['unit_cost'])
                
                # Sync back to Receipt Line so UI (Kardex) reflects gross value
                line.unit_cost = move.unit_cost
                line.save(update_fields=['unit_cost', 'total_cost'])
    
    @staticmethod
    def _revert_tax_from_product_cost(product, tax_amount):
        """
        Reverts previously capitalized tax from product cost.
        This is used when confirming a Draft Factura as a regular Factura.
        """
        from inventory.models import StockMove
        total_stock = sum(m.quantity for m in StockMove.objects.filter(product=product))
        
        if total_stock > 0:
            current_value = product.cost_price * total_stock
            product.cost_price = (current_value - tax_amount) / total_stock
            product.save()
    
    @staticmethod
    @transaction.atomic
    def create_sale_invoice(order: SaleOrder, dte_type: str, payment_method: str = 'CREDIT', status: str = Invoice.Status.POSTED, number: str = None, date=None):
        """
        Creates a Sale Invoice (Factura/Boleta) from a SaleOrder.
        """
        if order.status not in [SaleOrder.Status.CONFIRMED, SaleOrder.Status.DRAFT, SaleOrder.Status.PAYMENT_PENDING]:
             # Allow from draft if POS immediate
             pass
        
        from core.services import SequenceService
        
        # Auto-generate folio for Boletas if empty
        if dte_type == Invoice.DTEType.BOLETA and not number:
            number = SequenceService.get_next_number(
                Invoice, 
                filter_kwargs={'dte_type': Invoice.DTEType.BOLETA}
            )

        # Tax & Accounting Period Validation (Only for POSTED documents)
        if status != Invoice.Status.DRAFT:
            doc_date = date or timezone.now().date()
            from tax.services import TaxPeriodService, AccountingPeriodService
            
            if TaxPeriodService.is_period_closed(doc_date):
                raise ValidationError(
                    f"No se puede registrar el documento con fecha {doc_date}. "
                    f"El periodo tributario correspondiente (F29) ya se encuentra CERRADO."
                )
                
            if AccountingPeriodService.is_period_closed(doc_date):
                raise ValidationError(
                    f"No se puede registrar el documento con fecha {doc_date}. "
                    f"El periodo CONTABLE correspondiente ya se encuentra CERRADO."
                )

        # Validate Uniqueness
        if number:
            BillingService._validate_document_uniqueness(number, dte_type)

        # 1. Create Invoice Record
        invoice = Invoice.objects.create(
            dte_type=dte_type,
            number=number or '',
            date=date or timezone.now().date(),
            sale_order=order,
            payment_method=payment_method,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total_discount_amount=order.total_discount_amount,
            total=order.total,
            status=status
        )

        # 2. Accounting Entry via Mapper
        settings = AccountingSettings.get_solo()
        description, reference, items = AccountingMapper.get_entries_for_sale_invoice(invoice, settings)
        entry = JournalEntryService.create_entry(
            {
                'date': invoice.date,
                'description': description,
                'reference': reference,
                'status': JournalEntry.State.DRAFT
            },
            items
        )

        if status == Invoice.Status.POSTED:
            JournalEntryService.post_entry(entry)
            
        invoice.journal_entry = entry
        invoice.save()

        # Check for advances and link them
        advances = order.payments.filter(invoice__isnull=True)
        total_advanced = sum(p.amount for p in advances)

        if total_advanced > 0:
            recon_entry = JournalEntry.objects.create(
                date=timezone.now().date(),
                description=f"Conciliación Anticipos - Pedido {order.number} -> Factura {invoice.id}",
                reference=f"RECO-{invoice.id}", 
                status=JournalEntry.State.DRAFT
            )
            
            receivable_account = order.customer.account_receivable or settings.default_receivable_account
            advance_account = settings.default_advance_payment_account or receivable_account
            
            # Debit: Advance Account (Clear the liability)
            JournalItem.objects.create(
                entry=recon_entry,
                account=advance_account,
                debit=total_advanced,
                credit=0,
                partner=order.customer,
                partner_name=order.customer.name
            )
            
            # Credit: Receivable Account (Reduce what they owe us)
            JournalItem.objects.create(
                entry=recon_entry,
                account=receivable_account,
                debit=0,
                credit=total_advanced,
                partner=order.customer,
                partner_name=order.customer.name
            )
            
            JournalEntryService.post_entry(recon_entry)
            
            for payment in advances:
                payment.invoice = invoice
                payment.save()

        # Update Order Status
        if total_advanced >= order.total:
             order.status = SaleOrder.Status.PAID
        else:
             order.status = SaleOrder.Status.INVOICED
        order.save()

        # Auto-complete billing HUB task ONLY if posted
        if status == Invoice.Status.POSTED:
            from workflow.services import WorkflowService
            WorkflowService.sync_hub_tasks(order)


        return invoice

    @staticmethod
    @transaction.atomic
    def create_purchase_bill(order: PurchaseOrder, supplier_invoice_number: str = '', 
                             dte_type: str = Invoice.DTEType.PURCHASE_INV, 
                             document_attachment=None, date=None, status=Invoice.Status.POSTED):
        """
        Creates a Purchase Bill from a PurchaseOrder.
        If status is DRAFT, it allows empty folio and deferred VAT separation.
        """
        if status == Invoice.Status.POSTED and not supplier_invoice_number:
            raise ValidationError("El número de folio es obligatorio para publicar la factura.")

        # Tax & Accounting Period Validation (Only for POSTED documents)
        if status != Invoice.Status.DRAFT:
            doc_date = date or timezone.now().date()
            from tax.services import TaxPeriodService, AccountingPeriodService
            
            if TaxPeriodService.is_period_closed(doc_date):
                raise ValidationError(
                    f"No se puede registrar la factura con fecha {doc_date}. "
                    f"El periodo tributario correspondiente (F29) ya se encuentra CERRADO."
                )
                
            if AccountingPeriodService.is_period_closed(doc_date):
                raise ValidationError(
                    f"No se puede registrar la factura con fecha {doc_date}. "
                    f"El periodo CONTABLE correspondiente ya se encuentra CERRADO."
                )

        # 0. Validate Uniqueness
        if supplier_invoice_number:
            BillingService._validate_document_uniqueness(
                supplier_invoice_number, 
                dte_type, 
                supplier_id=order.supplier_id
            )

        invoice = Invoice.objects.create(
            dte_type=dte_type,
            number=supplier_invoice_number,
            document_attachment=document_attachment,
            date=date or timezone.now().date(),
            purchase_order=order,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total=order.total,
            status=status
        )

        # 2. Accounting Entry via Mapper (includes tax capitalization logic for Boletas)
        settings = AccountingSettings.get_solo()
        description, reference, items = AccountingMapper.get_entries_for_purchase_bill(invoice, settings)
        entry = JournalEntryService.create_entry(
            {
                'date': invoice.date,
                'description': description,
                'reference': reference,
                'status': JournalEntry.State.DRAFT
            },
            items
        )

        # Keep cost capitalization update ONLY for TAXABLE Boletas (not BOLETA_EXENTA)
        # Tax-exempt boletas have no IVA to capitalize
        if dte_type == Invoice.DTEType.BOLETA:
            for line in order.lines.all():
                line_tax = (line.subtotal * (line.tax_rate / Decimal('100.0'))).quantize(Decimal('1'), rounding='ROUND_HALF_UP')
                # Only capitalize tax for quantities that were ALREADY RECEIVED!
                # Because future receipts will check has_boleta=True and include it themselves in StockMove
                if line_tax > 0 and getattr(line, 'quantity_received', 0) > 0:
                    received_tax = line_tax * (line.quantity_received / line.quantity)
                    BillingService._capitalize_tax_to_product_cost(line.product, received_tax, line.unit_cost, line.quantity_received, order=order)
        elif dte_type == Invoice.DTEType.BOLETA_EXENTA:
            # No IVA capitalization for tax-exempt boletas
            pass


        # Only post the entry if the invoice is POSTED, not DRAFT
        if status == Invoice.Status.POSTED:
            JournalEntryService.post_entry(entry)
        
        invoice.journal_entry = entry
        invoice.save()

        # Check for prepayments on this order and link them
        prepayments = order.payments.filter(invoice__isnull=True)
        total_prepaid = sum(p.amount for p in prepayments)

        if total_prepaid > 0:
            # Reconcile prepayments: Move from Prepayment Account to Payable Account
            recon_entry = JournalEntry.objects.create(
                date=timezone.now().date(),
                description=f"Conciliación Anticipos - OC {order.number} -> Factura {supplier_invoice_number}",
                reference=f"RECO-{invoice.id}", # Reconciliation
                status=JournalEntry.State.DRAFT
            )
            
            payable_account = order.supplier.account_payable or settings.default_payable_account
            prepayment_account = settings.default_prepayment_account or payable_account
            
            # Debit: Payable Account (Reduce what we owe)
            JournalItem.objects.create(
                entry=recon_entry,
                account=payable_account,
                debit=total_prepaid,
                credit=0,
                partner=order.supplier,
                partner_name=order.supplier.name
            )
            
            # Credit: Prepayment Account (Clear the advance)
            JournalItem.objects.create(
                entry=recon_entry,
                account=prepayment_account,
                debit=0,
                credit=total_prepaid,
                partner=order.supplier,
                partner_name=order.supplier.name
            )
            
            JournalEntryService.post_entry(recon_entry)
            
            # Link payments to the new invoice
            for payment in prepayments:
                payment.invoice = invoice
                payment.save()

        # Update Order Status
        if total_prepaid >= order.total:
            order.status = PurchaseOrder.Status.PAID
        else:
            order.status = PurchaseOrder.Status.INVOICED
        order.save()

        # Auto-complete billing HUB task ONLY if posted
        if status == Invoice.Status.POSTED:
            from workflow.services import WorkflowService
            WorkflowService.sync_hub_tasks(order)


        return invoice

    @staticmethod
    def pos_checkout(*args, **kwargs):
        """
        Wrapper that secures the transaction against 'double-clicks' via DistributedLock.
        """
        user = kwargs.get('user')
        from core.cache import acquire_locks
        
        lock_resources = []
        if getattr(user, 'id', None):
            lock_resources.append(f"pos_user_{user.id}")
            
        with acquire_locks(lock_resources, timeout=15):
            return BillingService._pos_checkout_internal(*args, **kwargs)

    @staticmethod
    @transaction.atomic
    def _pos_checkout_internal(order_data, dte_type, payment_method, transaction_number=None,
                     is_pending_registration=False, payment_is_pending=False, amount=None, treasury_account_id=None,
                     document_number=None, document_date=None, document_attachment=None,
                     delivery_type='IMMEDIATE', delivery_date=None, delivery_notes='', immediate_lines=None, payment_type='INBOUND',
                     line_files=None, pos_session_id=None, user=None, payment_method_id=None, credit_approval_task_id=None, draft_id=None, direct_credit_approval=False):
        """
        Complete POS checkout: Create Order -> Confirm -> Invoice -> Payment -> (Optional) Delivery.
        pos_session_id: Optional ID of an open POS session to link the payment to.
        """
        from sales.serializers import CreateSaleOrderSerializer
        from treasury.services import TreasuryService
        from inventory.models import Warehouse
        
        # 1. Get or Create Order
        order = None
        if isinstance(order_data, list):
            order_data = order_data[0]
            
        if isinstance(order_data, str):
            import json
            order_data = json.loads(order_data)

        # CARD_TERMINAL is PaymentMethod.Type (new model), not SaleOrder.PaymentMethod legacy enum.
        # Normalize to CARD for SaleOrder persistence; PaymentMethod FK (payment_method_id) keeps the terminal link.
        if isinstance(order_data, dict) and order_data.get('payment_method') == 'CARD_TERMINAL':
            order_data['payment_method'] = 'CARD'

        if 'id' in order_data:
            order = SaleOrder.objects.get(id=order_data['id'])
            
            # Update tax rate for existing order if needed based on DTE type
            target_tax = Decimal('0') if dte_type in ['FACTURA_EXENTA', 'BOLETA_EXENTA'] else Decimal('19')
            lines_updated = False
            for line in order.lines.all():
                if line.tax_rate != target_tax:
                    line.tax_rate = target_tax
                    line.save()
                    lines_updated = True
            
            if lines_updated:
                order.recalculate_totals()
        else:
            if 'payment_method' not in order_data:
                order_data['payment_method'] = payment_method
            
            # Enforce tax rate for new orders based on DTE type
            target_tax = 0 if dte_type in ['FACTURA_EXENTA', 'BOLETA_EXENTA'] else 19
            if 'lines' in order_data:
                for line in order_data['lines']:
                    line['tax_rate'] = target_tax

            order_serializer = CreateSaleOrderSerializer(data=order_data)
            if not order_serializer.is_valid():
                raise ValidationError(order_serializer.errors)
            
            # Use provided channel or default to POS
            channel = order_data.get('channel', 'POS')
            order = order_serializer.save(channel=channel)
            
            # Enforce tax rate on created lines (Safety net against serializer dropping it)
            # This logic mirrors the existing order update logic
            target_tax = Decimal('0') if dte_type in ['FACTURA_EXENTA', 'BOLETA_EXENTA'] else Decimal('19')
            # Forcing refresh from DB to avoid any stale data issues
            for line in order.lines.all():
                line.tax_rate = target_tax
                line.save()
            
            order.recalculate_totals()
            order.save()
        
        # Tax & Accounting Period Validation (Only if NOT pending registration)
        if not is_pending_registration:
            doc_date = document_date or timezone.now().date()
            from tax.services import TaxPeriodService, AccountingPeriodService
            
            if TaxPeriodService.is_period_closed(doc_date):
                raise ValidationError(
                    f"No se puede registrar la venta con fecha {doc_date}. "
                    f"El periodo tributario correspondiente (F29) ya se encuentra CERRADO."
                )
                
            if AccountingPeriodService.is_period_closed(doc_date):
                raise ValidationError(
                    f"No se puede registrar la venta con fecha {doc_date}. "
                    f"El periodo CONTABLE correspondiente ya se encuentra CERRADO."
                )

        # --- CREDIT VALIDATION ---
        # Determine the amount paid versus the order total
        # If no amount is explicitly provided, we assume the full total is being paid UNLESS payment_method is CREDIT
        paid_amount = Decimal(str(amount)) if (amount is not None and str(amount) != '') else (Decimal('0') if payment_method == 'CREDIT' else order.total)
        required_credit = max(Decimal('0'), order.total - paid_amount)
        
        # Credit bypass by approved task
        bypass_credit_validation = False
        resolved_approval_task = None  # Track the task for post-checkout consumption marking
        if credit_approval_task_id:
            from workflow.models import Task
            try:
                task = Task.objects.get(id=credit_approval_task_id, task_type='CREDIT_POS_REQUEST')
                if task.status == Task.Status.COMPLETED:
                    # SECURE VALIDATION: Verify task data matches current checkout
                    task_data = task.data or {}
                    approved_customer_id = task_data.get('customer_id')
                    approved_credit_str = task_data.get('required_credit', '0')
                    approved_credit = Decimal(approved_credit_str)

                    # 0. Check Reuse (Anti-replay)
                    if task_data.get('consumed_by_invoice_id'):
                        raise ValidationError(
                            f"Seguridad: Esta aprobación de crédito ya fue utilizada en la factura #{task_data['consumed_by_invoice_id']}. "
                            f"Solicite una nueva aprobación."
                        )

                    # 1. Check Customer
                    if approved_customer_id and int(approved_customer_id) != order.customer_id:
                        raise ValidationError(
                            f"Seguridad: La aprobación de crédito fue emitida para otro cliente (ID {approved_customer_id})."
                        )
                    
                    # 2. Check Amount (Anti-fraud check)
                    if required_credit > approved_credit:
                        raise ValidationError(
                            f"Intento de aumento de crédito no autorizado. "
                            f"El crédito requerido (${required_credit:,.0f}) excede el monto "
                            f"que fue aprobado previamente (${approved_credit:,.0f})."
                        )
                    bypass_credit_validation = True
                    resolved_approval_task = task
                    order.credit_assignment_origin = SaleOrder.CreditOrigin.MANUAL
                    order.credit_approval_task = task
                else:
                    raise ValidationError(f"La tarea de aprobación de crédito {task.id} aún no está completada.")
            except Task.DoesNotExist:
                raise ValidationError("Tarea de aprobación de crédito no encontrada.")
        elif direct_credit_approval and user and user.has_perm('sales.approve_credit'):
            bypass_credit_validation = True
            order.credit_assignment_origin = SaleOrder.CreditOrigin.MANUAL

        if not bypass_credit_validation and required_credit > 0:
            contact = order.customer
            
            if not contact:
                raise ValidationError("Se requiere un cliente asociado para asignar crédito.")
                    
            if contact.credit_blocked:
                raise ValidationError("El crédito está bloqueado contractualmente para este cliente.")
                
            if getattr(contact, 'credit_auto_blocked', False) and not contact.is_default_customer:
                raise ValidationError("El cliente se encuentra Auto-Bloqueado por tener deudas con una mora superior al límite permitido.")

            # Fallback Logic: check if we can bypass credit_enabled check
            from accounting.models import AccountingSettings
            acc_settings = AccountingSettings.get_solo()
            fallback_percentage = (acc_settings.pos_default_credit_percentage if acc_settings else 0) / Decimal('100.0')
            allowed_fallback = order.total * fallback_percentage
            
            has_debt = contact.credit_balance_used > 0
            is_within_fallback = required_credit <= allowed_fallback
            
            # Implicit Credit: Check if we are within allowed bounds (Limit or Fallback)
            if required_credit > contact.credit_available:
                # If exceeding limit (or no limit assigned), check if fallback applies
                # Fallback requires: NO debt OR being the default customer, AND within fallback threshold
                if (not has_debt or contact.is_default_customer) and is_within_fallback:
                    # Fallback granted
                    order.credit_assignment_origin = SaleOrder.CreditOrigin.FALLBACK
                else:
                    if contact.credit_limit and contact.credit_limit > 0:
                        raise ValidationError(
                            f"Límite de crédito excedido. "
                            f"Crédito requerido: ${required_credit:,.0f}, "
                            f"Crédito disponible: ${contact.credit_available:,.0f}."
                        )
                    else:
                        raise ValidationError(
                            f"El cliente no tiene crédito asignado y el monto "
                            f"(${required_credit:,.0f}) excede el límite de fallback permitido."
                        )
            else:
                # Within credit portfolio limit
                order.credit_assignment_origin = SaleOrder.CreditOrigin.CREDIT_PORTFOLIO

        # Save changes to credit tracking before confirmation
        if required_credit > 0:
            order.save(update_fields=['credit_assignment_origin', 'credit_approval_task'])

        # -------------------------
        
        # 2. Confirm Order
        from sales.services import SalesService
        SalesService.confirm_sale(order, line_files=line_files)
        
        # 3. Handle Delivery Scheduling / Action
        if delivery_type == 'IMMEDIATE':
            # Dispatch everything right now from the first available warehouse
            warehouse = Warehouse.objects.first()
            if not warehouse:
                raise ValidationError("Debe existir al menos una bodega para realizar despachos.")
            SalesService.dispatch_order(order, warehouse)
        
        elif delivery_type == 'PARTIAL':
            # Partial Dispatch: Immediate lines are dispatched now, others are scheduled
            warehouse = Warehouse.objects.first()
            if not warehouse:
                raise ValidationError("Debe existir al menos una bodega para realizar despachos.")

            if not immediate_lines:
                # Fallback to SCHEDULED if no lines are marked for immediate
                delivery_type = 'SCHEDULED'
            else:
                # Prepare data for immediate lines
                line_data = []

                # Pre-fetch lines for faster lookup and ID resolution
                # This fixes the issue where frontend sends product_id as line_id
                all_order_lines = list(order.lines.all())
                lines_by_id = {line.id: line for line in all_order_lines}
                lines_by_product = {line.product_id: line for line in all_order_lines if line.product_id}

                for item in immediate_lines:
                    try:
                        resolved_line = None
                        qty = 0
                        uom_id = None
                        
                        if isinstance(item, dict):
                            # Frontend sends lineId, but we might also support id
                            raw_id = item.get('line_id') or item.get('lineId') or item.get('id')
                            qty = Decimal(str(item.get('quantity', 0)))
                            # Frontend sends uom, but backend partial_dispatch expects uom_id (or we adapt)
                            uom_id = item.get('uom') or item.get('uom_id')
                            
                            # Try to resolve line
                            if raw_id in lines_by_id:
                                resolved_line = lines_by_id[raw_id]
                            elif raw_id in lines_by_product:
                                resolved_line = lines_by_product[raw_id]
                        else:
                            raw_id = item
                            if raw_id in lines_by_id:
                                resolved_line = lines_by_id[raw_id]
                            elif raw_id in lines_by_product:
                                resolved_line = lines_by_product[raw_id]
                            
                            if resolved_line:
                                qty = resolved_line.quantity_pending
                                uom_id = resolved_line.uom.id if resolved_line.uom else None
                        
                        if resolved_line and qty > 0:
                            line_data.append({
                                'line_id': resolved_line.id,
                                'quantity': qty,
                                'uom_id': uom_id
                            })
                    except (ValueError, TypeError):
                        continue
                
                if line_data:
                    SalesService.partial_dispatch(order, warehouse, line_data)
            
            # For the REST (or all if fallback), schedule them
            if delivery_type == 'PARTIAL' or delivery_type == 'SCHEDULED': # Logic applies to remainder
                if delivery_date:
                    order.delivery_date = delivery_date
                
                notes_prefix = "Despacho Parcial: " if delivery_type == 'PARTIAL' else ""
                if delivery_notes:
                    order.notes = f"{order.notes}\n{notes_prefix}Notas Despacho: {delivery_notes}".strip()
                order.save()

        elif delivery_type == 'SCHEDULED':
            order.delivery_status = SaleOrder.DeliveryStatus.PENDING
            if delivery_date:
                order.delivery_date = delivery_date
            if delivery_notes:
                order.notes = f"{order.notes}\nNotas Despacho: {delivery_notes}".strip()
            order.save()
        elif delivery_type == 'PICKUP':
            # Could be handled similarly to IMMEDIATE or just marked as PENDING for now
            order.delivery_status = SaleOrder.DeliveryStatus.PENDING
            order.save()

        # --- Detección de pago vía terminal integrado TUU (DTE 48) ---
        # dte_type='COMPROBANTE_PAGO' indica que TUU ya emitió el DTE 48.
        # El ERP no emite DTE local; solo registra el movimiento de tesorería.
        # 4. Create Invoice (if not already invoiced)
        invoice = order.invoices.filter(status=Invoice.Status.POSTED).first()
        if not invoice:
            status = Invoice.Status.DRAFT if is_pending_registration else Invoice.Status.POSTED

            # Validate uniqueness if number provided
            if document_number:
                BillingService._validate_document_uniqueness(document_number, dte_type)

            invoice = BillingService.create_sale_invoice(order, dte_type, payment_method, status=status, number=document_number, date=document_date)
            if document_date:
                invoice.date = document_date
            if document_attachment:
                invoice.document_attachment = document_attachment
            invoice.save()

        # 4. Create Payment (if not credit)
        if payment_method not in ('CREDIT', 'CREDIT_BALANCE'):
            received_amount = Decimal(str(amount)) if amount is not None and str(amount) != '' else order.total
            payment_amount = min(received_amount, order.total)

            movement_date = invoice.date if invoice is not None else (document_date or timezone.now().date())

            # Resolve PaymentMethod FK — required for PaymentOrchestrator path.
            payment_method_inst = None
            if payment_method_id:
                from treasury.models import PaymentMethod as PM
                payment_method_inst = PM.objects.filter(id=payment_method_id).first()

            if payment_method_inst is not None:
                from treasury.orchestrator import PaymentOrchestrator
                PaymentOrchestrator.create_movement(
                    payment_method_obj=payment_method_inst,
                    amount=payment_amount,
                    movement_type=payment_type,
                    reference=f"NV-{order.number}",
                    partner=order.customer,
                    invoice=invoice,
                    date=movement_date,
                    sale_order=order,
                    pos_session_id=pos_session_id,
                    transaction_number=transaction_number or None,
                    is_pending_registration=payment_is_pending,
                    created_by=user,
                )
            else:
                # Fallback legacy path: payment_method_id not provided (non-POS flows).
                treasury_account = TreasuryAccount.objects.filter(id=treasury_account_id).first() if treasury_account_id else None
                from_acc = treasury_account if payment_type != TreasuryMovement.Type.INBOUND else None
                to_acc = treasury_account if payment_type == TreasuryMovement.Type.INBOUND else None
                TreasuryService.create_movement(
                    amount=payment_amount,
                    movement_type=payment_type,
                    payment_method=payment_method,
                    reference=f"NV-{order.number}",
                    partner=order.customer,
                    invoice=invoice,
                    date=movement_date,
                    sale_order=order,
                    from_account=from_acc,
                    to_account=to_acc,
                    transaction_number=transaction_number,
                    is_pending_registration=payment_is_pending,
                    pos_session_id=pos_session_id,
                    created_by=user,
                )
        elif payment_method == 'CREDIT_BALANCE':
            contact = order.customer
            received_amount = Decimal(str(amount)) if amount is not None and str(amount) != '' else order.total
            payment_amount = min(received_amount, order.total)
            
            if contact.credit_balance < payment_amount:
                raise ValidationError(f"Saldo a favor insuficiente. Disponible: ${contact.credit_balance:,.0f}, Requerido: ${payment_amount:,.0f}")
                
            # Create INBOUND on the sale invoice to balance the Sale order
            # This counts as a "Consumption" of the virtual balance.
            TreasuryService.create_movement(
                amount=payment_amount,
                movement_type='INBOUND',
                payment_method='CREDIT_BALANCE',
                reference=f"Consumo Saldo NV-{order.number}",
                partner=contact,
                invoice=invoice,
                date=invoice.date,
                sale_order=order,
                from_account=None,
                to_account=None,
                transaction_number=transaction_number,
                is_pending_registration=payment_is_pending,
                pos_session_id=pos_session_id,
                created_by=user
            )
        # 5. Atomic Draft Removal (NEW)
        if draft_id:
            from sales.models import DraftCart
            try:
                # Handle potential string-based 'null' or 'undefined' from frontend
                if isinstance(draft_id, str):
                    if draft_id.lower() in ['null', 'undefined', '']:
                        draft_id = None
                    else:
                        try:
                            draft_id = int(draft_id)
                        except ValueError:
                            draft_id = None
                
                if draft_id:
                    DraftCart.objects.filter(id=draft_id).delete()
            except Exception as e:
                # Log but don't fail the whole checkout if draft deletion fails
                print(f"WARNING: Failed to delete draft {draft_id} after checkout: {e}")
            
            
        # 6. Mark credit approval task as consumed (anti-replay)
        if resolved_approval_task:
            task_data = resolved_approval_task.data or {}
            task_data['consumed_by_invoice_id'] = invoice.id if invoice else f"order-{order.id}"
            task_data['consumed_at'] = str(timezone.now())
            resolved_approval_task.data = task_data
            resolved_approval_task.save(update_fields=['data'])

        return invoice


    @staticmethod
    @transaction.atomic
    def confirm_invoice(invoice: Invoice, number: str, document_attachment=None, date=None):
        """
        Finalizes a DRAFT or PAID-without-folio invoice, adding folio and separating VAT.
        Works for Sale Orders, Purchase Orders and Service Obligations.
        """
        from django.utils.dateparse import parse_date
        from .services import TaxPeriodService, AccountingPeriodService
        
        target_date = date
        if isinstance(target_date, str):
            target_date = parse_date(target_date)
        
        if not target_date:
            target_date = invoice.date

        # 1. Tax Period Validation
        if TaxPeriodService.is_period_closed(target_date):
            raise ValidationError(f"No se puede registrar este documento. El periodo de {target_date} está Tributariamente CERRADO.")

        # 2. Accounting Period Validation
        if AccountingPeriodService.is_period_closed(target_date, 'accounting'):
            raise ValidationError(f"No se puede registrar este documento. El periodo de {target_date} está CONTABLE CERRADO.")
        # Allow PAID status because a draft can be fully paid before folio is registered
        if invoice.status not in [Invoice.Status.DRAFT, Invoice.Status.PAID]:
            raise ValidationError(f"Solo se pueden confirmar facturas en estado Borrador (actual: {invoice.status}).")
        
        if not number:
            raise ValidationError("El número de folio es obligatorio para confirmar la factura.")

        # Tax & Accounting Period Validation
        doc_date = date or invoice.date
        from tax.services import AccountingPeriodService
        
        if TaxPeriodService.is_period_closed(doc_date):
            raise ValidationError(
                f"No se puede confirmar la factura con fecha {doc_date}. "
                f"El periodo tributario correspondiente ya se encuentra CERRADO."
            )
            
        if AccountingPeriodService.is_period_closed(doc_date):
             raise ValidationError(
                f"No se puede confirmar la factura con fecha {doc_date}. "
                f"El periodo CONTABLE correspondiente ya se encuentra CERRADO."
            )

        # Validate Uniqueness
        supplier_id = None
        from purchasing.models import PurchaseOrder
        if isinstance(invoice.source_order, PurchaseOrder):
            supplier_id = invoice.source_order.supplier_id
            
        BillingService._validate_document_uniqueness(
            number, 
            invoice.dte_type, 
            supplier_id=supplier_id, 
            exclude_id=invoice.id
        )

        invoice.number = number
        if date:
            invoice.date = date
        if document_attachment:
            invoice.document_attachment = document_attachment
        
        # Avoid downgrading status if it was already PAID
        if invoice.status == Invoice.Status.DRAFT:
            invoice.status = Invoice.Status.POSTED
            
        invoice.save()

        # Adjust Journal Entry
        entry = invoice.journal_entry
        if entry:
            from accounting.services import JournalEntryService
            from accounting.models import JournalEntry
            # 1. Update Description
            from purchasing.models import PurchaseOrder
            from sales.models import SaleOrder
            if isinstance(invoice.source_order, PurchaseOrder):
                entry.description = f"{invoice.get_dte_type_display()} Compra {number} - OC {invoice.source_order.number}"
            elif isinstance(invoice.source_order, SaleOrder):
                entry.description = f"{invoice.get_dte_type_display()} {number} - Pedido {invoice.source_order.number}"
            
            entry.reference = f"{invoice.dte_type[:3]}-{number}"
            entry.save()

            # Post entry if it's still in DRAFT (which it is for Draft/Paid-Draft invoices)
            if entry.status == JournalEntry.State.DRAFT:
                JournalEntryService.post_entry(entry)

        from workflow.services import WorkflowService
        if invoice.source_order:
            WorkflowService.sync_hub_tasks(invoice.source_order)

        return invoice

    @staticmethod
    @transaction.atomic
    def delete_invoice(invoice: Invoice):
        """
        Deletes an invoice, its associated Journal Entry, and its associated payments.
        Only allowed for DRAFT invoices.
        """
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError("Solo se pueden eliminar facturas en estado Borrador.")

        from treasury.services import TreasuryService
        
        # 1. Delete associated payments
        # 1. Delete associated payments
        for movement in invoice.payments.all():
            TreasuryService.delete_movement(movement)
        
        # 2. Delete invoice's own Journal Entry
        if invoice.journal_entry:
            invoice.journal_entry.delete()
        
        # 2.5 Delete reconciliation journal entries (RECO-...)
        JournalEntry.objects.filter(reference=f"RECO-{invoice.id}").delete()
        
        # 3. Delete invoice
        invoice.delete()

    @staticmethod
    @transaction.atomic
    def annul_invoice(invoice: Invoice, force: bool = False):
        """
        Annuls a POSTED invoice with strict business rule validations.
        Reverses the accounting entry and marks as CANCELLED.
        If force is True, also annuls associated payments.
        """
        if invoice.status not in [Invoice.Status.POSTED, Invoice.Status.PAID]:
             raise ValidationError("Solo se pueden anular facturas publicadas o pagadas.")

        # VALIDATION 1: Folio registrado (fiscal requirement)
        if invoice.number and invoice.number != 'Draft':
            raise ValidationError(
                "❌ No se puede anular una factura con folio asignado.\n"
                "💡 Use una Nota de Crédito para ajustar esta factura."
            )
        
        # VALIDATION 2: Despachos confirmados (para ventas)
        if invoice.sale_order:
            confirmed_deliveries = invoice.sale_order.deliveries.filter(
                status='CONFIRMED'
            ).exists()
            
            if confirmed_deliveries:
                raise ValidationError(
                    "❌ No se puede anular: existen despachos confirmados asociados.\n"
                    "📦 Los productos ya fueron despachados físicamente.\n"
                    "💡 Opciones:\n"
                    "   1. Registrar una devolución de mercadería (solo productos stockeables)\n"
                    "   2. Usar una Nota de Crédito para ajustar la factura"
                )
        
        # VALIDATION 3: Recepciones confirmadas (para compras)
        if invoice.purchase_order:
            confirmed_receipts = invoice.purchase_order.receipts.filter(
                status='CONFIRMED'
            ).exists()
            
            if confirmed_receipts:
                raise ValidationError(
                    "❌ No se puede anular: existen recepciones confirmadas asociadas.\n"
                    "📦 Los productos ya fueron recibidos físicamente.\n"
                    "💡 Opciones:\n"
                    "   1. Registrar una devolución de mercadería al proveedor\n"
                    "   2. Usar una Nota de Crédito para ajustar la factura"
                )
        
        # VALIDATION 4: Pagos registrados
        posted_payments = invoice.payments.filter(journal_entry__status='POSTED')

        if posted_payments.exists():
             if not force:
                 raise ValidationError(
                     "❌ No se puede anular: existen pagos registrados asociados.\n"
                     "💰 Los pagos ya fueron contabilizados.\n"
                     "💡 Opciones:\n"
                     "   1. Anular los pagos primero (use force=True para anulación en cascada)\n"
                     "   2. Registrar una devolución de pago\n"
                     "   3. Usar una Nota de Crédito para ajustar la factura"
                 )
             
             # Annul payments in cascade
             # Annul payments in cascade
             for movement in posted_payments:
                 TreasuryService.annul_movement(movement)

        # 1. Reverse Accounting Entry
        if invoice.journal_entry:
            JournalEntryService.reverse_entry(invoice.journal_entry, description=f"Anulación Factura {invoice.number}")
        
        # 2. Handle associated payments (already handled in validation)
        from treasury.services import TreasuryService

        # 3. Update Status
        invoice.status = Invoice.Status.CANCELLED
        invoice.save()

        # 4. Update Order Status
        from sales.models import SaleOrder
        from purchasing.models import PurchaseOrder
        if isinstance(invoice.source_order, SaleOrder):
            invoice.source_order.status = SaleOrder.Status.CONFIRMED # Revert to confirmed
            invoice.source_order.save()
        elif isinstance(invoice.source_order, PurchaseOrder):
             invoice.source_order.status = PurchaseOrder.Status.RECEIVED # Revert to received
             invoice.source_order.save()
        
        return invoice
