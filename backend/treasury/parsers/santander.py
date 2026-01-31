from typing import Dict, Any, List
from decimal import Decimal
import pandas as pd
from datetime import datetime
from .base import BaseParser

class SantanderParser(BaseParser):
    """
    Parser para Cartola Movimientos Santander (Excel).
    
    Formato esperado:
    - Archivo .xls o .xlsx
    - Columnas típicas: ['Fecha', 'Oficina', 'Descripción', 'Nº Documento', 'Cargos', 'Abonos', 'Saldo']
    """
    
    def validate_format(self, file) -> bool:
        # Validar extensión y firma básica
        if not (file.name.endswith('.xls') or file.name.endswith('.xlsx')):
            return False
            
        try:
            # Leer primeras filas para detectar keywords
            # Engine 'openpyxl' es para xlsx, 'xlrd' para xls antiguo. Pandas abstrae esto si están instalados.
            # Santander suele usar .xls pero a veces es HTML/XML renameado. Asumiremos Excel real por ahora.
            file.seek(0)
            df = pd.read_excel(file, nrows=20)
            
            # Convertir todo a string para buscar
            content = df.to_string().upper()
            
            keywords = ['SANTANDER', 'CARTOLA', 'MOVIMIENTOS']
            has_keywords = any(k in content for k in keywords)
            
            col_keywords = ['FECHA', 'OFICINA', 'DESCRIPCION', 'CARGOS', 'ABONOS', 'SALDO']
            has_cols = all(k in content for k in col_keywords)
            
            return has_keywords or has_cols
        except Exception:
            return False

    def parse(self, file) -> Dict[str, Any]:
        file.seek(0)
        
        try:
            # Santander suele tener encabezados en fila variable (ej: fila 10)
            # Leemos las primeras 20 filas para encontrar la que contiene "Fecha" y "Descripción"
            header_row = 0
            df_preview = pd.read_excel(file, nrows=20)
            
            for i, row in df_preview.iterrows():
                row_str = " ".join([str(x) for x in row.values]).upper()
                if "FECHA" in row_str and "DESCRIPCI" in row_str:
                    header_row = i + 1 # +1 porque el header es la siguiente fila en read_excel index
                    break
            
            # Si no encontramos header en first 20 rows, probamos row 0 por defecto
            if header_row == 0:
                # Fallback, tal vez está en la primera
                 pass
            
            file.seek(0)
            df = pd.read_excel(file, skiprows=header_row)
            
            # Normalizar columnas
            df.columns = [str(c).strip().upper() for c in df.columns]
            
            # Mapeo
            col_map = {
                'FECHA': 'transaction_date',
                'DESCRIPCI': 'description',
                'DOCUMENTO': 'reference',
                'CARGOS': 'debit',
                'ABONOS': 'credit',
                'SALDO': 'balance'
            }
            
            mapped_cols = {}
            for file_col in df.columns:
                for key, val in col_map.items():
                    if key in file_col:
                        mapped_cols[val] = file_col
                        break
            
            # Validar columnas mínimas
            required = ['transaction_date', 'description', 'debit', 'credit', 'balance']
            if not all(r in mapped_cols for r in required):
                 # Intentar buscar sin header row si falló
                 pass

            lines = []
            line_number = 1
            
            # Saldo inicial (mismo truco de cálculo inverso o metadata)
            # Santander a veces pone saldo inicial en una fila previa.
            # Por simplicidad, usaremos cálculo inverso.
            
            if df.empty:
                return {
                    'statement_date': datetime.now().date(),
                    'opening_balance': Decimal(0),
                    'closing_balance': Decimal(0),
                    'lines': [],
                    'metadata': {}
                }

            first_row = df.iloc[0]
            first_bal = self.normalize_amount(first_row[mapped_cols['balance']], decimal_separator='.')
            first_cred = self.normalize_amount(first_row[mapped_cols['credit']], decimal_separator='.')
            first_deb = self.normalize_amount(first_row[mapped_cols['debit']], decimal_separator='.')
            
            opening_balance = first_bal - first_cred + first_deb
            
            current_date = None
            
            for index, row in df.iterrows():
                # Validar fila válida (fecha no nula)
                if pd.isna(row[mapped_cols['transaction_date']]):
                    continue
                
                # Santander formato fecha suele ser DD/MM/AAAA
                date_val = self.normalize_date(row[mapped_cols['transaction_date']], date_format='%d/%m/%Y')
                if not date_val:
                    continue
                
                current_date = date_val
                
                # Montos: Santander usa punto para miles y coma para decimales en PDF, pero Excel sale numérico o string
                # Asumimos que pd.read_excel ya lo interpretó como numérico o que normalize_amount lo arregla.
                # OJO: Santander Excel a veces trae montos como strings "1.234,56"
                
                debit = self.normalize_amount(row[mapped_cols['debit']], decimal_separator=',')
                credit = self.normalize_amount(row[mapped_cols['credit']], decimal_separator=',')
                balance = self.normalize_amount(row[mapped_cols['balance']], decimal_separator=',')
                
                description = str(row[mapped_cols['description']]).strip()
                reference = str(row.get(mapped_cols.get('reference'), '')).strip()
                
                 # Limpiar referencia tipo "00000"
                if reference == '0' or reference == 'nan':
                    reference = ''

                line = {
                    'line_number': line_number,
                    'transaction_date': date_val,
                    'description': description,
                    'reference': reference,
                    'debit': abs(debit),
                    'credit': abs(credit),
                    'balance': balance,
                    'transaction_id': f"{date_val.strftime('%Y%m%d')}-{index}" # Generar ID simple
                }
                
                lines.append(line)
                line_number += 1
                
            return {
                'statement_date': lines[0]['transaction_date'] if lines else datetime.now().date(),
                'opening_balance': opening_balance,
                'closing_balance': lines[-1]['balance'] if lines else opening_balance,
                'lines': lines,
                'metadata': {
                    'bank': 'SANTANDER',
                    'original_filename': file.name
                }
            }
            
        except Exception as e:
            raise ValueError(f"Error parseando Santander: {str(e)}")
