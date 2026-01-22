from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from typing import List, Dict, Optional

from billing.models import Invoice
from billing.note_workflow import NoteWorkflow
from accounting.models import JournalEntry, JournalItem, AccountingSettings, AccountType
from inventory.models import StockMove, Product, Warehouse
from core.services import SequenceService


class NoteCheckoutService:
    """
    Service for handling multi-stage checkout of Credit/Debit Notes.
    Replaces atomic create_note with a staged workflow similar to SalesCheckoutWizard.
    """
    
    @staticmethod
    @transaction.atomic
    def init_note_workflow(
        corrected_invoice_id: int,
        note_type: str,
        reason: str = "",
        created_by=None
    ) -> NoteWorkflow:
        """
        Stage 1: Initialize note workflow
        
        Args:
            corrected_invoice_id: ID of the POSTED invoice being corrected
            note_type: 'NOTA_CREDITO' or 'NOTA_DEBITO'
            reason: Text explaining why the note is being created
            created_by: User creating the workflow
        
        Returns:
            NoteWorkflow instance in DRAFT stage
        
        Raises:
            ValidationError: If invoice is not POSTED or is another note
        """
        # Get and validate corrected invoice
        try:
            corrected_invoice = Invoice.objects.get(id=corrected_invoice_id)
        except Invoice.DoesNotExist:
            raise ValidationError(f"Factura con ID {corrected_invoice_id} no existe.")
        
        # CRITICAL VALIDATION: Only from POSTED invoices
        if corrected_invoice.status != Invoice.Status.POSTED:
            raise ValidationError(
                f"Solo se pueden crear NC/ND desde facturas publicadas. "
                f"Estado actual: {corrected_invoice.get_status_display()}"
            )
        
        # Cannot create note from another note
        if corrected_invoice.dte_type in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
            raise ValidationError(
                "No se puede crear una nota desde otra nota. "
                "Seleccione la factura original."
            )
        
        # Validate note_type
        if note_type not in [Invoice.DTEType.NOTA_CREDITO, Invoice.DTEType.NOTA_DEBITO]:
            raise ValidationError(f"Tipo de nota inválido: {note_type}")
        
        # Create draft invoice
        invoice = Invoice.objects.create(
            dte_type=note_type,
            status=Invoice.Status.DRAFT,
            date=timezone.now().date(),
            sale_order=corrected_invoice.sale_order,
            purchase_order=corrected_invoice.purchase_order,
            contact=corrected_invoice.contact,
            corrected_invoice=corrected_invoice,
            payment_method=corrected_invoice.payment_method
        )
        
        # Create workflow
        workflow = NoteWorkflow.objects.create(
            invoice=invoice,
            corrected_invoice=corrected_invoice,
            sale_order=corrected_invoice.sale_order,
            purchase_order=corrected_invoice.purchase_order,
            current_stage=NoteWorkflow.Stage.INVOICE_SELECTED,
            reason=reason,
            created_by=created_by
        )
        
        return workflow
    
    @staticmethod
    @transaction.atomic
    def select_items(
        workflow_id: int,
        selected_items: List[Dict]
    ) -> NoteWorkflow:
        """
        Stage 2: Select products/services to return/adjust
        
        Args:
            workflow_id: NoteWorkflow ID
            selected_items: List of dicts with:
                - product_id: int
                - quantity: Decimal or str
                - reason: str (optional)
                - unit_price: Decimal or str (optional, for accounting)
                - tax_amount: Decimal or str (optional)
        
        Returns:
            Updated workflow in ITEMS_SELECTED stage
        
        Raises:
            ValidationError: If quantities exceed delivered, or invalid products
        """
        workflow = NoteWorkflow.objects.select_related('invoice', 'corrected_invoice').get(id=workflow_id)
        
        if workflow.current_stage != NoteWorkflow.Stage.INVOICE_SELECTED:
            raise ValidationError(
                f"No se pueden seleccionar productos en etapa {workflow.get_current_stage_display()}"
            )
        
        # Validate and process items
        validated_items = []
        total_net = Decimal('0')
        total_tax = Decimal('0')
        has_stockable = False
        
        for item in selected_items:
            try:
                product = Product.objects.get(id=item['product_id'])
            except Product.DoesNotExist:
                raise ValidationError(f"Producto con ID {item['product_id']} no existe.")
            
            quantity = Decimal(str(item['quantity']))
            
            if quantity <= 0:
                raise ValidationError(f"Cantidad debe ser mayor a cero para {product.name}")
            
            # BUSINESS RULE: Validate against delivered quantity for credit notes
            if workflow.is_credit_note and workflow.sale_order:
                sale_line = workflow.sale_order.lines.filter(product=product).first()
                if sale_line and quantity > sale_line.quantity_delivered:
                    raise ValidationError(
                        f"Cantidad a devolver ({quantity}) excede cantidad entregada "
                        f"({sale_line.quantity_delivered}) para {product.name}"
                    )
            
            # Check if creates stock movements
            creates_stock_move = False
            if product.track_inventory:
                # Exclude manufacturable without BOM or advanced
                if product.product_type == Product.Type.MANUFACTURABLE:
                    if not product.requires_advanced_manufacturing and product.has_bom:
                        creates_stock_move = True
                else:
                    creates_stock_move = True
            
            if creates_stock_move:
                has_stockable = True
            
            # Calculate amounts (can be provided or calculated)
            unit_price = Decimal(str(item.get('unit_price', 0)))
            tax_amount = Decimal(str(item.get('tax_amount', 0)))
            
            line_net = quantity * unit_price
            line_tax = quantity * tax_amount
            
            total_net += line_net
            total_tax += line_tax
            
            validated_items.append({
                'product_id': product.id,
                'product_name': product.name,
                'product_type': product.product_type,
                'quantity': float(quantity),
                'unit_price': float(unit_price),
                'tax_amount': float(tax_amount),
                'line_net': float(line_net),
                'line_tax': float(line_tax),
                'reason': item.get('reason', ''),
                'creates_stock_move': creates_stock_move
            })
        
        # Update workflow
        workflow.selected_items = validated_items
        workflow.requires_logistics = has_stockable
        workflow.current_stage = NoteWorkflow.Stage.ITEMS_SELECTED
        workflow.save()
        
        # Update invoice totals
        workflow.invoice.total_net = total_net
        workflow.invoice.total_tax = total_tax
        workflow.invoice.total = total_net + total_tax
        workflow.invoice.save()
        
        return workflow
    
    @staticmethod
    @transaction.atomic
    def process_logistics(
        workflow_id: int,
        warehouse_id: int,
        date: str,
        notes: str = ""
    ) -> NoteWorkflow:
        """
        Stage 3: Process logistics (stock movements)
        Only called if requires_logistics=True
        
        Args:
            workflow_id: NoteWorkflow ID
            warehouse_id: Warehouse for receiving/dispatching
            date: Date for stock movement
            notes: Additional notes
        
        Returns:
            Updated workflow in LOGISTICS_COMPLETED stage
        
        Raises:
            ValidationError: If logistics not required or invalid warehouse
        """
        workflow = NoteWorkflow.objects.select_related('invoice').get(id=workflow_id)
        
        if workflow.current_stage != NoteWorkflow.Stage.ITEMS_SELECTED:
            raise ValidationError(
                f"No se puede procesar logística en etapa {workflow.get_current_stage_display()}"
            )
        
        if not workflow.requires_logistics:
            raise ValidationError("Este workflow no requiere procesamiento de logística.")
        
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id)
        except Warehouse.DoesNotExist:
            raise ValidationError(f"Bodega con ID {warehouse_id} no existe.")
        
        # Create stock movements for stockable items
        for item in workflow.selected_items:
            if not item.get('creates_stock_move', False):
                continue
            
            product = Product.objects.get(id=item['product_id'])
            quantity = Decimal(str(item['quantity']))
            
            # Determine move type
            move_type = StockMove.Type.IN if workflow.is_credit_note else StockMove.Type.OUT
            
            StockMove.objects.create(
                date=date,
                product=product,
                warehouse=warehouse,
                uom=product.uom,
                quantity=quantity,
                move_type=move_type,
                description=f"{workflow.invoice.get_dte_type_display()} - {workflow.invoice.display_id} (REF: WORKFLOW-{workflow.id})"
            )
        
        # Update workflow
        workflow.logistics_data = {
            'warehouse_id': warehouse_id,
            'warehouse_name': warehouse.name,
            'date': str(date),
            'notes': notes
        }
        workflow.current_stage = NoteWorkflow.Stage.LOGISTICS_COMPLETED
        workflow.save()
        
        return workflow
    
    @staticmethod
    @transaction.atomic
    def skip_logistics(workflow_id: int) -> NoteWorkflow:
        """
        Skip logistics stage if no stockable items
        
        Args:
            workflow_id: NoteWorkflow ID
        
        Returns:
            Updated workflow in LOGISTICS_COMPLETED stage
        """
        workflow = NoteWorkflow.objects.get(id=workflow_id)
        
        if workflow.current_stage != NoteWorkflow.Stage.ITEMS_SELECTED:
            raise ValidationError(
                f"No se puede saltar logística en etapa {workflow.get_current_stage_display()}"
            )
        
        if workflow.requires_logistics:
            raise ValidationError(
                "No se puede saltar logística cuando hay productos stockeables."
            )
        
        workflow.current_stage = NoteWorkflow.Stage.LOGISTICS_COMPLETED
        workflow.save()
        
        return workflow
    
    @staticmethod
    @transaction.atomic
    def register_document(
        workflow_id: int,
        document_number: str,
        document_date: str = None,
        document_attachment=None,
        is_pending: bool = False
    ) -> NoteWorkflow:
        """
        Stage 4: Register document (DTE folio and accounting)
        
        Args:
            workflow_id: NoteWorkflow ID
            document_number: Folio number
            document_date: Document date (optional, defaults to today)
            document_attachment: PDF/XML file (optional)
            is_pending: If True, defer accounting entry posting
        
        Returns:
            Updated workflow in REGISTRATION_PENDING stage
        """
        workflow = NoteWorkflow.objects.select_related(
            'invoice', 'corrected_invoice', 'sale_order', 'purchase_order'
        ).get(id=workflow_id)
        
        if workflow.current_stage != NoteWorkflow.Stage.LOGISTICS_COMPLETED:
            raise ValidationError(
                f"No se puede registrar documento en etapa {workflow.get_current_stage_display()}"
            )
        
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("Debe configurar la contabilidad primero.")
        
        # Update invoice
        workflow.invoice.number = document_number
        workflow.invoice.date = document_date or timezone.now().date()
        if document_attachment:
            workflow.invoice.document_attachment = document_attachment
        workflow.invoice.save()
        
        # Create accounting entry
        entry = NoteCheckoutService._create_accounting_entry(workflow, settings)
        
        if not is_pending:
            # Post entry immediately
            from accounting.services import JournalEntryService
            JournalEntryService.post_entry(entry)
            workflow.invoice.status = Invoice.Status.POSTED
            workflow.invoice.save()
        
        # Update workflow
        workflow.registration_data = {
            'document_number': document_number,
            'date': str(workflow.invoice.date),
            'is_pending': is_pending
        }
        workflow.registration_deferred = is_pending
        workflow.current_stage = NoteWorkflow.Stage.REGISTRATION_PENDING
        workflow.save()
        
        return workflow
    
    @staticmethod
    def _create_accounting_entry(workflow: NoteWorkflow, settings: AccountingSettings) -> JournalEntry:
        """
        Create journal entry for the note
        
        Business rules:
        - Services/Consumables: Reverse to income/expense accounts
        - Stockables: Reverse to inventory account
        - Manufacturables (with BOM): Reverse to inventory
        - Manufacturables (without BOM/advanced): Reverse to COGS (no stock recovery)
        """
        invoice = workflow.invoice
        is_sale = workflow.sale_order is not None
        
        # Create entry
        entry = JournalEntry.objects.create(
            date=invoice.date,
            description=f"{invoice.get_dte_type_display()} {invoice.number}",
            reference=f"WORKFLOW-{workflow.id}",
            state=JournalEntry.State.DRAFT
        )
        
        invoice.journal_entry = entry
        invoice.save()
        
        # Determine receivable/payable account
        if is_sale:
            partner_account = (
                workflow.corrected_invoice.contact.account_receivable or
                settings.default_receivable_account
            )
        else:
            partner_account = (
                workflow.corrected_invoice.contact.account_payable or
                settings.default_payable_account
            )
        
        if not partner_account:
            raise ValidationError("No se encontró cuenta por cobrar/pagar.")
        
        # Create receivable/payable entry
        total_amount = invoice.total
        
        if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
            # Credit Note: Reduces debt -> Debit partner account
            debit_amount = total_amount if is_sale else 0
            credit_amount = 0 if is_sale else total_amount
        else:
            # Debit Note: Increases debt -> Credit partner account
            debit_amount = 0 if is_sale else total_amount
            credit_amount = total_amount if is_sale else 0
        
        JournalItem.objects.create(
            entry=entry,
            account=partner_account,
            debit=debit_amount,
            credit=credit_amount,
            partner=workflow.corrected_invoice.contact.name if workflow.corrected_invoice.contact else "",
            label=f"{invoice.display_id}"
        )
        
        # Create revenue/expense entries per product
        for item in workflow.selected_items:
            product = Product.objects.get(id=item['product_id'])
            line_net = Decimal(str(item['line_net']))
            line_tax = Decimal(str(item['line_tax']))
            
            # Determine account based on product type
            if product.product_type == Product.Type.SERVICE:
                # Service -> Income/Expense account
                product_account = product.income_account or settings.default_revenue_account
            elif product.product_type == Product.Type.CONSUMABLE:
                # Consumable -> Expense account
                product_account = product.expense_account or settings.default_expense_account
            elif product.track_inventory:
                # Stockable -> Inventory account
                product_account = settings.default_inventory_account
            else:
                # Manufacturable without stock -> COGS
                product_account = settings.default_expense_account
            
            if not product_account:
                raise ValidationError(f"No se encontró cuenta contable para {product.name}")
            
            # Revenue/Expense line (net amount)
            if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
                debit_amount = 0 if is_sale else line_net
                credit_amount = line_net if is_sale else 0
            else:
                debit_amount = line_net if is_sale else 0
                credit_amount = 0 if is_sale else line_net
            
            JournalItem.objects.create(
                entry=entry,
                account=product_account,
                debit=debit_amount,
                credit=credit_amount,
                label=f"{product.name} - {item['reason']}" if item.get('reason') else product.name
            )
        
        # Tax entry
        if invoice.total_tax > 0:
            tax_account = settings.default_tax_payable_account if is_sale else settings.default_tax_receivable_account
            
            if not tax_account:
                raise ValidationError("No se encontró cuenta de impuestos.")
            
            if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
                debit_amount = 0 if is_sale else invoice.total_tax
                credit_amount = invoice.total_tax if is_sale else 0
            else:
                debit_amount = invoice.total_tax if is_sale else 0
                credit_amount = 0 if is_sale else invoice.total_tax
            
            JournalItem.objects.create(
                entry=entry,
                account=tax_account,
                debit=debit_amount,
                credit=credit_amount,
                label="Impuesto (IVA)"
            )
        
        return entry
    
    @staticmethod
    @transaction.atomic
    def complete_workflow(workflow_id: int, payment_data: Dict = None) -> NoteWorkflow:
        """
        Stage 5: Complete workflow and apply payment adjustments
        
        Args:
            workflow_id: NoteWorkflow ID
            payment_data: Optional payment information
        
        Returns:
            Completed workflow
        """
        workflow = NoteWorkflow.objects.select_related('invoice').get(id=workflow_id)
        
        if workflow.current_stage != NoteWorkflow.Stage.REGISTRATION_PENDING:
            raise ValidationError(
                f"No se puede completar workflow en etapa {workflow.get_current_stage_display()}"
            )
        
        # If registration was deferred and not yet posted, post now
        if workflow.registration_deferred and workflow.invoice.status == Invoice.Status.DRAFT:
            from accounting.services import JournalEntryService
            JournalEntryService.post_entry(workflow.invoice.journal_entry)
            workflow.invoice.status = Invoice.Status.POSTED
            workflow.invoice.save()
        
        # Store payment data if provided
        if payment_data:
            workflow.payment_data = payment_data
        
        workflow.current_stage = NoteWorkflow.Stage.COMPLETED
        workflow.save()
        
        return workflow
    
    @staticmethod
    @transaction.atomic
    def cancel_workflow(workflow_id: int, reason: str = "") -> NoteWorkflow:
        """
        Cancel an incomplete workflow
        
        Args:
            workflow_id: NoteWorkflow ID
            reason: Cancellation reason
        
        Returns:
            Cancelled workflow
        """
        workflow = NoteWorkflow.objects.select_related('invoice').get(id=workflow_id)
        
        if workflow.current_stage == NoteWorkflow.Stage.COMPLETED:
            raise ValidationError("No se puede cancelar un workflow completado.")
        
        # Delete draft invoice if not posted
        if workflow.invoice.status == Invoice.Status.DRAFT:
            # Delete associated journal entry if exists
            if workflow.invoice.journal_entry:
                workflow.invoice.journal_entry.delete()
            
            workflow.invoice.delete()
        
        workflow.current_stage = NoteWorkflow.Stage.CANCELLED
        workflow.notes = f"{workflow.notes}\nCANCELADO: {reason}" if workflow.notes else f"CANCELADO: {reason}"
        workflow.save()
        
        return workflow
