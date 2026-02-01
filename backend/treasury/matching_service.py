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
from .models import BankStatementLine, Payment, BankStatement


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
        for payment in payments_query[:50]:  # Limitar procesamiento
            score_data = MatchingService._calculate_match_score(line, payment)
            
            if score_data['score'] >= 50:  # Threshold mínimo
                suggestions.append(score_data)
        
        # Ordenar por score descendente y limitar
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
    def manual_match(
        statement_line_id: int,
        payment_id: int,
        user
    ) -> BankStatementLine:
        """
        Asocia manualmente una línea con un pago.
        
        Args:
            statement_line_id: ID de línea de extracto
            payment_id: ID de pago
            user: Usuario que realiza el match
        
        Returns:
            BankStatementLine actualizado
        
        Raises:
            ValueError: Si la línea o pago no existe, o si ya están reconciliados
        """
        try:
            line = BankStatementLine.objects.select_for_update().select_related('statement').get(
                id=statement_line_id
            )
        except BankStatementLine.DoesNotExist:
            raise ValueError(f"Línea de extracto {statement_line_id} no encontrada")
        
        try:
            payment = Payment.objects.get(id=payment_id)
        except Payment.DoesNotExist:
            raise ValueError(f"Pago {payment_id} no encontrado")
        
        # Validaciones
        if line.reconciliation_state == 'RECONCILED':
            raise ValueError("Línea ya reconciliada")
        
        if payment.is_reconciled:
            raise ValueError("Pago ya reconciliado con otra línea")
        
        if line.statement.state == 'CONFIRMED':
            raise ValueError("No se puede modificar extracto confirmado")
        
        # Calcular diferencia
        line_amount = abs(line.credit - line.debit)
        payment_amount = abs(payment.amount)
        difference = line_amount - payment_amount
        
        # Actualizar línea
        line.matched_payment = payment
        line.reconciliation_state = 'MATCHED'
        line.difference_amount = difference
        line.save()
        
        # Actualizar contador en statement
        line.statement.save()  # Triggers reconciled_lines recalc via property
        
        return line
    
    @staticmethod
    @transaction.atomic
    def confirm_match(
        statement_line_id: int,
        user
    ) -> BankStatementLine:
        """
        Confirma un match (MATCHED -> RECONCILED).
        Marca el pago como reconciliado.
        
        Args:
            statement_line_id: ID de línea
            user: Usuario que confirma
        
        Returns:
            BankStatementLine actualizado
        """
        try:
            line = BankStatementLine.objects.select_for_update().select_related(
                'matched_payment', 'statement'
            ).get(id=statement_line_id)
        except BankStatementLine.DoesNotExist:
            raise ValueError(f"Línea {statement_line_id} no encontrada")
        
        if not line.matched_payment:
            raise ValueError("Línea no tiene pago asociado")
        
        if line.reconciliation_state == 'RECONCILED':
            raise ValueError("Línea ya reconciliada")
        
        # Actualizar línea
        line.reconciliation_state = 'RECONCILED'
        line.reconciled_at = timezone.now()
        line.reconciled_by = user
        line.save()
        
        # Actualizar pago
        payment = line.matched_payment
        payment.is_reconciled = True
        payment.reconciled_at = timezone.now()
        payment.reconciled_by = user
        payment.bank_statement_line = line
        payment.save()
        
        # Actualizar statement
        line.statement.reconciled_lines = line.statement.lines.filter(
            reconciliation_state='RECONCILED'
        ).count()
        line.statement.save()
        
        return line
    
    @staticmethod
    @transaction.atomic
    def unmatch(statement_line_id: int) -> BankStatementLine:
        """
        Remueve asociación entre línea y pago.
        
        Args:
            statement_line_id: ID de línea
        
        Returns:
            BankStatementLine actualizado
        """
        try:
            line = BankStatementLine.objects.select_for_update().select_related(
                'matched_payment', 'statement'
            ).get(id=statement_line_id)
        except BankStatementLine.DoesNotExist:
            raise ValueError(f"Línea {statement_line_id} no encontrada")
        
        if line.statement.state == 'CONFIRMED':
            raise ValueError("No se puede modificar extracto confirmado")
        
        # Limpiar pago si está asociado
        if line.matched_payment:
            payment = line.matched_payment
            payment.is_reconciled = False
            payment.reconciled_at = None
            payment.reconciled_by = None
            payment.bank_statement_line = None
            payment.save()
        
        # Limpiar línea
        line.matched_payment = None
        line.reconciliation_state = 'UNRECONCILED'
        line.reconciled_at = None
        line.reconciled_by = None
        line.difference_amount = None
        line.save()
        
        # Actualizar statement
        line.statement.reconciled_lines = line.statement.lines.filter(
            reconciliation_state='RECONCILED'
        ).count()
        line.statement.save()
        
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
            
            if suggestions and suggestions[0]['score'] >= confidence_threshold:
                top_suggestion = suggestions[0]
                payment_id = top_suggestion['payment_data']['id']
                
                try:
                    # Auto-match
                    matched_line = MatchingService.manual_match(
                        line.id,
                        payment_id,
                        None  # Sistema
                    )
                    
                    matched_count += 1
                    matches.append({
                        'line_id': line.id,
                        'line_number': line.line_number,
                        'payment_id': payment_id,
                        'score': top_suggestion['score']
                    })
                except Exception as e:
                    # Skip si falla
                    continue
        
        return {
            'matched_count': matched_count,
            'total_unreconciled': total_unreconciled,
            'matches': matches
        }
