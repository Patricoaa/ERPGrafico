"""
Matching Service
================

Servicio para matching automático y manual de líneas de extracto con pagos.
"""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
from typing import List, Dict, Any, Optional
from .models import BankStatementLine, Payment, BankStatement, ReconciliationRule
from .rule_service import RuleService


class MatchingService:
    """
    Servicio para matching de líneas de extracto con pagos.
    
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
        Sugiere pagos candidatos para una línea de extracto.
        
        Args:
            statement_line_id: ID de la línea de extracto
            limit: Máximo número de sugerencias a retornar
        
        Returns:
            Lista de sugerencias ordenadas por score descendente:
            [
                {
                    'payment': Payment instance,
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
        
        # Calcular monto neto de la línea
        line_amount = line.credit - line.debit
        is_inbound = line_amount > 0
        
        # Rango de fechas (±7 días por defecto para candidatos generales)
        date_min = line.transaction_date - timedelta(days=7)
        date_max = line.transaction_date + timedelta(days=7)
        
        # Criterios básicos: misma cuenta, no reconciliado, mismo sentido
        base_filters = Q(
            treasury_account=line.statement.treasury_account,
            is_reconciled=False,
            payment_type='INBOUND' if is_inbound else 'OUTBOUND'
        )

        # Candidatos por proximidad de fecha O por coincidencia exacta de ID/Referencia
        candidate_filters = Q(date__gte=date_min, date__lte=date_max)
        
        if line.transaction_id:
            candidate_filters |= Q(transaction_number__iexact=line.transaction_id)
        
        if line.reference:
            # Si hay referencia, buscamos coincidencia exacta en nro transacción o referencia
            candidate_filters |= Q(transaction_number__iexact=line.reference)
            candidate_filters |= Q(reference__iexact=line.reference)

        payments_query = Payment.objects.filter(
            base_filters & candidate_filters
        ).select_related('contact', 'invoice', 'sale_order', 'purchase_order')
        
        # Scoring de cada pago
        suggestions = []
        
        # 1. Aplicar reglas personalizadas primero
        rule_matches = RuleService.apply_rules_to_line(line)
        for match in rule_matches:
            from .serializers import PaymentSerializer
            suggestions.append({
                'payment_data': PaymentSerializer(match['payment']).data,
                'score': match['score'],
                'reasons': [f"Rule: {match['rule_name']}"],
                'difference': abs(line.credit - line.debit) - abs(match['payment'].amount),
                'rule_id': match['rule_id'],
                'auto_confirm': match['auto_confirm']
            })
            
        # 2. Scoring estándar (evitando duplicados)
        seen_ids = {s['payment_data']['id'] for s in suggestions}
        
        for payment in payments_query[:50]:  # Limitar procesamiento
            if payment.id in seen_ids:
                continue
                
            score_data = MatchingService._calculate_match_score(line, payment)
            
            if score_data['score'] >= 50:  # Threshold mínimo
                suggestions.append(score_data)
        
        # Ordenar por score descendente y limitar
        suggestions.sort(key=lambda x: x['score'], reverse=True)
        return suggestions[:limit]
    
    @staticmethod
    def suggest_lines_for_payment(
        payment_id: int,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Sugiere líneas de extracto para un pago. (Bidireccional)
        """
        try:
            payment = Payment.objects.get(id=payment_id)
        except Payment.DoesNotExist:
            return []
            
        if payment.is_reconciled or not payment.treasury_account:
            return []
            
        # Rango de fechas
        date_min = payment.date - timedelta(days=7)
        date_max = payment.date + timedelta(days=7)
        
        # Filtros base
        filters = Q(
            statement__treasury_account=payment.treasury_account,
            reconciliation_state='UNRECONCILED'
        )
        
        # Sentido
        if payment.payment_type == 'INBOUND':
            filters &= Q(credit__gt=0)
        else:
            filters &= Q(debit__gt=0)
            
        # Candidatos
        candidate_filters = Q(transaction_date__gte=date_min, transaction_date__lte=date_max)
        if payment.transaction_number:
            candidate_filters |= Q(transaction_id__iexact=payment.transaction_number)
            candidate_filters |= Q(reference__iexact=payment.transaction_number)
            
        lines_query = BankStatementLine.objects.filter(
            filters & candidate_filters
        )
        
        suggestions = []
        for line in lines_query[:20]:
            score_data = MatchingService._calculate_match_score(line, payment)
            if score_data['score'] >= 50:
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
        payment: Payment
    ) -> Dict[str, Any]:
        """
        Calcula score de matching entre línea y pago.
        
        Returns:
            {
                'payment': Payment,
                'payment_data': dict,
                'score': float,
                'reasons': list,
                'difference': Decimal
            }
        """
        score = 0
        reasons = []
        
        line_amount = abs(line.credit - line.debit)
        payment_amount = abs(payment.amount)
        difference = line_amount - payment_amount
        
        # 1. Exact amount match (40 puntos)
        if line_amount == payment_amount:
            score += 40
            reasons.append('exact_amount')
        elif abs(difference) <= payment_amount * Decimal('0.05'):  # ±5%
            score += 25
            reasons.append('similar_amount')
        
        # 2. Date proximity (30 puntos)
        date_diff = abs((line.transaction_date - payment.date).days)
        if date_diff == 0:
            score += 30
            reasons.append('exact_date')
        elif date_diff <= 1:
            score += 25
            reasons.append('date_1day')
        elif date_diff <= 3:
            score += 15
            reasons.append('date_3days')
        elif date_diff <= 7:
            score += 5
            reasons.append('date_week')
        
        # 3. Reference/ID match (Hasta 30 puntos)
        id_score = 0
        
        # Prioridad 1: ID de transacción exacto (30 pts)
        if line.transaction_id and payment.transaction_number:
            l_id = line.transaction_id.strip().upper()
            p_id = payment.transaction_number.strip().upper()
            if l_id == p_id:
                id_score = max(id_score, 30)
                reasons.append('exact_id_match')
            elif l_id in p_id or p_id in l_id:
                id_score = max(id_score, 20)
                reasons.append('partial_id_match')
        
        # Prioridad 2: Referencia (Hasta 25 pts)
        if line.reference and payment.transaction_number:
            l_ref = line.reference.strip().upper()
            p_id = payment.transaction_number.strip().upper()
            if l_ref == p_id:
                id_score = max(id_score, 25)
                reasons.append('exact_ref_match')
            elif l_ref in p_id or p_id in l_ref:
                id_score = max(id_score, 15)
                reasons.append('partial_ref_match')
        
        score += id_score
        
        # 4. Description match (10 puntos)
        # Buscar RUT o nombre de contacto en descripción
        if payment.contact:
            contact_name = payment.contact.name.upper()
            description = line.description.upper()
            
            if contact_name in description:
                score += 10
                reasons.append('contact_name_match')
            else:
                # Buscar palabras clave (mínimo 3 letras)
                words = [w for w in contact_name.split() if len(w) >= 3]
                matches = sum(1 for word in words if word in description)
                if matches >= 2:
                    score += 5
                    reasons.append('contact_partial_match')
        
        # Serializar payment data
        from .serializers import PaymentSerializer
        payment_data = PaymentSerializer(payment).data
        
        return {
            'payment_data': payment_data,
            'score': min(score, 100),  # Cap at 100
            'reasons': reasons,
            'difference': difference
        }
    
    @staticmethod
    @transaction.atomic
    def create_match_group(
        line_ids: List[int],
        payment_ids: List[int],
        user,
        difference_reason: Optional[str] = None,
        notes: Optional[str] = None
    ):
        """
        Crea un grupo de conciliación (N:M).
        """
        from .models import ReconciliationMatch
        
        lines = list(BankStatementLine.objects.filter(id__in=line_ids).select_for_update())
        payments = list(Payment.objects.filter(id__in=payment_ids).select_for_update())
        
        if len(lines) != len(line_ids) or len(payments) != len(payment_ids):
            raise ValueError("Algunas líneas o pagos no existen")
            
        # Validaciones de estado
        for l in lines:
            if l.reconciliation_state == 'RECONCILED':
                raise ValueError(f"Línea {l.line_number} ya reconciliada")
            if l.statement.state == 'CONFIRMED':
                raise ValueError(f"Extracto {l.statement.display_id} está confirmado")
        
        for p in payments:
            if p.is_reconciled:
                 # Check if partial? For now strict.
                 raise ValueError(f"Pago {p.id} ya reconciliado")

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
            l.matched_payment = None  # Clear legacy
            l.reconciliation_state = 'MATCHED'
            l.save()
            total_lines_amount += abs(l.credit - l.debit)
            
        # Link Payments
        total_payments_amount = Decimal(0)
        for p in payments:
            p.reconciliation_match = group
            p.save()
            total_payments_amount += abs(p.amount)
            
        # Calculate Difference and assign to first line (Arbitrary anchor)
        difference = total_lines_amount - total_payments_amount
        
        # Reset diff on all lines first
        for l in lines:
            l.difference_amount = Decimal(0)
            l.save()
            
        # Assign to first line
        if lines:
            lines[0].difference_amount = difference
            if difference_reason:
                lines[0].difference_reason = difference_reason
            lines[0].save()
            
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
        
        # Fallback legacy 1:1 if no group (Migración en caliente)
        if not group and line.matched_payment:
             # Convert legacy to group logic on the fly? Or just run legacy code?
             # Let's simple create a group now to migrate it.
             group = MatchingService.create_match_group([line.id], [line.matched_payment.id], user)
             # Refresh line
             line.refresh_from_db()
        
        if not group:
            raise ValueError("Línea no tiene conciliación asociada para confirmar")
        
        if group.is_confirmed:
             return line # Already confirmed
             
        # Confirm Group
        group.is_confirmed = True
        group.confirmed_at = timezone.now()
        group.confirmed_by = user
        group.save()
        
        # Update All Lines in Group
        for l in group.lines.all():
            l.reconciliation_state = 'RECONCILED'
            l.reconciled_at = timezone.now()
            l.reconciled_by = user
            l.save()
            
            # Update Statement counters logic (Optimization: update once per statement)
            l.statement.reconciled_lines = l.statement.lines.filter(
                reconciliation_state='RECONCILED'
            ).count()
            l.statement.save()

        # Update All Payments in Group AND Handle Transfer if Accounts Differs
        for p in group.payments.all():
            
            # Check for Account Mismatch (e.g. Card Payment vs Bank Statement)
            # If Payment was registered in "Transbank Account" but matched to "Bank Statement"
            # We need to transfer funds: Dr Bank / Cr Transbank
            stmt_account = line.statement.treasury_account.account
            if p.account and p.account != stmt_account:
                # Create Transfer Entry
                from accounting.models import JournalEntry, JournalItem
                transfer_entry = JournalEntry.objects.create(
                    date=line.transaction_date,
                    reference=f"Transferencia Conciliación {line.statement.display_id}",
                    description=f"Movimiento de fondos por conciliación ({p.get_payment_method_display()})",
                    state=JournalEntry.State.POSTED
                )
                
                # Dr Bank (Destination)
                JournalItem.objects.create(
                    entry=transfer_entry,
                    account=stmt_account,
                    debit=abs(p.amount) if p.payment_type == 'INBOUND' else 0,
                    credit=abs(p.amount) if p.payment_type == 'OUTBOUND' else 0,
                    partner=p.contact.name if p.contact else ''
                )
                
                # Cr Original Account (Source/Bridge)
                JournalItem.objects.create(
                    entry=transfer_entry,
                    account=p.account,
                    debit=abs(p.amount) if p.payment_type == 'OUTBOUND' else 0,
                    credit=abs(p.amount) if p.payment_type == 'INBOUND' else 0,
                    partner=p.contact.name if p.contact else ''
                )
                
                # Link entry to payment? maybe append to notes or add M2M?
                # Ideally we track this, but for now just create it.

            p.is_reconciled = True
            p.reconciled_at = timezone.now()
            p.reconciled_by = user
            p.bank_statement_line = line # Legacy connection primarily to the 'main' line? 
                                         # Or leave null? Better leave null to avoid confusion, 
                                         # but models.Payment.bank_statement_line exists.
                                         # Let's link it to the first line if 1:1, or None if N:M?
                                         # For now, let's skip legacy field to encourage 'reconciliation_match' usage.
            p.save()
        
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
            
        if line.statement.state == 'CONFIRMED':
            raise ValueError("No se puede modificar extracto confirmado")

        group = line.reconciliation_match
        
        # Legacy fallback
        if not group and line.matched_payment:
             # Legacy unmatch logic
             payment = line.matched_payment
             payment.is_reconciled = False
             payment.reconciled_at = None
             payment.bank_statement_line = None
             payment.save()
             
             line.matched_payment = None
             line.reconciliation_state = 'UNRECONCILED'
             line.difference_amount = Decimal(0)
             line.save()
             return line
             
        if not group:
            if line.reconciliation_state == 'EXCLUDED':
                line.reconciliation_state = 'UNRECONCILED'
                line.save()
            return line

        # Disband Group (Remove all links)
        # 1. Payments
        for p in group.payments.all():
            p.is_reconciled = False
            p.reconciled_at = None
            p.reconciliation_match = None
            p.bank_statement_line = None
            p.save()
            
        # 2. Lines
        for l in group.lines.all():
            l.reconciliation_match = None
            l.matched_payment = None
            l.reconciliation_state = 'UNRECONCILED'
            l.reconciled_at = None
            l.difference_amount = Decimal(0)
            l.save()
            
            # Update statement
            l.statement.reconciled_lines = l.statement.lines.filter(
                 reconciliation_state='RECONCILED'
            ).count()
            l.statement.save()
            
        # 3. Delete Group
        group.delete()
        
        line.refresh_from_db()
        return line
    
    @staticmethod
    @transaction.atomic
    def auto_match_statement(
        statement_id: int,
        confidence_threshold: float = 90.0
    ) -> Dict[str, Any]:
        """
        Intenta matching automático para todas las líneas de un extracto.
        Solo confirma matches con score >= threshold.
        
        Args:
            statement_id: ID del extracto
            confidence_threshold: Score mínimo para auto-match (default: 90)
        
        Returns:
            {
                'matched_count': int,
                'total_unreconciled': int,
                'matches': List[Dict]
            }
        """
        try:
            statement = BankStatement.objects.get(id=statement_id)
        except BankStatement.DoesNotExist:
            raise ValueError(f"Extracto {statement_id} no encontrado")
        
        if statement.state == 'CONFIRMED':
            raise ValueError("Extracto ya confirmado")
        
        # Obtener líneas no reconciliadas
        unreconciled_qs = statement.lines.filter(
            reconciliation_state='UNRECONCILED'
        )
        total_unreconciled = unreconciled_qs.count()
        unreconciled_lines = unreconciled_qs.iterator()
        
        matched_count = 0
        matches = []
        
        for line in unreconciled_lines:
            suggestions = MatchingService.suggest_matches(line.id, limit=1)
            
            if suggestions:
                top_suggestion = suggestions[0]
                score = top_suggestion['score']
                
                # Condición de auto-match: Score >= threshold O Regla con auto_confirm
                should_match = score >= confidence_threshold or top_suggestion.get('auto_confirm', False)
                
                if should_match:
                    payment_id = top_suggestion['payment_data']['id']
                    
                    try:
                        # Auto-match (Ahora usa el wrapper que crea grupos)
                        MatchingService.manual_match(
                            line.id,
                            payment_id,
                            None  # Sistema
                        )
                        
                        # Si viene de una regla, confirmar el uso
                        if top_suggestion.get('rule_id'):
                            RuleService.increment_rule_usage(top_suggestion['rule_id'], success=True)
                        
                        matched_count += 1
                        matches.append({
                            'line_id': line.id,
                            'line_number': line.line_number,
                            'payment_id': payment_id,
                            'score': score,
                            'rule_applied': top_suggestion.get('rule_id') is not None
                        })
                    except Exception as e:
                        # Skip si falla
                        continue
        
        return {
            'matched_count': matched_count,
            'total_unreconciled': total_unreconciled,
            'matches': matches
        }
