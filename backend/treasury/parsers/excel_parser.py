from typing import Dict, Any, List, Optional
import pandas as pd
from decimal import Decimal
from datetime import date
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
                'reference': 'F'
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
            def get_col_val(row, col_config):
                # col_config puede ser índice (0), letra ('A'), o nombre ('Fecha')
                if col_config is None:
                    return None
                    
                val = None
                
                # Nombre de columna exacto en DF
                if isinstance(col_config, str) and col_config in df.columns:
                    val = row[col_config]
                
                # Índice entero
                elif isinstance(col_config, int) and 0 <= col_config < len(row):
                    val = row.iloc[col_config]
                
                # Letra 'A', 'B' -> índice 0, 1 (Solo si no macheó nombre)
                elif isinstance(col_config, str) and len(col_config) <= 2 and col_config.isalpha():
                    # Convertir A->0, B->1
                    idx = 0
                    for char in col_config.upper():
                        idx = idx * 26 + (ord(char) - ord('A') + 1)
                    idx -= 1 # 0-indexed
                    
                    if 0 <= idx < len(row):
                         val = row.iloc[idx]

                # Fallback: intentar buscar por nombre parcial si es string
                if pd.isna(val) or val is None:
                    return None
                return val

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
                    'debit': abs(amount_debit),
                    'credit': abs(amount_credit),
                    'balance': amount_balance
                }
                
                lines.append(line)
                line_idx += 1
                
                if line_idx == 2: # Set opening balance tentatively
                     # Si tenemos balance en linea 1, intentar deducir opening
                     # Opening = Balance1 - (Credit1 - Debit1)
                     opening_balance = amount_balance - (amount_credit - amount_debit)
                
                closing_balance = amount_balance

            return {
                'statement_date': lines[0]['transaction_date'] if lines else date.today(),
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
