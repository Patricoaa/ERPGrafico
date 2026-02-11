from typing import Dict, Any, List
from decimal import Decimal
import pandas as pd
from datetime import datetime
from django.utils import timezone
from .base import BaseParser

class BancoChileParser(BaseParser):
    """
    Parser para Cartola de Movimientos Banco de Chile (CSV).
    
    Formato esperado:
    - Encabezado con información de cuenta en primeras líneas
    - Tabla de movimientos con columnas:
      ['Fecha', 'Descripción', 'Nº Documento', 'Cargo', 'Abono', 'Saldo']
    """
    
    def validate_format(self, file) -> bool:
        try:
            encoding = self.detect_encoding(file)
            file.seek(0)
            
            # Leer primeras 15 líneas para buscar encabezados típicos
            content = file.read(4096).decode(encoding)
            
            keywords = ['BANCO DE CHILE', 'CUENTA CORRIENTE', 'MOVIMIENTOS']
            has_keywords = any(k in content.upper() for k in keywords)
            
            col_keywords = ['FECHA', 'DESCRIPCION', 'DOCUMENTO', 'CARGO', 'ABONO', 'SALDO']
            has_cols = all(k in content.upper() for k in col_keywords)
            
            return has_keywords or has_cols
        except Exception:
            return False

    def parse(self, file) -> Dict[str, Any]:
        encoding = self.detect_encoding(file)
        file.seek(0)
        
        # Encontrar la fila de encabezado
        # Banco de Chile suele tener metadata arriba. Buscamos la fila que tiene 'Fecha'
        header_row = 0
        df = None
        
        try:
            # Iterar para encontrar header
            for i in range(20):
                file.seek(0)
                try:
                    temp_df = pd.read_csv(file, encoding=encoding, sep=';', skiprows=i, nrows=1)
                    if 'Fecha' in temp_df.columns or 'fecha' in temp_df.columns:
                        header_row = i
                        break
                    
                    # Probar con coma si punto y coma falla
                    file.seek(0)
                    temp_df = pd.read_csv(file, encoding=encoding, sep=',', skiprows=i, nrows=1)
                    if 'Fecha' in temp_df.columns or 'fecha' in temp_df.columns:
                        header_row = i
                        break
                except Exception:
                    continue
            
            file.seek(0)
            # Intentar leer con ;
            try:
                df = pd.read_csv(file, encoding=encoding, sep=';', skiprows=header_row)
            except:
                file.seek(0)
                df = pd.read_csv(file, encoding=encoding, sep=',', skiprows=header_row)
            
            # Normalizar nombres de columnas
            df.columns = [c.strip().lower() for c in df.columns]
            
            # Mapeo de columnas
            # Esperado: fecha, descripcion, n documento, cargo, abono, saldo
            col_map = {
                'fecha': 'transaction_date',
                'descripción': 'description',
                'descripcion': 'description',
                'nº documento': 'reference',
                'n documento': 'reference',
                'documento': 'reference',
                'cargo': 'debit',
                'abono': 'credit',
                'saldo': 'balance'
            }
            
            mapped_cols = {}
            for file_col in df.columns:
                for key, val in col_map.items():
                    if key in file_col:
                        mapped_cols[val] = file_col
                        break
            
            lines = []
            line_number = 1
            
            # TODO: Extraer saldo inicial de metadata o calcularlo inversa desde primer saldo
            first_balance = self.normalize_amount(df.iloc[0][mapped_cols['balance']])
            first_credit = self.normalize_amount(df.iloc[0].get(mapped_cols.get('credit'), 0))
            first_debit = self.normalize_amount(df.iloc[0].get(mapped_cols.get('debit'), 0))
            
            # Saldo Inicial = Saldo Final Línea 1 - (Abono - Cargo)
            # Balance[t] = Balance[t-1] + Credit[t] - Debit[t]
            # Balance[t-1] = Balance[t] - Credit[t] + Debit[t]
            opening_balance = first_balance - first_credit + first_debit
            
            for index, row in df.iterrows():
                # Ignorar filas vacías o de totales
                if pd.isna(row[mapped_cols['transaction_date']]):
                    continue
                    
                date_val = self.normalize_date(row[mapped_cols['transaction_date']])
                if not date_val:
                    continue
                    
                debit = self.normalize_amount(row.get(mapped_cols.get('debit'), 0))
                credit = self.normalize_amount(row.get(mapped_cols.get('credit'), 0))
                balance = self.normalize_amount(row.get(mapped_cols.get('balance'), 0))
                description = str(row[mapped_cols['description']]).strip()
                reference = str(row.get(mapped_cols.get('reference'), ''))
                
                # Extraer RUT si existe en descripción
                rut = self.extract_rut(description)
                if rut:
                    description += f" [RUT: {rut}]"

                line = {
                    'line_number': line_number,
                    'transaction_date': date_val,
                    'description': description,
                    'reference': reference.replace('.0', ''), # Limpiar float str
                    'debit': abs(debit),
                    'credit': abs(credit),
                    'balance': balance,
                    'raw_data': row.to_dict()
                }
                
                lines.append(line)
                line_number += 1
                
            return {
                'statement_date': lines[0]['transaction_date'] if lines else timezone.now().date(),
                'opening_balance': opening_balance,
                'closing_balance': lines[-1]['balance'] if lines else opening_balance,
                'lines': lines,
                'metadata': {
                    'bank': 'BANCO_CHILE',
                    'original_filename': file.name
                }
            }
            
        except Exception as e:
            raise ValueError(f"Error parseando archivo Banco de Chile: {str(e)}")
