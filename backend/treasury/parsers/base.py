"""
Base Parser for Bank Statements
=================================

Abstract class that defines the interface for all bank statement parsers.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import re


class BaseParser(ABC):
    """
    Clase base abstracta para parsers de extractos bancarios.
    
    Todos los parsers específicos deben heredar de esta clase e implementar
    los métodos mark como @abstractmethod.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Inicializa el parser con configuración opcional.
        
        Args:
            config: Diccionario con configuración específica del parser
        """
        self.config = config or {}
    
    @abstractmethod
    def parse(self, file) -> Dict[str, Any]:
        """
        Parsea el archivo de extracto bancario.
        
        Args:
            file: Archivo a parsear (Django UploadedFile o file-like object)
        
        Returns:
            Dict con estructura:
            {
                'statement_date': date,
                'opening_balance': Decimal,
                'closing_balance': Decimal,
                'lines': List[Dict[str, Any]],
                'metadata': Dict[str, Any]
            }
        
        Raises:
            ValueError: Si el formato no es válido
        """
        pass
    
    @abstractmethod
    def validate_format(self, file) -> bool:
        """
        Valida que el archivo sea del formato esperado.
        
        Args:
            file: Archivo a validar
        
        Returns:
            True si el formato es válido, False en caso contrario
        """
        pass
    
    def normalize_date(self, value: Any, date_format: str = '%d-%m-%Y') -> Optional[date]:
        """
        Normaliza un valor a objeto date.
        
        Soporta múltiples formatos:
        - DD-MM-YYYY
        - DD/MM/YYYY
        - YYYY-MM-DD
        - DD.MM.YYYY
        
        Args:
            value: Valor a normalizar (string, date, datetime)
            date_format: Formato primario a intentar
        
        Returns:
            Objeto date o None si falla
        """
        if isinstance(value, date):
            return value
        
        if isinstance(value, datetime):
            return value.date()
        
        if not value:
            return None
        
        value_str = str(value).strip()
        
        # Formatos comunes en Chile
        formats = [
            date_format,
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%Y-%m-%d',
            '%d.%m.%Y',
            '%d-%m-%y',
            '%d/%m/%y',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt).date()
            except (ValueError, TypeError):
                continue
        
        return None
    
    def normalize_amount(self, value: Any, decimal_separator: str = ',') -> Decimal:
        """
        Normaliza un valor a Decimal.
        
        Maneja:
        - Separadores de miles (. o ,)
        - Separadores decimales (, o .)
        - Signos de moneda ($)
        - Paréntesis para negativos
        
        Args:
            value: Valor a normalizar
            decimal_separator: Separador decimal usado (',' o '.')
        
        Returns:
            Decimal normalizado
        
        Raises:
            ValueError: Si el valor no puede ser convertido
        """
        if isinstance(value, (Decimal, int, float)):
            return Decimal(str(value))
        
        if not value:
            return Decimal('0')
        
        value_str = str(value).strip()
        
        # Detectar si es negativo por paréntesis
        is_negative = value_str.startswith('(') and value_str.endswith(')')
        if is_negative:
            value_str = value_str[1:-1]
        
        # Remover símbolos de moneda y espacios
        value_str = re.sub(r'[$\s]', '', value_str)
        
        # Normalizar separadores según convención
        if decimal_separator == ',':
            # Formato europeo: 1.234.567,89
            value_str = value_str.replace('.', '')  # Remover separador de miles
            value_str = value_str.replace(',', '.')  # Cambiar separador decimal
        else:
            # Formato anglosajón: 1,234,567.89
            value_str = value_str.replace(',', '')  # Remover separador de miles
        
        try:
            amount = Decimal(value_str)
            return -amount if is_negative else amount
        except (InvalidOperation, ValueError) as e:
            raise ValueError(f"No se pudo convertir '{value}' a número: {e}")
    
    def detect_encoding(self, file) -> str:
        """
        Detecta el encoding del archivo.
        
        Args:
            file: Archivo a analizar
        
        Returns:
            Nombre del encoding detectado
        """
        try:
            import chardet
            
            # Leer primeros 10KB para detectar encoding
            file.seek(0)
            raw_data = file.read(10000)
            file.seek(0)
            
            result = chardet.detect(raw_data)
            return result['encoding'] or 'utf-8'
        except ImportError:
            # chardet no instalado, usar utf-8 por defecto
            return 'utf-8'
        except Exception:
            return 'utf-8'
    
    def extract_rut(self, text: str) -> Optional[str]:
        """
        Extrae RUT chileno de un texto.
        
        Args:
            text: Texto donde buscar el RUT
        
        Returns:
            RUT encontrado o None
        """
        if not text:
            return None
        
        # Patrón para RUT: XX.XXX.XXX-X o XXXXXXXX-X
        pattern = r'(\d{1,2}\.?\d{3}\.?\d{3}[-]?[0-9kK])'
        match = re.search(pattern, text)
        
        if match:
            rut = match.group(1)
            # Normalizar formato
            rut = rut.replace('.', '').replace('-', '')
            if len(rut) >= 2:
                return f"{rut[:-1]}-{rut[-1]}"
        
        return None
    
    def validate_balance_consistency(self, lines: List[Dict], opening_balance: Decimal) -> bool:
        """
        Valida que los balances sean consistentes.
        
        Verifica que cada línea tenga:
        balance_anterior + (credit - debit) = balance_nuevo
        
        Args:
            lines: Lista de líneas del extracto
            opening_balance: Balance de apertura
        
        Returns:
            True si los balances son consistentes
        """
        current_balance = opening_balance
        
        for line in lines:
            expected_balance = current_balance + line.get('credit', 0) - line.get('debit', 0)
            actual_balance = line.get('balance', 0)
            
            # Tolerancia de 0.01 para redondeos
            if abs(expected_balance - actual_balance) > Decimal('0.01'):
                return False
            
            current_balance = actual_balance
        
        return True
