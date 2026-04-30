"""
Celery tasks for the Treasury module.
"""
from celery import shared_task
from .matching_service import MatchingService


@shared_task(bind=True, max_retries=1, soft_time_limit=300)
def auto_match_statement_task(self, statement_id: int, confidence_threshold: float = 90.0):
    """
    S4.8: Auto-match asincrónico con reporte de progreso incremental.

    Corre en background vía Celery. El frontend hace polling al endpoint
    /treasury/statements/{id}/auto_match_status/?task_id=<id> cada 1s.

    Progress format:
        { 'processed': int, 'total': int, 'matched': int, 'percent': int }
    """
    try:
        from .models import BankStatement, TreasuryMovement, ReconciliationRule
        from .rule_service import RuleService
        from django.db.models import Q
        from datetime import timedelta

        try:
            statement = BankStatement.objects.select_related(
                'treasury_account', 'treasury_account__account'
            ).get(id=statement_id)
        except BankStatement.DoesNotExist:
            raise ValueError(f"Cartola {statement_id} no encontrada")

        if statement.status == 'CONFIRMED':
            raise ValueError("Cartola ya confirmada")

        account = statement.treasury_account

        # Pre-fetch unreconciled lines
        unreconciled_lines = list(
            statement.lines.filter(
                reconciliation_status='UNRECONCILED'
            ).select_related('statement', 'statement__treasury_account')
        )
        total_unreconciled = len(unreconciled_lines)

        if total_unreconciled == 0:
            return {'matched_count': 0, 'total_unreconciled': 0, 'matches': []}

        # Seed progress
        self.update_state(
            state='PROGRESS',
            meta={'processed': 0, 'total': total_unreconciled, 'matched': 0, 'percent': 0}
        )

        # Date range
        dates = [l.transaction_date for l in unreconciled_lines]
        range_min = min(dates) - timedelta(days=7)
        range_max = max(dates) + timedelta(days=7)

        # Pre-fetch candidates and rules
        candidates_qs = TreasuryMovement.objects.filter(
            Q(
                is_reconciled=False,
                is_pending_registration=False,
                date__gte=range_min,
                date__lte=range_max,
            ) & (Q(to_account=account) | Q(from_account=account))
        ).select_related('contact', 'from_account', 'to_account')

        all_candidates = list(candidates_qs)

        active_rules = list(
            ReconciliationRule.objects.filter(
                Q(treasury_account=account) | Q(treasury_account__isnull=True),
                is_active=True
            ).order_by('priority')
        )

        already_matched_payment_ids: set = set()
        matched_count = 0
        matches = []

        for i, line in enumerate(unreconciled_lines):
            line_amount = abs(line.credit - line.debit)
            is_inbound = line.credit > line.debit

            line_candidates = [
                p for p in all_candidates
                if p.id not in already_matched_payment_ids
                and MatchingService._payment_matches_account_sense(p, account, is_inbound)
            ]

            best_suggestion = None
            best_score: float = 0.0

            # Rules first
            for rule in active_rules:
                config = rule.match_config
                min_score = config.get('min_score', 50)
                for p in line_candidates:
                    score = RuleService._calculate_rule_score(line, p, rule)
                    if score >= min_score and score > best_score:
                        best_score = score
                        best_suggestion = {
                            'payment': p,
                            'score': score,
                            'rule_id': rule.id,
                            'auto_confirm': rule.auto_confirm,
                        }

            # Standard score fallback
            if best_score < confidence_threshold:
                for p in line_candidates:
                    score_data = MatchingService._calculate_match_score(line, p)
                    if score_data['score'] > best_score:
                        best_score = score_data['score']
                        best_suggestion = {
                            'payment': p,
                            'score': score_data['score'],
                            'rule_id': None,
                            'auto_confirm': False,
                        }

            should_match = (
                best_suggestion
                and (
                    best_suggestion['score'] >= confidence_threshold
                    or best_suggestion.get('auto_confirm', False)
                )
            )

            if should_match and best_suggestion:
                payment = best_suggestion['payment']
                try:
                    MatchingService.create_match_group([line.id], [payment.id], None)
                    if best_suggestion.get('rule_id'):
                        RuleService.increment_rule_usage(best_suggestion['rule_id'], success=True)
                    already_matched_payment_ids.add(payment.id)
                    matched_count += 1
                    matches.append({
                        'line_id': line.id,
                        'payment_id': payment.id,
                        'score': best_suggestion['score'],
                    })
                except Exception:
                    pass  # skip failed individual matches, continue

            # Report progress every line
            processed = i + 1
            percent = int(processed / total_unreconciled * 100)
            self.update_state(
                state='PROGRESS',
                meta={
                    'processed': processed,
                    'total': total_unreconciled,
                    'matched': matched_count,
                    'percent': percent,
                }
            )

        return {
            'matched_count': matched_count,
            'total_unreconciled': total_unreconciled,
            'matches': matches,
        }

    except Exception as exc:
        self.update_state(state='FAILURE', meta={'error': str(exc)})
        raise
