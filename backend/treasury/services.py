import logging

from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from datetime import datetime
from dateutil.relativedelta import relativedelta
from decimal import Decimal, ROUND_HALF_UP
from django.utils.translation import gettext as _
from .models import TreasuryMovement, TreasuryAccount, TerminalBatch, PaymentMethod, CreditLine
from .check_service import CheckService
from accounting.models import JournalEntry, JournalItem, AccountingSettings
from accounting.services import JournalEntryService

logger = logging.getLogger(__name__)

class TreasuryService:
    @staticmethod
    @transaction.atomic
    def create_movement(amount, movement_type, payment_method=TreasuryMovement.Method.CASH,
                        date=None, created_by=None,
                        from_account=None, to_account=None,
                        partner=None, invoice=None, sale_order=None, purchase_order=None,
                        payroll=None, payroll_payment_type=None,
                        pos_session=None, pos_session_id=None, reference='', notes='', justify_reason=None,
                        transaction_number=None, is_pending_registration=False,
                        payment_method_new=None, is_reconciled=False):
        """
        Unified method to create a TreasuryMovement.
        Handles:
        1. Validation (Funds, Accounts)
        2. Creation of TreasuryMovement record
        3. Accounting Journal Entry creation (in real-time)
        4. Updating Business Documents (Invoices, Orders)
        5. Updating POS Session totals
        """
        if amount is not None:
            amount = Decimal(str(amount))
            
        if amount <= 0:
            raise ValidationError("El monto debe ser mayor a cero.")
        
        if not date:
            date = timezone.now().date()

        # 1. Account Logic Resolution
        # Ensure we have valid accounts for the movement type (except for CREDIT_BALANCE)
        if not from_account and not to_account and payment_method != TreasuryMovement.Method.CREDIT_BALANCE:
             raise ValidationError("Debe especificar al menos una cuenta de tesorería (Origen o Destino).")

        # Validation: Insufficient Funds for Outbound from Cash
        if from_account and from_account.account_type == TreasuryAccount.Type.CASH:
             # Refresh balance check
             if amount > from_account.current_balance:
                 # We allow it but with a warning? strict? 
                 # Current logic was strict for transfers.
                 if movement_type in [TreasuryMovement.Type.TRANSFER, TreasuryMovement.Type.OUTBOUND]:
                      pass # Keeping strict logic might block business. Let's rely on frontend warning, or strict.
                      # raise ValidationError(f"Fondos insuficientes en {from_account.name}.")

        # ── Auto-draw desde línea de crédito (CHECKING accounts) ─────────
        credit_line_draw_amount = Decimal('0')
        credit_line = None
        if (from_account
            and from_account.account_type == TreasuryAccount.Type.CHECKING
            and movement_type in (TreasuryMovement.Type.OUTBOUND, TreasuryMovement.Type.TRANSFER)
            and amount > from_account.current_balance):
            try:
                cl = from_account.credit_line
                if cl and cl.status == CreditLine.Status.ACTIVE:
                    excess = amount - from_account.current_balance
                    if excess > cl.available_amount:
                        raise ValidationError(_(
                            "El pago de $%(amount)s excede la liquidez disponible "
                            "(saldo $%(balance)s + cupo línea $%(available)s). "
                            "Cubra el excedente o solicite un aumento de línea."
                        ) % {
                            'amount': amount,
                            'balance': from_account.current_balance,
                            'available': cl.available_amount,
                        })
                    credit_line_draw_amount = excess
                    credit_line = cl
            except CreditLine.DoesNotExist:
                pass

        # 1.5 Resolve POS Session
        if not pos_session and pos_session_id:
            from .models import POSSession
            pos_session = POSSession.objects.filter(id=pos_session_id).first()


        # 1.6 Resolve Terminal Fields from Payment Method
        terminal_device = None
        terminal_provider = None
        if payment_method_new and payment_method_new.method_type == PaymentMethod.Type.CARD_TERMINAL:
             terminal_device = payment_method_new.linked_terminal_device
             if terminal_device:
                 terminal_provider = terminal_device.provider

        # 2. Create TreasuryMovement
        movement = TreasuryMovement.objects.create(
            terminal_device=terminal_device,
            terminal_provider=terminal_provider,
            movement_type=movement_type,
            payment_method=payment_method,
            payment_method_new=payment_method_new,
            amount=amount,
            date=date,
            created_by=created_by,
            from_account=from_account,
            to_account=to_account,
            contact=partner,
            invoice=invoice,
            sale_order=sale_order,
            purchase_order=purchase_order,
            payroll=payroll,
            payroll_payment_type=payroll_payment_type,
            reference=reference or '',
            notes=notes or '',
            justify_reason=justify_reason,
            pos_session=pos_session,
            transaction_number=transaction_number,
            is_pending_registration=is_pending_registration,
            is_reconciled=is_reconciled
        )

        # 3. Handle Business Documents (Status Updates)
        TreasuryService.update_related_document_status(movement, invoice, sale_order, purchase_order, payroll)

        # 4. Handle POS Session Totals
        if pos_session:
            TreasuryService._update_pos_session(movement, pos_session)


        # 5. Generate Accounting Entry
        if not is_pending_registration:
            TreasuryService._create_accounting_entry(movement)

        # 6. Create PartnerTransaction if applicable
        if movement.justify_reason in [TreasuryMovement.JustifyReason.CAPITAL_CONTRIBUTION, TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL] and movement.contact and movement.contact.is_partner:
            from contacts.partner_models import PartnerTransaction
            partner = movement.contact
            
            # Smart Type Selection
            if movement.movement_type == TreasuryMovement.Type.INBOUND:
                # If it's an inbound contribution, check if it's paying a pending capital subscription
                if partner.partner_pending_capital > 0:
                    target_tx_type = PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH # Generic but correct
                else:
                    target_tx_type = PartnerTransaction.Type.CAPITAL_CONTRIBUTION_CASH
            else:
                # Withdrawal side: Smart Type Selection
                if partner.partner_dividends_payable_balance > 0:
                    target_tx_type = PartnerTransaction.Type.DIVIDEND_PAYMENT
                else:
                    target_tx_type = PartnerTransaction.Type.PROVISIONAL_WITHDRAWAL

            PartnerTransaction.objects.get_or_create(
                treasury_movement=movement,
                defaults={
                    'partner': movement.contact,
                    'transaction_type': target_tx_type,
                    'amount': movement.amount,
                    'date': movement.date,
                    'description': movement.notes or f"{movement.get_justify_reason_display()}",
                    'journal_entry': movement.journal_entry,
                    'created_by': created_by
                }
            )
        
        # 7. Create CREDIT_LINE_DRAW movement if excess was financed
        if credit_line_draw_amount > 0 and credit_line:
            TreasuryMovement.objects.create(
                movement_type=TreasuryMovement.Type.CREDIT_LINE_DRAW,
                payment_method=TreasuryMovement.Method.TRANSFER,
                amount=credit_line_draw_amount,
                date=date,
                created_by=created_by,
                from_account=from_account,
                credit_line=credit_line,
                reference=reference or '',
                notes=_("Cubierto por línea de crédito (pago #%(id)s).") % {'id': movement.id},
                is_pending_registration=True,
            )
        
        return movement


    @staticmethod
    def update_related_document_status(movement, invoice=None, sale_order=None, purchase_order=None, payroll=None):
        # Logic to update status to PAID
        targets = []
        if invoice: targets.append(invoice)
        if sale_order and not invoice: targets.append(sale_order)
        if purchase_order: targets.append(purchase_order)
        if payroll: targets.append(payroll)
        
        # If arguments are missing, try to resolve from movement's GFK allocated_to.
        # Use _meta.model_name (stable string) instead of isinstance to avoid coupling.
        allocated = getattr(movement, 'allocated_to', None)
        if allocated is not None:
            model_name = allocated._meta.model_name
            if not invoice and model_name == 'invoice':
                targets.append(allocated)
            elif not sale_order and model_name == 'saleorder':
                targets.append(allocated)
            elif not purchase_order and model_name == 'purchaseorder':
                targets.append(allocated)
            elif not payroll and model_name == 'payroll':
                targets.append(allocated)

        targets = list(set(targets)) # unique

        for target in targets:
             # Recalculate total paid
             model_to_field = {
                 'invoice': 'invoice',
                 'saleorder': 'sale_order',
                 'purchaseorder': 'purchase_order'
             }
             field_name = model_to_field.get(target._meta.model_name, target._meta.model_name)
             
             # Get all related payments
             related_payments = TreasuryMovement.objects.filter(**{field_name: target})
             total_paid = sum(m.amount for m in related_payments)
             
             target_total = getattr(target, 'total', 0)
             if hasattr(target, 'effective_total'): target_total = target.effective_total

             # Check if fully paid
             if total_paid >= target_total:
                 status_field = 'status'
                 if hasattr(target, 'Status') and hasattr(target.Status, 'PAID'):
                     setattr(target, status_field, target.Status.PAID)
                     target.save()

                 # Sync HUB Tasks
                 from workflow.services import WorkflowService
                 if target._meta.model_name in ['saleorder', 'purchaseorder']:
                     WorkflowService.sync_hub_tasks(target)
                 elif target._meta.model_name == 'invoice':
                     if hasattr(target, 'sale_order') and target.sale_order:
                         WorkflowService.sync_hub_tasks(target.sale_order)
                     if hasattr(target, 'purchase_order') and target.purchase_order:
                         WorkflowService.sync_hub_tasks(target.purchase_order)

    @staticmethod
    def _update_pos_session(movement, pos_session):
        # Update session totals based on payment method and type
        if pos_session.status != 'OPEN': return
        
        amount = movement.amount
        allocated = getattr(movement, 'allocated_to', None)
        is_sale = allocated is not None and allocated.is_sale_document()

        if movement.movement_type == TreasuryMovement.Type.INBOUND:
            if is_sale:
                if movement.payment_method in (
                    TreasuryMovement.Method.CARD,
                    TreasuryMovement.Method.DEBIT_CARD,
                    TreasuryMovement.Method.CREDIT_CARD,
                    TreasuryMovement.Method.CARD_TERMINAL,
                ):
                    pos_session.total_card_sales += amount
                elif movement.payment_method == TreasuryMovement.Method.CASH:
                    pos_session.total_cash_sales += amount
                elif movement.payment_method == TreasuryMovement.Method.CHECK:
                    pos_session.total_check_sales += amount
                elif movement.payment_method == TreasuryMovement.Method.TRANSFER:
                    pos_session.total_transfer_sales += amount
                elif movement.payment_method == TreasuryMovement.Method.CREDIT:
                    pos_session.total_credit_sales += amount
                else:
                    pos_session.total_other_cash_inflow += amount
            else:
                pos_session.total_other_cash_inflow += amount

        elif movement.movement_type == TreasuryMovement.Type.OUTBOUND:
            if not is_sale:
                pos_session.total_other_cash_outflow += amount
        
        elif movement.movement_type == TreasuryMovement.Type.TRANSFER:
            session_treasury_id = pos_session.treasury_account_id or (pos_session.terminal.default_treasury_account_id if pos_session.terminal else None)
            if session_treasury_id:
                if movement.to_account_id == session_treasury_id:
                    pos_session.total_other_cash_inflow += amount
                elif movement.from_account_id == session_treasury_id:
                    pos_session.total_other_cash_outflow += amount

        pos_session.save()

    @staticmethod
    def _create_accounting_entry(movement):
        settings = AccountingSettings.get_solo()
        if not settings: return
        
        date = movement.date
        description = f"{movement.get_movement_type_display()} - {movement.reference or movement.notes or 'Sin Ref'}"
        entry = JournalEntry.objects.create(
             date=date,
             description=description,
             reference=f"MOV-{movement.id}",
             status=JournalEntry.State.DRAFT,
             source_content_type=ContentType.objects.get_for_model(TreasuryMovement),
             source_object_id=movement.id,
        )

        from_acc = movement.from_account.account if movement.from_account else None
        to_acc = movement.to_account.account if movement.to_account else None
        
        # Override for Credit Balance (Virtual Pool Account)
        if movement.payment_method == TreasuryMovement.Method.CREDIT_BALANCE:
            pool_acc = settings.default_advance_payment_account
            if pool_acc:
                if movement.movement_type == TreasuryMovement.Type.INBOUND:
                    to_acc = pool_acc
                elif movement.movement_type == TreasuryMovement.Type.OUTBOUND:
                    from_acc = pool_acc

        # Resolve the related business document used to pick the counterpart
        # account. The `allocated_to` GFK is only backfilled for historical
        # movements (migration 0046); movements created via create_movement
        # leave it null, which used to make the default-account fallbacks
        # below unreachable and silently drop the entry (E1). Fall back to the
        # legacy document FKs, preferring the order (unambiguous sale/purchase
        # direction) over the invoice (whose direction depends on source_order).
        allocated = getattr(movement, 'allocated_to', None)
        if allocated is None:
            allocated = (
                movement.purchase_order
                or movement.sale_order
                or movement.invoice
            )

        # 1. TRANSFER (Internal)
        if movement.movement_type == TreasuryMovement.Type.TRANSFER:
             if from_acc and to_acc:
                 JournalItem.objects.create(entry=entry, account=from_acc, debit=0, credit=movement.amount)
                 JournalItem.objects.create(entry=entry, account=to_acc, debit=movement.amount, credit=0)
        
        # 2. INBOUND (Sale / Deposit)
        elif movement.movement_type == TreasuryMovement.Type.INBOUND:
            # Debit ToAccount (Treasury or Card Provider Receivable)
            debit_acc = to_acc

            # Stage 1.2: Terminal payments must hit the provider's clearing/receivable
            # account (so Stage 2 batch settlement can credit the same account and
            # cancel the cycle cleanly). Detect by method type (stable) rather than
            # is_integrated (runtime-only). If the provider lacks receivable_account,
            # fail loudly — silently falling back to the treasury account would create
            # an asymmetric cycle that batch settlement cannot close.
            pm = movement.payment_method_new
            is_card_terminal = bool(pm and pm.method_type == PaymentMethod.Type.CARD_TERMINAL)
            if is_card_terminal:
                provider = None
                if movement.terminal_device:
                    provider = movement.terminal_device.provider
                elif pm.linked_terminal_device_id:
                    provider = pm.linked_terminal_device.provider
                if not provider or not provider.receivable_account:
                    raise ValidationError(
                        "El proveedor del terminal no tiene 'Cuenta Por Cobrar Terminal' (clearing) configurada."
                    )
                debit_acc = provider.receivable_account

            if debit_acc:
                JournalItem.objects.create(entry=entry, account=debit_acc, debit=movement.amount, credit=0)
            
            # Credit Source (Revenue / Debtor)
            source_acc = None
            if movement.justify_reason == TreasuryMovement.JustifyReason.CAPITAL_CONTRIBUTION and movement.contact and movement.contact.is_partner:
                # Smart Contribution: Priority Capital Receivable > Equity
                partner = movement.contact
                if partner.partner_pending_capital > 0:
                    source_acc = settings.partner_capital_receivable_account
                else:
                    source_acc = settings.partner_capital_contribution_account

            if not source_acc:
                if allocated is not None and allocated._meta.model_name in ('invoice', 'saleorder'):
                    # Resolve customer from the document itself, not movement.contact —
                    # they can diverge in some flows (e.g. POS guest sales) and any
                    # divergence breaks the receivable offset against Stage 1.1's invoice
                    # entry. Fall back to movement.contact only when the document has no
                    # explicit customer.
                    customer = allocated.get_customer_for_payment() or movement.contact
                    source_acc = settings.default_receivable_account
                elif movement.justify_reason:
                    # Operational Reasons (Tips, Adjustments)
                    source_acc = TreasuryService._get_reason_account(settings, movement.justify_reason, 'IN')
            
            if not source_acc:
                source_acc = settings.default_receivable_account

            if source_acc:
                JournalItem.objects.create(entry=entry, account=source_acc, debit=0, credit=movement.amount)

        # 3. OUTBOUND (Expense / Withdrawal)
        elif movement.movement_type == TreasuryMovement.Type.OUTBOUND:
             # Credit FromAccount (Treasury)
             if from_acc:
                 JournalItem.objects.create(entry=entry, account=from_acc, debit=0, credit=movement.amount)
             
             # Debit Target (Expense / Creditor)
             target_acc = None
             if movement.justify_reason == TreasuryMovement.JustifyReason.PARTNER_WITHDRAWAL and movement.contact and movement.contact.is_partner:
                  # Smart Withdrawal: Priority Dividends Payable > Provisional Withdrawal
                  partner = movement.contact
                  if partner.partner_dividends_payable_balance > 0:
                      target_acc = settings.partner_dividends_payable_account
                  else:
                      target_acc = settings.partner_provisional_withdrawal_account or settings.partner_withdrawal_account or settings.pos_partner_withdrawal_account

             if not target_acc:
                 if allocated is not None:
                      if allocated.is_sale_document():
                           target_acc = settings.default_receivable_account
                      else:
                           # Supplier Account
                           target_acc = settings.default_payable_account
                 elif movement.justify_reason:
                      target_acc = TreasuryService._get_reason_account(settings, movement.justify_reason, 'OUT')

             if not target_acc:
                 target_acc = settings.default_payable_account

             if not target_acc and movement.payroll:
                  acct_settings = AccountingSettings.get_solo()
                  if acct_settings:
                       if movement.payroll_payment_type == 'SALARY':
                            target_acc = acct_settings.account_remuneraciones_por_pagar
                       elif movement.payroll_payment_type == 'PREVIRED':
                            target_acc = acct_settings.account_previred_por_pagar
                       elif movement.payroll_payment_type == 'ADVANCE':
                            target_acc = acct_settings.account_anticipos

             if target_acc:
                  JournalItem.objects.create(entry=entry, account=target_acc, debit=movement.amount, credit=0)

        # Post if valid. The E1 fix above (allocated revival + default-account
        # fallbacks) makes the counterpart resolvable whenever it is
        # configured, so well-formed movements now produce a balanced entry
        # instead of being silently dropped. We keep the soft delete for the
        # residual <2-leg cases (e.g. ADJUSTMENT, whose entry is built
        # elsewhere) to avoid a fail-closed regression on under-configured
        # flows (check reception, cash sales). Callers that REQUIRE the entry
        # to exist — like create_card_purchase — assert it as a post-condition.
        if entry.items.count() >= 2:
             JournalEntryService.post_entry(entry)
             movement.journal_entry = entry
             movement.status = TreasuryMovement.MovementStatus.POSTED
             movement.save()
        else:
             entry.delete()

    # ── Compras en tarjeta en cuotas (Onda 2, ADR-0043) ─────────────

    @staticmethod
    @transaction.atomic
    def create_card_purchase(
        amount,
        card_account: "TreasuryAccount",
        *,
        installments: int = 1,
        monthly_rate=Decimal('0'),
        date=None,
        partner=None,
        invoice=None,
        sale_order=None,
        purchase_order=None,
        client_reference: str = '',
        notes: str = '',
        created_by=None,
    ) -> "CardPurchaseGroup":
        """
        Registra una compra con tarjeta de crédito propia en N cuotas
        (ADR-0046; supersede el modelo de N movimientos de ADR-0043).

        - `amount`: monto total de la compra.
        - `card_account`: `TreasuryAccount` con `account_type=CREDIT_CARD`.
        - `installments`: cantidad de cuotas (1 a 36).
        - `monthly_rate`: solo `0` en esta onda. `> 0` → ValidationError
          (la ruta con interés está diferida, ADR-0046 D-5).
        - `date`: fecha de compra (= primera cuota; las siguientes
          vencen un mes calendario después cada una).
        - `invoice` / `sale_order` / `purchase_order`: documentos
          vinculados (opcional, para el asiento del uso).
        - `client_reference`: id externo opcional para idempotencia.
          Un segundo POST con la misma `client_reference` retorna el
          grupo existente.
        - `notes`: notas adicionales.

        Genera **un solo** `OUTBOUND` por el total (el uso de la TC),
        posteado con el asiento estándar `D=proveedor / H=pasivo
        tarjeta` en la fecha de compra, más **N** filas de cronograma
        (`CardPurchaseInstallment`) que definen cuánto principal factura
        cada statement mensual. Las cuotas NO son movimientos ni generan
        asiento; el pago se hace a nivel statement (`pay_statement`).
        """
        from .models import CardPurchaseGroup, CardPurchaseInstallment

        amount = Decimal(str(amount))
        monthly_rate = Decimal(str(monthly_rate))

        if card_account.account_type != TreasuryAccount.Type.CREDIT_CARD:
            raise ValidationError(
                f"create_card_purchase requiere una cuenta CREDIT_CARD "
                f"(recibida: {card_account.get_account_type_display()})."
            )
        if amount <= 0:
            raise ValidationError("El monto de la compra debe ser mayor a cero.")
        if not isinstance(installments, int) or installments < 1 or installments > 36:
            raise ValidationError(
                f"La cantidad de cuotas debe estar entre 1 y 36 (recibido: {installments})."
            )
        if monthly_rate < 0 or monthly_rate >= 1:
            raise ValidationError(
                f"La tasa mensual debe estar en [0, 1) (recibido: {monthly_rate})."
            )
        if monthly_rate > 0:
            # ADR-0046 D-5: la ruta con interés (devengo por período) está
            # diferida. El checkout ya pasa monthly_rate=0.
            raise ValidationError(
                "Las compras en cuotas con interés no están soportadas por "
                "ahora (use monthly_rate=0)."
            )
        # Normalizar `date`: los callers que parten de un request
        # (purchase/sales checkout) pueden pasar un string ISO. El
        # cronograma (`date + relativedelta`) exige un date real.
        if isinstance(date, str):
            from django.utils.dateparse import parse_datetime, parse_date
            parsed = parse_date(date)
            if parsed is None:
                dt = parse_datetime(date)
                parsed = dt.date() if dt is not None else None
            date = parsed
        elif isinstance(date, datetime):
            date = date.date()
        if not date:
            date = timezone.now().date()

        # Idempotencia por client_reference.
        if client_reference:
            existing = (
                CardPurchaseGroup.objects
                .filter(client_reference=client_reference)
                .first()
            )
            if existing is not None:
                return existing

        # Calcular principal por cuota (residuo en la última).
        # `quantize(Decimal('0.01'))` aplica redondeo bancario a 2
        # decimales; la última cuota recibe el ajuste.
        principal_base = (amount / installments).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP,
        )
        principals: list[Decimal] = [principal_base] * (installments - 1)
        principals.append(amount - sum(principals))

        # Crear el grupo (agrupador lógico; sin interés en esta onda).
        group = CardPurchaseGroup.objects.create(
            card_account=card_account,
            partner=partner,
            total_amount=amount,
            installments=installments,
            monthly_rate=Decimal('0'),
            principal_per_installment=principal_base,
            first_installment_date=date,
            client_reference=client_reference or '',
            notes=notes or '',
            created_by=created_by,
        )

        # ── Uso de la TC: 1 OUTBOUND por el total (ADR-0046 D-1) ──────
        # El pasivo (H=tarjeta) y la liquidación del proveedor (D) se
        # reconocen completos en la fecha de compra, una sola vez.
        # `is_billed=True`: es el uso, no un cargo pendiente de facturar
        # (lo que se factura por mes vive en el cronograma, abajo).
        purchase_mv = TreasuryService.create_movement(
            amount=amount,
            movement_type=TreasuryMovement.Type.OUTBOUND,
            payment_method=TreasuryMovement.Method.CARD,
            date=date,
            created_by=created_by,
            from_account=card_account,
            partner=partner,
            invoice=invoice,
            sale_order=sale_order,
            purchase_order=purchase_order,
            reference=f"CP-{group.uuid}",
            notes=(
                f"Compra TC {group.display_id} en {installments} cuota(s) "
                f"{notes}".strip()
            ),
        )
        purchase_mv.card_purchase_group = group
        purchase_mv.is_billed = True
        purchase_mv.save(update_fields=['card_purchase_group', 'is_billed'])

        # E4: el asiento del uso (D=proveedor / H=pasivo tarjeta) es el pilar
        # de ADR-0046 (pasivo completo el día de la compra). Si no se posteó
        # —p.ej. el proveedor no tiene cuenta por pagar ni hay
        # `default_payable_account` configurada— `_create_accounting_entry`
        # descarta el asiento en silencio. Verificamos la post-condición y
        # abortamos: como todo el método es @transaction.atomic, el grupo, el
        # movimiento y el cronograma se revierten en bloque (sin pasivo
        # fantasma ni cuotas que facturen una deuda nunca registrada).
        if purchase_mv.journal_entry_id is None:
            raise ValidationError(
                "No se pudo contabilizar el uso de la tarjeta de crédito "
                f"(${amount}): no se resolvió la cuenta de contrapartida. "
                "Verifique que el proveedor tenga cuenta por pagar o configure "
                "`default_payable_account` en Configuración Contable."
            )

        # ── Cronograma: N cuotas (ADR-0046 D-2) ──────────────────────
        # Filas planas, sin contabilidad. Definen cuánto principal entra
        # en el billed_amount de cada statement mensual. El vencimiento
        # avanza por mes calendario desde la fecha de compra.
        CardPurchaseInstallment.objects.bulk_create([
            CardPurchaseInstallment(
                card_purchase_group=group,
                number=i + 1,
                due_date=date + relativedelta(months=i),
                principal_amount=principals[i],
            )
            for i in range(installments)
        ])

        return group

    @staticmethod
    def _get_reason_account(settings, reason, direction):
        if reason == 'TIP' and direction == 'IN':
             return settings.pos_tip_account
        elif reason == 'ROUNDING':
             return settings.pos_rounding_adjustment_account or settings.rounding_adjustment_account
        elif reason == 'COUNTING_ERROR':
             return settings.pos_counting_error_account
        elif reason == 'SYSTEM_ERROR':
             return settings.pos_system_error_account
        elif reason == 'OTHER_IN' and direction == 'IN':
             return settings.pos_other_inflow_account
        elif reason == 'OTHER_OUT' and direction == 'OUT':
             return settings.pos_other_outflow_account
        elif reason == 'THEFT' and direction == 'OUT':
             return settings.pos_theft_account
        elif reason == 'PARTNER_WITHDRAWAL' and direction == 'OUT':
             return settings.pos_partner_withdrawal_account
        elif reason == 'CASHBACK' and direction == 'OUT':
             return settings.pos_cashback_error_account
        return None

    @staticmethod
    def validate_purge(movement: TreasuryMovement):
        """
        Un movimiento solo puede purgarse (hard delete) si está CANCELLED y no dejó
        huella contable: movimientos anulados con reversos se conservan por auditoría.
        """
        if movement.status != TreasuryMovement.MovementStatus.CANCELLED:
            raise ValidationError("Use el endpoint de cancelación para movimientos activos.")
        if movement.journal_entry_id is not None:
            raise ValidationError(
                "No se puede eliminar: el movimiento tiene asientos contables asociados. "
                "Los documentos anulados se conservan como pista de auditoría."
            )

    @staticmethod
    @transaction.atomic
    def cancel_movement(movement: TreasuryMovement, user=None, reason: str = ''):
        """
        Cancels a DRAFT movement: deletes the unposted journal entry and marks
        the movement as CANCELLED. No reversals — a movement with a POSTED
        journal entry must be annulled (see annul_movement) per deletion-policy.
        Never hard-deletes the movement record.
        """
        from core.services.document import lock_document
        lock_document(movement)

        if movement.status == TreasuryMovement.MovementStatus.CANCELLED:
             return movement

        if movement.is_reconciled:
             raise ValidationError("No se puede cancelar un movimiento conciliado.")

        if movement.journal_entry and movement.journal_entry.status == JournalEntry.State.POSTED:
             raise ValidationError(
                  "No se puede cancelar: el movimiento ya está contabilizado. "
                  "Use 'Anular' para revertir con asiento de reversión."
             )

        if movement.journal_entry:
             from tax.services import validate_period_open
             validate_period_open(movement.journal_entry.date, action='cancelar el movimiento')
             je = movement.journal_entry
             movement.journal_entry = None
             movement.save(update_fields=['journal_entry'])
             try:
                  je.delete()
             except ProtectedError:
                  pass

        movement.status = TreasuryMovement.MovementStatus.CANCELLED
        movement.save()

        from workflow.services import WorkflowService
        WorkflowService.log_transition(movement, 'cancel', user=user, reason=reason)
        return movement

    @staticmethod
    @transaction.atomic
    def annul_movement(movement: TreasuryMovement, user=None, reason: str = '',
                       treasury_account_id: int = None, amount: Decimal = None):
        """
        Annuls a movement: reverses its POSTED journal entry (reversal dated
        today, original untouched) and marks it as CANCELLED.

        If treasury_account_id is provided, also creates a return TreasuryMovement
        to track where the refund is deposited to / taken from.
        """
        from core.services.document import lock_document
        lock_document(movement)

        if movement.status == TreasuryMovement.MovementStatus.CANCELLED:
             return movement

        if not reason:
             raise ValidationError("Debe indicar el motivo de la anulación.")

        if movement.is_reconciled:
             raise ValidationError("No se puede anular un movimiento conciliado.")

        if movement.journal_entry and movement.journal_entry.status == JournalEntry.State.POSTED:
             from tax.services import validate_period_open
             validate_period_open(timezone.now().date(), action='anular el movimiento')
             JournalEntryService.reverse_entry(
                  movement.journal_entry,
                  description=f"Anulación Movimiento {movement.id}",
             )
        elif movement.journal_entry:
             je = movement.journal_entry
             movement.journal_entry = None
             movement.save(update_fields=['journal_entry'])
             try:
                  je.delete()
             except ProtectedError:
                  pass

        # ── Return movement ──────────────────────────────────────────────
        if treasury_account_id:
            refund_amount = amount or movement.amount
            if refund_amount <= 0:
                raise ValidationError("El monto a devolver debe ser mayor a cero.")
            if refund_amount > movement.amount:
                raise ValidationError(
                    f"El monto a devolver ({refund_amount}) excede el monto del pago ({movement.amount})."
                )

            try:
                treasury_acc = TreasuryAccount.objects.get(pk=treasury_account_id)
            except TreasuryAccount.DoesNotExist:
                raise ValidationError("La cuenta de tesorería seleccionada no existe.")

            # Check if original movement is a Check → route through CheckService
            from treasury.models import Check
            check = getattr(movement, 'check_receipt', None)

            if check:
                return_movement = CheckService.void_and_return_movement(
                    check, notes=reason,
                )
                from_account = return_movement.from_account
                to_account = return_movement.to_account
            else:
                # Determine return direction (non-check)
                if movement.sale_order:
                    return_type = 'OUTBOUND'
                    from_account = treasury_acc
                    to_account = None
                elif movement.purchase_order:
                    return_type = 'INBOUND'
                    from_account = None
                    to_account = treasury_acc
                else:
                    # Fallback: invert original direction
                    return_type = 'OUTBOUND' if movement.movement_type == 'INBOUND' else 'INBOUND'
                    from_account = treasury_acc if return_type == 'OUTBOUND' else None
                    to_account = treasury_acc if return_type == 'INBOUND' else None

                return_movement = TreasuryMovement.objects.create(
                    movement_type=return_type,
                    payment_method=movement.payment_method,
                    amount=refund_amount,
                    reference=f"DEV-{movement.id}",
                    contact=movement.contact,
                    invoice=movement.invoice,
                    sale_order=movement.sale_order,
                    purchase_order=movement.purchase_order,
                    from_account=from_account,
                    to_account=to_account,
                    payment_method_new=movement.payment_method_new,
                    date=timezone.now().date(),
                    notes=f"Devolución por anulación: {reason}",
                )

            # ── Journal entry for the return movement ──────────────────
            settings = AccountingSettings.get_solo()

            if movement.sale_order:
                partner_account = settings.default_receivable_account
                treasury_acc_ref = from_account
                entry_desc = f"Devolución pago cliente - {movement.contact.name if movement.contact else ''}"
            elif movement.purchase_order:
                partner_account = settings.default_payable_account
                treasury_acc_ref = to_account
                entry_desc = f"Devolución pago proveedor - {movement.contact.name if movement.contact else ''}"

            if movement.sale_order or movement.purchase_order:
                entry = JournalEntry.objects.create(
                    date=return_movement.date,
                    description=entry_desc,
                    reference=f"DEV-JE-{movement.id}",
                    status=JournalEntry.State.DRAFT,
                    source_content_type=ContentType.objects.get_for_model(TreasuryMovement),
                    source_object_id=return_movement.id,
                )

                if movement.sale_order:
                    # Debit: Receivable, Credit: Treasury
                    JournalItem.objects.create(
                        entry=entry, account=partner_account,
                        debit=refund_amount, credit=0,
                        partner=movement.contact,
                        label=f"Devolución pago - {reason}",
                    )
                    JournalItem.objects.create(
                        entry=entry,
                        account=treasury_acc_ref.account if hasattr(treasury_acc_ref, 'account') else treasury_acc_ref,
                        debit=0, credit=refund_amount,
                        label="Salida efectivo - Devolución",
                    )
                else:
                    # Debit: Treasury, Credit: Payable
                    JournalItem.objects.create(
                        entry=entry,
                        account=treasury_acc_ref.account if hasattr(treasury_acc_ref, 'account') else treasury_acc_ref,
                        debit=refund_amount, credit=0,
                        label="Entrada efectivo - Devolución",
                    )
                    JournalItem.objects.create(
                        entry=entry, account=partner_account,
                        debit=0, credit=refund_amount,
                        partner=movement.contact,
                        label=f"Devolución pago - {reason}",
                    )

                JournalEntryService.post_entry(entry)
                return_movement.journal_entry = entry
                return_movement.save()

            # Update pending_amount
            if movement.sale_order:
                movement.sale_order.pending_amount = (
                    (movement.sale_order.pending_amount or 0) + refund_amount
                )
                movement.sale_order.save()
            elif movement.purchase_order:
                movement.purchase_order.pending_amount = (
                    (movement.purchase_order.pending_amount or 0) + refund_amount
                )
                movement.purchase_order.save()

        movement.status = TreasuryMovement.MovementStatus.CANCELLED
        movement.save()

        from workflow.services import WorkflowService
        WorkflowService.log_transition(movement, 'annul', user=user, reason=reason)
        return movement

    @staticmethod
    def create_movement_from_payload(data: dict, *, created_by) -> "TreasuryMovement":
        """
        Resolves all entity references from a raw request payload dict and delegates
        to create_movement. Handles aliased field names from different frontend callers.

        Accepts:
          amount, movement_type | payment_type, payment_method | paymentMethod,
          treasury_account_id | treasury_account, contact_id | partner,
          invoice_id | invoice, purchase_order_id | purchase_order,
          sale_order_id | sale_order, payment_method_id | payment_method_new,
          pos_session_id | pos_session, reference, transaction_number,
          is_pending_registration
        """
        amount_val = data.get("amount")
        if not amount_val:
            raise ValidationError("Amount required")
        amount = Decimal(str(amount_val))

        movement_type = data.get("movement_type") or data.get("payment_type")
        payment_method = (
            data.get("payment_method") or data.get("paymentMethod") or TreasuryMovement.Method.CASH
        )

        is_pending = data.get("is_pending_registration", False)
        if isinstance(is_pending, str):
            is_pending = is_pending.lower() == "true"

        # Resolve treasury account → from/to based on direction
        treasury_account_id = data.get("treasury_account_id") or data.get("treasury_account")
        treasury_account = None
        if treasury_account_id:
            treasury_account = TreasuryAccount.objects.get(pk=treasury_account_id)

        from_account = to_account = None
        if movement_type == TreasuryMovement.Type.INBOUND:
            to_account = treasury_account
        elif movement_type == TreasuryMovement.Type.OUTBOUND:
            from_account = treasury_account

        # Resolve related entities
        contact_id = data.get("contact_id") or data.get("partner")
        partner = None
        if contact_id:
            from contacts.models import Contact
            partner = Contact.objects.filter(pk=contact_id).first()

        invoice = None
        invoice_id = data.get("invoice_id") or data.get("invoice")
        if invoice_id:
            from billing.models import Invoice
            invoice = Invoice.objects.filter(pk=invoice_id).first()

        purchase_order = None
        purchase_order_id = data.get("purchase_order_id") or data.get("purchase_order")
        if purchase_order_id:
            from purchasing.models import PurchaseOrder
            purchase_order = PurchaseOrder.objects.filter(pk=purchase_order_id).first()

        sale_order = None
        sale_order_id = data.get("sale_order_id") or data.get("sale_order")
        if sale_order_id:
            from sales.models import SaleOrder
            sale_order = SaleOrder.objects.filter(pk=sale_order_id).first()

        payment_method_new = None
        payment_method_id = data.get("payment_method_id") or data.get("payment_method_new")
        if payment_method_id:
            payment_method_new = PaymentMethod.objects.filter(pk=payment_method_id).first()

        pos_session_id = data.get("pos_session_id") or data.get("pos_session")

        return TreasuryService.create_movement(
            amount=amount,
            movement_type=movement_type,
            payment_method=payment_method,
            payment_method_new=payment_method_new,
            from_account=from_account,
            to_account=to_account,
            reference=data.get("reference", ""),
            partner=partner,
            invoice=invoice,
            purchase_order=purchase_order,
            sale_order=sale_order,
            transaction_number=data.get("transaction_number"),
            is_pending_registration=is_pending,
            pos_session_id=pos_session_id,
            created_by=created_by,
        )


