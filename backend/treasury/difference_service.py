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
    Manejo de diferencias entre extractos bancarios y pagos registrados.
    Genera asientos contables automáticos para ajustes.
    """
    
    # Tipos de diferencias predefinidos
    COMMISSION = 'COMMISSION'
    CARD_COMMISSION = 'CARD_COMMISSION'  # Comisión Transbank/Tarjeta
    INTEREST = 'INTEREST'
    EXCHANGE_DIFF = 'EXCHANGE_DIFF'
    ROUNDING = 'ROUNDING'
    ERROR = 'ERROR'
    OTHER = 'OTHER'
    
    DIFFERENCE_CHOICES = [
        (COMMISSION, 'Comisión Bancaria'),
        (CARD_COMMISSION, 'Comisión Tarjeta (Transbank)'),
        (INTEREST, 'Interés'),
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
        
        Args:
            line: Línea bancaria con diferencia
            difference_type: Tipo de diferencia (COMMISSION, INTEREST, etc.)
            user: Usuario que crea el ajuste
            notes: Notas adicionales
        
        Returns:
            JournalEntry creado
        
        Raises:
            ValueError: Si no hay diferencia, tipo inválido o cuenta no existe
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
        
        if difference_type == DifferenceService.CARD_COMMISSION:
             # Intentar obtener cuenta puente del proveedor de tarjeta
             # Buscamos pagos asociados a la línea
             provider = None
             if line.matched_payment and line.matched_payment.card_provider:
                 provider = line.matched_payment.card_provider
             elif line.reconciliation_match:
                 # Buscar en grupo (primer pago con proveedor)
                 first_payment = line.reconciliation_match.payments.filter(card_provider__isnull=False).first()
                 if first_payment:
                     provider = first_payment.card_provider
             
             if provider and provider.commission_bridge_account:
                 difference_account = provider.commission_bridge_account
             elif settings.bank_commission_account:
                 # Fallback
                 difference_account = settings.bank_commission_account

        if not difference_account:
            field_name = DifferenceService.ACCOUNT_FIELD_MAP.get(difference_type)
            if field_name:
                difference_account = getattr(settings, field_name)
        
        if not difference_account:
            label = dict(DifferenceService.DIFFERENCE_CHOICES).get(difference_type, difference_type)
            raise ValueError(f"No se ha configurado la cuenta contable para '{label}'. Revise la configuración contable.")
        
        # Cuenta de banco (de la TreasuryAccount)
        treasury_account = line.statement.treasury_account.account
        if not treasury_account:
            raise ValueError("La cuenta de tesorería no tiene cuenta contable asociada")
        
        # Crear asiento
        difference_label = dict(DifferenceService.DIFFERENCE_CHOICES)[difference_type]
        
        entry = JournalEntry.objects.create(
            date=line.transaction_date,
            reference=f"Ajuste {line.statement.display_id} #{line.line_number}",
            notes=f"{difference_label}\n{notes}" if notes else difference_label,
            state='DRAFT',
            created_by=user
        )
        
        # Lógica de debe/haber según signo de diferencia
        abs_diff = abs(difference)
        
        if difference > 0:
            # Banco tiene MÁS de lo esperado
            # Significa: ingreso no registrado o gasto menor
            # Debe: Gasto/Activo | Haber: Banco
            if difference_type in [DifferenceService.INTEREST]:
                # Es un ingreso → Debe: Banco | Haber: Ingreso
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=treasury_account,
                    debit=abs_diff,
                    credit=0
                )
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=difference_account,
                    debit=0,
                    credit=abs_diff
                )
            else:
                # Es ajuste genérico
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=difference_account,
                    debit=abs_diff,
                    credit=0
                )
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=treasury_account,
                    debit=0,
                    credit=abs_diff
                )
        else:
            # Banco tiene MENOS de lo esperado
            # Significa: gasto no registrado (comisión, etc.)
            # Debe: Banco | Haber: Gasto/Ingreso
            
            if difference_type in [DifferenceService.COMMISSION, DifferenceService.CARD_COMMISSION, DifferenceService.ERROR]:
                # Es un gasto → Debe: Gasto | Haber: Banco
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=difference_account,
                    debit=abs_diff,
                    credit=0
                )
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=treasury_account,
                    debit=0,
                    credit=abs_diff
                )
            else:
                # Ajuste genérico
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=treasury_account,
                    debit=abs_diff,
                    credit=0
                )
                JournalItem.objects.create(
                    journal_entry=entry,
                    account=difference_account,
                    debit=0,
                    credit=abs_diff
                )
        
        # Postear asiento inmediatamente
        entry.state = 'POSTED'
        entry.save()
        
        # Asociar a línea bancaria
        line.difference_journal_entry = entry
        line.difference_reason = difference_type
        line.save()
        
        return entry
    
    @staticmethod
    def suggest_difference_type(line: BankStatementLine) -> str:
        """
        Sugiere tipo de diferencia basado en descripción y monto.
        
        Args:
            line: Línea bancaria
        
        Returns:
            Tipo de diferencia sugerido
        """
        description = line.description.upper()
        difference = abs(line.difference_amount)
        
        # Reglas heurísticas basadas en palabras clave
        commission_keywords = ['COMISION', 'COMISIÓN', 'CARGO', 'MANTENCIÓN', 'MANTENCION']
        interest_keywords = ['INTERES', 'INTERÉS', 'ABONO', 'RENDIMIENTO']
        
        for keyword in commission_keywords:
            if keyword in description:
                return DifferenceService.COMMISSION
        
        for keyword in interest_keywords:
            if keyword in description:
                return DifferenceService.INTEREST
        
        # Diferencias pequeñas probablemente son redondeo
        if difference < 10:
            return DifferenceService.ROUNDING
        
        # Default
        return DifferenceService.OTHER
    
    @staticmethod
    def calculate_difference(line: BankStatementLine, payment) -> Decimal:
        """
        Calcula diferencia entre línea bancaria y pago.
        
        Args:
            line: Línea bancaria
            payment: Pago asociado
        
        Returns:
            Diferencia (+ si banco tiene más, - si banco tiene menos)
        """
        line_amount = abs(line.credit - line.debit)
        payment_amount = abs(payment.amount)
        
        return line_amount - payment_amount
    
    @staticmethod
    def get_difference_summary(statement_id: int) -> Dict:
        """
        Resumen de diferencias para un extracto.
        
        Args:
            statement_id: ID del extracto
        
        Returns:
            Dict con resumen de diferencias
        """
        from .models import BankStatement
        
        statement = BankStatement.objects.get(id=statement_id)
        
        lines_with_diff = statement.lines.filter(
            reconciliation_state='RECONCILED'
        ).exclude(difference_amount=0)
        
        total_positive = sum(
            line.difference_amount 
            for line in lines_with_diff 
            if line.difference_amount > 0
        )
        
        total_negative = sum(
            abs(line.difference_amount) 
            for line in lines_with_diff 
            if line.difference_amount < 0
        )
        
        # Agrupar por tipo
        by_type = {}
        for line in lines_with_diff:
            diff_type = line.difference_reason or 'UNKNOWN'
            if diff_type not in by_type:
                by_type[diff_type] = {
                    'count': 0,
                    'total': Decimal('0')
                }
            by_type[diff_type]['count'] += 1
            by_type[diff_type]['total'] += abs(line.difference_amount)
        
        return {
            'total_lines_with_difference': lines_with_diff.count(),
            'total_positive_diff': total_positive,
            'total_negative_diff': total_negative,
            'net_difference': total_positive - total_negative,
            'by_type': by_type
        }
