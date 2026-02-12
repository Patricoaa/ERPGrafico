from typing import Dict, Any, List, Optional
import pandas as pd
from decimal import Decimal
from datetime import date
from django.utils import timezone
from .base import BaseParser

class GenericExcelParser(BaseParser):
    """
    Parser genérico para archivos Excel (XLS, XLSX).
    Permite configuración dinámica de columnas.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        default_config = {
            'header_row': 0,
            'skip_footer_rows': 0,
            'columns': {
                'date': 'A',  # Puede ser letra letra columna, índice (int) o nombre (str)
                'description': 'B',
                'debit': 'C',
                'credit': 'D',
                'balance': 'E',
                'reference': 'F',
                'transaction_id': 'G'
            }
        }
        if config:
            default_config.update(config)
        super().__init__(default_config)

    def validate_format(self, file) -> bool:
        return file.name.endswith('.xls') or file.name.endswith('.xlsx')

    def parse(self, file) -> Dict[str, Any]:
        file.seek(0)
        
        # Config params
        header_row = self.config.get('header_row', 0)
        footer_rows = self.config.get('skip_footer_rows', 0)
        
        try:
            df = pd.read_excel(file, header=header_row)
            
            # Si hay footer, recortar
            if footer_rows > 0:
                df = df.iloc[:-footer_rows]
            
            # Helper para resolver valor de columna
            def get_col_val(column_row, col_conf):
                if col_conf is None or pd.isna(col_conf):
                    return None
                
                # Try exact name match
                if isinstance(col_conf, str) and col_conf in df.columns:
                    return column_row[col_conf]
                
                # Try index (int or numeric string)
                try:
                    idx = int(col_conf)
                    if 0 <= idx < len(column_row):
                        return column_row.iloc[idx]
                except (ValueError, TypeError):
                    pass
                
                # Try column letter (A, B...)
                if isinstance(col_conf, str) and len(col_conf) <= 2 and col_conf.isalpha():
                    idx = 0
                    for char in col_conf.upper():
                        idx = idx * 26 + (ord(char) - ord('A') + 1)
                    idx -= 1
                    if 0 <= idx < len(column_row):
                        return column_row.iloc[idx]
                
                return None

            lines = []
            col_map = self.config.get('columns', {})
            line_idx = 1
            
            # Detectar balances y fechas de config global si existen
            # ... (similar a GenericCSVParser, por ahora simplificado)
            
            opening_balance = Decimal(0)
            closing_balance = Decimal(0)
            
            for index, row in df.iterrows():
                # Parsear campos obligatorios
                date_val = get_col_val(row, col_map.get('date'))
                desc_val = get_col_val(row, col_map.get('description'))
                
                if pd.isna(date_val) or pd.isna(desc_val):
                    continue
                    
                # Normalizar
                txn_date = self.normalize_date(date_val, self.config.get('date_format', '%d-%m-%Y'))
                if not txn_date:
                    continue
                
                debit_val = get_col_val(row, col_map.get('debit'))
                credit_val = get_col_val(row, col_map.get('credit'))
                balance_val = get_col_val(row, col_map.get('balance'))
                ref_val = get_col_val(row, col_map.get('reference'))
                txn_id_val = get_col_val(row, col_map.get('transaction_id'))
                
                amount_debit = self.normalize_amount(debit_val) if debit_val else Decimal(0)
                amount_credit = self.normalize_amount(credit_val) if credit_val else Decimal(0)
                amount_balance = self.normalize_amount(balance_val) if balance_val else Decimal(0)
                
                # Si debit/credit vienen en una sola columna "Amount"
                amount_col = col_map.get('amount')
                if amount_col:
                    amt = self.normalize_amount(get_col_val(row, amount_col))
                    if amt < 0:
                        amount_debit = abs(amt)
                        amount_credit = Decimal(0)
                    else:
                        amount_credit = abs(amt)
                        amount_debit = Decimal(0)
                
                line = {
                    'line_number': line_idx,
                    'transaction_date': txn_date,
                    'description': str(desc_val).strip(),
                    'reference': str(ref_val).strip() if ref_val else '',
                    'transaction_id': str(txn_id_val).strip() if txn_id_val else '',
                    'debit': abs(amount_debit),
                    'credit': abs(amount_credit),
                    'balance': amount_balance
                }
                
                lines.append(line)
                line_idx += 1
                
            # Determine direction and balances
            if not lines:
                return {
                    'statement_date': timezone.now().date(),
                    'opening_balance': Decimal('0'),
                    'closing_balance': Decimal('0'),
                    'lines': [],
                    'metadata': {
                        'format': 'GENERIC_EXCEL',
                        'original_filename': file.name
                    }
                }

            # Si el archivo viene en orden inverso (más reciente primero), lo invertimos
            # Comparamos la fecha de la primera y última línea
            if len(lines) > 1:
                first_date = lines[0]['transaction_date']
                last_date = lines[-1]['transaction_date']
                if first_date > last_date:
                    lines.reverse()
            
            # Ahora las líneas están en orden cronológico (más antigua a más reciente)
            # Opening = Balance de la primera línea - su movimiento neto
            # Closing = Balance de la última línea
            first_line = lines[0]
            last_line = lines[-1]
            
            opening_balance = first_line['balance'] - (first_line['credit'] - first_line['debit'])
            closing_balance = last_line['balance']

            return {
                'statement_date': last_line['transaction_date'],
                'opening_balance': opening_balance,
                'closing_balance': closing_balance,
                'lines': lines,
                'metadata': {
                    'format': 'GENERIC_EXCEL',
                    'original_filename': file.name
                }
            }

        except Exception as e:
             raise ValueError(f"Error parseando Excel genérico: {str(e)}")
