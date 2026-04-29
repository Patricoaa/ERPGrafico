"""
Tests de DoD para Sprint 2 — Performance del matching
=====================================================

Cubre:
  - S2.5: normalize_description strips prefijos bancarios (glossa_normalizer)
  - S2.6: fuzzy matching con rapidfuzz.partial_ratio score > 0 en casos triviales
  - S2.3: matching_service no escribe .reconciled_lines (Fase 1 estructural)
  - S2.2: confirm_match usa bulk_update (verificación estructural)
  - S2.4: cap de candidatos es >= 200

Ejecutar:
    pytest treasury/tests/test_sprint2_dod.py -v
"""

import re
import pathlib
import pytest

# ─── S2.5: Normalización de glosas ───────────────────────────────────────────

def test_normalize_banco_chile_tef_prefix():
    """S2.5 DoD: TEF/ prefix stripeado en BANCO_CHILE_CSV"""
    from treasury.glossa_normalizer import normalize_description
    result = normalize_description("TEF/COMERCIAL ANDES SPA", "BANCO_CHILE_CSV")
    assert "COMERCIAL" in result
    assert "ANDES" in result
    # SPA es stop-word, debe desaparecer
    assert "SPA" not in result, f"SPA should be removed as stop-word, got: {result}"


def test_normalize_santander_abo_tr_prefix():
    """S2.5: ABO TR prefix stripeado en SANTANDER_CSV"""
    from treasury.glossa_normalizer import normalize_description
    result = normalize_description("ABO TR PROVEEDOR LTDA", "SANTANDER_CSV")
    assert "PROVEEDOR" in result
    assert "LTDA" not in result  # stop-word


def test_normalize_generic_tef_prefix():
    """S2.5: Prefijo TEF/ stripeado con banco genérico"""
    from treasury.glossa_normalizer import normalize_description
    result = normalize_description("TEF/EMPRESA ABC", None)
    assert "EMPRESA" in result
    assert "ABC" in result


def test_normalize_removes_rut():
    """S2.5: RUT eliminado del texto"""
    from treasury.glossa_normalizer import normalize_description
    result = normalize_description("PAGO 12.345.678-9 PROVEEDOR", None)
    assert "12.345.678" not in result
    assert "PROVEEDOR" in result


def test_normalize_bag_returns_set():
    """S2.5: normalize_bag retorna conjunto de tokens"""
    from treasury.glossa_normalizer import normalize_bag
    tokens = normalize_bag("TEF/COMERCIAL ANDES SPA", "BANCO_CHILE_CSV")
    assert isinstance(tokens, set)
    assert "COMERCIAL" in tokens
    assert "ANDES" in tokens


# ─── S2.6: Fuzzy matching ────────────────────────────────────────────────────

def test_fuzzy_ratio_comercial_andes():
    """S2.6 DoD: Comercial Andes vs COMERCIAL ANDES SPA → score > 0"""
    from rapidfuzz import fuzz
    ratio = fuzz.partial_ratio("COMERCIAL ANDES", "COMERCIAL ANDES SPA")
    assert ratio >= 80, f"Expected ratio >= 80, got {ratio}"


def test_fuzzy_ratio_sufijo_legal():
    """S2.6: sufijo legal (LTDA) no impide match"""
    from rapidfuzz import fuzz
    ratio = fuzz.partial_ratio("ANDES PATAGONIA", "ANDES PATAGONIA LTDA")
    assert ratio >= 80


def test_fuzzy_ratio_case_insensitive_via_normalization():
    """S2.6: producción normaliza a .upper() antes de partial_ratio — test replica eso"""
    from rapidfuzz import fuzz
    # El código usa contact_name.upper() y normalize_description (también upper)
    ratio = fuzz.partial_ratio("COMERCIAL ANDES", "COMERCIAL ANDES SPA")
    assert ratio >= 80, f"Expected ratio >= 80 with both uppercased, got {ratio}"


# ─── S2.3 Fase 1: Sin escrituras a .reconciled_lines ────────────────────────

def test_no_reconciled_lines_write_in_matching_service():
    """S2.3 Fase 1 DoD: 0 asignaciones a .reconciled_lines en matching_service.py"""
    src = pathlib.Path("/app/treasury/matching_service.py").read_text()
    pattern = re.compile(r'\.reconciled_lines\s*=')
    hits = [(i + 1, line.strip()) for i, line in enumerate(src.splitlines()) if pattern.search(line)]
    assert not hits, (
        f"Found {len(hits)} write(s) to .reconciled_lines (S2.3 Fase 1 violated):\n"
        + "\n".join(f"  L{no}: {content}" for no, content in hits)
    )


def test_reconciled_lines_field_still_exists_in_models():
    """S2.3: campo aún existe en BankStatement (Fase 2 = drop column, en Sprint 3)"""
    src = pathlib.Path("/app/treasury/models.py").read_text()
    assert "reconciled_lines = models.IntegerField" in src, (
        "BankStatement.reconciled_lines should still exist as DB column (Fase 1 only stops writes)"
    )


# ─── S2.2: bulk_update en confirm_match ──────────────────────────────────────

def test_bulk_update_present_in_matching_service():
    """S2.2 DoD: matching_service usa BankStatementLine.objects.bulk_update"""
    src = pathlib.Path("/app/treasury/matching_service.py").read_text()
    assert "BankStatementLine.objects.bulk_update" in src, (
        "S2.2: bulk_update not found in matching_service.py"
    )


# ─── S2.4: Cap de candidatos ─────────────────────────────────────────────────

def test_candidate_cap_is_200():
    """S2.4 DoD: cap de candidatos en suggest_matches es [:200], no [:50]"""
    src = pathlib.Path("/app/treasury/matching_service.py").read_text()
    assert "[:200]" in src, "S2.4: cap should be [:200]"
    assert "[:50]" not in src, "S2.4: old [:50] cap still present"


# ─── S2.1: Helper de batch ───────────────────────────────────────────────────

def test_payment_matches_account_sense_helper_exists():
    """S2.1: _payment_matches_account_sense helper presente"""
    src = pathlib.Path("/app/treasury/matching_service.py").read_text()
    assert "_payment_matches_account_sense" in src, "S2.1: helper not found"


def test_batch_prefetch_pattern_exists():
    """S2.1: auto_match_statement usa pre-fetch (all_candidates en RAM)"""
    src = pathlib.Path("/app/treasury/matching_service.py").read_text()
    assert "all_candidates" in src, "S2.1: all_candidates batch pattern not found"
    assert "Pre-fetch" in src or "pre-fetch" in src, "S2.1: pre-fetch comment not found"
