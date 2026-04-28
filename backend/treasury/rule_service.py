"""
Rule Service
============

Servicio para gestión y aplicación de reglas de reconciliación configurables.
"""

from django.db import transaction
from django.db.models import Q, QuerySet
from decimal import Decimal
from datetime import timedelta, date
from typing import List, Dict, Any, Optional
from .models import BankStatementLine, TreasuryMovement, ReconciliationRule, BankStatement


class RuleService:
    """
    Servicio para aplicar reglas de matching configurables.
    Complementa MatchingService con lógica personalizable por usuario.
    """
    
    @staticmethod
    def apply_rules_to_line(
        line: BankStatementLine,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Aplica reglas activas a una línea y retorna matches ordenados.
        
        Args:
            line: Línea de Cartola Bancaria
            limit: Máximo de sugerencias a retornar
        
        Returns:
            Lista de matches ordenados por score descendente
        """
        # Obtener reglas activas para esta cuenta
        rules = ReconciliationRule.objects.filter(
            Q(treasury_account=line.statement.treasury_account) | Q(treasury_account__isnull=True),
            is_active=True
        ).order_by('priority')
        
        all_matches = []
        seen_payment_ids = set()
        
        for rule in rules:
            # Aplicar regla
            candidates = RuleService._get_candidates_by_rule(line, rule)
            
            for candidate in candidates:
                # Evitar duplicados
                if candidate.id in seen_payment_ids:
                    continue
                
                # Calcular score
                score = RuleService._calculate_rule_score(line, candidate, rule)
                
                min_score = rule.match_config.get('min_score', 50)
                if score >= min_score:
                    all_matches.append({
                        'payment': candidate,
                        'score': score,
                        'rule_id': rule.id,
                        'rule_name': rule.name,
                        'auto_confirm': rule.auto_confirm
                    })
                    seen_payment_ids.add(candidate.id)
        
        # Ordenar por score descendente
        all_matches.sort(key=lambda x: x['score'], reverse=True)
        
        return all_matches[:limit]
    
    @staticmethod
    def _get_candidates_by_rule(
        line: BankStatementLine,
        rule: ReconciliationRule
    ) -> QuerySet:
        """
        Filtra pagos candidatos según criterios de la regla.
        """
        filters = Q(
            account=line.statement.treasury_account.account,
            is_reconciled=False
        )
        
        config = rule.match_config
        criteria = config.get('criteria', [])
        
        # Determinar tipo de línea (credit/debit)
        line_amount = abs(line.credit - line.debit)
        is_inbound = line.credit > line.debit
        
        filters &= Q(movement_type='INBOUND' if is_inbound else 'OUTBOUND')
        
        # Filtro por monto exacto
        if 'amount_exact' in criteria:
            tolerance = Decimal(str(config.get('amount_tolerance', 0)))
            filters &= Q(
                amount__gte=line_amount - tolerance,
                amount__lte=line_amount + tolerance
            )
        
        # Filtro por rango de fechas
        if 'date_range' in criteria:
            days = config.get('date_range_days', 3)
            date_min = line.transaction_date - timedelta(days=days)
            date_max = line.transaction_date + timedelta(days=days)
            filters &= Q(date__gte=date_min, date__lte=date_max)
        
        # Filtro por palabras clave en referencia
        if 'reference' in criteria:
            keywords = config.get('reference_keywords', [])
            if keywords and line.reference:
                q_keywords = Q()
                for keyword in keywords:
                    q_keywords |= Q(transaction_number__icontains=keyword)
                    q_keywords |= Q(reference__icontains=keyword)
                filters &= q_keywords
        
        # Filtro por ID de transacción
        if 'transaction_id' in criteria and line.transaction_id:
            filters &= Q(transaction_number__icontains=line.transaction_id)
        
        return TreasuryMovement.objects.filter(filters).select_related(
            'contact', 'invoice', 'sale_order', 'purchase_order'
        )[:20]  # Limitar resultados
    
    @staticmethod
    def _calculate_rule_score(
        line: BankStatementLine,
        payment: TreasuryMovement,
        rule: ReconciliationRule
    ) -> float:
        """
        Calcula score personalizado según configuración de regla.
        """
        config = rule.match_config
        score = 0
        
        # Pesos configurables (default similar a MatchingService)
        weights = config.get('weights', {
            'amount': 40,
            'date': 30,
            'reference': 20,
            'contact': 10
        })
        
        line_amount = abs(line.credit - line.debit)
        payment_amount = abs(payment.amount)
        
        # 1. Score de monto
        amount_weight = weights.get('amount', 0)
        if line_amount == payment_amount:
            score += amount_weight
        elif abs(line_amount - payment_amount) <= payment_amount * Decimal('0.05'):  # ±5%
            score += amount_weight * 0.7
        
        # 2. Score de fecha
        date_diff = abs((line.transaction_date - payment.date).days)
        date_weight = weights.get('date', 0)
        
        if date_diff == 0:
            score += date_weight
        elif date_diff <= 1:
            score += date_weight * 0.9
        elif date_diff <= 3:
            score += date_weight * 0.6
        elif date_diff <= 7:
            score += date_weight * 0.3
        
        # 3. Score de referencia
        ref_weight = weights.get('reference', 0)
        if line.reference and payment.transaction_number:
            ref_line = line.reference.upper()
            ref_payment = payment.transaction_number.upper()
            
            if ref_payment in ref_line or ref_line in ref_payment:
                score += ref_weight
            else:
                # Palabras en común
                words_line = set(ref_line.split())
                words_payment = set(ref_payment.split())
                common = len(words_line & words_payment)
                if common > 0:
                    score += ref_weight * (common / max(len(words_line), len(words_payment)))
        
        # 4. Score de contacto
        contact_weight = weights.get('contact', 0)
        if payment.contact and line.description:
            contact_name = payment.contact.name.upper()
            description = line.description.upper()
            
            if contact_name in description:
                score += contact_weight
        
        return min(score, 100)
    
    @staticmethod
    @transaction.atomic
    def create_default_rules(treasury_account, user) -> List[ReconciliationRule]:
        """
        Crea reglas predeterminadas para una cuenta de tesorería.
        
        Args:
            treasury_account: TreasuryAccount
            user: Usuario que crea las reglas
        
        Returns:
            Lista de ReconciliationRule creadas
        """
        default_rules = [
            {
                'name': 'Match Exacto - ID + Monto',
                'description': 'Match por ID de transacción y monto exacto (prioridad máxima)',
                'priority': 1,
                'match_config': {
                    'criteria': ['transaction_id', 'amount_exact'],
                    'amount_tolerance': 0,
                    'min_score': 95,
                    'weights': {
                        'amount': 50,
                        'date': 20,
                        'reference': 20,
                        'contact': 10
                    }
                },
                'auto_confirm': True
            },
            {
                'name': 'Match Cercano - Monto + Fecha',
                'description': 'Match por monto exacto y fecha cercana (±3 días)',
                'priority': 2,
                'match_config': {
                    'criteria': ['amount_exact', 'date_range'],
                    'amount_tolerance': 0,
                    'date_range_days': 3,
                    'min_score': 80,
                    'weights': {
                        'amount': 45,
                        'date': 35,
                        'reference': 15,
                        'contact': 5
                    }
                },
                'auto_confirm': False
            },
            {
                'name': 'Match Amplio - Referencia + Monto',
                'description': 'Match por similitud en referencia y monto aproximado',
                'priority': 3,
                'match_config': {
                    'criteria': ['reference', 'amount_exact', 'date_range'],
                    'amount_tolerance': 100,  # ±$100 tolerancia
                    'date_range_days': 7,
                    'min_score': 60,
                    'weights': {
                        'amount': 30,
                        'date': 20,
                        'reference': 35,
                        'contact': 15
                    }
                },
                'auto_confirm': False
            }
        ]
        
        created_rules = []
        for rule_data in default_rules:
            rule = ReconciliationRule.objects.create(
                treasury_account=treasury_account,
                created_by=user,
                **rule_data
            )
            created_rules.append(rule)
        
        return created_rules
    
    @staticmethod
    def get_rule_statistics(
        rule_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Obtiene estadísticas de uso de una regla.

        Args:
            rule_id: ID de la regla
            date_from: Fecha inicio (opcional)
            date_to: Fecha fin (opcional)

        Returns:
            Dict con estadísticas de la regla
        """
        try:
            rule = ReconciliationRule.objects.get(id=rule_id)
        except ReconciliationRule.DoesNotExist:
            return {'error': 'Regla no encontrada'}

        return {
            'rule_id': rule.id,
            'name': rule.name,
            'times_applied': rule.times_applied,
            'times_succeeded': rule.times_succeeded,
            'success_rate': rule.success_rate,  # @property derivada
            'is_active': rule.is_active,
            'priority': rule.priority,
            'auto_confirm': rule.auto_confirm,
        }
    
    @staticmethod
    @transaction.atomic
    def increment_rule_usage(rule_id: int, success: bool = True) -> None:
        """
        Incrementa contadores de uso de una regla de forma atómica.

        Utiliza contadores enteros separados (times_applied / times_succeeded)
        en lugar de un promedio móvil flotante para evitar deriva acumulada.
        La tasa de éxito se deriva como propiedad calculada en memoria.

        Args:
            rule_id: ID de la regla a actualizar
            success: True si el match fue confirmado por el usuario, False si fue descartado
        """
        from django.db.models import F

        fields_to_increment: List[str] = ['times_applied']
        if success:
            fields_to_increment.append('times_succeeded')

        updated = ReconciliationRule.objects.filter(id=rule_id).update(
            **{field: F(field) + 1 for field in fields_to_increment}
        )
        # Si la regla no existe simplemente ignoramos (evita DoesNotExist en hot-path)
        if not updated:
            pass

    @staticmethod
    def simulate_rule(
        rule_data: Dict[str, Any],
        treasury_account_id: Optional[int] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Simula la ejecución de una regla para ver qué matches encontraría.
        
        Args:
            rule_data: Datos de configuración de la regla (match_config)
            treasury_account_id: ID de cuenta (opcional)
            limit: Límite de resultados
            
        Returns:
            Lista de matches simulados
        """
        # Crear objeto regla temporal en memoria
        temp_rule = ReconciliationRule(
            match_config=rule_data.get('match_config', {}),
            treasury_account_id=treasury_account_id,
            name="Simulation"
        )
        
        # Buscar líneas no reconciliadas recientes
        lines_query = BankStatementLine.objects.filter(
            reconciliation_status='UNRECONCILED'
        ).select_related('statement', 'statement__treasury_account').order_by('-transaction_date')
        
        if treasury_account_id:
            lines_query = lines_query.filter(statement__treasury_account_id=treasury_account_id)
            
        # Analizar un subconjunto de líneas para no demorar demasiado
        sample_lines = lines_query[:50]
        
        results = []
        min_score = temp_rule.match_config.get('min_score', 50)
        
        for line in sample_lines:
            # Reutilizar lógica existente
            candidates = RuleService._get_candidates_by_rule(line, temp_rule)
            
            best_match = None
            best_score = 0
            
            for candidate in candidates:
                score = RuleService._calculate_rule_score(line, candidate, temp_rule)
                if score >= min_score and score > best_score:
                    best_score = score
                    best_match = candidate
            
            if best_match:
                results.append({
                    'line': {
                        'id': line.id,
                        'date': line.transaction_date,
                        'description': line.description,
                        'amount': line.credit - line.debit
                    },
                    'payment': {
                        'id': best_match.id,
                        'date': best_match.date,
                        'reference': best_match.reference or str(best_match.transaction_number or ''),
                        'amount': best_match.amount,
                        'partner': str(best_match.contact) if best_match.contact else None
                    },
                    'score': best_score
                })
                
                if len(results) >= limit:
                    break
        
        return results
