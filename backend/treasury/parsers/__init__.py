"""
Bank Statement Parsers
=======================

Módulo extensible para parsear cartolas bancarios de diferentes formatos.
"""

from .base import BaseParser
from .chile import BancoChileParser
from .csv_parser import GenericCSVParser
from .excel_parser import GenericExcelParser
from .santander import SantanderParser

__all__ = [
    "BaseParser",
    "GenericCSVParser",
    "GenericExcelParser",
    "BancoChileParser",
    "SantanderParser",
]
