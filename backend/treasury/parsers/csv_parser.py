"""
Generic CSV Parser for Bank Statements
=======================================

Parser configurable para cartolas bancarios en formato CSV.
Soporta configuración flexible por banco mediante JSON.
"""

import csv
import io
from typing import Dict, List, Any, Optional
from datetime import date
from decimal import Decimal
from .base import BaseParser


class GenericCSVParser(BaseParser):
    """
    Parser genérico para archivos CSV de cartolas bancarios.
    
    Configuración esperada:
    {
        "delimiter": ";",  # Delimitador de columnas
        "decimal_separator": ",",  # Separador decimal (, o .)
        "date_format": "%d-%m-%Y",  # Formato de fecha
        "skip_rows": 0,  # Filas a saltar al inicio
        "skip_footer_rows": 0,  # Filas a saltar al final
        "encoding": "auto",  # Encoding (auto, utf-8, iso-8859-1)
        "columns": {  # Mapeo de columnas (índice o nombre)
            "date": 0,  # Índice o nombre de columna
            "description": 1,
            "debit": 2,
            "credit": 3,
            "balance": 4,
            "reference": 5,  # Opcional
            "transaction_id": 6  # Opcional
        },
        "has_header": true,  # Si la primera fila no salteada es header
        "balance_info": {  # Información de balances (opcional)
            "opening_balance_row": null,  # Número de fila, null si no está
            "closing_balance_row": null,
            "statement_date_row": null
        }
    }
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Inicializa el parser con configuración.
        
        Args:
            config: Configuración del parser (ver docstring de clase)
        """
        default_config = {
            'delimiter': ',',
            'decimal_separator': '.',
            'date_format': '%d-%m-%Y',
            'skip_rows': 0,
            'skip_footer_rows': 0,
            'encoding': 'auto',
            'has_header': True,
            'columns': {
                'date': 0,
                'description': 1,
                'debit': 2,
                'credit': 3,
                'balance': 4,
            },
            'balance_info': {}
        }
        
        if config:
            default_config.update(config)
        
        super().__init__(default_config)
    
    def validate_format(self, file) -> bool:
        """
        Valida que el archivo sea un CSV válido.
        
        Args:
            file: Archivo a validar
        
        Returns:
            True si es CSV válido
        """
        try:
            file.seek(0)
            encoding = self.config.get('encoding', 'auto')
            if encoding == 'auto':
                encoding = self.detect_encoding(file)
            
            content = file.read().decode(encoding)
            file.seek(0)
            
            reader = csv.reader(
                io.StringIO(content),
                delimiter=self.config.get('delimiter', ',')
            )
            
            # Intentar leer al menos 2 líneas
            rows = []
            for i, row in enumerate(reader):
                rows.append(row)
                if i >= 2:
                    break
            
            return len(rows) >= 2
        
        except Exception:
            return False
    
    def parse(self, file) -> Dict[str, Any]:
        """
        Parsea el archivo CSV.
        
        Args:
            file: Archivo CSV a parsear
        
        Returns:
            Diccionario con datos del cartola
        
        Raises:
            ValueError: Si el formato es inválido
        """
        if not self.validate_format(file):
            raise ValueError("El archivo no es un CSV válido")
        
        file.seek(0)
        encoding = self.config.get('encoding', 'auto')
        if encoding == 'auto':
            encoding = self.detect_encoding(file)
        
        content = file.read().decode(encoding)
        file.seek(0)
        
        reader = csv.reader(
            io.StringIO(content),
            delimiter=self.config.get('delimiter', ',')
        )
        
        all_rows = list(reader)
        
        # Saltar filas iniciales
        skip_rows = self.config.get('skip_rows', 0)
        skip_footer = self.config.get('skip_footer_rows', 0)
        
        if skip_footer > 0:
            all_rows = all_rows[skip_rows:-skip_footer]
        else:
            all_rows = all_rows[skip_rows:]
        
        # Extraer header si existe
        has_header = self.config.get('has_header', True)
        if has_header and all_rows:
            header = all_rows[0]
            data_rows = all_rows[1:]
        else:
            header = None
            data_rows = all_rows
        
        # Parsear balance info si está disponible
        balance_info = self.config.get('balance_info', {})
        opening_balance = self._extract_balance_from_config(all_rows, balance_info, 'opening_balance_row')
        closing_balance = self._extract_balance_from_config(all_rows, balance_info, 'closing_balance_row')
        statement_date = self._extract_date_from_config(all_rows, balance_info, 'statement_date_row')
        
        # Parsear líneas
        lines = []
        for idx, row in enumerate(data_rows, start=1):
            try:
                line_data = self._parse_row(row, header, idx)
                if line_data:
                    lines.append(line_data)
            except Exception as e:
                # Log error pero continúa
                print(f"Error parseando línea {idx}: {e}")
                continue
        
        if not lines:
            return {
                'statement_date': statement_date or date.today(),
                'opening_balance': opening_balance or Decimal('0'),
                'closing_balance': closing_balance or Decimal('0'),
                'lines': [],
                'metadata': {
                    'total_lines': 0,
                    'encoding': encoding,
                    'format': 'GENERIC_CSV'
                }
            }

        # Si el archivo viene en orden inverso (más reciente primero), lo invertimos
        if len(lines) > 1:
            if lines[0]['transaction_date'] > lines[-1]['transaction_date']:
                lines.reverse()

        # Calcular balances basados en orden cronológico
        # Si ya se extrajeron de la configuración (cabeceras), los respetamos.
        # Si no, los deducimos de las líneas.
        if not opening_balance:
            first_line = lines[0]
            opening_balance = first_line['balance'] - (first_line['credit'] - first_line['debit'])
        
        if not closing_balance:
            closing_balance = lines[-1]['balance']
        
        if not statement_date:
            statement_date = lines[-1]['transaction_date']

        return {
            'statement_date': statement_date,
            'opening_balance': opening_balance,
            'closing_balance': closing_balance,
            'lines': lines,
            'metadata': {
                'total_lines': len(lines),
                'encoding': encoding,
                'format': 'GENERIC_CSV'
            }
        }
    
    def _parse_row(self, row: List[str], header: Optional[List[str]], line_number: int) -> Optional[Dict[str, Any]]:
        """
        Parsea una fila de datos.
        
        Args:
            row: Fila de datos
            header: Header de columnas (si existe)
            line_number: Número de línea
        
        Returns:
            Diccionario con datos de la línea o None si fila vacía
        """
        if not row or all(not cell.strip() for cell in row):
            return None
        
        column_map = self.config['columns']
        decimal_sep = self.config.get('decimal_separator', '.')
        date_fmt = self.config.get('date_format', '%d-%m-%Y')
        
        # Helper para obtener valor de columna
        def get_value(key: str, default=None):
            col_ref = column_map.get(key)
            if col_ref is None:
                return default
            
            # Si es índice numérico
            if isinstance(col_ref, int):
                if col_ref < len(row):
                    return row[col_ref].strip()
                return default
            
            # Si es nombre de columna
            if header and col_ref in header:
                col_idx = header.index(col_ref)
                if col_idx < len(row):
                    return row[col_idx].strip()
            
            return default
        
        # Parsear fecha
        date_str = get_value('date')
        transaction_date = self.normalize_date(date_str, date_fmt)
        if not transaction_date:
            raise ValueError(f"Fecha inválida: {date_str}")
        
        # Parsear montos
        debit = self.normalize_amount(get_value('debit', '0'), decimal_sep)
        credit = self.normalize_amount(get_value('credit', '0'), decimal_sep)
        balance = self.normalize_amount(get_value('balance', '0'), decimal_sep)
        
        # Descripción (requerida)
        description = get_value('description', '')
        if not description:
            raise ValueError("Descripción requerida")
        
        # Campos opcionales
        reference = get_value('reference', '')
        transaction_id = get_value('transaction_id', '')
        
        return {
            'line_number': line_number,
            'transaction_date': transaction_date,
            'value_date': transaction_date,  # Por defecto igual a transaction_date
            'description': description,
            'reference': reference,
            'transaction_id': transaction_id,
            'debit': debit,
            'credit': credit,
            'balance': balance
        }
    
    def _extract_balance_from_config(self, rows: List[List[str]], balance_info: Dict, key: str) -> Optional[Decimal]:
        """
        Extrae un balance de una fila específica según configuración.
        
        Args:
            rows: Todas las filas del archivo
            balance_info: Configuración de balances
            key: Clave del balance a extraer
        
        Returns:
            Balance como Decimal o None
        """
        row_num = balance_info.get(key)
        if row_num is None or row_num >= len(rows):
            return None
        
        row = rows[row_num]
        # Buscar primer valor que parezca un número
        for cell in row:
            try:
                return self.normalize_amount(
                    cell,
                    self.config.get('decimal_separator', '.')
                )
            except ValueError:
                continue
        
        return None
    
    def _extract_date_from_config(self, rows: List[List[str]], balance_info: Dict, key: str) -> Optional[date]:
        """
        Extrae una fecha de una fila específica según configuración.
        
        Args:
            rows: Todas las filas del archivo
            balance_info: Configuración de balances
            key: Clave de la fecha a extraer
        
        Returns:
            Fecha o None
        """
        row_num = balance_info.get(key)
        if row_num is None or row_num >= len(rows):
            return None
        
        row = rows[row_num]
        # Buscar primer valor que parezca una fecha
        for cell in row:
            parsed_date = self.normalize_date(
                cell,
                self.config.get('date_format', '%d-%m-%Y')
            )
            if parsed_date:
                return parsed_date
        
        return None
