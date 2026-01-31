"""
Bank Statement Parsers
=======================

Módulo extensible para parsear extractos bancarios de diferentes formatos.
"""

from .base import BaseParser
from .csv_parser import GenericCSVParser

__all__ = ['BaseParser', 'GenericCSVParser']
