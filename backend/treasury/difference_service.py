"""
Difference Service
==================

Servicio para manejo automático de diferencias en reconciliación.
Crea ajustes contables para comisiones, intereses y otros conceptos.
"""

from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from typing import Dict, Optional
from .models import BankStatementLine
from accounting.models import JournalEntry, JournalItem, Account, AccountingSettings


class DifferenceService:
    """
    Manejo de diferencias entre cartolas bancarias y pagos registrados.
    Genera asientos contables automáticos para ajustes.
    """
    
    # Tipos de diferencias predefinidos
    COMMISSION = 'COMMISSION'

    INTEREST = 'INTEREST'
    EXCHANGE_DIFF = 'EXCHANGE_DIFF'
    ROUNDING = 'ROUNDING'
    ERROR = 'ERROR'
    OTHER = 'OTHER'
    
    DIFFERENCE_CHOICES = [
        (COMMISSION, 'Comisión Bancaria'),
        (INTEREST, 'Intereses Percibidos/Pagados'),
        (EXCHANGE_DIFF, 'Diferencia de Cambio'),
        (ROUNDING, 'Ajuste por Redondeo'),
        (ERROR, 'Error de Registro'),
        (OTHER, 'Otro')
    ]
    
    # Mapeo de tipos a nombres de campos en AccountingSettings
    ACCOUNT_FIELD_MAP = {
        COMMISSION: 'bank_commission_account',
        INTEREST: 'interest_income_account',
        EXCHANGE_DIFF: 'exchange_difference_account',
        ROUNDING: 'rounding_adjustment_account',
        ERROR: 'error_adjustment_account',
        OTHER: 'miscellaneous_adjustment_account'
    }
    
    @staticmethod
    @transaction.atomic
    def create_difference_adjustment(
        line: BankStatementLine,
        difference_type: str,
        user,
        notes: str = ""
    ) -> JournalEntry:
        """
        Crea asiento contable de ajuste por diferencia.
        """
        difference = line.difference_amount
        if abs(difference) == 0:
            raise ValueError("No hay diferencia que ajustar en esta línea")
        
        # Validar tipo de diferencia
        valid_types = dict(DifferenceService.DIFFERENCE_CHOICES).keys()
        if difference_type not in valid_types:
            raise ValueError(f"Tipo de diferencia inválido: {difference_type}")
        
        # Obtener configuración contable
        settings = AccountingSettings.objects.select_related(
            'bank_commission_account', 'interest_income_account', 
            'exchange_difference_account', 'rounding_adjustment_account', 
            'error_adjustment_account', 'miscellaneous_adjustment_account'
        ).first()
        
        if not settings:
            raise ValueError("No existe configuración contable global. Por favor configure los ajustes de contabilidad.")
            
        # Obtener cuenta según el tipo
        difference_account = None
        


        if not difference_account:
            field_name = DifferenceService.ACCOUNT_FIELD_MAP.get(difference_type)
            if field_name:
                difference_account = getattr(settings, field_name)
        
        if not difference_account:
            label = dict(DifferenceService.DIFFERENCE_CHOICES).get(difference_type, difference_type)
            raise ValueError(f"No se ha configurado la cuenta contable para '{label}'. Revise la configuración contable.")
        
        treasury_account = line.statement.treasury_account.account
        if not treasury_account:
            raise ValueError("La cuenta de tesorería no tiene cuenta contable asociada")
        
        difference_label = dict(DifferenceService.DIFFERENCE_CHOICES)[difference_type]
        
        entry = JournalEntry.objects.create(
            date=line.transaction_date,
            reference=f"Ajuste {line.statement.display_id} #{line.line_number}",
            description=f"{difference_label} - {notes}" if notes else difference_label,
            status=JournalEntry.State.DRAFT
        )
        
        abs_diff = abs(difference)
        
        if difference > 0:
            if difference_type in [DifferenceService.INTEREST]:
                JournalItem.objects.create(entry=entry, account=treasury_account, debit=abs_diff, credit=0)
                JournalItem.objects.create(entry=entry, account=difference_account, debit=0, credit=abs_diff)
            else:
                JournalItem.objects.create(entry=entry, account=difference_account, debit=abs_diff, credit=0)
                JournalItem.objects.create(entry=entry, account=treasury_account, debit=0, credit=abs_diff)
        else:
            if difference_type in [DifferenceService.COMMISSION, DifferenceService.ERROR]:
                JournalItem.objects.create(entry=entry, account=difference_account, debit=abs_diff, credit=0)
                JournalItem.objects.create(entry=entry, account=treasury_account, debit=0, credit=abs_diff)
            else:
                JournalItem.objects.create(entry=entry, account=treasury_account, debit=abs_diff, credit=0)
                JournalItem.objects.create(entry=entry, account=difference_account, debit=0, credit=abs_diff)
        
        entry.status = 'POSTED'
        entry.save()
        
        line.difference_journal_entry = entry
        line.difference_reason = difference_type
        line.save()
        
        return entry
    
    @staticmethod
    def suggest_difference_type(line: BankStatementLine) -> str:
        description = line.description.upper()
        difference = abs(line.difference_amount)
        commission_keywords = ['COMISION', 'COMISIÓN', 'CARGO', 'MANTENCIÓN', 'MANTENCION']
        interest_keywords = ['INTERES', 'INTERÉS', 'ABONO', 'RENDIMIENTO']
        for keyword in commission_keywords:
            if keyword in description: return DifferenceService.COMMISSION
        for keyword in interest_keywords:
            if keyword in description: return DifferenceService.INTEREST
        if difference < 10: return DifferenceService.ROUNDING
        return DifferenceService.OTHER
    
    @staticmethod
    def calculate_difference(line: BankStatementLine, movement) -> Decimal:
        line_amount = abs(line.credit - line.debit)
        payment_amount = abs(movement.amount)
        return line_amount - payment_amount
    
    @staticmethod
    def get_difference_summary(statement_id: int) -> Dict:
        from .models import BankStatement
        statement = BankStatement.objects.get(id=statement_id)
        lines_with_diff = statement.lines.filter(reconciliation_status='RECONCILED').exclude(difference_amount=0)
        total_positive = sum(line.difference_amount for line in lines_with_diff if line.difference_amount > 0)
        total_negative = sum(abs(line.difference_amount) for line in lines_with_diff if line.difference_amount < 0)
        by_type = {}
        for line in lines_with_diff:
            diff_type = line.difference_reason or 'UNKNOWN'
            if diff_type not in by_type:
                by_type[diff_type] = {'count': 0, 'total': Decimal('0')}
            by_type[diff_type]['count'] += 1
            by_type[diff_type]['total'] += abs(line.difference_amount)
        return {
            'total_lines_with_difference': lines_with_diff.count(),
            'total_positive_diff': total_positive,
            'total_negative_diff': total_negative,
            'net_difference': total_positive - total_negative,
            'by_type': by_type
        }
