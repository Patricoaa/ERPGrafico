"""
Matching Service
================

Servicio para matching automático y manual de líneas de cartola con pagos.
"""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
from typing import List, Dict, Any, Optional
from .models import BankStatementLine, TreasuryMovement, BankStatement, ReconciliationSettings, TerminalBatch
# from .rule_service import RuleService


class MatchingService:
    """
    Servicio para matching de líneas de cartola con pagos.
    
    Implementa 3 estrategias de matching por prioridad:
    1. Exact Match: monto + fecha + referencia exactos
    2. Close Match: monto + fecha cercana (±3 días)
    3. Fuzzy Match: monto similar + descripción parcial
    """
    
    @staticmethod
    def suggest_matches(
        statement_line_id: int,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Sugiere pagos candidatos para una línea de cartola.
        
        Args:
            statement_line_id: ID de la línea de cartola
            limit: Máximo número de sugerencias a retornar
        
        Returns:
            Lista de sugerencias ordenadas por score descendente:
            [
                {
                    'payment': TreasuryMovement instance,
                    'payment_data': dict serializado,
                    'score': float (0-100),
                    'reasons': ['exact_amount', 'date_match', ...],
                    'difference': Decimal
                }
            ]
        """
        try:
            line = BankStatementLine.objects.select_related('statement__treasury_account').get(
                id=statement_line_id
            )
        except BankStatementLine.DoesNotExist:
            return []
        
        # 1. Cargar Configuración (Hierarchical: Account -> Global -> Defaults)
        from .models import ReconciliationSettings
        account = line.statement.treasury_account
        settings = ReconciliationSettings.get_for_account(account)

        # 2. Calcular monto neto y rango de búsqueda
        line_amount = line.credit - line.debit
        is_inbound = line_amount > 0
        lookback = settings.date_range_days
        date_min = line.transaction_date - timedelta(days=lookback)
        date_max = line.transaction_date + timedelta(days=lookback)
        
        # Criterios básicos: no reconciliado, exclude pending
        base_filters = Q(
            is_reconciled=False,
            is_pending_registration=False,
        )
        
        # Filtro de cuenta y sentido
        account = line.statement.treasury_account
        if is_inbound:
            # Abono: Buscar INBOUND a la cuenta O TRANSFER hacia la cuenta
            base_filters &= (
                (Q(movement_type='INBOUND') & Q(to_account=account)) |
                (Q(movement_type='TRANSFER') & Q(to_account=account))
            )
        else:
            # Cargo: Buscar OUTBOUND desde la cuenta O TRANSFER desde la cuenta
            base_filters &= (
                (Q(movement_type='OUTBOUND') & Q(from_account=account)) |
                (Q(movement_type='TRANSFER') & Q(from_account=account))
            )

        # Candidatos por proximidad de fecha O por coincidencia exacta de ID/Referencia
        candidate_filters = Q(date__gte=date_min, date__lte=date_max)
        
        if line.transaction_id:
            candidate_filters |= Q(transaction_number__iexact=line.transaction_id)
        
        if line.reference:
            # Si hay referencia, buscamos coincidencia exacta en nro transacción o referencia
            candidate_filters |= Q(transaction_number__iexact=line.reference)
            candidate_filters |= Q(reference__iexact=line.reference)

        payments_query = TreasuryMovement.objects.filter(
            base_filters & candidate_filters
        ).select_related('contact', 'invoice', 'sale_order', 'purchase_order')
        
        # Scoring de cada pago
        suggestions = []
        
        for payment in payments_query[:200]:
            score_data = MatchingService._calculate_match_score(line, payment, settings=settings)
            
            if score_data['score'] >= 40:  # Threshold base de visibilidad
                suggestions.append(score_data)
        
        # Order by score descending and limit
        suggestions.sort(key=lambda x: x['score'], reverse=True)
        
        # 3. Batch Suggestions (Specific for Terminal Settlements)
        if is_inbound and len(suggestions) < limit:
            batch_suggestions = MatchingService._suggest_batches(line, limit - len(suggestions))
            suggestions.extend(batch_suggestions)

        return suggestions[:limit]
    
    @staticmethod
    def _suggest_batches(line: BankStatementLine, limit: int) -> List[Dict[str, Any]]:
        """Busca lotes de terminales que coincidan con la línea de abono."""
        line_amount = line.credit - line.debit
        date_min = line.transaction_date - timedelta(days=7)
        date_max = line.transaction_date + timedelta(days=7)
        
        batches = TerminalBatch.objects.filter(
            status=TerminalBatch.Status.SETTLED,
            reconciliation_match__isnull=True,
            net_amount__gte=line_amount * Decimal('0.95'),
            net_amount__lte=line_amount * Decimal('1.05'),
            sales_date__gte=date_min,
            sales_date__lte=date_max,
            payment_method__treasury_account=line.statement.treasury_account
        )
        
        suggestions = []
        from .serializers import TerminalBatchSerializer
        for b in batches[:limit]:
            score = 60 # Base score for amount/date proximity
            reasons = ['batch_match']
            
            diff = line_amount - b.net_amount
            if diff == 0:
                score += 30
                reasons.append('exact_amount')
            
            if b.terminal_reference and line.reference and b.terminal_reference.upper() in line.reference.upper():
                score += 10
                reasons.append('reference_match')
                
            suggestions.append({
                'batch_data': TerminalBatchSerializer(b).data,
                'score': min(score, 100),
                'reasons': reasons,
                'difference': diff,
                'is_batch': True
            })
        return suggestions
    
    @staticmethod
    def suggest_lines_for_payment(
        payment_id: int,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Sugiere líneas de cartola para un pago. (Bidireccional)
        """
        try:
            payment = TreasuryMovement.objects.get(id=payment_id)
        except TreasuryMovement.DoesNotExist:
            return []
            
        if payment.is_reconciled or not payment.treasury_account:
            return []
            
        # Rango de fechas
        date_min = payment.date - timedelta(days=7)
        date_max = payment.date + timedelta(days=7)
        
        # Sentido e identificación de cuenta relevante
        if payment.movement_type == 'TRANSFER':
            # Si es traspaso, la cuenta relevante para la línea de cartola 
            # es la que recibe (si buscamos abonos) o la que entrega (si buscamos cargos)
            # Como el pago es uno solo, el sentido depende de en qué cuenta estemos mirando.
            # En MatchingService, asumimos que buscamos líneas para EL LADO del pago que toca el banco.
            
            # Si el pago tiene to_account bancaria, buscamos Abonos (credit > 0)
            if payment.to_account and payment.to_account.account_type != 'CASH':
                account = payment.to_account
                sense_filter = Q(credit__gt=0)
            else:
                account = payment.from_account
                sense_filter = Q(debit__gt=0)
        else:
            account = payment.from_account or payment.to_account
            sense_filter = Q(credit__gt=0) if payment.movement_type == 'INBOUND' else Q(debit__gt=0)
            
        filters = Q(
            statement__treasury_account=account,
            reconciliation_status='UNRECONCILED'
        )
        filters &= sense_filter
        
        # Búsqueda de candidatos...
            
        # Candidatos
        candidate_filters = Q(transaction_date__gte=date_min, transaction_date__lte=date_max)
        if payment.transaction_number:
            candidate_filters |= Q(transaction_id__iexact=payment.transaction_number)
            candidate_filters |= Q(reference__iexact=payment.transaction_number)
            
        lines_query = BankStatementLine.objects.filter(
            filters & candidate_filters
        )
        
        # Load settings
        from .models import ReconciliationSettings
        settings, _ = ReconciliationSettings.objects.get_or_create(treasury_account=account)

        suggestions = []
        for line in lines_query[:20]:
            score_data = MatchingService._calculate_match_score(line, payment, settings=settings)
            if score_data['score'] >= 40:
                # Re-format for line suggestion
                from .serializers import BankStatementLineSerializer
                suggestions.append({
                    'line_data': BankStatementLineSerializer(line).data,
                    'score': score_data['score'],
                    'reasons': score_data['reasons'],
                    'difference': score_data['difference']
                })
                
        suggestions.sort(key=lambda x: x['score'], reverse=True)
        return suggestions[:limit]

    @staticmethod
    def _calculate_match_score(
        line: BankStatementLine,
        payment: TreasuryMovement,
        settings=None
    ) -> Dict[str, Any]:
        """
        Calcula score de matching entre línea y pago usando pesos configurables.
        """
        if not settings:
            from .models import ReconciliationSettings
            account = line.statement.treasury_account if line.statement else None
            settings = ReconciliationSettings.get_for_account(account)

        total_weight = settings.amount_weight + settings.date_weight + settings.reference_weight + settings.contact_weight
        if total_weight == 0:
            total_weight = 100 # Avoid division by zero

        reasons = []
        line_amount = abs(line.credit - line.debit)
        payment_amount = abs(payment.amount)
        difference = line_amount - payment_amount
        
        # 1. Amount Match (0-100)
        amount_score = 0
        if line_amount == payment_amount:
            amount_score = 100
            reasons.append('exact_amount')
        elif abs(difference) <= payment_amount * Decimal('0.05'):  # ±5%
            amount_score = 50
            reasons.append('similar_amount')
        
        # 2. Date Match (0-100)
        date_score = 0
        date_diff = abs((line.transaction_date - payment.date).days)
        if date_diff == 0:
            date_score = 100
            reasons.append('exact_date')
        elif date_diff <= 1:
            date_score = 80
            reasons.append('date_1day')
        elif date_diff <= 3:
            date_score = 50
            reasons.append('date_3days')
        elif date_diff <= 7:
            date_score = 20
            reasons.append('date_week')
        
        # 3. Reference/ID match (0-100)
        ref_score = 0
        if line.transaction_id and payment.transaction_number:
            l_id = line.transaction_id.strip().upper()
            p_id = payment.transaction_number.strip().upper()
            if l_id == p_id:
                ref_score = 100
                reasons.append('exact_id_match')
            elif l_id in p_id or p_id in l_id:
                ref_score = 60
                reasons.append('partial_id_match')
        
        if ref_score < 80 and line.reference and payment.transaction_number:
            l_ref = line.reference.strip().upper()
            p_id = payment.transaction_number.strip().upper()
            if l_ref == p_id:
                ref_score = 80
                reasons.append('exact_ref_match')
            elif l_ref in p_id or p_id in l_ref:
                ref_score = 50
                reasons.append('partial_ref_match')
        
        # 4. Description/Contact match (0-100)
        contact_score = 0
        if payment.contact:
            contact_name = payment.contact.name.upper()
            bank_format = line.statement.bank_format if line.statement else None
            from .glossa_normalizer import normalize_description
            normalized_description = normalize_description(line.description, bank_format)

            try:
                from rapidfuzz import fuzz as _fuzz
                ratio = _fuzz.partial_ratio(contact_name, normalized_description)
                if ratio >= 70:
                    contact_score = ratio
                    reasons.append('contact_name_match' if ratio == 100 else 'contact_fuzzy_match')
            except ImportError:
                if contact_name in normalized_description:
                    contact_score = 100
                    reasons.append('contact_name_match')

        # Final Weighted Score
        final_score = (
            (amount_score * settings.amount_weight) +
            (date_score * settings.date_weight) +
            (ref_score * settings.reference_weight) +
            (contact_score * settings.contact_weight)
        ) / total_weight

        # Serializar payment data
        from .serializers import TreasuryMovementSerializer
        payment_data = TreasuryMovementSerializer(payment).data
        
        return {
            'payment_data': payment_data,
            'score': round(final_score, 2),
            'reasons': reasons,
            'difference': difference
        }
    
    @staticmethod
    @transaction.atomic
    def create_match_group(
        line_ids: List[int],
        movement_ids: List[int],
        user=None,
        difference_reason: Optional[str] = None,
        notes: Optional[str] = None,
        batch_ids: Optional[List[int]] = None
    ):
        """
        Crea un grupo de conciliación (N:M).
        """
        from .models import ReconciliationMatch
        
        lines = list(BankStatementLine.objects.filter(id__in=line_ids).select_for_update())
        payments = list(TreasuryMovement.objects.filter(id__in=movement_ids).select_for_update())
        batches = []
        if batch_ids:
            batches = list(TerminalBatch.objects.filter(id__in=batch_ids).select_for_update())
        
        if len(lines) != len(line_ids) or len(payments) != len(movement_ids) or (batch_ids and len(batches) != len(batch_ids)):
            raise ValueError("Algunas líneas, pagos o lotes no existen")
            
        # Validaciones de estado y consistencia
        is_all_abonos = all(l.credit > 0 for l in lines)
        is_all_cargos = all(l.debit > 0 for l in lines)
        
        if not (is_all_abonos or is_all_cargos):
            raise ValueError("No se pueden mezclar Cargos y Abonos en un mismo grupo de conciliación.")
            
        is_all_inbound = all(p.movement_type == 'INBOUND' for p in payments)
        is_all_outbound = all(p.movement_type == 'OUTBOUND' for p in payments)
        
        if not (is_all_inbound or is_all_outbound):
            raise ValueError("No se pueden mezclar Ingresos y Egresos en un mismo grupo de conciliación.")

        # Validación de sentido cruzado
        if is_all_abonos and not (is_all_inbound or (batches and all(b.net_amount > 0 for b in batches))):
            raise ValueError("Los Abonos bancarios solo pueden conciliarse con Ingresos del sistema o Lotes de Terminal.")
        if is_all_cargos and not is_all_outbound:
            raise ValueError("Los Cargos bancarios solo pueden conciliarse con Egresos del sistema.")

        for l in lines:
            if l.reconciliation_status == 'RECONCILED':
                raise ValueError(f"Línea {l.line_number} ya reconciliada")
            if l.statement.status == 'CONFIRMED':
                raise ValueError(f"Cartola {l.statement.display_id} está confirmada")
        
        for p in payments:
            if p.is_reconciled:
                 raise ValueError(f"Pago {p.id} ya reconciliado")
            if p.is_pending_registration:
                raise ValueError(
                    f"Pago {p.display_id} está pendiente de registro bancario. "
                    "No se puede reconciliar hasta que el banco confirme la transacción."
                )

        for b in batches:
            if b.status == TerminalBatch.Status.RECONCILED:
                 raise ValueError(f"Lote {b.display_id} ya reconciliado")

        # Create Group
        treasury_account = lines[0].statement.treasury_account
        group = ReconciliationMatch.objects.create(
            treasury_account=treasury_account,
            created_by=user,
            is_confirmed=False
        )
        
        # Link Lines
        total_lines_amount = Decimal(0)
        for l in lines:
            l.reconciliation_match = group
            l.reconciliation_status = 'MATCHED'
            l.save()
            total_lines_amount += abs(l.credit - l.debit)
            
        # Link TreasuryMovements
        total_payments_amount = Decimal(0)
        for p in payments:
            p.reconciliation_match = group
            p.save()
            total_payments_amount += abs(p.amount)

        # Link Batches
        for b in batches:
            b.reconciliation_match = group
            b.save()
            total_payments_amount += b.net_amount
            
        # Calculate Difference and distribute proportionally
        difference = total_lines_amount - total_payments_amount
        
        if lines and total_lines_amount > 0:
            remaining_diff = difference
            distribution_log = []
            
            for i, l in enumerate(lines):
                # If it's the last line, assign the remaining difference to avoid rounding issues
                if i == len(lines) - 1:
                    l_diff = remaining_diff
                else:
                    line_abs = abs(l.credit - l.debit)
                    proportion = line_abs / total_lines_amount
                    l_diff = (difference * proportion).quantize(Decimal('0.01'))
                    remaining_diff -= l_diff
                
                l.difference_amount = l_diff
                if difference_reason:
                    l.difference_reason = difference_reason
                l.save()
                
                if l_diff != 0:
                    distribution_log.append(f"L{l.line_number}: {l_diff}")
            
            # Document distribution in group notes
            if distribution_log:
                dist_str = ", ".join(distribution_log)
                notes_prefix = f"{notes}\n" if notes else ""
                group.notes = f"{notes_prefix}[Reparto proporcional: {dist_str}]"
                group.save()
        elif lines:
            # Fallback if total_lines_amount is 0
            lines[0].difference_amount = difference
            if difference_reason:
                lines[0].difference_reason = difference_reason
            lines[0].save()
            
        from core.cache import invalidate_report_cache
        invalidate_report_cache('treasury')
        
        return group

    @staticmethod
    @transaction.atomic
    def manual_match(
        statement_line_id: int,
        payment_id: int,
        user
    ) -> BankStatementLine:
        """
        Asocia manualmente una línea con un pago (Wrapper 1:1).
        """
        MatchingService.create_match_group([statement_line_id], [payment_id], user)
        return BankStatementLine.objects.get(id=statement_line_id)
    
    @staticmethod
    @transaction.atomic
    def confirm_match(
        statement_line_id: int,
        user
    ) -> BankStatementLine:
        """
        Confirma un match (MATCHED -> RECONCILED) usando Grupos.
        """
        try:
            line = BankStatementLine.objects.select_for_update().get(id=statement_line_id)
        except BankStatementLine.DoesNotExist:
            raise ValueError(f"Línea {statement_line_id} no encontrada")
        
        group = line.reconciliation_match
        
        if not group:
            raise ValueError("Línea no tiene conciliación asociada para confirmar")
        
        if group.is_confirmed:
             return line # Already confirmed
             
        # Confirm Group
        group.is_confirmed = True
        group.confirmed_at = timezone.now()
        group.confirmed_by = user
        group.save()
        
        # S2.2: bulk_update todas las líneas del grupo en una sola operación.
        # S2.3 Fase 1: No escribimos reconciled_lines — es contador denormalizado
        # que será convertido a @property en S2.3 Fase 2.
        now = timezone.now()
        lines_in_group = list(group.lines.all())
        for l in lines_in_group:
            l.reconciliation_status = 'RECONCILED'
            l.reconciled_at = now
            l.reconciled_by = user
        BankStatementLine.objects.bulk_update(
            lines_in_group,
            ['reconciliation_status', 'reconciled_at', 'reconciled_by']
        )

        # Update All Terminal Batches in Group
        for b in group.terminal_batches.all():
            b.status = TerminalBatch.Status.RECONCILED
            # Also set deposit_date to statement date if null
            if not b.deposit_date:
                b.deposit_date = line.transaction_date
            b.bank_statement_line = line
            b.save()

        # Update All TreasuryMovements in Group AND Handle Transfer if Accounts Differs
        for p in group.movements.all():
            
            # Check for Account Mismatch (e.g. Card TreasuryMovement vs Bank Statement)
            # If TreasuryMovement was registered in "Transbank Account" but matched to "Bank Statement"
            # We need to transfer funds: Dr Bank / Cr Transbank
            stmt_account = line.statement.treasury_account.account
            if p.account and p.account != stmt_account:
                # Create Transfer Entry
                from accounting.models import JournalEntry, JournalItem
                transfer_entry = JournalEntry.objects.create(
                    date=line.transaction_date,
                    reference=f"Transferencia Conciliación {line.statement.display_id}",
                    description=f"Movimiento de fondos por conciliación ({p.get_payment_method_display()})",
                    status=JournalEntry.State.DRAFT
                )
                
                # Dr Bank (Destination)
                JournalItem.objects.create(
                    entry=transfer_entry,
                    account=stmt_account,
                    debit=abs(p.amount) if p.movement_type == 'INBOUND' else 0,
                    credit=abs(p.amount) if p.movement_type == 'OUTBOUND' else 0,
                    partner=p.contact,
                    partner_name=p.contact.name if p.contact else ''
                )
                
                # Cr Original Account (Source/Bridge)
                JournalItem.objects.create(
                    entry=transfer_entry,
                    account=p.account,
                    debit=abs(p.amount) if p.movement_type == 'OUTBOUND' else 0,
                    credit=abs(p.amount) if p.movement_type == 'INBOUND' else 0,
                    partner=p.contact,
                    partner_name=p.contact.name if p.contact else ''
                )
                
                # Link entry to match group for explicit tracking
                group.transfer_journal_entries.add(transfer_entry)

            p.is_reconciled = True
            p.reconciled_at = timezone.now()
            p.reconciled_by = user
            p.bank_statement_line = line # Legacy connection primarily to the 'main' line? 
                                         # Or leave null? Better leave null to avoid confusion, 
                                         # but models.TreasuryMovement.bank_statement_line exists.
                                         # Let's link it to the first line if 1:1, or None if N:M?
                                         # For now, let's skip legacy field to encourage 'reconciliation_match' usage.
            p.save()
        
        from core.cache import invalidate_report_cache
        invalidate_report_cache('treasury')
        
        return line
    
    @staticmethod
    @transaction.atomic
    def unmatch(statement_line_id: int) -> BankStatementLine:
        """
        Remueve asociación (Deshace el grupo).
        """
        try:
            line = BankStatementLine.objects.select_for_update().get(id=statement_line_id)
        except BankStatementLine.DoesNotExist:
            raise ValueError(f"Línea {statement_line_id} no encontrada")
            
        if line.statement.status == 'CONFIRMED':
            raise ValueError("No se puede modificar una cartola confirmada")

        group = line.reconciliation_match
        
        if not group:
            if line.reconciliation_status == 'EXCLUDED':
                line.reconciliation_status = 'UNRECONCILED'
                line.save()
            return line

        # Disband Group (Remove all links)
        # 1. TreasuryMovements
        for p in group.movements.all():
            p.is_reconciled = False
            p.reconciled_at = None
            p.reconciliation_match = None
            p.bank_statement_line = None
            p.save()
            
        # 2. Lines — S2.2: bulk_update, S2.3 Fase 1: sin escribir reconciled_lines
        lines_to_reset = list(group.lines.all())
        for l in lines_to_reset:
            l.reconciliation_match = None
            l.reconciliation_status = 'UNRECONCILED'
            l.reconciled_at = None
            l.difference_amount = Decimal(0)
        BankStatementLine.objects.bulk_update(
            lines_to_reset,
            ['reconciliation_match', 'reconciliation_status',
             'reconciled_at', 'difference_amount']
        )
            
        # 3. TerminalBatches
        for b in group.terminal_batches.all():
            b.status = TerminalBatch.Status.SETTLED
            b.reconciliation_match = None
            b.bank_statement_line = None
            b.save()
            
        # 4. Delete Group
        group.delete()
        
        line.refresh_from_db()
        
        from core.cache import invalidate_report_cache
        invalidate_report_cache('treasury')
        
        return line
    
    @staticmethod
    @transaction.atomic
    def auto_match_statement(
        statement_id: int,
        confidence_threshold: float = 90.0
    ) -> Dict[str, Any]:
        """
        S2.1: Matching automático con batch pre-fetch.

        Estrategia O(1 query candidatos + N scoring en RAM) en lugar de O(N queries):
          1. Pre-fetch en 1 query todos los TreasuryMovements no reconciliados
             de la cuenta en el rango de fechas de la cartola.
          2. Construir índice en memoria (dict) por amount y por transaction_number.
          3. Pre-fetch reglas activas de la cuenta (1 query).
          4. Por cada línea, filtrar candidatos en RAM y calcular score sin tocar DB.
          5. Confirmar matches que superen el threshold con create_match_group.

        Args:
            statement_id: ID de la cartola
            confidence_threshold: Score mínimo para auto-match (default: 90)

        Returns:
            {'matched_count': int, 'total_unreconciled': int, 'matches': List[Dict]}
        """
        try:
            statement = BankStatement.objects.select_related(
                'treasury_account', 'treasury_account__account'
            ).get(id=statement_id)
        except BankStatement.DoesNotExist:
            raise ValueError(f"Cartola {statement_id} no encontrada")

        if statement.status == 'CONFIRMED':
            raise ValueError("Cartola ya confirmada")

        account = statement.treasury_account

        # ── 1. Pre-fetch líneas no reconciliadas (1 query) ──────────────────────
        unreconciled_lines = list(
            statement.lines.filter(
                reconciliation_status='UNRECONCILED'
            ).select_related('statement', 'statement__treasury_account')
        )
        total_unreconciled = len(unreconciled_lines)

        if total_unreconciled == 0:
            return {'matched_count': 0, 'total_unreconciled': 0, 'matches': []}

        # ── 2. Rango de fechas de la cartola con holgura ────────────────────────
        dates = [l.transaction_date for l in unreconciled_lines]
        range_min = min(dates) - timedelta(days=7)
        range_max = max(dates) + timedelta(days=7)

        # ── 3. Pre-fetch candidatos (1 query para toda la cartola) ───────────────
        # Incluimos tanto INBOUND→to_account como OUTBOUND→from_account para cubrir
        # cualquier sentido que tenga la cartola.
        candidates_qs = TreasuryMovement.objects.filter(
            Q(
                is_reconciled=False,
                is_pending_registration=False,
                date__gte=range_min,
                date__lte=range_max,
            ) & (
                Q(to_account=account) | Q(from_account=account)
            )
        ).select_related('contact', 'from_account', 'to_account')

        all_candidates: List[TreasuryMovement] = list(candidates_qs)

        # ── 4. Load intelligence settings ────────────────────────────────────────
        from .models import ReconciliationSettings
        settings, _ = ReconciliationSettings.objects.get_or_create(treasury_account=account)
        
        # Use settings thresholds if not provided
        if confidence_threshold is None:
            confidence_threshold = settings.confidence_threshold

        # ── 5. Conjuntos de IDs ya matched (para skip inmediato) ─────────────────
        already_matched_payment_ids: set[int] = set()

        matched_count = 0
        matches: List[Dict[str, Any]] = []

        for line in unreconciled_lines:
            line_candidates = [
                p for p in all_candidates
                if p.id not in already_matched_payment_ids
                and MatchingService._payment_matches_account_sense(p, account, line.credit > line.debit)
            ]

            best_suggestion: Optional[Dict[str, Any]] = None
            best_score: float = 0.0

            for p in line_candidates:
                score_data = MatchingService._calculate_match_score(line, p, settings)
                if score_data['score'] > best_score:
                    best_score = score_data['score']
                    best_suggestion = {
                        'payment': p,
                        'score': score_data['score'],
                    }

            if not best_suggestion or best_score < confidence_threshold:
                continue

            payment = best_suggestion['payment']

            try:
                MatchingService.create_match_group(
                    [line.id],
                    [payment.id],
                    None,
                )

                already_matched_payment_ids.add(payment.id)
                matched_count += 1
                matches.append({
                    'line_id': line.id,
                    'line_number': line.line_number,
                    'payment_id': payment.id,
                    'score': best_score,
                })
            except Exception:
                continue

        if matched_count > 0:
            from core.cache import invalidate_report_cache
            invalidate_report_cache('treasury')

        return {
            'matched_count': matched_count,
            'total_unreconciled': total_unreconciled,
            'matches': matches,
        }

    @staticmethod
    def _payment_matches_account_sense(
        payment: TreasuryMovement,
        account: 'TreasuryAccount',
        is_inbound: bool,
    ) -> bool:
        """
        S2.1 helper: verifica en RAM si un TreasuryMovement tiene el sentido
        correcto para conciliarse con una línea de la cuenta dada.

        is_inbound=True  → línea es Abono → buscamos INBOUND a la cuenta o TRANSFER hacia la cuenta.
        is_inbound=False → línea es Cargo → buscamos OUTBOUND desde la cuenta o TRANSFER desde la cuenta.
        """
        if is_inbound:
            return (
                (payment.movement_type == 'INBOUND' and payment.to_account_id == account.pk)
                or (payment.movement_type == 'TRANSFER' and payment.to_account_id == account.pk)
            )
        else:
            return (
                (payment.movement_type == 'OUTBOUND' and payment.from_account_id == account.pk)
                or (payment.movement_type == 'TRANSFER' and payment.from_account_id == account.pk)
            )


