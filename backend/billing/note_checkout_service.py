from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from typing import List, Dict, Optional

from billing.models import Invoice
from billing.note_workflow import NoteWorkflow
from accounting.models import JournalEntry, JournalItem, AccountingSettings, AccountType
from inventory.models import StockMove, Product, Warehouse, UoM
from core.services import SequenceService
from sales.return_services import ReturnService as SalesReturnService
from purchasing.return_services import PurchaseReturnService
from sales.services import SalesService
from purchasing.services import PurchasingService

class NoteCheckoutService:
    """
    Service for handling multi-stage checkout of Credit/Debit Notes.
    Replaces atomic create_note with a staged workflow similar to SalesCheckoutWizard.
    """

    @staticmethod
    @transaction.atomic
    def process_logistics_from_invoice(
        invoice_id: int,
        warehouse_id: int,
        date: str,
        line_data: list,
        notes: str = ""
    ):
        """
        Processes logistics for a POSTED Credit/Debit Note.
        Used by the HUB to handle partial returns/deliveries after initial Note creation.
        """
        invoice = Invoice.objects.get(id=invoice_id)
        is_sale = invoice.sale_order is not None
        is_credit = invoice.dte_type == Invoice.DTEType.NOTA_CREDITO
        
        # Determine items for logistics
        items_for_logistics = []
        for ld in line_data:
            product_id = ld.get('product_id')
            quantity = Decimal(str(ld.get('quantity', 0)))
            if quantity <= 0: continue
            
            # Find item details from previous workflow if possible (to get unit_price/cost)
            # Or just fetch product
            product = Product.objects.get(id=product_id)
            items_for_logistics.append({
                'product_id': product.id,
                'quantity': quantity,
                'uom_id': ld.get('uom_id') or product.uom_id,
                'unit_cost': float(product.cost_price) # Fallback or look up original
            })

        if is_credit:
            if is_sale:
                doc = SalesReturnService.create_return_from_note_request(
                    order=invoice.sale_order,
                    items=items_for_logistics,
                    warehouse_id=warehouse_id,
                    date=date,
                    notes=notes,
                    credit_note=invoice
                )
                SalesReturnService.confirm_return(doc)
            else:
                doc = PurchaseReturnService.create_return_from_note_request(
                    order=invoice.purchase_order,
                    items=items_for_logistics,
                    warehouse_id=warehouse_id,
                    date=date,
                    notes=notes,
                    credit_note=invoice
                )
                PurchaseReturnService.confirm_return(doc)
        else:
            # Debit Note
            if is_sale:
                doc = SalesService.create_delivery_from_note(
                    order=invoice.sale_order,
                    warehouse=Warehouse.objects.get(id=warehouse_id),
                    line_data=items_for_logistics,
                    delivery_date=date,
                    notes=notes,
                    related_note=invoice
                )
            else:
                doc = PurchasingService.create_receipt_from_note(
                    order=invoice.purchase_order,
                    warehouse=Warehouse.objects.get(id=warehouse_id),
                    line_data=items_for_logistics,
                    receipt_date=date,
                    notes=notes,
                    related_note=invoice
                )
        return doc
    
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
        
        # CRITICAL VALIDATION: Only from POSTED or PAID invoices
        if corrected_invoice.status not in [Invoice.Status.POSTED, Invoice.Status.PAID]:
            raise ValidationError(
                f"Solo se pueden crear NC/ND desde facturas publicadas o pagadas. "
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
        
        if has_stockable:
            workflow.current_stage = NoteWorkflow.Stage.ITEMS_SELECTED
        else:
            workflow.current_stage = NoteWorkflow.Stage.LOGISTICS_COMPLETED
            
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
        delivery_type: str = 'IMMEDIATE',
        line_data: list = None,
        notes: str = ""
    ) -> NoteWorkflow:
        """
        Stage 3: Process logistics (stock movements via Return Documents)
        Only called if requires_logistics=True
        
        Args:
            workflow_id: NoteWorkflow ID
            warehouse_id: Warehouse for receiving/dispatching
            date: Date for stock movement
            delivery_type: Type of delivery (IMMEDIATE, SCHEDULED, PARTIAL)
            line_data: List of line quantities for partial delivery
            notes: Additional notes
        
        Returns:
            Updated workflow in LOGISTICS_COMPLETED stage
        """
        workflow = NoteWorkflow.objects.select_related('invoice').get(id=workflow_id)
        
        if workflow.current_stage != NoteWorkflow.Stage.ITEMS_SELECTED:
            raise ValidationError(
                f"No se puede procesar logística en etapa {workflow.get_current_stage_display()}"
            )
        
        if not workflow.requires_logistics:
            raise ValidationError("Este workflow no requiere procesamiento de logística.")
        
        # Save logistics data
        try:
            warehouse = Warehouse.objects.get(id=warehouse_id)
        except Warehouse.DoesNotExist:
            raise ValidationError(f"Bodega con ID {warehouse_id} no existe.")

        workflow.logistics_data = {
            'warehouse_id': warehouse_id,
            'warehouse_name': warehouse.name,
            'date': str(date),
            'delivery_type': delivery_type,
            'notes': notes,
            'line_data': line_data
        }
        
        # Determine items to process
        items_for_return = []
        if delivery_type == 'PARTIAL' and line_data:
            for ld in line_data:
                line_id = ld.get('line_id')
                quantity = Decimal(str(ld.get('quantity', 0)))
                
                if quantity <= 0:
                    continue
                
                # Find matching item in selected_items
                item = next((i for i in workflow.selected_items if i['line_id'] == line_id), None)
                if item and item.get('creates_stock_move', False):
                    items_for_return.append({
                        'product_id': item['product_id'],
                        'quantity': quantity,
                        'uom_id': ld.get('uom_id'),
                         # Pass price/cost references if available in item
                        'unit_price': item.get('unit_price', 0),
                        'unit_cost': item.get('unit_cost', 0)
                    })
        else:
            # IMMEDIATE (Full) - or SCHEDULED (plan full)
            for item in workflow.selected_items:
                if item.get('creates_stock_move', False):
                    items_for_return.append({
                        'product_id': item['product_id'],
                        'quantity': Decimal(str(item['quantity'])),
                        'uom_id': None,
                        'unit_price': item.get('unit_price', 0),
                        'unit_cost': item.get('unit_cost', 0)
                    })

        # Process via appropriate Service
        is_sale = workflow.sale_order is not None
        logistics_doc = None
        is_credit_note = workflow.is_credit_note

        if is_credit_note:
            # CREDIT NOTE -> RETURNS (Decoupled Documents)
            if is_sale:
                logistics_doc = SalesReturnService.create_return_from_note_request(
                    order=workflow.sale_order,
                    items=items_for_return,
                    warehouse_id=warehouse_id,
                    date=date,
                    notes=notes,
                    credit_note=workflow.invoice
                )
                if delivery_type == 'IMMEDIATE':
                    SalesReturnService.confirm_return(logistics_doc)
            else:
                if workflow.purchase_order:
                    logistics_doc = PurchaseReturnService.create_return_from_note_request(
                        order=workflow.purchase_order,
                        items=items_for_return,
                        warehouse_id=warehouse_id,
                        date=date,
                        notes=notes,
                        credit_note=workflow.invoice
                    )
                    if delivery_type == 'IMMEDIATE':
                        PurchaseReturnService.confirm_return(logistics_doc)
        else:
            # DEBIT NOTE -> SUPPLEMENTAL LOGISTICS (Reuse standard Delivery/Receipt)
            if is_sale:
                # Supplemental Dispatch
                logistics_doc = SalesService.create_delivery_from_note(
                    order=workflow.sale_order,
                    warehouse=warehouse,
                    line_data=items_for_return, # Note: ReturnService format is same as create_delivery_from_note format
                    delivery_date=date,
                    notes=f"Nota Débito: {notes or ''}",
                    related_note=workflow.invoice
                )
            else:
                # Supplemental Reception
                if workflow.purchase_order:
                    logistics_doc = PurchasingService.create_receipt_from_note(
                        order=workflow.purchase_order,
                        warehouse=warehouse,
                        line_data=items_for_return,
                        receipt_date=date,
                        notes=f"Nota Débito: {notes or ''}",
                        related_note=workflow.invoice
                    )

        # Advance workflow logic
        workflow.current_stage = NoteWorkflow.Stage.LOGISTICS_COMPLETED
        if logistics_doc:
             doc_type_label = "Devolución" if is_credit_note else ("Despacho" if is_sale else "Recepción")
             workflow.notes = f"{workflow.notes or ''}\nGenerado Documento {doc_type_label}: {logistics_doc.display_id}"
             
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
            is_pending: If True, create as DRAFT and don't post entry
        
        Returns:
            Updated workflow in REGISTRATION_PENDING stage
        """
        workflow = NoteWorkflow.objects.select_related(
            'invoice', 'corrected_invoice', 'sale_order', 'purchase_order'
        ).get(id=workflow_id)
        
        # Robustness: Allow if in ITEMS_SELECTED but doesn't require logistics
        if workflow.current_stage == NoteWorkflow.Stage.ITEMS_SELECTED and not workflow.requires_logistics:
            workflow.current_stage = NoteWorkflow.Stage.LOGISTICS_COMPLETED
            workflow.save()

        if workflow.current_stage != NoteWorkflow.Stage.LOGISTICS_COMPLETED:
            raise ValidationError(
                f"No se puede registrar documento en etapa {workflow.get_current_stage_display()}"
            )
        
        settings = AccountingSettings.objects.first()
        if not settings:
            raise ValidationError("Debe configurar la contabilidad primero.")
        
        # Mandatory attachment for NC if not pending
        if workflow.is_credit_note and not is_pending and not document_attachment:
            raise ValidationError("El archivo PDF/XML es obligatorio para emitir la nota de crédito.")

        # Update invoice
        workflow.invoice.number = document_number
        workflow.invoice.date = document_date or timezone.now().date()
        if document_attachment:
            workflow.invoice.document_attachment = document_attachment
        
        if is_pending:
            workflow.invoice.status = Invoice.Status.DRAFT
        else:
            workflow.invoice.status = Invoice.Status.POSTED
            
        workflow.invoice.save()
        
        # Create accounting entry
        entry = NoteCheckoutService._create_accounting_entry(workflow, settings)
        
        if not is_pending:
            # Post entry immediately
            from accounting.services import JournalEntryService
            JournalEntryService.post_entry(entry)
        
        # Update workflow
        workflow.registration_data = {
            'document_number': document_number,
            'date': str(workflow.invoice.date),
            'is_pending': is_pending
        }
        workflow.registration_deferred = is_pending
        workflow.current_stage = NoteWorkflow.Stage.PAYMENT_PENDING # Move straight to payment
        workflow.save()
        
        return workflow
    
    @staticmethod
    def _create_accounting_entry(workflow: NoteWorkflow, settings: AccountingSettings, moved_quantities: Dict[int, Decimal] = None) -> JournalEntry:
        """
        Create journal entry for the note
        
        Args:
            moved_quantities: Optional map of product_id -> quantity actually moved.
                            If None, assumes full quantity (backend backward compatibility).
                            If provided, COGS reversal uses this quantity.
        """
        invoice = workflow.invoice
        is_sale = workflow.sale_order is not None
        
        # ... [rest of method] ...

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
        contact = workflow.corrected_invoice.contact
        if is_sale:
            partner_account = (
                contact.account_receivable if contact else None
            ) or settings.default_receivable_account
        else:
            partner_account = (
                contact.account_payable if contact else None
            ) or settings.default_payable_account
        
        if not partner_account:
            partner_type = "por cobrar" if is_sale else "por pagar"
            raise ValidationError(f"No se encontró cuenta {partner_type} por defecto en la configuración contable o en el contacto.")
        
        # Create receivable/payable entry
        total_amount = invoice.total
        
        if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
            # Credit Note: Reduces debt
            # Sale NC -> Credit Receivable; Purchase NC -> Debit Payable
            debit_amount = 0 if is_sale else total_amount
            credit_amount = total_amount if is_sale else 0
        else:
            # Debit Note: Increases debt
            # Sale ND -> Debit Receivable; Purchase ND -> Credit Payable
            debit_amount = total_amount if is_sale else 0
            credit_amount = 0 if is_sale else total_amount
        
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
            
            # 1. Main Net Amount Line (Revenue/Expense reversal) - ALWAYS FULL IVOICE AMOUNT
            if product.product_type == Product.Type.SERVICE:
                product_account = product.income_account or settings.default_service_revenue_account or settings.default_revenue_account
            elif product.product_type == Product.Type.CONSUMABLE:
                product_account = product.expense_account or settings.default_consumable_account or settings.default_expense_account
            elif product.track_inventory:
                # For sales, reverse revenue. For purchases, reverse stock bridge/inventory.
                # Here we handle the REVENUE/EXPENSE side first.
                if is_sale:
                    product_account = product.income_account or settings.default_revenue_account
                else:
                    # Purchase return: Credit the "Inventory bridge" (liability) or Expense
                    product_account = settings.stock_input_account or settings.default_expense_account
            else:
                product_account = settings.default_expense_account
            
            if not product_account:
                account_req = "Ingresos" if is_sale else "Gastos"
                raise ValidationError(f"No se encontró cuenta de {account_req} para '{product.name}'.")
            
            if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
                debit_amount = line_net if is_sale else 0
                credit_amount = 0 if is_sale else line_net
            else:
                debit_amount = 0 if is_sale else line_net
                credit_amount = line_net if is_sale else 0
            
            JournalItem.objects.create(
                entry=entry,
                account=product_account,
                debit=debit_amount,
                credit=credit_amount,
                label=f"{product.name} - {item['reason']}" if item.get('reason') else product.name
            )
            
            # 2. COGS Reversal: REMOVED
            # Responsability moved to Logistics Documents (Returns/deliveries)
            # The Note only handles Revenue/Expense Reversal + AR/AP + Tax.
            pass
        
        # Tax entry
        if invoice.total_tax > 0:
            tax_account = settings.default_tax_payable_account if is_sale else settings.default_tax_receivable_account
            
            if not tax_account:
                tax_type = "IVA Débito" if is_sale else "IVA Crédito"
                raise ValidationError(f"No se encontró cuenta de {tax_type} por defecto en la configuración contable.")
            
            if invoice.dte_type == Invoice.DTEType.NOTA_CREDITO:
                debit_amount = invoice.total_tax if is_sale else 0
                credit_amount = 0 if is_sale else invoice.total_tax
            else:
                debit_amount = 0 if is_sale else invoice.total_tax
                credit_amount = invoice.total_tax if is_sale else 0
            
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
    def process_payment(workflow_id: int, payment_data: Dict) -> NoteWorkflow:
        """
        Stage 5: Process payment/refund
        
        Args:
            workflow_id: NoteWorkflow ID
            payment_data: Dict with:
                - method: 'CASH', 'CARD', 'TRANSFER', 'CREDIT'
                - amount: Decimal or str
                - treasury_account_id: int (optional)
                - transaction_number: str (optional)
                - is_pending: bool
        """
        workflow = NoteWorkflow.objects.get(id=workflow_id)
        if workflow.current_stage != NoteWorkflow.Stage.PAYMENT_PENDING:
             raise ValidationError(f"No se puede procesar pago en etapa {workflow.get_current_stage_display()}")

        # 1. Register payment logic via TreasuryService
        from treasury.services import TreasuryService
        
        method = payment_data.get('method')
        amount = Decimal(str(payment_data.get('amount', 0)))
        is_sale = workflow.sale_order is not None
        
        if method != 'CREDIT' and amount > 0:
            # For Credit Note on Sale -> OUTBOUND (Refund)
            # For Debit Note on Sale -> INBOUND (Payment)
            # For Credit Note on Purchase -> INBOUND (Refund from supplier)
            # For Debit Note on Purchase -> OUTBOUND (Payment to supplier)
            
            if is_sale:
                p_type = 'OUTBOUND' if workflow.is_credit_note else 'INBOUND'
                partner = workflow.sale_order.customer
            else:
                p_type = 'INBOUND' if workflow.is_credit_note else 'OUTBOUND'
                partner = workflow.purchase_order.supplier

            TreasuryService.register_payment(
                amount=amount,
                payment_type=p_type,
                payment_method=method,
                reference=f"{workflow.invoice.dte_type[:3]}-{workflow.invoice.number}",
                partner=partner,
                invoice=workflow.invoice,
                treasury_account_id=payment_data.get('treasury_account_id'),
                transaction_number=payment_data.get('transaction_number'),
                is_pending_registration=payment_data.get('is_pending', False)
            )

        workflow.payment_data = payment_data
        workflow.current_stage = NoteWorkflow.Stage.COMPLETED
        workflow.save()
        return workflow

    @staticmethod
    @transaction.atomic
    def complete_workflow(workflow_id: int, payment_data: Dict = None) -> NoteWorkflow:
        """
        Final verification and completion.
        If payment_data is provided, it calls process_payment first.
        """
        workflow = NoteWorkflow.objects.get(id=workflow_id)
        
        if payment_data:
            return NoteCheckoutService.process_payment(workflow_id, payment_data)

        if workflow.current_stage == NoteWorkflow.Stage.PAYMENT_PENDING:
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

    @staticmethod
    @transaction.atomic
    def process_full_checkout(
        original_invoice_id: int,
        note_type: str,
        selected_items: List[Dict],
        registration_data: Dict,
        logistics_data: Optional[Dict] = None,
        payment_data: Optional[Dict] = None,
        reason: str = "",
        document_attachment=None,
        created_by=None
    ) -> NoteWorkflow:
        """
        ATOMIC CHECKOUT: Handle strict transaction for Note creation.
        Replaces the staged workflow with a single commit-at-end process.
        """
        # 1. Validate Original Invoice
        try:
            corrected_invoice = Invoice.objects.get(id=original_invoice_id)
        except Invoice.DoesNotExist:
            raise ValidationError(f"Factura con ID {original_invoice_id} no existe.")
        
        if corrected_invoice.status not in [Invoice.Status.POSTED, Invoice.Status.PAID]:
            raise ValidationError("Solo se pueden crear notas desde facturas Publicadas o Pagadas.")

        # 2. Initialize Invoice (Draft)
        invoice = Invoice.objects.create(
            dte_type=note_type,
            status=Invoice.Status.DRAFT,
            date=registration_data.get('document_date') or timezone.now().date(),
            sale_order=corrected_invoice.sale_order,
            purchase_order=corrected_invoice.purchase_order,
            contact=corrected_invoice.contact,
            corrected_invoice=corrected_invoice,
            payment_method=corrected_invoice.payment_method
        )

        # 3. Create Transient Workflow (for tracking and passing context to existing methods)
        workflow = NoteWorkflow.objects.create(
            invoice=invoice,
            corrected_invoice=corrected_invoice,
            sale_order=corrected_invoice.sale_order,
            purchase_order=corrected_invoice.purchase_order,
            current_stage=NoteWorkflow.Stage.ITEMS_SELECTED, # Temp stage
            reason=reason,
            created_by=created_by,
            selected_items=selected_items, # Save intent
            logistics_data=logistics_data,
            registration_data=registration_data,
            payment_data=payment_data
        )

        # 4. Process Items (Calculate Totals & Validation)
        # Reuse logic from select_items but without extra DB saves
        total_net = Decimal('0')
        total_tax = Decimal('0')
        has_stockable = False
        
        validated_items = []
        for item in selected_items:
            product = Product.objects.get(id=item['product_id'])
            quantity = Decimal(str(item['quantity']))
            
            if quantity <= 0: continue
            
            # Validation against delivered
            if workflow.is_credit_note and workflow.sale_order:
                sale_line = workflow.sale_order.lines.filter(product=product).first()
                if sale_line and quantity > sale_line.quantity_delivered:
                     raise ValidationError(f"Cantidad excede lo entregado para {product.name}")

            # Determine stockable
            creates_stock_move = False
            if product.track_inventory:
                 if product.product_type == Product.Type.MANUFACTURABLE:
                     if not product.requires_advanced_manufacturing and product.has_bom:
                         creates_stock_move = True
                 else:
                     creates_stock_move = True
            
            if creates_stock_move: has_stockable = True

            # Calculate Line Totals
            unit_price = Decimal(str(item.get('unit_price', 0)))
            # If price not provided, could fallback to invoice price, but frontend should send it.
            
            tax_amount = Decimal(str(item.get('tax_amount', 0)))
            line_net = quantity * unit_price
            line_tax = quantity * tax_amount
            
            total_net += line_net
            total_tax += line_tax
            
            validated_items.append({
                'product_id': product.id,
                'product_name': product.name,
                'quantity': float(quantity),
                'unit_price': float(unit_price),
                'tax_amount': float(tax_amount),
                'line_net': float(line_net),
                'line_tax': float(line_tax),
                'creates_stock_move': creates_stock_move,
                'reason': item.get('reason', ''),
                'line_id': item.get('line_id')
            })

        workflow.selected_items = validated_items
        workflow.requires_logistics = has_stockable
        
        # Update Invoice Totals
        invoice.total_net = total_net
        invoice.total_tax = total_tax
        invoice.total = total_net + total_tax
        invoice.save()

        # Update Sale Line quantities (Revert Delivered Qty if Credit Note)
        if workflow.is_credit_note and workflow.sale_order:
             for item in validated_items:
                 product_id = item['product_id']
                 qty = Decimal(str(item['quantity']))
                 sale_line = workflow.sale_order.lines.filter(product_id=product_id).first()
                 if sale_line:
                     sale_line.quantity_delivered -= qty
                     if sale_line.quantity_delivered < 0: sale_line.quantity_delivered = 0
                     sale_line.save()
                     print(f"DEBUG: Workflow - Reverted delivered qty for product {product_id} to {sale_line.quantity_delivered}")

        # 5. Process Logistics (Stock Moves)
        # Parse logistics data to determine what actually moves
        moved_quantities = {} # map product_id -> quantity
        
        if has_stockable and logistics_data:
            warehouse_id = logistics_data.get('warehouse_id')
            move_date = logistics_data.get('date') or timezone.now().date()
            delivery_type = logistics_data.get('delivery_type', 'IMMEDIATE')
            warehouse = Warehouse.objects.get(id=warehouse_id)
            is_sale = workflow.sale_order is not None
            
            # Determine quantities to move
            items_to_move = []
            
            if delivery_type == 'PARTIAL':
                # Use provided line_data
                line_data = logistics_data.get('line_data', [])
                for ld in line_data:
                    line_id = ld.get('line_id') # Corresponds to item['line_id'] in selected_items
                    # ...
                
                # Re-iterate selected items to match with line_data
                for item in selected_items:
                    # We need a way to link line_data back to selected_items.
                    # Frontend usually sends line_id.
                    l_id = item.get('line_id')
                    
                    # Find matching data
                    match = next((l for l in line_data if l.get('line_id') == l_id), None)
                    if match:
                        qty_to_move = Decimal(str(match.get('quantity', 0)))
                        if qty_to_move > 0:
                            items_to_move.append({
                                'product_id': item['product_id'],
                                'quantity': qty_to_move,
                                'makes_move': item.get('creates_stock_move', False) # We need to re-verify if valid stockable
                            })
            
            elif delivery_type == 'SCHEDULED':
                # No movements now
                pass
                
            else:
                # IMMEDIATE: Move full quantity
                for item in validated_items:
                    items_to_move.append({
                        'product_id': item['product_id'],
                        'quantity': Decimal(str(item['quantity'])),
                        'makes_move': item['creates_stock_move']
                    })

            # Create Stock Moves
            for move_item in items_to_move:
                # Re-verify stockable (in case logic above was loose)
                # We can check the validated_items list to be sure
                val_item = next((i for i in validated_items if i['product_id'] == move_item['product_id']), None)
                if not val_item or not val_item['creates_stock_move']:
                    continue

                product = Product.objects.get(id=move_item['product_id'])
                quantity = move_item['quantity']
                
                # Store for Accounting usage
                # Aggregate if multiple lines for same product (rare but possible)
                moved_quantities[product.id] = moved_quantities.get(product.id, Decimal(0)) + quantity
                
                # Logic: Sale NC (Return) -> IN. Sale ND -> OUT.
                # Logic: Purchase NC (Return) -> OUT. Purchase ND -> IN.
                if is_sale:
                    move_type = StockMove.Type.IN if workflow.is_credit_note else StockMove.Type.OUT
                else:
                    move_type = StockMove.Type.OUT if workflow.is_credit_note else StockMove.Type.IN
                
                signed_qty = quantity if move_type == StockMove.Type.IN else -quantity
                
                StockMove.objects.create(
                    date=move_date,
                    product=product,
                    warehouse=warehouse,
                    uom=product.uom,
                    quantity=signed_qty,
                    move_type=move_type,
                    description=f"{invoice.get_dte_type_display()} {registration_data.get('document_number')} (REF: WF-{workflow.id})"
                )

        # 6. document Registration (DTE & Accounting)
        doc_number = registration_data.get('document_number')
        doc_date = registration_data.get('document_date')
        val_is_pending = registration_data.get('is_pending', False)
        
        invoice.number = doc_number
        invoice.date = doc_date
        if document_attachment:
            invoice.document_attachment = document_attachment
        
        invoice.status = Invoice.Status.DRAFT if val_is_pending else Invoice.Status.POSTED
        invoice.save()
        
        # Create Accounting Entry
        # Pass moved_quantities so COGS is reversed only for what moved
        entry = NoteCheckoutService._create_accounting_entry(workflow, AccountingSettings.objects.first(), moved_quantities=moved_quantities)
        
        if not val_is_pending:
            from accounting.services import JournalEntryService
            JournalEntryService.post_entry(entry)
            
        # 6.5 Link created stock moves to the accounting entry for Hub visibility
        # If immediate/partial return was selected, we search for the moves created in step 5
        StockMove.objects.filter(description__contains=f"(REF: WF-{workflow.id})").update(journal_entry=entry)
        
        # 7. Process Payment
        if payment_data:
            workflow.current_stage = NoteWorkflow.Stage.PAYMENT_PENDING
            workflow.save()
            NoteCheckoutService.process_payment(workflow.id, payment_data)
        
        # Reload workflow in case it was modified by process_payment
        workflow.refresh_from_db()
        workflow.current_stage = NoteWorkflow.Stage.COMPLETED
        workflow.save()
        
        return workflow