class TerminalBatchService:
    @staticmethod
    @transaction.atomic
    def create_batch(provider, payment_method, sales_date, gross_amount, commission_base, commission_tax, net_amount, terminal_reference='', user=None, movement_ids=None, sales_date_end=None):
        """
        Create a TerminalBatch and its accounting entries.
        Stage 2 of the Terminal accounting flow.
        """
        # 1. Validation
        commission_total = commission_base + commission_tax
        expected_net = gross_amount - commission_total
        
        if abs(net_amount - expected_net) > Decimal('0.01'):
             raise ValidationError(f"El monto neto no coincide con Bruto - Comisión. Esperado: {expected_net}")

        # Accounts resolution — all per-provider, no global fallbacks.
        # Provider's receivable_account is the clearing account that was debited at
        # Stage 1.2; Stage 2 credits it to close the cycle. Commission and IVA
        # accounts are mandatory at provider level for granular reporting.
        receivable_acc = provider.receivable_account
        comm_acc = provider.commission_expense_account
        iva_acc = provider.commission_iva_account

        # Bank deposit account: use the "Método de Depósito (Hacia Banco)" chosen
        # in the batch modal. The method must represent a transfer/cash settlement
        # to a real bank — never a CARD_TERMINAL method, whose treasury account is
        # itself the provider's clearing and would create a self-canceling entry.
        if not payment_method:
            # Try to resolve from provider's default deposit account
            if provider.default_deposit_account_id:
                payment_method = PaymentMethod.objects.filter(
                    treasury_account=provider.default_deposit_account,
                    method_type__in=[
                        PaymentMethod.Type.CASH,
                        PaymentMethod.Type.TRANSFER,
                        PaymentMethod.Type.CARD,
                        PaymentMethod.Type.DEBIT_CARD,
                        PaymentMethod.Type.CREDIT_CARD,
                    ],
                    allow_for_sales=True,
                    is_active=True,
                ).first()
            if not payment_method:
                raise ValidationError(
                    "Debe seleccionar un Método de Depósito (Hacia Banco) para registrar la liquidación, "
                    "o configure una Cuenta de Tesorería por Defecto en el proveedor."
                )
        if payment_method.method_type == PaymentMethod.Type.CARD_TERMINAL:
            raise ValidationError(
                "El Método de Depósito no puede ser un método CARD_TERMINAL: ese tipo "
                "representa la entrada de la venta, no el abono al banco. Use un método "
                "de tipo TRANSFER o CASH cuya cuenta de tesorería sea el banco real."
            )
        deposit_treasury = payment_method.treasury_account
        # Reject treasury accounts that are themselves clearing/merchant pools — the
        # deposit must land in a real bank/cash account so the cycle Stage 1.2 → Stage 2
        # actually moves money out of the clearing.
        if deposit_treasury and deposit_treasury.account_type in TreasuryAccount._NON_CASH_EQUIVALENT_TYPES:
            raise ValidationError(
                f"La cuenta de tesorería del Método de Depósito es de tipo "
                f"'{deposit_treasury.get_account_type_display()}' (cuenta puente). "
                f"Seleccione un método cuya cuenta sea un banco real (CHECKING) o caja (CASH)."
            )
        bank_acc = deposit_treasury.account if deposit_treasury else None

        if not receivable_acc:
             raise ValidationError("El proveedor del terminal no tiene configurada la 'Cuenta Por Cobrar Terminal' (clearing).")
        if not comm_acc:
             raise ValidationError("El proveedor del terminal no tiene configurada la 'Cuenta Gasto Comisión'.")
        if not iva_acc:
             raise ValidationError("El proveedor del terminal no tiene configurada la 'Cuenta IVA Comisión'.")
        if not bank_acc:
             raise ValidationError("Debe seleccionar un Método de Depósito con cuenta de tesorería válida para registrar la liquidación.")
        if bank_acc.pk == receivable_acc.pk:
             raise ValidationError(
                 "El Método de Depósito apunta a la misma cuenta que la cuenta puente del proveedor. "
                 "Configure un método cuya cuenta de tesorería sea la cuenta bancaria real donde se acreditó el depósito."
             )

        # 2. Identify Payments
        payments = TreasuryMovement.objects.none()
        if movement_ids:
            payments = TreasuryMovement.objects.filter(
                id__in=movement_ids,
                payment_method_new__method_type=PaymentMethod.Type.CARD_TERMINAL,
                terminal_device__provider=provider,
                terminal_batch__isnull=True
            )
        
        batch = TerminalBatch.objects.create(
            provider=provider,
            payment_method=payment_method,
            sales_date=sales_date,
            sales_date_end=sales_date_end,
            settlement_date=timezone.now().date(), # Or passed as arg
            deposit_date=timezone.now().date(), # Assuming deposit happens on settlement report
            gross_amount=gross_amount,
            commission_base=commission_base,
            commission_tax=commission_tax,
            commission_total=commission_total,
            net_amount=net_amount,
            terminal_reference=terminal_reference,
            status=TerminalBatch.Status.SETTLED,
            created_by=user
        )
        
        # Link payments
        payments.update(terminal_batch=batch)
        
        # 3. Create Accounting Entry (Settlement)
        # Description: Liquidación Terminal [Provider] - [Date]
        description = f"Liq. {provider.name} - {sales_date}"
        first_movement = payments.first()
        source_ct = ContentType.objects.get_for_model(TreasuryMovement) if first_movement else None
        source_oid = first_movement.id if first_movement else None
        entry = JournalEntry.objects.create(
            date=batch.settlement_date,
            description=description,
            reference=f"LIQ-JE-{batch.id}",
            status=JournalEntry.State.DRAFT,
            source_content_type=source_ct,
            source_object_id=source_oid,
        )
        
        # A. Commission Expense - Net (Debit)
        JournalItem.objects.create(
            entry=entry,
            account=comm_acc,
            debit=commission_base,
            credit=0
        )

        # B. IVA Commission (Debit)
        JournalItem.objects.create(
            entry=entry,
            account=iva_acc,
            debit=commission_tax,
            credit=0
        )
        
        # C. Bank Check/Transfer (Debit) <-- Net Amount received
        JournalItem.objects.create(
            entry=entry,
            account=bank_acc,
            debit=net_amount,
            credit=0
        )
        
        # D. Receivable Offset (Credit) <-- Gross Amount was previously debited here
        JournalItem.objects.create(
            entry=entry,
            account=receivable_acc,
            debit=0,
            credit=gross_amount
        )
        
        JournalEntryService.post_entry(entry)
        
        batch.settlement_journal_entry = entry
        
        # 4. Create Settlement TreasuryMovement (INBOUND, net_amount)
        # The provider's clearing is a virtual/bridge treasury — the real cash
        # arrival happens in the bank account chosen as deposit method. Modeling
        # this as INBOUND to that bank ensures the movement surfaces in the bank
        # reconciliation workbench for 1:1 matching with the actual bank statement.
        # journal_entry stays null: accounting is already booked above as
        # settlement_journal_entry on the batch.
        settlement_movement = TreasuryMovement.objects.create(
            movement_type=TreasuryMovement.Type.INBOUND,
            payment_method=TreasuryMovement.Method.TRANSFER,
            amount=net_amount,
            date=batch.settlement_date,
            to_account=deposit_treasury,
            payment_method_new=payment_method,
            contact=provider.supplier,
            reference=f"LIQ-{batch.display_id}",
            notes=f"Liquidación terminal {provider.name} - Ventas {sales_date} (Bruto: ${gross_amount}, Comisión: ${commission_total})",
            terminal_batch=batch,
            created_by=user,
            is_reconciled=False,
        )
        
        batch.settlement_movement = settlement_movement
        batch.save()
        
        return batch

    @staticmethod
    @transaction.atomic
    def generate_monthly_invoice(provider, year, month, user=None, number=None, date=None, document_attachment=None):
        """
        Aggregates SETTLED batches for a month/provider and generates a Supplier Invoice.
        Status -> INVOICED.
        """
        # Find batches
        batches = TerminalBatch.objects.filter(
            provider=provider,
            sales_date__year=year,
            sales_date__month=month,
            status=TerminalBatch.Status.SETTLED,
            supplier_invoice__isnull=True
        )
        
        if not batches.exists():
            return None

        # Materialize totals before status mutation (line 725 changes status=INVOICED,
        # which would empty the queryset on re-iteration).
        batch_list = list(batches)
        total_commission_net = sum(b.commission_base for b in batch_list)
        total_commission_tax = sum(b.commission_tax for b in batch_list)

        supplier = provider.supplier
        commission_product = provider.commission_product
        
        if not commission_product:
            from django.core.exceptions import ValidationError
            raise ValidationError(f"El proveedor {provider.name} no tiene un 'Producto de Comisión' configurado.")

        # 2. Create Purchase Order
        from purchasing.models import PurchaseOrder, PurchaseLine
        from purchasing.services import PurchasingService
        
        po = PurchaseOrder.objects.create(
            supplier=supplier,
            date=date or timezone.now().date(),
            notes=f"Comisiones Terminales {month}/{year}",
            payment_method=PurchaseOrder.PaymentMethod.CREDIT 
        )
        
        # Create Line — set tax_rate from the actual effective rate of the settled
        # batches so the resulting invoice total matches what the provider charged
        # (avoids divergence from product's default 19% if the provider applied a
        # different effective rate, exemption, or rounding).
        if total_commission_net > 0 and total_commission_tax > 0:
            effective_tax_rate = (total_commission_tax / total_commission_net) * Decimal('100')
            effective_tax_rate = effective_tax_rate.quantize(Decimal('0.01'))
        else:
            effective_tax_rate = Decimal('0.00')

        PurchaseLine.objects.create(
            order=po,
            product=commission_product,
            quantity=1,
            unit_cost=total_commission_net,
            tax_rate=effective_tax_rate,
            uom=commission_product.uom
        )
        
        # 3. Confirm PO
        PurchasingService.confirm_order(po, user)
        
        # 4. Generate Invoice (using PurchasingService)
        # This service usually creates a JournalEntry or Invoice depending on the flow. 
        # Assuming it creates an Invoice and links it to the PO.
        PurchasingService.create_invoice_from_order(po, user=user) 
        
        # Re-fetch invoice linked to PO
        invoice = po.invoices.first()
        if not invoice:
             raise ValidationError("Error generando factura desde la orden de compra.")
             
        # Update Invoice details
        if number:
            invoice.number = number
        if document_attachment:
            invoice.document_attachment = document_attachment
        if date:
            invoice.date = date
        invoice.save()

        # 5. Link Batches
        batches.update(supplier_invoice=invoice, status=TerminalBatch.Status.INVOICED)

        # 6. Cancel Bridge Accounts against Supplier Payable (direct JournalEntry)
        # The settlement batches debited Commission Bridge + IVA Bridge against the
        # Terminal Receivable. Now that the supplier invoice exists, we offset both
        # bridges by crediting them and debiting the supplier's payable.
        settings = AccountingSettings.get_solo()
        comm_bridge = provider.commission_expense_account or (settings.terminal_commission_bridge_account if settings else None)
        iva_bridge = provider.commission_iva_account or (settings.terminal_iva_bridge_account if settings else None)
        payable_acc = settings.default_payable_account if settings else None

        if not (comm_bridge and iva_bridge and payable_acc):
            raise ValidationError("Faltan cuentas para cancelar las cuentas puente de comisión: configure cuentas de comisión/IVA en el proveedor (o globales) y la cuenta por pagar del contacto.")

        bridge_total = total_commission_net + total_commission_tax

        bridge_entry = JournalEntry.objects.create(
            date=date or timezone.now().date(),
            description=f"Cruce comisiones terminales {provider.name} - {month}/{year}",
            reference=f"BRIDGE-{invoice.display_id}",
            status=JournalEntry.State.DRAFT,
            source_content_type=ContentType.objects.get_for_model(TreasuryMovement),
            source_object_id=invoice.id,
        )
        JournalItem.objects.create(entry=bridge_entry, account=payable_acc, debit=bridge_total, credit=0)
        JournalItem.objects.create(entry=bridge_entry, account=comm_bridge, debit=0, credit=total_commission_net)
        if total_commission_tax > 0:
            JournalItem.objects.create(entry=bridge_entry, account=iva_bridge, debit=0, credit=total_commission_tax)
        JournalEntryService.post_entry(bridge_entry)

        return invoice


class ProviderAccountService:
    """Gestión automática de cuentas contables para proveedores de terminal."""

    @staticmethod
    def ensure_bridge_account(provider_name: str) -> 'TreasuryAccount':
        """
        Garantiza que exista una TreasuryAccount de tipo BRIDGE para el
        proveedor de terminal. Idempotente: si ya existe una con ese nombre,
        la reusa.

        Sigue el patrón de CheckService.ensure_portfolio_account().
        """
        from django.utils.text import slugify

        code_base = slugify(provider_name)[:8].upper() or "PROVIDER"
        bridge, created = TreasuryAccount.objects.get_or_create(
            account_type=TreasuryAccount.Type.BRIDGE,
            name=f"Puente {provider_name}",
            defaults={
                'currency': 'CLP',
                'code': f"BRIDGE-{code_base}",
            },
        )
        if created:
            logger.info(f"Auto-creada TreasuryAccount BRIDGE: {bridge.name} (code={bridge.code})")
        return bridge
