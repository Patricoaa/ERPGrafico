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
        Stage 3: Process logistics (stock movements)
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
        
        # Save logistics data
        workflow.logistics_data = {
            'warehouse_id': warehouse_id,
            'warehouse_name': warehouse.name,
            'date': str(date),
            'delivery_type': delivery_type,
            'notes': notes,
            'line_data': line_data
        }
        
        # If scheduled, we don't create stock moves now
        if delivery_type == 'SCHEDULED':
            workflow.current_stage = NoteWorkflow.Stage.LOGISTICS_COMPLETED
            workflow.save()
            return workflow
            
        is_sale = workflow.sale_order is not None
        from inventory.models import StockMove, UoM
        
        # Determine items to process
        items_to_move = []
        if delivery_type == 'PARTIAL' and line_data:
            for ld in line_data:
                line_id = ld.get('line_id')
                quantity = Decimal(str(ld.get('quantity', 0)))
                
                if quantity <= 0:
                    continue
                
                # Find matching item in selected_items
                item = next((i for i in workflow.selected_items if i['line_id'] == line_id), None)
                if item and item.get('creates_stock_move', False):
                    items_to_move.append({
                        'product_id': item['product_id'],
                        'quantity': quantity,
                        'uom_id': ld.get('uom_id')
                    })
        else:
            # IMMEDIATE (Full)
            for item in workflow.selected_items:
                if item.get('creates_stock_move', False):
                    items_to_move.append({
                        'product_id': item['product_id'],
                        'quantity': Decimal(str(item['quantity'])),
                        'uom_id': None
                    })

        # Create stock movements
        for move_item in items_to_move:
            product = Product.objects.get(id=move_item['product_id'])
            quantity = move_item['quantity']
            uom_id = move_item.get('uom_id')
            
            # Determine move type correctly based on context
            if is_sale:
                # Sales: Credit Note (Return) -> IN; Debit Note (Extra) -> OUT
                move_type = StockMove.Type.IN if workflow.is_credit_note else StockMove.Type.OUT
            else:
                # Purchases: Credit Note (Return) -> OUT; Debit Note (Extra) -> IN
                move_type = StockMove.Type.OUT if workflow.is_credit_note else StockMove.Type.IN
            
            # Apply sign correctly (Pos for Add/IN, Neg for Remove/OUT)
            signed_qty = quantity if move_type == StockMove.Type.IN else -quantity
            
            uom = UoM.objects.filter(id=uom_id).first() if uom_id else product.uom

            print(f"DEBUG: NoteProcessLogistics - Workflow {workflow.id}, Product {product.internal_code}, Move {move_type}, Qty {signed_qty}")

            StockMove.objects.create(
                date=date,
                product=product,
                warehouse=warehouse,
                uom=uom,
                quantity=signed_qty,
                move_type=move_type,
                description=f"{workflow.invoice.get_dte_type_display()} - {workflow.invoice.display_id} (REF: WORKFLOW-{workflow.id})"
            )
        
        # Advance workflow
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
    def _create_accounting_entry(workflow: NoteWorkflow, settings: AccountingSettings) -> JournalEntry:
        """
        Create journal entry for the note
        
        Business rules:
        - Services/Consumables: Reverse to income/expense accounts
        - Stockables: Reverse to inventory account AND reverse COGS
        - Manufacturables (with BOM): Reverse to inventory AND reverse COGS
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
            
            # 1. Main Net Amount Line (Revenue/Expense reversal)
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

            # 2. STOCK VALUATION REVERSAL (Only for sales of stockable items)
            # If Customer NC (Return): Debit Inventory, Credit COGS (at current cost)
            if is_sale and workflow.is_credit_note and item.get('creates_stock_move'):
                # Valuation amount = qty * current_cost
                valuation_amount = (Decimal(str(item['quantity'])) * product.cost_price).quantize(Decimal('1'))
                
                if valuation_amount > 0:
                    inv_account = settings.storable_inventory_account or settings.default_inventory_account
                    cogs_account = settings.merchandise_cogs_account or settings.default_expense_account
                    
                    if product.product_type == Product.Type.MANUFACTURABLE:
                        inv_account = settings.manufacturable_inventory_account or inv_account
                        cogs_account = settings.manufactured_cogs_account or cogs_account

                    if inv_account and cogs_account:
                        # Entry: Inventory (Debit) and COGS (Credit)
                        JournalItem.objects.create(
                            entry=entry,
                            account=inv_account,
                            debit=valuation_amount,
                            credit=0,
                            label=f"Devolución Stock: {product.name}"
                        )
                        JournalItem.objects.create(
                            entry=entry,
                            account=cogs_account,
                            debit=0,
                            credit=valuation_amount,
                            label=f"Reverso Costo Venta: {product.name}"
                        )
        
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
                'creates_stock_move': creates_stock_move,
                'reason': item.get('reason', '')
            })

        workflow.selected_items = validated_items
        workflow.requires_logistics = has_stockable
        
        # Update Invoice Totals
        invoice.total_net = total_net
        invoice.total_tax = total_tax
        invoice.total = total_net + total_tax
        invoice.save()

        # 5. Process Logistics (Stock Moves)
        # Only if required AND data provided
        if has_stockable and logistics_data:
            warehouse_id = logistics_data.get('warehouse_id')
            move_date = logistics_data.get('date') or timezone.now().date()
            warehouse = Warehouse.objects.get(id=warehouse_id)
            is_sale = workflow.sale_order is not None
            
            for item in validated_items:
                if not item['creates_stock_move']: continue
                
                product = Product.objects.get(id=item['product_id'])
                quantity = Decimal(str(item['quantity']))
                
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
        entry = NoteCheckoutService._create_accounting_entry(workflow, AccountingSettings.objects.first())
        
        if not val_is_pending:
            from accounting.services import JournalEntryService
            JournalEntryService.post_entry(entry)
        
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
