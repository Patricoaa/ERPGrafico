"""
Reconciliation Service
======================

Servicio de negocio para conciliación bancaria.
"""

from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from typing import Dict, Any, Optional
from .models import BankStatement, BankStatementLine, TreasuryAccount
from .parsers import GenericCSVParser
from .parsers.formats import get_parser_config, get_available_formats


class ReconciliationService:
    """
    Servicio para gestionar conciliación bancaria.
    """
    
    @staticmethod
    @transaction.atomic
    def import_statement(
        file,
        treasury_account_id: int,
        bank_format: str,
        user,
        custom_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Importa un extracto bancario desde archivo.
        
        Args:
            file: Archivo a importar (Django UploadedFile)
            treasury_account_id: ID de la cuenta de tesorería
            bank_format: Formato del archivo (ej: 'BANCO_CHILE_CSV')
            user: Usuario que importa
            custom_config: Configuración custom opcional
        
        Returns:
            Dict con:
            {
                'statement': BankStatement instance,
                'total_lines': int,
                'errors': List[str],
                'warnings': List[str]
            }
        
        Raises:
            ValueError: Si la cuenta no existe o el formato es inválido
        """
        # Validar cuenta de tesorería
        try:
            treasury_account = TreasuryAccount.objects.get(id=treasury_account_id)
        except TreasuryAccount.DoesNotExist:
            raise ValueError(f"Cuenta de tesorería {treasury_account_id} no encontrada")
        
        # Obtener configuración del formato
        try:
            parser_config = get_parser_config(bank_format) if not custom_config else custom_config
        except ValueError as e:
            raise ValueError(f"Formato inválido: {e}")
        
        # Parsear archivo
        try:
            parsed_data = ReconciliationService.parse_file(file, parser_config)
        except Exception as e:
            raise ValueError(f"Error al parsear archivo: {e}")
        
        # Validar datos parseados
        validation_result = ReconciliationService.validate_statement(parsed_data, treasury_account)
        
        if validation_result['errors']:
            raise ValueError(f"Validación falló: {', '.join(validation_result['errors'])}")
        
        # Crear BankStatement
        statement = BankStatement.objects.create(
            treasury_account=treasury_account,
            statement_date=parsed_data['statement_date'],
            opening_balance=parsed_data['opening_balance'],
            closing_balance=parsed_data['closing_balance'],
            file=file,
            imported_by=user,
            bank_format=bank_format,
            total_lines=len(parsed_data['lines']),
            state='DRAFT'
        )
        
        # Crear líneas
        bulk_lines = []
        for line_data in parsed_data['lines']:
            line = BankStatementLine(
                statement=statement,
                line_number=line_data['line_number'],
                transaction_date=line_data['transaction_date'],
                value_date=line_data.get('value_date'),
                description=line_data['description'],
                reference=line_data.get('reference', ''),
                transaction_id=line_data.get('transaction_id', ''),
                debit=line_data['debit'],
                credit=line_data['credit'],
                balance=line_data['balance']
            )
            bulk_lines.append(line)
        
        BankStatementLine.objects.bulk_create(bulk_lines)
        
        return {
            'statement': statement,
            'total_lines': len(bulk_lines),
            'errors': validation_result['errors'],
            'warnings': validation_result['warnings']
        }
    
    @staticmethod
    def parse_file(file, parser_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parsea un archivo usando la configuración dada.
        
        Args:
            file: Archivo a parsear
            parser_config: Configuración del parser
        
        Returns:
            Datos parseados
        
        Raises:
            Exception: Si el parsing falla
        """
        parser = GenericCSVParser(parser_config)
        
        if not parser.validate_format(file):
            raise ValueError("El formato del archivo no es válido")
        
        parsed_data = parser.parse(file)
        
        return parsed_data
    
    @staticmethod
    def validate_statement(parsed_data: Dict[str, Any], treasury_account: TreasuryAccount) -> Dict[str, Any]:
        """
        Valida los datos de un extracto parseado.
        
        Args:
            parsed_data: Datos del extracto parseado
            treasury_account: Cuenta de tesorería
        
        Returns:
            Dict con:
            {
                'is_valid': bool,
                'errors': List[str],
                'warnings': List[str]
            }
        """
        errors = []
        warnings = []
        
        # Validar que tenga líneas
        if not parsed_data.get('lines'):
            errors.append("El extracto no contiene líneas de transacciones")
        
        # Validar balances
        opening_balance = parsed_data.get('opening_balance', Decimal('0'))
        closing_balance = parsed_data.get('closing_balance', Decimal('0'))
        lines = parsed_data.get('lines', [])
        
        if lines:
            # Calcular balance esperado
            total_movements = sum(
                line['credit'] - line['debit']
                for line in lines
            )
            expected_closing = opening_balance + total_movements
            
            # Tolerancia de 0.01 para redondeos
            if abs(expected_closing - closing_balance) > Decimal('0.01'):
                errors.append(
                    f"Balance inconsistente: Apertura {opening_balance} + Movimientos {total_movements} "
                    f"= {expected_closing}, pero el cierre es {closing_balance}"
                )
        
        # Validar fechas
        statement_date = parsed_data.get('statement_date')
        if not statement_date:
            errors.append("Fecha del extracto es requerida")
        
        # Validar que no haya líneas duplicadas por transaction_id
        transaction_ids = [
            line.get('transaction_id')
            for line in lines
            if line.get('transaction_id')
        ]
        
        if len(transaction_ids) != len(set(transaction_ids)):
            warnings.append("Se encontraron transaction_ids duplicados")
        
        # Validar fechas de transacciones
        for line in lines:
            if line['transaction_date'] > timezone.now().date():
                warnings.append(f"Línea {line['line_number']} tiene fecha futura: {line['transaction_date']}")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    @staticmethod
    def get_statement_summary(statement_id: int) -> Dict[str, Any]:
        """
        Obtiene resumen de un extracto.
        
        Args:
            statement_id: ID del extracto
        
        Returns:
            Dict con estadísticas del extracto
        """
        try:
            statement = BankStatement.objects.get(id=statement_id)
        except BankStatement.DoesNotExist:
            raise ValueError(f"Extracto {statement_id} no encontrado")
        
        lines = statement.lines.all()
        
        total_debits = sum(line.debit for line in lines)
        total_credits = sum(line.credit for line in lines)
        
        reconciled_count = lines.filter(
            reconciliation_state='RECONCILED'
        ).count()
        
        matched_count = lines.filter(
            reconciliation_state='MATCHED'
        ).count()
        
        return {
            'statement': statement,
            'total_lines': statement.total_lines,
            'reconciled_lines': reconciled_count,
            'matched_lines': matched_count,
            'unreconciled_lines': statement.total_lines - reconciled_count,
            'reconciliation_progress': statement.reconciliation_progress,
            'total_debits': total_debits,
            'total_credits': total_credits,
            'net_movement': total_credits - total_debits,
            'opening_balance': statement.opening_balance,
            'closing_balance': statement.closing_balance,
        }
    
    @staticmethod
    def get_available_bank_formats() -> Dict[str, str]:
        """
        Retorna formatos bancarios disponibles.
        
        Returns:
            Dict {format_id: format_name}
        """
        return get_available_formats()
