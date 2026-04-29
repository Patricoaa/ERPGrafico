"""
Glossa Normalizer (S2.5)
========================

Normalización de descripciones de cartolas bancarias chilenas.
Cada banco antepone prefijos de ruido ("TEF/", "ABO TR ", "TRANSFERENCIA DE ", etc.)
que degradan el score de matching por descripción.

Este módulo:
  1. Strippea prefijos/sufijos conocidos por banco.
  2. Elimina stop-words bancarias genéricas.
  3. Retorna un string limpio normalizado (bag-of-words en mayúsculas).

DoD:
  normalize_description("TEF/COMERCIAL ANDES SPA", "BANCO_CHILE_CSV") → "COMERCIAL ANDES"
"""

import re
from typing import Optional


# ─── Prefijos a eliminar por banco ────────────────────────────────────────────
# Cada entrada es una lista de patterns a stripear (orden importa: más específicos primero)

_PREFIXES_BY_FORMAT: dict[str, list[str]] = {
    "BANCO_CHILE_CSV": [
        r"^TEF/",
        r"^TRANSF\.?\s*",
        r"^TRANSFERENCIA\s+DE\s+",
        r"^CARGO\s+",
        r"^ABONO\s+",
        r"^PAG\s+",
        r"^PAGO\s+",
    ],
    "SANTANDER_CSV": [
        r"^ABO TR\s+",
        r"^ABO\s+TR\s+",
        r"^CAR TR\s+",
        r"^CAR\s+TR\s+",
        r"^TRANS\s+",
        r"^TRF\s+",
        r"^TRFXINT\s+",
    ],
    "BICE_CSV": [
        r"^TEF EFEC\s+",
        r"^TEF\s+EFEC\s+",
        r"^OAB\s+",
        r"^CARGOS\s+",
    ],
    "BCI_CSV": [
        r"^TRANSFERENCIA\s+ELECTRÓNICA\s+",
        r"^TE\s+",
        r"^ABONO\s+TRANSFERENCIA\s+",
    ],
    "SCOTIABANK_CSV": [
        r"^TEF\s+",
        r"^TRANS\s+",
        r"^ABONO\s+",
    ],
    "ITAU_CSV": [
        r"^TRF\s+",
        r"^TRANSF\s+",
        r"^PAG\s+",
    ],
    "ESTADO_CSV": [
        r"^DEPOSITO\s+",
        r"^DEP\s+",
        r"^PAGO\s+",
        r"^TEF\s+",
    ],
}

# Prefijos genéricos aplicados a TODOS los bancos
_GENERIC_PREFIXES: list[str] = [
    r"^TRANSF(?:ERENCIA)?\s+(?:ELECTRÓNICA\s+)?",
    r"^TEF/?",
    r"^TRF/?",
    r"^PAGO\s+",
    r"^PAG\s+",
    r"^ABONO\s+",
    r"^CARGO\s+",
    r"^DEPOSITO\s+",
    r"^DEP\s+",
    r"^COM(?:ISIÓN)?\s+",
]

# Stop-words bancarias a eliminar después del prefijo
_STOP_WORDS: set[str] = {
    "DE", "LA", "EL", "LOS", "LAS", "DEL", "AL", "CON", "POR",
    "SPA", "LTDA", "SA", "SRL", "EIRL", "S.A.", "LTDA.",
    "CL", "RUT", "RUN",
    "TEF", "TRF", "TRANS",
}


def normalize_description(text: str, bank_format: Optional[str] = None) -> str:
    """
    Normaliza una descripción de cartola bancaria.

    Args:
        text: Descripción cruda del banco (ej: "TEF/COMERCIAL ANDES SPA")
        bank_format: Formato bancario (ej: "BANCO_CHILE_CSV"). Si es None,
                     solo aplica prefijos genéricos.

    Returns:
        Descripción normalizada en mayúsculas sin prefijos de ruido.
        Ej: "TEF/COMERCIAL ANDES SPA" → "COMERCIAL ANDES"
    """
    if not text:
        return ""

    normalized = text.strip().upper()

    # 1. Aplicar prefijos del banco específico
    if bank_format and bank_format in _PREFIXES_BY_FORMAT:
        for pattern in _PREFIXES_BY_FORMAT[bank_format]:
            normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()

    # 2. Aplicar prefijos genéricos (idem para bancos no mapeados)
    for pattern in _GENERIC_PREFIXES:
        normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()

    # 3. Eliminar contenido entre paréntesis/corchetes (ej: "(BANCO CHILE)")
    normalized = re.sub(r"[\(\[\{][^\)\]\}]*[\)\]\}]", "", normalized).strip()

    # 4. Eliminar números de RUT (ej: "12.345.678-9")
    normalized = re.sub(r"\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b", "", normalized).strip()

    # 5. Eliminar stop-words
    tokens = normalized.split()
    tokens = [t for t in tokens if t not in _STOP_WORDS and len(t) >= 2]

    return " ".join(tokens)


def normalize_bag(text: str, bank_format: Optional[str] = None) -> set[str]:
    """
    Retorna el conjunto de tokens del texto normalizado.
    Útil para Jaccard-similarity o intersección de palabras.
    """
    normalized = normalize_description(text, bank_format)
    return set(t for t in normalized.split() if len(t) >= 3)
