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
import hashlib


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
        Importa una cartola bancaria desde archivo.
        
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
        
        # Calcular hash del archivo para evitar duplicados
        file.seek(0)
        file_content = file.read()
        file_hash = hashlib.sha256(file_content).hexdigest()
        file.seek(0) # Reset para que el parser pueda leerlo
        
        if BankStatement.objects.filter(file_hash=file_hash).exists():
            raise ValueError("Este archivo de cartola ya ha sido importado anteriormente.")
        
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
            period_start=validation_result.get('period_start', parsed_data['statement_date']),
            period_end=validation_result.get('period_end', parsed_data['statement_date']),
            opening_balance=parsed_data['opening_balance'],
            closing_balance=parsed_data['closing_balance'],
            file=file,
            file_hash=file_hash,
            imported_by=user,
            bank_format=bank_format,
            total_lines=len(parsed_data['lines']),
            status='DRAFT'
        )
        
        # Crear líneas
        bulk_lines = []
        seen_tx_ids = set()
        skipped_count = 0
        
        # Mapa de advertencias por línea para fácil acceso
        line_warnings_map = {
            w['line']: w['message'] 
            for w in validation_result['warnings'] 
            if w.get('line') is not None
        }

        for line_data in parsed_data['lines']:
            tx_id = line_data.get('transaction_id', '')
            if tx_id and tx_id in seen_tx_ids:
                skipped_count += 1
                continue
            
            if tx_id:
                seen_tx_ids.add(tx_id)
                
            line_warn = line_warnings_map.get(line_data['line_number'])
            has_warning = bool(line_warn)

            line = BankStatementLine(
                statement=statement,
                line_number=line_data['line_number'],
                transaction_date=line_data['transaction_date'],
                value_date=line_data.get('value_date'),
                description=line_data['description'],
                reference=line_data.get('reference', ''),
                transaction_id=tx_id,
                debit=line_data['debit'],
                credit=line_data['credit'],
                balance=line_data['balance'],
                has_warning=has_warning,
                warning_message=line_warn or ''
            )
            bulk_lines.append(line)
        
        if skipped_count > 0:
            validation_result['warnings'].append({
                "line": None,
                "message": f"Se omitieron {skipped_count} transacciones con ID de transacción duplicado."
            })
        
        BankStatementLine.objects.bulk_create(bulk_lines)
        
        from core.cache import invalidate_report_cache
        invalidate_report_cache('treasury')
        
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
        Valida los datos de una cartola parseada.
        
        Args:
            parsed_data: Datos de la cartola parseada
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
            errors.append("La cartola no contiene líneas de transacciones")
        
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
            diff = abs(expected_closing - closing_balance)
            if not diff.is_nan() and diff > Decimal('0.01'):
                warnings.append({
                    "line": None,
                    "message": f"Balance inconsistente: Apertura {opening_balance} + Movimientos {total_movements} "
                    f"= {expected_closing}, pero el cierre es {closing_balance}"
                })
        
        # Validar fechas
        statement_date = parsed_data.get('statement_date')
        if not statement_date:
            errors.append("Fecha de la cartola es requerida")

        # Determinar periodo
        period_start = None
        period_end = None
        if lines:
            period_start = min(line['transaction_date'] for line in lines)
            period_end = max(line['transaction_date'] for line in lines)
        else:
            period_start = statement_date
            period_end = statement_date

        if period_start and period_end:
            # Solapamiento de rangos
            overlapping = BankStatement.objects.filter(
                treasury_account=treasury_account,
                period_end__gte=period_start,
                period_start__lte=period_end
            )
            
            if overlapping.filter(status='CONFIRMED').exists():
                errors.append(f"El rango de fechas ({period_start} a {period_end}) se solapa con una cartola confirmada existente.")
            elif overlapping.filter(status='DRAFT').exists():
                warnings.append({
                    "line": None,
                    "message": f"El rango de fechas ({period_start} a {period_end}) se solapa con una cartola en borrador."
                })

            # Continuidad de balance
            previous_statement = BankStatement.objects.filter(
                treasury_account=treasury_account,
                period_end__lt=period_start
            ).order_by('-period_end').first()
            
            if previous_statement:
                diff = abs(previous_statement.closing_balance - opening_balance)
                if not diff.is_nan() and diff > Decimal('0.01'):
                    warnings.append({
                        "line": None,
                        "message": f"Discontinuidad de saldos: El balance inicial ({opening_balance}) no coincide con el balance final de la cartola anterior ({previous_statement.closing_balance})."
                    })

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
                diff = abs(expected - actual)
                if not diff.is_nan() and diff > Decimal('0.05'): # Un poco más permisivo por acumulacion
                    # Intentar detectar si es orden inverso
                    # Si falla mucho, quizás el archivo está al revés.
                    # Por ahora, solo warning si es inconsistencia leve, error si es grave
                     warnings.append({
                        "line": line['line_number'],
                        "message": f"Discontinuidad de saldo en línea {line['line_number']}: "
                        f"Anterior {current_balance} + A{line['credit']} - C{line['debit']} "
                        f"!= Actual {actual}"
                    })
                
                current_balance = actual

        
        # Validar fechas de transacciones
        for line in lines:
            if line['transaction_date'] > timezone.now().date():
                warnings.append({
                    "line": line['line_number'],
                    "message": f"Línea {line['line_number']} tiene fecha futura: {line['transaction_date']}"
                })
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'period_start': period_start,
            'period_end': period_end
        }
    
    @staticmethod
    def get_statement_summary(statement_id: int) -> Dict[str, Any]:
        """
        Obtiene resumen de una cartola.
        
        Args:
            statement_id: ID de la cartola
        
        Returns:
            Dict con estadísticas de la cartola
        """
        try:
            statement = BankStatement.objects.get(id=statement_id)
        except BankStatement.DoesNotExist:
            raise ValueError(f"Cartola {statement_id} no encontrada")
        
        lines = statement.lines.all()
        
        total_debits = sum(line.debit for line in lines)
        total_credits = sum(line.credit for line in lines)
        
        reconciled_count = lines.filter(
            reconciliation_status='RECONCILED'
        ).count()
        
        matched_count = lines.filter(
            reconciliation_status='MATCHED'
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
