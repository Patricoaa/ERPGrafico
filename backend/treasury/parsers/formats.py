"""
Bank Format Configurations
===========================

Configuraciones predefinidas para bancos chilenos.
"""

# Configuración genérica (template)
GENERIC_CSV = {
    "name": "CSV Genérico",
    "delimiter": ",",
    "decimal_separator": ".",
    "date_format": "%d-%m-%Y",
    "skip_rows": 0,
    "skip_footer_rows": 0,
    "encoding": "auto",
    "has_header": True,
    "columns": {
        "date": 0,
        "description": 1,
        "debit": 2,
        "credit": 3,
        "balance": 4,
        "reference": 5,
    },
    "balance_info": {}
}

# Banco de Chile
# Basado en formato común (ajustar cuando tengas ejemplo real)
BANCO_CHILE_CSV = {
    "name": "Banco de Chile - CSV",
    "delimiter": ";",
    "decimal_separator": ",",
    "date_format": "%d-%m-%Y",
    "skip_rows": 3,  # Típicamente tiene header info
    "skip_footer_rows": 1,
    "encoding": "iso-8859-1",
    "has_header": True,
    "columns": {
        "date": "Fecha",
        "description": "Descripción",
        "debit": "Cargo",
        "credit": "Abono", 
        "balance": "Saldo",
        "reference": "Referencia",
    },
    "balance_info": {}
}

# Scotiabank
SCOTIABANK_CSV = {
    "name": "Scotiabank - CSV",
    "delimiter": ",",
    "decimal_separator": ".",
    "date_format": "%d/%m/%Y",
    "skip_rows": 2,
    "skip_footer_rows": 0,
    "encoding": "utf-8",
    "has_header": True,
    "columns": {
        "date": "Fecha",
        "description": "Detalle",
        "debit": "Débito",
        "credit": "Crédito",
        "balance": "Saldo",
    },
    "balance_info": {}
}

# Banco Estado
BANCO_ESTADO_CSV = {
    "name": "Banco Estado - CSV",
    "delimiter": ";",
    "decimal_separator": ",",
    "date_format": "%d-%m-%Y",
    "skip_rows": 5,
    "skip_footer_rows": 2,
    "encoding": "iso-8859-1",
    "has_header": True,
    "columns": {
        "date": "Fecha Transacción",
        "description": "Glosa",
        "debit": "Débito",
        "credit": "Crédito",
        "balance": "Saldo",
        "reference": "N° Documento",
    },
    "balance_info": {
        "opening_balance_row": 2,
        "closing_balance_row": -3,  # Tercer fila desde el final
        "statement_date_row": 1
    }
}

# Mapeo de formatos
FORMAT_MAP = {
    'GENERIC_CSV': GENERIC_CSV,
    'GENERIC_EXCEL': {
        "name": "Excel Genérico (Configurable)",
        "delimiter": ";",
        "decimal_separator": ".",
        "date_format": "%d-%m-%Y",
        "skip_rows": 0,
        "skip_footer_rows": 0,
        "encoding": "utf-8",
        "has_header": True,
        "columns": {},
        "balance_info": {}
    },
    'BANCO_CHILE_CSV': BANCO_CHILE_CSV,
    'SANTANDER_XLS': {
        "name": "Santander - Excel",
        "delimiter": ";",  # Irrelevante para Excel pero requerido por schema
        "decimal_separator": ",",
        "date_format": "%d/%m/%Y",
        "skip_rows": 0,
        "skip_footer_rows": 0,
        "encoding": "utf-8",
        "has_header": True,
        "columns": {},
        "balance_info": {}
    },
    'SCOTIABANK_CSV': SCOTIABANK_CSV,
    'BANCO_ESTADO_CSV': BANCO_ESTADO_CSV,
}


def get_parser_config(format_name: str) -> dict:
    """
    Obtiene la configuración para un formato específico.
    
    Args:
        format_name: Nombre del formato (ej: 'BANCO_CHILE_CSV')
    
    Returns:
        Diccionario de configuración
    
    Raises:
        ValueError: Si el formato no existe
    """
    if format_name not in FORMAT_MAP:
        raise ValueError(f"Formato '{format_name}' no encontrado. Formatos disponibles: {list(FORMAT_MAP.keys())}")
    
    config = FORMAT_MAP[format_name].copy()
    config['format_id'] = format_name
    return config


def get_available_formats() -> dict:
    """
    Retorna todos los formatos disponibles con sus nombres descriptivos.
    
    Returns:
        Dict {format_id: format_name}
    """
    return {
        format_id: config['name']
        for format_id, config in FORMAT_MAP.items()
    }
