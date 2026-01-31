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
            parser_config = get_parser_config(bank_format)
            if custom_config:
                parser_config.update(custom_config)
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
        format_id = parser_config.get('format_id', 'GENERIC_CSV')
        
        if format_id == 'BANCO_CHILE_CSV':
            from .parsers import BancoChileParser
            parser = BancoChileParser(parser_config)
        elif format_id == 'SANTANDER_XLS':
            from .parsers import SantanderParser
            parser = SantanderParser(parser_config)
        elif format_id == 'GENERIC_EXCEL':
            from .parsers import GenericExcelParser
            parser = GenericExcelParser(parser_config)
        else:
            parser = GenericCSVParser(parser_config)
        
        if not parser.validate_format(file):
            raise ValueError(f"El formato del archivo no es válido para {format_id}")
        
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

        # Validar consistencia línea por línea
        if lines:
            # Ordenar por fecha y luego por linea original para validar secuencia
            # Asumimos que parsed_data['lines'] viene en orden cronológico o de archivo
            # Si el archivo viene inverso (más reciente primero), habría que invertirlo
            # Por ahora asumimos orden de lectura (que suele ser cronológico o inverso consistente)
            
            # Detectar dirección: ¿Fecha linea 0 < Fecha linea N? -> Cronológico
            # Si es inverso, la lógica de saldo sería: Saldo[i] = Saldo[i+1] - Abono[i] + Cargo[i]
            # Esto es complejo. Asumiremos que el parser devuelve líneas en orden cronológico (Oldest -> Newest)
            # Los parsers deberían garantizar esto.
            
            current_balance = opening_balance
            for i, line in enumerate(lines):
                expected = current_balance + line['credit'] - line['debit']
                actual = line['balance']
                
                # Tolerancia
                if abs(expected - actual) > Decimal('0.05'): # Un poco más permisivo por acumulacion
                    # Intentar detectar si es orden inverso
                    # Si falla mucho, quizás el archivo está al revés.
                    # Por ahora, solo warning si es inconsistencia leve, error si es grave
                     warnings.append(
                        f"Discontinuidad de saldo en línea {line['line_number']}: "
                        f"Anterior {current_balance} + A{line['credit']} - C{line['debit']} "
                        f"!= Actual {actual}"
                    )
                
                current_balance = actual

        
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

    @staticmethod
    def generate_preview(file) -> Dict[str, Any]:
        """
        Genera una vista previa del archivo para mapeo de columnas.
        Soporta CSV y Excel.
        """
        import pandas as pd
        import chardet
        
        filename = file.name.lower()
        file.seek(0)
        
        preview_rows = []
        columns = []
        file_type = 'unknown'
        
        try:
            if filename.endswith('.csv'):
                file_type = 'csv'
                # Detectar encoding
                raw = file.read(4000)
                file.seek(0)
                encoding = chardet.detect(raw)['encoding'] or 'utf-8'
                
                # Leer con pandas, intentar deducir separador
                try:
                    df = pd.read_csv(file, encoding=encoding, sep=None, engine='python', nrows=10)
                except:
                    file.seek(0)
                    df = pd.read_csv(file, encoding=encoding, nrows=10) # Coma default
                    
            elif filename.endswith('.xls') or filename.endswith('.xlsx'):
                file_type = 'excel'
                df = pd.read_excel(file, nrows=10, header=None) # Leer sin header para mostrar todo raw
            else:
                raise ValueError("Formato de archivo no soportado")
            
            # Convertir a lista de diccionarios/listas para JSON
            # Reemplazar NaN con ""
            df = df.fillna("")
            
            # Si leímos sin header (excel), las columnas son 0, 1, 2...
            # Si leímos con header (csv), son los nombres
            
            columns = list(df.columns)
            preview_rows = df.values.tolist()
            
            return {
                'columns': columns,
                'rows': preview_rows,
                'file_type': file_type,
                'filename': file.name
            }
            
        except Exception as e:
            raise ValueError(f"No se pudo generar vista previa: {str(e)}")
