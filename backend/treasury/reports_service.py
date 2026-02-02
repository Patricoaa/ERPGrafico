"""
Reports Service
===============

Servicio para reportes y analytics de reconciliación bancaria.
"""

from django.db.models import Q, Sum, Count, Avg
from django.utils import timezone
from datetime import date, timedelta
from typing import Dict, List, Any, Optional
from decimal import Decimal
from .models import BankStatement, BankStatementLine, ReconciliationRule


class ReportsService:
    """
    Generación de reportes y métricas de reconciliación.
    """
    
    @staticmethod
    def get_reconciliation_dashboard(
        treasury_account_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Dashboard consolidado con KPIs de reconciliación.
        
        Args:
            treasury_account_id: Filtrar por cuenta (opcional)
            date_from: Fecha inicio del período
            date_to: Fecha fin del período
        
        Returns:
            Dict con métricas del dashboard
        """
        # Construir filtros
        filters = Q()
        
        if treasury_account_id:
            filters &= Q(treasury_account_id=treasury_account_id)
        
        if date_from:
            filters &= Q(statement_date__gte=date_from)
        
        if date_to:
            filters &= Q(statement_date__lte=date_to)
        
        # Obtener cartolas
        statements = BankStatement.objects.filter(filters)
        
        # Métricas de cartolas
        total_statements = statements.count()
        confirmed_statements = statements.filter(state='CONFIRMED').count()
        draft_statements = statements.filter(state='DRAFT').count()
        
        # Métricas de líneas
        all_lines = BankStatementLine.objects.filter(statement__in=statements)
        total_lines = all_lines.count()
        
        reconciled_lines = all_lines.filter(
            reconciliation_state='RECONCILED'
        ).count()
        
        matched_lines = all_lines.filter(
            reconciliation_state='MATCHED'
        ).count()
        
        pending_lines = all_lines.filter(
            reconciliation_state='UNRECONCILED'
        ).count()
        
        excluded_lines = all_lines.filter(
            reconciliation_state='EXCLUDED'
        ).count()
        
        # Tasa de reconciliación global
        reconciliation_rate = (
            (reconciled_lines / total_lines * 100) 
            if total_lines > 0 else 0
        )
        
        # Diferencias
        lines_with_diff = all_lines.filter(
            reconciliation_state='RECONCILED'
        ).exclude(difference_amount=0)
        
        diff_aggregates = lines_with_diff.aggregate(
            total_diff=Sum('difference_amount'),
            count_diff=Count('id'),
            avg_diff=Avg('difference_amount')
        )
        
        # Diferencias por tipo
        diff_by_type = {}
        for diff_type, label in [
            ('COMMISSION', 'Comisiones'),
            ('INTEREST', 'Intereses'),
            ('ROUNDING', 'Redondeos'),
            ('ERROR', 'Errores'),
            ('OTHER', 'Otros')
        ]:
            count = lines_with_diff.filter(difference_reason=diff_type).count()
            total = lines_with_diff.filter(difference_reason=diff_type).aggregate(
                total=Sum('difference_amount')
            )['total'] or Decimal('0')
            
            if count > 0:
                diff_by_type[diff_type] = {
                    'label': label,
                    'count': count,
                    'total': float(total)
                }
        
        return {
            'period': {
                'from': date_from.isoformat() if date_from else None,
                'to': date_to.isoformat() if date_to else None
            },
            'statements': {
                'total': total_statements,
                'confirmed': confirmed_statements,
                'draft': draft_statements
            },
            'lines': {
                'total': total_lines,
                'reconciled': reconciled_lines,
                'matched': matched_lines,
                'pending': pending_lines,
                'excluded': excluded_lines
            },
            'reconciliation_rate': round(reconciliation_rate, 2),
            'differences': {
                'total_amount': float(diff_aggregates['total_diff'] or 0),
                'count': diff_aggregates['count_diff'] or 0,
                'average': float(diff_aggregates['avg_diff'] or 0),
                'by_type': diff_by_type
            }
        }
    
    @staticmethod
    def get_pending_reconciliations_report(
        treasury_account_id: Optional[int] = None,
        days_pending_threshold: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Reporte de líneas pendientes de reconciliar.
        
        Args:
            treasury_account_id: Filtrar por cuenta
            days_pending_threshold: Resaltar líneas con más días pendientes
        
        Returns:
            Lista de líneas pendientes con detalles
        """
        filters = Q(reconciliation_state='UNRECONCILED')
        
        if treasury_account_id:
            filters &= Q(statement__treasury_account_id=treasury_account_id)
        
        lines = BankStatementLine.objects.filter(filters).select_related(
            'statement__treasury_account'
        ).order_by('-transaction_date')
        
        today = timezone.now().date()
        
        result = []
        for line in lines:
            amount = abs(line.credit - line.debit)
            days_pending = (today - line.transaction_date).days
            is_overdue = days_pending > days_pending_threshold
            
            result.append({
                'id': line.id,
                'statement_id': line.statement.id,
                'statement': line.statement.display_id,
                'account': line.statement.treasury_account.name,
                'date': line.transaction_date.isoformat(),
                'description': line.description,
                'reference': line.reference or '',
                'amount': float(amount),
                'is_credit': line.credit > line.debit,
                'days_pending': days_pending,
                'is_overdue': is_overdue
            })
        
        return result
    
    @staticmethod
    def get_monthly_trend(
        treasury_account_id: Optional[int] = None,
        months: int = 6
    ) -> List[Dict[str, Any]]:
        """
        Tendencia mensual de reconciliación.
        
        Args:
            treasury_account_id: Filtrar por cuenta
            months: Número de meses hacia atrás
        
        Returns:
            Lista de datos mensuales
        """
        from django.db.models.functions import TruncMonth
        
        # Calcular fecha de inicio
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=months * 30)
        
        filters = Q(statement_date__gte=start_date)
        if treasury_account_id:
            filters &= Q(treasury_account_id=treasury_account_id)
        
        # Agrupar por mes
        monthly_stats = BankStatement.objects.filter(filters).annotate(
            month=TruncMonth('statement_date')
        ).values('month').annotate(
            total_statements=Count('id'),
            total_lines=Sum('total_lines'),
            reconciled_lines=Sum('reconciled_lines')
        ).order_by('month')
        
        result = []
        for stat in monthly_stats:
            total = stat['total_lines'] or 0
            reconciled = stat['reconciled_lines'] or 0
            rate = (reconciled / total * 100) if total > 0 else 0
            
            result.append({
                'month': stat['month'].strftime('%Y-%m'),
                'statements': stat['total_statements'],
                'total_lines': total,
                'reconciled_lines': reconciled,
                'reconciliation_rate': round(rate, 2)
            })
        
        return result
    
    @staticmethod
    def get_rules_performance(
        treasury_account_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Performance de reglas de matching.
        
        Args:
            treasury_account_id: Filtrar por cuenta
        
        Returns:
            Lista de reglas con estadísticas
        """
        filters = Q(is_active=True)
        
        if treasury_account_id:
            filters &= Q(
                Q(treasury_account_id=treasury_account_id) | 
                Q(treasury_account__isnull=True)
            )
        
        rules = ReconciliationRule.objects.filter(filters).select_related(
            'treasury_account', 'created_by'
        )
        
        result = []
        for rule in rules:
            result.append({
                'id': rule.id,
                'name': rule.name,
                'description': rule.description,
                'priority': rule.priority,
                'times_applied': rule.times_applied,
                'success_rate': float(rule.success_rate),
                'auto_confirm': rule.auto_confirm,
                'account': rule.treasury_account.name if rule.treasury_account else 'Global',
                'created_by': rule.created_by.get_full_name() if rule.created_by else None
            })
        
        # Ordenar por tasa de éxito descendente
        result.sort(key=lambda x: x['success_rate'], reverse=True)
        
        return result
    
    @staticmethod
    def get_reconciliation_timeline(
        statement_id: int
    ) -> List[Dict[str, Any]]:
        """
        Timeline de actividades de reconciliación para una cartola.
        
        Args:
            statement_id: ID de la cartola
        
        Returns:
            Lista de eventos cronológicos
        """
        statement = BankStatement.objects.get(id=statement_id)
        
        events = []
        
        # Evento: Importación
        events.append({
            'timestamp': statement.imported_at.isoformat(),
            'type': 'IMPORT',
            'description': 'Cartola importada',
            'user': statement.imported_by.get_full_name() if statement.imported_by else None
        })
        
        # Eventos: Reconciliaciones de líneas
        reconciled_lines = statement.lines.filter(
            reconciliation_state='RECONCILED'
        ).select_related('reconciled_by').order_by('reconciled_at')
        
        for line in reconciled_lines:
            if line.reconciled_at:
                events.append({
                    'timestamp': line.reconciled_at.isoformat(),
                    'type': 'RECONCILE',
                    'description': f'Línea #{line.line_number} reconciliada',
                    'user': line.reconciled_by.get_full_name() if line.reconciled_by else None,
                    'amount': float(abs(line.credit - line.debit))
                })
        
        # Evento: Confirmación de la cartola (si está confirmada)
        if statement.state == 'CONFIRMED':
            events.append({
                'timestamp': statement.updated_at.isoformat(),
                'type': 'CONFIRM',
                'description': 'Cartola confirmada',
                'user': None
            })
        
        return events

    @staticmethod
    def export_reconciliation_report(
        treasury_account_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Any:
        """
        Genera reporte Excel de reconciliación.
        Retorna archivo bytes (BytesIO).
        """
        import pandas as pd
        import io
        
        # 1. Obtener datos
        filters = Q()
        if treasury_account_id:
            filters &= Q(statement__treasury_account_id=treasury_account_id)
        if date_from:
            filters &= Q(statement__statement_date__gte=date_from)
        if date_to:
            filters &= Q(statement__statement_date__lte=date_to)
            
        lines = BankStatementLine.objects.filter(filters).select_related(
            'statement', 'statement__treasury_account', 'matched_payment', 'reconciled_by'
        ).order_by('statement__statement_date', 'line_number')
        
        # 2. Preparar DataFrames
        
        # Hoja 1: Transacciones Conciliadas
        reconciled_data = []
        pending_data = []
        
        for line in lines:
            row = {
                'Fecha': line.transaction_date,
                'Cuenta': line.statement.treasury_account.name,
                'Cartola': line.statement.id,
                'Descripción': line.description,
                'Referencia': line.reference,
                'Cargo': line.debit if line.debit > 0 else 0,
                'Abono': line.credit if line.credit > 0 else 0,
                'Estado': line.get_reconciliation_state_display(),
            }
            
            if line.reconciliation_state == 'RECONCILED':
                row.update({
                    'Diferencia': line.difference_amount,
                    'Motivo Diferencia': line.difference_reason,
                    'Reconciliado Por': line.reconciled_by.get_full_name() if line.reconciled_by else '',
                    'Fecha Reconciliación': line.reconciled_at.date() if line.reconciled_at else '',
                })
                if line.matched_payment:
                    payment = line.matched_payment
                    row.update({
                        'Pago Sistema': payment.id,
                        'Partner': str(payment.contact) if payment.contact else '',
                        'Ref Pago': payment.reference
                    })
                reconciled_data.append(row)
            else:
                row.update({
                    'Días Pendiente': (timezone.now().date() - line.transaction_date).days
                })
                pending_data.append(row)
                
        df_reconciled = pd.DataFrame(reconciled_data)
        df_pending = pd.DataFrame(pending_data)
        
        # 3. Escribir Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            if not df_reconciled.empty:
                df_reconciled.to_excel(writer, sheet_name='Conciliados', index=False)
            else:
                pd.DataFrame({'Info': ['No hay movimientos conciliados en el periodo']}).to_excel(writer, sheet_name='Conciliados', index=False)
                
            if not df_pending.empty:
                df_pending.to_excel(writer, sheet_name='Pendientes', index=False)
            else:
                pd.DataFrame({'Info': ['No hay movimientos pendientes']}).to_excel(writer, sheet_name='Pendientes', index=False)
                
        output.seek(0)
        return output

