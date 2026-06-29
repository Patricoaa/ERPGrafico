from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from accounting.glosa_builder import GlosaBuilder, Roles
from accounting.models import AccountingSettings, JournalEntry, JournalItem
from accounting.services import AccountingMapper, JournalEntryService
from purchasing.models import PurchaseOrder
from sales.models import SaleOrder
from tax.services import TaxPeriodService
from treasury.models import TreasuryAccount, TreasuryMovement

from .models import Invoice


class BillingService:
    @staticmethod
    def _parse_pos_checkout_params(request):
        """Extract and coerce all POS checkout parameters from the multipart request."""
        data = request.data
        is_pending_registration = data.get("is_pending_registration", False)
        if isinstance(is_pending_registration, str):
            is_pending_registration = is_pending_registration.lower() == "true"

        payment_is_pending = data.get("payment_is_pending", False)
        if isinstance(payment_is_pending, str):
            payment_is_pending = payment_is_pending.lower() == "true"

        installments = data.get("installments")
        if installments is not None:
            try:
                installments = int(installments)
            except (ValueError, TypeError):
                installments = 1
        else:
            installments = 1

        immediate_lines = data.get("immediate_lines")
        if isinstance(immediate_lines, str):
            import json
            try:
                immediate_lines = json.loads(immediate_lines)
            except Exception:
                pass

        line_files = {}
        for key, file_obj in request.FILES.items():
            if key.startswith("line_"):
                parts = key.split("_")
                if len(parts) >= 3:
                    try:
                        line_idx = int(parts[1])
                        file_type = parts[2]
                        if line_idx not in line_files:
                            line_files[line_idx] = {"design": [], "approval": None}
                        if file_type == "design":
                            line_files[line_idx]["design"].append(file_obj)
                        elif file_type == "approval":
                            line_files[line_idx]["approval"] = file_obj
                    except (ValueError, IndexError):
                        continue

        direct_credit_approval = data.get("direct_credit_approval", False)
        if isinstance(direct_credit_approval, str):
            direct_credit_approval = direct_credit_approval.lower() == "true"

        check_bank_id = data.get("check_bank_id")
        if check_bank_id:
            check_bank_id = int(check_bank_id)

        return {
            "order_data": data.get("order_data"),
            "dte_type": data.get("dte_type"),
            "payment_method": data.get("payment_method"),
            "payment_method_id": data.get("payment_method_id"),
            "transaction_number": data.get("transaction_number"),
            "is_pending_registration": is_pending_registration,
            "payment_is_pending": payment_is_pending,
            "document_number": data.get("document_number") or data.get("document_reference"),
            "document_date": data.get("document_date"),
            "document_attachment": request.FILES.get("document_attachment"),
            "amount": data.get("amount"),
            "installments": installments,
            "treasury_account_id": data.get("treasury_account_id"),
            "payment_type": data.get("payment_type", "INBOUND"),
            "pos_session_id": data.get("pos_session_id"),
            "delivery_type": data.get("delivery_type", "IMMEDIATE"),
            "delivery_date": data.get("delivery_date"),
            "immediate_lines": immediate_lines,
            "line_files": line_files,
            "direct_credit_approval": direct_credit_approval,
            "check_number": data.get("check_number") or data.get("transaction_number"),
            "check_bank_id": check_bank_id,
            "check_issue_date": data.get("check_issue_date"),
            "check_due_date": data.get("check_due_date"),
            "checkbook_id": data.get("checkbook_id"),
            "credit_approval_task_id": data.get("credit_approval_task_id"),
            "draft_id": data.get("draft_id"),
            "user": request.user,
        }

    @staticmethod
    def pos_checkout_from_request(request) -> Invoice:
        params = BillingService._parse_pos_checkout_params(request)

        if not all([params["order_data"], params["dte_type"], params["payment_method"]]):
            raise ValidationError("Missing data")

        return BillingService.pos_checkout(
            params["order_data"],
            params["dte_type"],
            params["payment_method"],
            transaction_number=params["transaction_number"],
            is_pending_registration=params["is_pending_registration"],
            payment_is_pending=params["payment_is_pending"],
            amount=params["amount"],
            installments=params["installments"],
            treasury_account_id=params["treasury_account_id"],
            document_number=params["document_number"],
            document_date=params["document_date"],
            document_attachment=params["document_attachment"],
            delivery_type=params["delivery_type"],
            delivery_date=params["delivery_date"],
            immediate_lines=params["immediate_lines"],
            payment_type=params["payment_type"],
            line_files=params["line_files"],
            pos_session_id=params["pos_session_id"],
            payment_method_id=params["payment_method_id"],
            user=params["user"],
            credit_approval_task_id=params["credit_approval_task_id"],
            draft_id=params["draft_id"],
            direct_credit_approval=params["direct_credit_approval"],
            check_number=params["check_number"],
            check_bank_id=params["check_bank_id"],
            check_issue_date=params["check_issue_date"],
            check_due_date=params["check_due_date"],
            checkbook_id=params["checkbook_id"],
        )

    @staticmethod
    def create_invoice_from_payload(validated_data) -> Invoice:
        order_id = validated_data["order_id"]
        order_type = validated_data["order_type"]
        dte_type = validated_data["dte_type"]
        payment_method = validated_data["payment_method"]

        if order_type == "sale":
            from sales.models import SaleOrder
            try:
                order = SaleOrder.objects.get(id=order_id)
            except SaleOrder.DoesNotExist:
                raise ValidationError("Order not found")
            return BillingService.create_sale_invoice(order, dte_type, payment_method)
        else:
            from purchasing.models import PurchaseOrder
            try:
                order = PurchaseOrder.objects.get(id=order_id)
            except PurchaseOrder.DoesNotExist:
                raise ValidationError("Order not found")
            
            supplier_invoice_number = validated_data.get("supplier_invoice_number", "")
            document_attachment = validated_data.get("document_attachment")
            issue_date = validated_data.get("issue_date")
            status_val = validated_data.get("status", Invoice.Status.POSTED)
            return BillingService.create_purchase_bill(
                order,
                supplier_invoice_number,
                dte_type=dte_type,
                document_attachment=document_attachment,
                date=issue_date,
                status=status_val,
            )

    @staticmethod
    @transaction.atomic
    def request_credit_approval(
        order_data, amount, payment_method, full_request_data, requesting_user
    ):
        """
        Creates a CREDIT_POS_REQUEST task when a sale exceeds available credit.
        """
        if isinstance(order_data, list):
            order_data = order_data[0]

        if isinstance(order_data, str):
            import json

            order_data = json.loads(order_data)

        # Basic parsing to find the customer
        from decimal import Decimal

        from contacts.models import Contact
        from sales.models import SaleOrder

        customer_id = None
        # 1. Total calculation improvement
        if "id" in order_data:
            order = SaleOrder.objects.get(id=order_data["id"])
            customer = order.customer
            total = order.total
        else:
            customer_id = order_data.get("customer")
            if not customer_id:
                raise ValidationError("Se requiere un cliente asociado para solicitar crédito.")
            customer = Contact.objects.get(id=customer_id)

            # Robust total calculation for POS:
            # We must account for gross prices and total discounts
            lines_total = Decimal("0")
            for item in order_data.get("lines", []):
                qty = Decimal(str(item.get("quantity", item.get("qty", 0))))
                price = Decimal(str(item.get("unit_price_gross", item.get("unit_price", 0))))
                lines_total += qty * price

            total_discount = Decimal(str(order_data.get("total_discount_amount", 0)))
            total = max(Decimal("0"), lines_total - total_discount)

        paid_amount = (
            Decimal(str(amount))
            if amount is not None
            else (Decimal("0") if payment_method == "CREDIT" else total)
        )
        required_credit = total - paid_amount

        # Calculate POS Fallback Credit
        from accounting.models import AccountingSettings
        from workflow.models import Task
        from workflow.services import WorkflowService

        acc_settings = AccountingSettings.get_solo()
        # Ensure we use a safe division and handle None/0
        fb_val = acc_settings.pos_default_credit_percentage if acc_settings else Decimal("0")
        fallback_percentage = Decimal(str(fb_val)) / Decimal("100.0")
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
        clean_request_data = {
            k: v for k, v in full_request_data.items() if not k.startswith("line_")
        }

        # Calculate POS Fallback Credit
        from accounting.models import AccountingSettings

        acc_settings = AccountingSettings.get_solo()
        fallback_percentage = (
            acc_settings.pos_default_credit_percentage if acc_settings else Decimal("0")
        ) / Decimal("100.0")
        pos_credit = total * fallback_percentage

        task = WorkflowService.create_task(
            task_type="CREDIT_POS_REQUEST",
            title=f"Aprobación Crédito: {customer.name}",
            description=description,
            priority=Task.Priority.HIGH,
            created_by=requesting_user,
            data={
                "request_data": clean_request_data,
                "customer_id": customer.id,
                "customer_name": customer.name,
                "customer_tax_id": customer.tax_id,
                "is_default_customer": customer.is_default_customer,
                "customer_debt": str(customer.credit_balance_used),
                "required_credit": str(required_credit),
                "explicit_credit": str(customer.credit_available),
                "pos_credit": str(pos_credit),
            },
            category=Task.Category.APPROVAL,
        )

        # Apply assignment rule if configured
        try:
            from workflow.models import TaskAssignmentRule

            rule = TaskAssignmentRule.objects.filter(task_type="CREDIT_POS_REQUEST").first()
            if rule:
                task.assigned_to = rule.assigned_user

                # Assign to group. task.assigned_group is a FK to Group, but rule.assigned_group is a CharField string in TaskAssignmentRule.
                if rule.assigned_group:
                    from django.contrib.auth.models import Group

                    group = Group.objects.filter(name=rule.assigned_group).first()
                    if group:
                        task.assigned_group = group

                task.save(update_fields=["assigned_to", "assigned_group"])
        except Exception:
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
        if not number or number == "Draft" or number == "":
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
                raise ValidationError(
                    f"El folio {number} ya ha sido registrado para este proveedor en otro documento."
                )
            else:
                raise ValidationError(
                    f"El folio {number} ya ha sido utilizado en otro documento de venta."
                )

    @staticmethod
    def _capitalize_tax_to_product_cost(product, tax_amount, unit_cost, quantity, order=None):
        """
        Capitalizes tax amount into product cost using weighted average.
        This is used for Boletas and Draft Facturas.
        """
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
                receipt__status="CONFIRMED",
                product=product,
                stock_move__isnull=False,
            )

            for line in receipt_lines:
                move = line.stock_move
                # Capitalize the tax proportionally to this specific move's quantity
                # We use the tax_rate from the purchase line to be precise
                tax_rate = line.purchase_line.tax_rate

                # IVA = Net * (Rate/100)
                # Gross = Net + (Net * Rate/100) = Net * (1 + Rate/100)
                # We update the unit_cost in the Kardex (StockMove) to reflected the capitalized tax
                move.unit_cost = (
                    move.unit_cost * (Decimal("1") + (tax_rate / Decimal("100.0")))
                ).quantize(Decimal("1"))
                move.save(update_fields=["unit_cost"])

                # Sync back to Receipt Line so UI (Kardex) reflects gross value
                line.unit_cost = move.unit_cost
                line.save(update_fields=["unit_cost", "total_cost"])

    @staticmethod
    @transaction.atomic
    def create_sale_invoice(
        order: SaleOrder,
        dte_type: str,
        payment_method: str = "CREDIT",
        status: str = Invoice.Status.POSTED,
        number: str = None,
        date=None,
    ):
        """
        Creates a Sale Invoice (Factura/Boleta) from a SaleOrder.
        """
        if order.status not in [
            SaleOrder.Status.CONFIRMED,
            SaleOrder.Status.DRAFT,
            SaleOrder.Status.PAYMENT_PENDING,
        ]:
            # Allow from draft if POS immediate
            pass

        from core.services import SequenceService

        # Auto-generate folio for Boletas if empty
        if dte_type == Invoice.DTEType.BOLETA and not number:
            number = SequenceService.get_next_number(
                Invoice, filter_kwargs={"dte_type": Invoice.DTEType.BOLETA}
            )

        # Tax & Accounting Period Validation (Only for POSTED documents)
        if status != Invoice.Status.DRAFT:
            doc_date = date or timezone.now().date()
            from tax.services import AccountingPeriodService, TaxPeriodService

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
            number=number or "",
            date=date or timezone.now().date(),
            sale_order=order,
            payment_method=payment_method,
            total_net=order.total_net,
            total_tax=order.total_tax,
            total_discount_amount=order.total_discount_amount,
            total=order.total,
            status=status,
        )

        # 2. Accounting Entry via Mapper
        settings = AccountingSettings.get_solo()
        description, reference, items = AccountingMapper.get_entries_for_sale_invoice(
            invoice, settings
        )
        entry = JournalEntryService.create_entry(
            {
                "date": invoice.date,
                "description": description,
                "status": JournalEntry.State.DRAFT,
                "is_manual": False,
                "source_content_type": ContentType.objects.get_for_model(invoice),
                "source_object_id": invoice.id,
            },
            items,
        )

        if status == Invoice.Status.POSTED:
            JournalEntryService.post_entry(entry)

        invoice.journal_entry = entry
        invoice.save()

        # Check for advances and link them
        advances = order.payments.filter(invoice__isnull=True)
        total_advanced = sum(p.amount for p in advances)

        if total_advanced > 0:
            doc_id = invoice.display_id
            customer_name = order.customer.name

            recon_entry = JournalEntry.objects.create(
                date=timezone.now().date(),
                description=GlosaBuilder.build(
                    GlosaBuilder.CONCILIACION_ANTICIPOS, doc_id, customer_name, total_advanced,
                ),
                reference=f"RECO-{invoice.id}",
                status=JournalEntry.State.DRAFT,
                source_content_type=ContentType.objects.get_for_model(Invoice),
                source_object_id=invoice.id,
            )

            receivable_account = settings.default_receivable_account
            advance_account = settings.default_advance_payment_account or receivable_account

            # Debit: Advance Account (Clear the liability)
            JournalItem.objects.create(
                entry=recon_entry,
                account=advance_account,
                debit=total_advanced,
                credit=0,
                partner=order.customer,
                partner_name=customer_name,
                label=GlosaBuilder.item(Roles.ANTICIPO, customer_name, doc_id),
            )

            # Credit: Receivable Account (Reduce what they owe us)
            JournalItem.objects.create(
                entry=recon_entry,
                account=receivable_account,
                debit=0,
                credit=total_advanced,
                partner=order.customer,
                partner_name=customer_name,
                label=GlosaBuilder.item(Roles.CXC, customer_name, doc_id),
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
    def create_purchase_bill(
        order: PurchaseOrder,
        supplier_invoice_number: str = "",
        dte_type: str = Invoice.DTEType.PURCHASE_INV,
        document_attachment=None,
        date=None,
        status=Invoice.Status.POSTED,
    ):
        """
        Creates a Purchase Bill from a PurchaseOrder.
        If status is DRAFT, it allows empty folio and deferred VAT separation.
        """
        if status == Invoice.Status.POSTED and not supplier_invoice_number:
            raise ValidationError("El número de folio es obligatorio para publicar la factura.")

        # Tax & Accounting Period Validation (Only for POSTED documents)
        if status != Invoice.Status.DRAFT:
            doc_date = date or timezone.now().date()
            from tax.services import AccountingPeriodService, TaxPeriodService

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
                supplier_invoice_number, dte_type, supplier_id=order.supplier_id
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
            status=status,
        )

        # 2. Accounting Entry via Mapper (includes tax capitalization logic for Boletas)
        settings = AccountingSettings.get_solo()
        description, reference, items = AccountingMapper.get_entries_for_purchase_bill(
            invoice, settings
        )
        entry = JournalEntryService.create_entry(
            {
                "date": invoice.date,
                "description": description,
                "status": JournalEntry.State.DRAFT,
                "is_manual": False,
                "source_content_type": ContentType.objects.get_for_model(invoice),
                "source_object_id": invoice.id,
            },
            items,
        )

        # Keep cost capitalization update ONLY for TAXABLE Boletas (not BOLETA_EXENTA)
        # Tax-exempt boletas have no IVA to capitalize
        if dte_type == Invoice.DTEType.BOLETA:
            for line in order.lines.all():
                # Skip products without an asset account (services/subscriptions)
                # — IVA goes to expense, not capitalized into inventory
                if line.product.strategy.get_asset_account(line.product) is None:
                    continue
                line_tax = (line.subtotal * (line.tax_rate / Decimal("100.0"))).quantize(
                    Decimal("1"), rounding="ROUND_HALF_UP"
                )
                # Only capitalize tax for quantities that were ALREADY RECEIVED!
                # Because future receipts will check has_boleta=True and include it themselves in StockMove
                if line_tax > 0 and getattr(line, "quantity_received", 0) > 0:
                    received_tax = line_tax * (line.quantity_received / line.quantity)
                    BillingService._capitalize_tax_to_product_cost(
                        line.product,
                        received_tax,
                        line.unit_cost,
                        line.quantity_received,
                        order=order,
                    )
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
            doc_id = invoice.display_id
            supplier_name = order.supplier.name

            recon_entry = JournalEntry.objects.create(
                date=timezone.now().date(),
                description=GlosaBuilder.build(
                    GlosaBuilder.CONCILIACION_ANTICIPOS, doc_id, supplier_name, total_prepaid,
                ),
                reference=f"RECO-{invoice.id}",  # Reconciliation
                status=JournalEntry.State.DRAFT,
                source_content_type=ContentType.objects.get_for_model(Invoice),
                source_object_id=invoice.id,
            )

            payable_account = settings.default_payable_account
            prepayment_account = settings.default_prepayment_account or payable_account

            # Debit: Payable Account (Reduce what we owe)
            JournalItem.objects.create(
                entry=recon_entry,
                account=payable_account,
                debit=total_prepaid,
                credit=0,
                partner=order.supplier,
                partner_name=supplier_name,
                label=GlosaBuilder.item(Roles.CXP, supplier_name, doc_id),
            )

            # Credit: Prepayment Account (Clear the advance)
            JournalItem.objects.create(
                entry=recon_entry,
                account=prepayment_account,
                debit=0,
                credit=total_prepaid,
                partner=order.supplier,
                partner_name=supplier_name,
                label=GlosaBuilder.item(Roles.ANTICIPO, supplier_name, doc_id),
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
        user = kwargs.get("user")
        from core.cache import acquire_locks

        lock_resources = []
        if getattr(user, "id", None):
            lock_resources.append(f"pos_user_{user.id}")

        with acquire_locks(lock_resources, timeout=15):
            return BillingService._pos_checkout_internal(*args, **kwargs)

    @staticmethod
    @transaction.atomic
    def _pos_checkout_internal(
        order_data,
        dte_type,
        payment_method,
        transaction_number=None,
        is_pending_registration=False,
        payment_is_pending=False,
        amount=None,
        installments=1,
        treasury_account_id=None,
        document_number=None,
        document_date=None,
        document_attachment=None,
        delivery_type="IMMEDIATE",
        delivery_date=None,
        immediate_lines=None,
        payment_type="INBOUND",
        line_files=None,
        pos_session_id=None,
        user=None,
        payment_method_id=None,
        credit_approval_task_id=None,
        draft_id=None,
        direct_credit_approval=False,
        check_number=None,
        check_bank_id=None,
        check_issue_date=None,
        check_due_date=None,
        checkbook_id=None,
    ):
        """
        Complete POS checkout: Create Order -> Confirm -> Invoice -> Payment -> (Optional) Delivery.
        pos_session_id: Optional ID of an open POS session to link the payment to.
        """
        from inventory.models import Warehouse
        from sales.serializers import CreateSaleOrderSerializer
        from treasury.services import TreasuryService

        # 1. Get or Create Order
        order = None
        if isinstance(order_data, list):
            order_data = order_data[0]

        if isinstance(order_data, str):
            import json

            order_data = json.loads(order_data)

        # CARD_TERMINAL is PaymentMethod.Type (new model), not SaleOrder.PaymentMethod legacy enum.
        # Normalize to CARD for SaleOrder persistence; PaymentMethod FK (payment_method_id) keeps the terminal link.
        if isinstance(order_data, dict) and order_data.get("payment_method") == "CARD_TERMINAL":
            order_data["payment_method"] = "CARD"

        if "id" in order_data:
            order = SaleOrder.objects.get(id=order_data["id"])

            # Update tax rate for existing order if needed based on DTE type
            from accounting.utils import get_default_vat_rate

            target_tax = (
                Decimal("0")
                if dte_type in ["FACTURA_EXENTA", "BOLETA_EXENTA"]
                else get_default_vat_rate()
            )
            lines_updated = False
            for line in order.lines.all():
                if line.tax_rate != target_tax:
                    line.tax_rate = target_tax
                    line.save()
                    lines_updated = True

            if lines_updated:
                order.recalculate_totals()
        else:
            if "payment_method" not in order_data:
                order_data["payment_method"] = payment_method

            # Enforce tax rate for new orders based on DTE type
            from accounting.utils import get_default_vat_rate

            target_tax = (
                0
                if dte_type in ["FACTURA_EXENTA", "BOLETA_EXENTA"]
                else float(get_default_vat_rate())
            )
            if "lines" in order_data:
                for line in order_data["lines"]:
                    line["tax_rate"] = target_tax

            order_serializer = CreateSaleOrderSerializer(data=order_data)
            if not order_serializer.is_valid():
                raise ValidationError(order_serializer.errors)

            # Use provided channel or default to POS
            channel = order_data.get("channel", "POS")
            order = order_serializer.save(channel=channel)

            # Enforce tax rate on created lines (Safety net against serializer dropping it)
            # This logic mirrors the existing order update logic
            from accounting.utils import get_default_vat_rate

            target_tax = (
                Decimal("0")
                if dte_type in ["FACTURA_EXENTA", "BOLETA_EXENTA"]
                else get_default_vat_rate()
            )
            # Forcing refresh from DB to avoid any stale data issues
            for line in order.lines.all():
                line.tax_rate = target_tax
                line.save()

            order.recalculate_totals()
            order.save()

        # Tax & Accounting Period Validation (Only if NOT pending registration)
        if not is_pending_registration:
            doc_date = document_date or timezone.now().date()
            from tax.services import AccountingPeriodService, TaxPeriodService

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
        paid_amount = (
            Decimal(str(amount))
            if (amount is not None and str(amount) != "")
            else (Decimal("0") if payment_method == "CREDIT" else order.total)
        )
        required_credit = max(Decimal("0"), order.total - paid_amount)

        # Credit bypass by approved task
        bypass_credit_validation = False
        resolved_approval_task = None  # Track the task for post-checkout consumption marking
        if credit_approval_task_id:
            from workflow.models import Task

            try:
                task = Task.objects.get(id=credit_approval_task_id, task_type="CREDIT_POS_REQUEST")
                if task.status == Task.Status.COMPLETED:
                    # SECURE VALIDATION: Verify task data matches current checkout
                    task_data = task.data or {}
                    approved_customer_id = task_data.get("customer_id")
                    approved_credit_str = task_data.get("required_credit", "0")
                    approved_credit = Decimal(approved_credit_str)

                    # 0. Check Reuse (Anti-replay)
                    if task_data.get("consumed_by_invoice_id"):
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
                    raise ValidationError(
                        f"La tarea de aprobación de crédito {task.id} aún no está completada."
                    )
            except Task.DoesNotExist:
                raise ValidationError("Tarea de aprobación de crédito no encontrada.")
        elif direct_credit_approval and user and user.has_perm("sales.approve_credit"):
            bypass_credit_validation = True
            order.credit_assignment_origin = SaleOrder.CreditOrigin.MANUAL

        if not bypass_credit_validation and required_credit > 0:
            contact = order.customer

            if not contact:
                raise ValidationError("Se requiere un cliente asociado para asignar crédito.")

            if contact.credit_blocked:
                raise ValidationError(
                    "El crédito está bloqueado contractualmente para este cliente."
                )

            if getattr(contact, "credit_auto_blocked", False) and not contact.is_default_customer:
                raise ValidationError(
                    "El cliente se encuentra Auto-Bloqueado por tener deudas con una mora superior al límite permitido."
                )

            # Fallback Logic: check if we can bypass credit_enabled check
            from accounting.models import AccountingSettings

            acc_settings = AccountingSettings.get_solo()
            fallback_percentage = (
                acc_settings.pos_default_credit_percentage if acc_settings else 0
            ) / Decimal("100.0")
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
            order.save(update_fields=["credit_assignment_origin", "credit_approval_task"])

        # -------------------------

        # 2. Confirm Order
        from sales.services import SalesService

        SalesService.confirm_sale(order, line_files=line_files)

        # 2.5 Propagar fecha de entrega como estimated_completion_date en las OT
        if delivery_date:
            from production.models import WorkOrder as WO

            WO.objects.filter(sale_order=order).update(
                estimated_completion_date=delivery_date,
            )

        # 3. Handle Delivery Scheduling / Action
        if delivery_type == "IMMEDIATE":
            # Dispatch everything right now from the first available warehouse
            warehouse = Warehouse.objects.first()
            if not warehouse:
                raise ValidationError("Debe existir al menos una bodega para realizar despachos.")
            SalesService.dispatch_order(order, warehouse)

        elif delivery_type == "PARTIAL":
            # Partial Dispatch: Immediate lines are dispatched now, others are scheduled
            warehouse = Warehouse.objects.first()
            if not warehouse:
                raise ValidationError("Debe existir al menos una bodega para realizar despachos.")

            if not immediate_lines:
                # Fallback to SCHEDULED if no lines are marked for immediate
                delivery_type = "SCHEDULED"
            else:
                # Prepare data for immediate lines
                line_data = []

                # Pre-fetch lines for faster lookup and ID resolution
                # This fixes the issue where frontend sends product_id as line_id
                all_order_lines = list(order.lines.all())
                lines_by_id = {line.id: line for line in all_order_lines}
                lines_by_product = {
                    line.product_id: line for line in all_order_lines if line.product_id
                }

                for item in immediate_lines:
                    try:
                        resolved_line = None
                        qty = 0
                        uom_id = None

                        if isinstance(item, dict):
                            # Frontend sends lineId, but we might also support id
                            raw_id = item.get("line_id") or item.get("lineId") or item.get("id")
                            qty = Decimal(str(item.get("quantity", 0)))
                            # Frontend sends uom, but backend partial_dispatch expects uom_id (or we adapt)
                            uom_id = item.get("uom") or item.get("uom_id")

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
                            line_data.append(
                                {"line_id": resolved_line.id, "quantity": qty, "uom_id": uom_id}
                            )
                    except (ValueError, TypeError):
                        continue

                if line_data:
                    SalesService.partial_dispatch(order, warehouse, line_data)

            # For the REST (or all if fallback), schedule them
            if (
                delivery_type == "PARTIAL" or delivery_type == "SCHEDULED"
            ):  # Logic applies to remainder
                if delivery_date:
                    order.delivery_date = delivery_date

                order.save()

        elif delivery_type == "SCHEDULED":
            service_lines = order.lines.filter(
                product__product_type="SERVICE", quantity_pending__gt=0
            )
            non_service_pending = order.lines.exclude(product__product_type="SERVICE").filter(
                quantity_pending__gt=0
            )

            if service_lines.exists() and not non_service_pending.exists():
                warehouse = Warehouse.objects.first()
                if not warehouse:
                    raise ValidationError(
                        "Debe existir al menos una bodega para registrar cumplimiento."
                    )
                SalesService.dispatch_order(order, warehouse, delivery_date=delivery_date)
            else:
                order.delivery_status = SaleOrder.DeliveryStatus.PENDING
                if delivery_date:
                    order.delivery_date = delivery_date
                order.save()
        elif delivery_type == "PICKUP":
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

            invoice = BillingService.create_sale_invoice(
                order,
                dte_type,
                payment_method,
                status=status,
                number=document_number,
                date=document_date,
            )
            if document_date:
                invoice.date = document_date
            if document_attachment:
                invoice.document_attachment = document_attachment
            invoice.save()

        # 4. Create Payment (if not credit)
        if payment_method not in ("CREDIT", "CREDIT_BALANCE"):
            received_amount = (
                Decimal(str(amount)) if amount is not None and str(amount) != "" else order.total
            )
            payment_amount = min(received_amount, order.total)

            movement_date = (
                invoice.date if invoice is not None else (document_date or timezone.now().date())
            )

            # Resolve PaymentMethod FK — required for PaymentOrchestrator path.
            payment_method_inst = None
            if payment_method_id:
                from treasury.models import PaymentMethod as PM

                payment_method_inst = PM.objects.filter(id=payment_method_id).first()

            # Asegurar que installments sea int
            if not isinstance(installments, int):
                try:
                    installments = int(installments) if installments is not None else 1
                except (ValueError, TypeError):
                    installments = 1

            if payment_method_inst is not None:
                # E2: la tarjeta de crédito propia (método CREDIT_CARD) es un
                # medio de pago de COMPRAS — usarla genera pasivo de TC. NO es
                # un medio de COBRO de ventas: cobrar una venta con ella crearía
                # deuda de tarjeta propia (antes esta rama instanciaba
                # create_card_purchase → un OUTBOUND D=cliente / H=pasivo TC,
                # contablemente incorrecto). Coincide con el filtro
                # `allow_for_sales` del frontend, que ya oculta estos métodos en
                # el checkout de ventas; esto lo hace cumplir también en backend.
                if (
                    payment_method_inst.method_type == "CREDIT_CARD"
                    and payment_type == TreasuryMovement.Type.INBOUND
                ):
                    raise ValidationError(
                        "La tarjeta de crédito propia no es un medio de cobro de "
                        "ventas. Para cobros con tarjeta use un medio de tipo "
                        "Tarjeta o terminal."
                    )
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
                    # Check-specific params (only used when method_type == 'CHECK')
                    check_number=check_number,
                    check_bank_id=check_bank_id,
                    check_issue_date=check_issue_date,
                    check_due_date=check_due_date,
                    checkbook_id=checkbook_id,
                )
            else:
                # Fallback legacy path: payment_method_id not provided (non-POS flows).
                treasury_account = (
                    TreasuryAccount.objects.filter(id=treasury_account_id).first()
                    if treasury_account_id
                    else None
                )
                from_acc = (
                    treasury_account if payment_type != TreasuryMovement.Type.INBOUND else None
                )
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
        elif payment_method == "CREDIT_BALANCE":
            contact = order.customer
            received_amount = (
                Decimal(str(amount)) if amount is not None and str(amount) != "" else order.total
            )
            payment_amount = min(received_amount, order.total)

            if contact.credit_balance < payment_amount:
                raise ValidationError(
                    f"Saldo a favor insuficiente. Disponible: ${contact.credit_balance:,.0f}, Requerido: ${payment_amount:,.0f}"
                )

            # Create INBOUND on the sale invoice to balance the Sale order
            # This counts as a "Consumption" of the virtual balance.
            TreasuryService.create_movement(
                amount=payment_amount,
                movement_type="INBOUND",
                payment_method="CREDIT_BALANCE",
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
                created_by=user,
            )
        # 5. Atomic Draft Removal (NEW)
        if draft_id:
            from sales.models import DraftCart

            try:
                # Handle potential string-based 'null' or 'undefined' from frontend
                if isinstance(draft_id, str):
                    if draft_id.lower() in ["null", "undefined", ""]:
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
            task_data["consumed_by_invoice_id"] = invoice.id if invoice else f"order-{order.id}"
            task_data["consumed_at"] = str(timezone.now())
            resolved_approval_task.data = task_data
            resolved_approval_task.save(update_fields=["data"])

        return invoice

    @staticmethod
    @transaction.atomic
    def confirm_invoice(invoice: Invoice, number: str, document_attachment=None, date=None):
        """
        Finalizes a DRAFT or PAID-without-folio invoice, adding folio and separating VAT.
        Works for Sale Orders, Purchase Orders and Service Obligations.
        """
        from django.utils.dateparse import parse_date

        from tax.services import AccountingPeriodService

        target_date = date
        if isinstance(target_date, str):
            target_date = parse_date(target_date)

        if not target_date:
            target_date = invoice.date

        # 1. Tax Period Validation
        if TaxPeriodService.is_period_closed(target_date):
            raise ValidationError(
                f"No se puede registrar este documento. El periodo de {target_date} está Tributariamente CERRADO."
            )

        # 2. Accounting Period Validation
        if AccountingPeriodService.is_period_closed(target_date):
            raise ValidationError(
                f"No se puede registrar este documento. El periodo de {target_date} está CONTABLE CERRADO."
            )
        # Allow PAID status because a draft can be fully paid before folio is registered
        if invoice.status not in [Invoice.Status.DRAFT, Invoice.Status.PAID]:
            raise ValidationError(
                f"Solo se pueden confirmar facturas en estado Borrador (actual: {invoice.status})."
            )

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
        supplier_id = (
            invoice.source_order.get_invoice_supplier_id() if invoice.source_order else None
        )
        BillingService._validate_document_uniqueness(
            number, invoice.dte_type, supplier_id=supplier_id, exclude_id=invoice.id
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
            from accounting.models import JournalEntry
            from accounting.services import JournalEntryService

            # 1. Update Description
            if invoice.source_order:
                entry.description = invoice.source_order.describe_for_invoice_journal(
                    number, invoice.get_dte_type_display()
                )

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
    @staticmethod
    def validate_editable(instance):
        if instance.status != "DRAFT":
            raise ValidationError("Solo se pueden editar facturas en estado Borrador.")

    @staticmethod
    def check_folio_from_request(request):
        from .selectors import InvoiceSelector

        num = request.query_params.get('number')
        dte = request.query_params.get('dte_type')
        if not num or not dte:
            raise ValidationError('Faltan parametros')
        return InvoiceSelector.check_folio_uniqueness(
            number=num,
            dte_type=dte,
            exclude_id=request.query_params.get('exclude_id'),
            contact_id=request.query_params.get('contact_id'),
            is_purchase=request.query_params.get('is_purchase', 'false').lower() == 'true',
        )

    @staticmethod
    def validate_purge(invoice: Invoice):
        """
        Una factura solo puede purgarse (hard delete) si está CANCELLED y no dejó
        huella contable: facturas anuladas con reversos se conservan por auditoría.
        """
        if invoice.status != Invoice.Status.CANCELLED:
            raise ValidationError("Use el endpoint de cancelación para facturas activas.")
        has_accounting_trace = (
            invoice.journal_entry_id is not None
            or invoice.payments.filter(journal_entry__isnull=False).exists()
        )
        if has_accounting_trace:
            raise ValidationError(
                "No se puede eliminar: la factura tiene asientos contables asociados. "
                "Los documentos anulados se conservan como pista de auditoría."
            )

    @staticmethod
    @transaction.atomic
    def cancel_invoice(invoice: Invoice, user=None, reason: str = ""):
        """
        Cancels a DRAFT invoice by cancelling its payments, deleting its draft JE,
        and marking it as CANCELLED. Never hard-deletes fiscal records.
        """
        from core.services.document import lock_document

        lock_document(invoice)

        if invoice.status == Invoice.Status.CANCELLED:
            return invoice

        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError("Solo se pueden cancelar facturas en estado Borrador.")

        from treasury.models import TreasuryMovement
        from treasury.services import TreasuryService

        # 1. Cancel associated payments
        for movement in invoice.payments.all():
            if movement.status != TreasuryMovement.MovementStatus.CANCELLED:
                TreasuryService.cancel_movement(movement, user=user, reason=reason)

        # 2. Delete invoice's own draft Journal Entry
        if invoice.journal_entry:
            from tax.services import validate_period_open

            validate_period_open(invoice.journal_entry.date, action="cancelar la factura")
            invoice.journal_entry.delete()

        # 3. Delete reconciliation journal entries (RECO-...)
        JournalEntry.objects.filter(reference=f"RECO-{invoice.id}").delete()

        # 4. Mark as CANCELLED
        invoice.status = Invoice.Status.CANCELLED
        invoice.save()

        from workflow.services import WorkflowService

        WorkflowService.log_transition(invoice, "cancel", user=user, reason=reason)
        return invoice

    @staticmethod
    @transaction.atomic
    def annul_invoice(invoice: Invoice, force: bool = False, user=None, reason: str = ""):
        """
        Annuls a POSTED invoice with strict business rule validations.
        Reverses the accounting entry and marks as CANCELLED.
        If force is True, also annuls associated payments.
        """
        from core.services.document import lock_document

        lock_document(invoice)

        if invoice.status == Invoice.Status.CANCELLED:
            return invoice

        if not reason:
            raise ValidationError("Debe indicar el motivo de la anulación.")

        if invoice.status not in [Invoice.Status.POSTED, Invoice.Status.PAID]:
            raise ValidationError("Solo se pueden anular facturas publicadas o pagadas.")

        # VALIDATION 1: Folio registrado (fiscal requirement)
        # Solo aplica a documentos EMITIDOS (ventas): un folio propio informado al SII
        # es inmutable y se ajusta por Nota de Crédito. En compras el folio pertenece
        # al proveedor; la factura recibida se anula con asiento de reverso.
        # (create_purchase_bill no setea source_order, por eso el FK explícito manda.)
        is_purchase_doc = invoice.purchase_order_id is not None or not invoice.is_sale_document()
        if invoice.number and invoice.number != "Draft" and not is_purchase_doc:
            raise ValidationError(
                "❌ No se puede anular una factura con folio asignado.\n"
                "💡 Use una Nota de Crédito para ajustar esta factura."
            )

        # VALIDATION 2: Despachos confirmados (para ventas)
        if invoice.sale_order:
            confirmed_deliveries = invoice.sale_order.deliveries.filter(status="CONFIRMED").exists()

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
            confirmed_receipts = invoice.purchase_order.receipts.filter(status="CONFIRMED").exists()

            if confirmed_receipts:
                raise ValidationError(
                    "❌ No se puede anular: existen recepciones confirmadas asociadas.\n"
                    "📦 Los productos ya fueron recibidos físicamente.\n"
                    "💡 Opciones:\n"
                    "   1. Registrar una devolución de mercadería al proveedor\n"
                    "   2. Usar una Nota de Crédito para ajustar la factura"
                )

        # VALIDATION 4: Pagos registrados
        from treasury.services import TreasuryService

        posted_payments = invoice.payments.filter(journal_entry__status="POSTED")

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
            for movement in posted_payments:
                TreasuryService.annul_movement(
                    movement,
                    user=user,
                    reason=reason,
                    treasury_account_id=(
                        movement.to_account_id
                        if movement.movement_type == "INBOUND"
                        else movement.from_account_id
                    ),
                )

        # 1. Reverse Accounting Entry
        if invoice.journal_entry:
            from django.utils import timezone

            from tax.services import validate_period_open

            validate_period_open(timezone.now().date(), action="anular la factura")
            JournalEntryService.reverse_entry(
                invoice.journal_entry, description=f"Anulación Factura {invoice.number}"
            )

        # 2. Update Status
        invoice.status = Invoice.Status.CANCELLED
        invoice.save()

        # 3. Update Order Status
        if invoice.source_order:
            invoice.source_order.revert_after_invoice_cancellation()

        from workflow.services import WorkflowService

        WorkflowService.log_transition(invoice, "annul", user=user, reason=reason)
        return invoice
