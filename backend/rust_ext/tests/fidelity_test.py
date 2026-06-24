"""
Fidelity test: Compare Rust erpgrafico_rs output against equivalent Python logic.
This ensures the Rust port produces identical results to the original Python code.
"""
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Pure Python reference implementation (from matching_service.py) ────────

import re


def py_normalize_description(text, bank_format=None):
    """Mirrors glossa_normalizer.normalize_description"""
    if not text:
        return ""

    _PREFIXES_BY_FORMAT = {
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
        "BICE_CSV": [r"^TEF EFEC\s+", r"^TEF\s+EFEC\s+", r"^OAB\s+", r"^CARGOS\s+"],
        "BCI_CSV": [
            r"^TRANSFERENCIA\s+ELECTRÓNICA\s+",
            r"^TE\s+",
            r"^ABONO\s+TRANSFERENCIA\s+",
        ],
        "SCOTIABANK_CSV": [r"^TEF\s+", r"^TRANS\s+", r"^ABONO\s+"],
        "ITAU_CSV": [r"^TRF\s+", r"^TRANSF\s+", r"^PAG\s+"],
        "ESTADO_CSV": [r"^DEPOSITO\s+", r"^DEP\s+", r"^PAGO\s+", r"^TEF\s+"],
    }

    _GENERIC_PREFIXES = [
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

    _STOP_WORDS = {
        "DE", "LA", "EL", "LOS", "LAS", "DEL", "AL", "CON", "POR",
        "SPA", "LTDA", "SA", "SRL", "EIRL", "S.A.", "LTDA.",
        "CL", "RUT", "RUN", "TEF", "TRF", "TRANS",
    }

    normalized = text.strip().upper()

    if bank_format and bank_format in _PREFIXES_BY_FORMAT:
        for pattern in _PREFIXES_BY_FORMAT[bank_format]:
            normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()

    for pattern in _GENERIC_PREFIXES:
        normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()

    normalized = re.sub(r"[\(\[\{][^\)\]\}]*[\)\]\}]", "", normalized).strip()
    normalized = re.sub(r"\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b", "", normalized).strip()

    tokens = normalized.split()
    tokens = [t for t in tokens if t not in _STOP_WORDS and len(t) >= 2]

    return " ".join(tokens)


def py_calculate_match_score(line, payment, settings):
    """Pure Python version of _calculate_match_score"""
    total_weight = settings["amountWeight"] + settings["dateWeight"] + settings["referenceWeight"] + settings["contactWeight"]
    if total_weight == 0:
        total_weight = 100

    reasons = []
    line_amount = round(abs(line["credit"] - line["debit"]), 2)
    payment_amount = round(abs(payment["amount"]), 2)
    difference = line_amount - payment_amount

    # 1. Amount Match
    amount_score = 0
    if line_amount == payment_amount:
        amount_score = 100
        reasons.append("exact_amount")
    elif abs(difference) <= payment_amount * 0.05:
        amount_score = 50
        reasons.append("similar_amount")

    # 2. Date Match
    date_score = 0
    from datetime import datetime
    line_dt = datetime.strptime(line["transactionDate"][:10], "%Y-%m-%d").date()
    pay_dt = datetime.strptime(payment["date"][:10], "%Y-%m-%d").date()
    date_diff = abs((line_dt - pay_dt).days)
    if date_diff == 0:
        date_score = 100
        reasons.append("exact_date")
    elif date_diff <= 1:
        date_score = 80
        reasons.append("date_1day")
    elif date_diff <= 3:
        date_score = 50
        reasons.append("date_3days")
    elif date_diff <= 7:
        date_score = 20
        reasons.append("date_week")

    # 3. Reference/ID Match
    ref_score = 0
    if line.get("transactionId") and payment.get("transactionNumber"):
        l_id = line["transactionId"].strip().upper()
        p_id = payment["transactionNumber"].strip().upper()
        if l_id == p_id:
            ref_score = 100
            reasons.append("exact_id_match")
        elif l_id in p_id or p_id in l_id:
            ref_score = 60
            reasons.append("partial_id_match")

    if ref_score < 80 and line.get("reference") and payment.get("transactionNumber"):
        l_ref = line["reference"].strip().upper()
        p_id = payment["transactionNumber"].strip().upper()
        if l_ref == p_id:
            ref_score = 80
            reasons.append("exact_ref_match")
        elif l_ref in p_id or p_id in l_ref:
            ref_score = 50
            reasons.append("partial_ref_match")

    # 4. Description/Contact match (fuzzy)
    contact_score = 0
    if payment.get("contactName"):
        contact_name = payment["contactName"].upper()
        bank_format = line.get("bankFormat")
        normalized_description = py_normalize_description(line.get("description", ""), bank_format)

        # Use rapidfuzz if available, else substring
        try:
            from rapidfuzz import fuzz as _fuzz
            ratio = _fuzz.partial_ratio(contact_name, normalized_description)
            if ratio >= 70:
                contact_score = ratio
                reasons.append("contact_name_match" if ratio == 100 else "contact_fuzzy_match")
        except ImportError:
            if contact_name in normalized_description:
                contact_score = 100
                reasons.append("contact_name_match")

    # Final Weighted Score
    final_score = (
        (amount_score * settings["amountWeight"]) +
        (date_score * settings["dateWeight"]) +
        (ref_score * settings["referenceWeight"]) +
        (contact_score * settings["contactWeight"])
    ) / total_weight

    return {
        "score": round(final_score, 2),
        "reasons": reasons,
        "difference": difference,
    }


# ── Test cases ────────────────────────────────────────────────────────────

TEST_CASES = [
    {
        "name": "exact_match_all_dimensions",
        "line": {"id": 1, "credit": 1000.0, "debit": 0.0, "transactionDate": "2024-01-15",
                 "transactionId": "REF001", "reference": "REF001",
                 "description": "TEF/COMERCIAL ANDES SPA", "bankFormat": "BANCO_CHILE_CSV"},
        "payment": {"id": 1, "amount": 1000.0, "date": "2024-01-15",
                    "transactionNumber": "REF001", "contactName": "COMERCIAL ANDES"},
        "settings": {"amountWeight": 35.0, "dateWeight": 25.0, "referenceWeight": 25.0, "contactWeight": 15.0},
    },
    {
        "name": "partial_match_similar_amount",
        "line": {"id": 2, "credit": 1050.0, "debit": 0.0, "transactionDate": "2024-01-15",
                 "transactionId": None, "reference": None,
                 "description": "PAGO SUMINISTROS ELECTRICOS SA", "bankFormat": "BANCO_CHILE_CSV"},
        "payment": {"id": 2, "amount": 1000.0, "date": "2024-01-14",
                    "transactionNumber": None, "contactName": "SUMINISTROS ELECTRICOS"},
        "settings": {"amountWeight": 35.0, "dateWeight": 25.0, "referenceWeight": 25.0, "contactWeight": 15.0},
    },
    {
        "name": "no_match_different_data",
        "line": {"id": 3, "credit": 50000.0, "debit": 0.0, "transactionDate": "2024-06-01",
                 "transactionId": "TXN001", "reference": None,
                 "description": "HONORARIOS PROFESIONALES", "bankFormat": None},
        "payment": {"id": 3, "amount": 1500.0, "date": "2024-03-15",
                    "transactionNumber": "TXN999", "contactName": None},
        "settings": {"amountWeight": 35.0, "dateWeight": 25.0, "referenceWeight": 25.0, "contactWeight": 15.0},
    },
    {
        "name": "batch_multiple_lines_payments",
        "lines": [
            {"id": 10, "credit": 250000.0, "debit": 0.0, "transactionDate": "2024-02-01",
             "transactionId": "FAC001", "reference": None,
             "description": "ABONO CLIENTE ABC LTDA", "bankFormat": "SANTANDER_CSV"},
            {"id": 11, "credit": 0.0, "debit": 180000.0, "transactionDate": "2024-02-03",
             "transactionId": "CHQ-100", "reference": "CHQ-100",
             "description": "PAGO PROVEEDOR XYZ SA", "bankFormat": "SANTANDER_CSV"},
        ],
        "payments": [
            {"id": 10, "amount": 250000.0, "date": "2024-02-01",
             "transactionNumber": "FAC001", "contactName": "CLIENTE ABC"},
            {"id": 11, "amount": 180000.0, "date": "2024-02-03",
             "transactionNumber": "CHQ-100", "contactName": "XYZ SA"},
        ],
        "settings": {"amountWeight": 30.0, "dateWeight": 20.0, "referenceWeight": 30.0, "contactWeight": 20.0},
    },
    {
        "name": "overdue_date_far_range",
        "line": {"id": 4, "credit": 5000.0, "debit": 0.0, "transactionDate": "2024-01-01",
                 "transactionId": None, "reference": None,
                 "description": "TRANSFERENCIA ELECTRONICA MENSUAL", "bankFormat": "BCI_CSV"},
        "payment": {"id": 4, "amount": 5000.0, "date": "2024-06-15",
                    "transactionNumber": None, "contactName": None},
        "settings": {"amountWeight": 40.0, "dateWeight": 30.0, "referenceWeight": 15.0, "contactWeight": 15.0},
    },
]


def run_tests():
    import erpgrafico_rs

    passed = 0
    failed = 0
    tolerance = 0.01  # 0.01% tolerance for float comparison

    for tc in TEST_CASES:
        name = tc["name"]
        settings = tc["settings"]

        if "lines" in tc:
            # Batch test: multiple lines x payments
            lines = tc["lines"]
            payments = tc["payments"]
            lines_json = json.dumps(lines)
            payments_json = json.dumps(payments)
            settings_json = json.dumps(settings)

            rs_result = json.loads(erpgrafico_rs.batch_match_scores(lines_json, payments_json, settings_json))

            idx = 0
            for li, line in enumerate(lines):
                for pi, payment in enumerate(payments):
                    py_out = py_calculate_match_score(line, payment, settings)
                    rs_out = rs_result[idx]

                    score_ok = abs(rs_out["score"] - py_out["score"]) <= tolerance
                    diff_ok = abs(rs_out["difference"] - py_out["difference"]) <= tolerance
                    reasons_ok = set(rs_out["reasons"]) == set(py_out["reasons"])

                    status = "PASS" if (score_ok and diff_ok and reasons_ok) else "FAIL"
                    if status == "PASS":
                        passed += 1
                    else:
                        failed += 1
                        print(f"  [{status}] {name} L{li}P{pi}")
                        print(f"    RS:   score={rs_out['score']:.2f} diff={rs_out['difference']:.2f} reasons={rs_out['reasons']}")
                        print(f"    PY:   score={py_out['score']:.2f} diff={py_out['difference']:.2f} reasons={py_out['reasons']}")
                    idx += 1
        else:
            # Single test
            line = tc["line"]
            payment = tc["payment"]

            lines_json = json.dumps([line])
            payments_json = json.dumps([payment])
            settings_json = json.dumps(settings)

            rs_raw = erpgrafico_rs.batch_match_scores(lines_json, payments_json, settings_json)
            rs_result = json.loads(rs_raw)[0]
            py_out = py_calculate_match_score(line, payment, settings)

            score_ok = abs(rs_result["score"] - py_out["score"]) <= tolerance
            diff_ok = abs(rs_result["difference"] - py_out["difference"]) <= tolerance
            reasons_ok = set(rs_result["reasons"]) == set(py_out["reasons"])

            status = "PASS" if (score_ok and diff_ok and reasons_ok) else "FAIL"
            if status == "PASS":
                passed += 1
            else:
                failed += 1

            print(f"  [{status}] {name}")
            if status == "FAIL":
                print(f"    RS:   score={rs_result['score']:.2f} diff={rs_result['difference']:.2f} reasons={rs_result['reasons']}")
                print(f"    PY:   score={py_out['score']:.2f} diff={py_out['difference']:.2f} reasons={py_out['reasons']}")

    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# ── Normalizer test ────────────────────────────────────────────────────────

def test_normalizer():
    import erpgrafico_rs

    cases = [
        ("TEF/COMERCIAL ANDES SPA", "BANCO_CHILE_CSV", "COMERCIAL ANDES"),
        ("ABO TR COMERCIAL ANDES SPA", "SANTANDER_CSV", "COMERCIAL ANDES"),
        ("PAGO DE FACTURA SPA", None, "FACTURA"),
        ("", "BANCO_CHILE_CSV", ""),
        ("DEPOSITO CLIENTE ABC LTDA", "ESTADO_CSV", "CLIENTE ABC"),
        ("TRANSFERENCIA ELECTRÓNICA MENSUAL", None, "MENSUAL"),
    ]

    for text, fmt, expected in cases:
        rs_result = erpgrafico_rs.normalize_description(text, fmt)
        py_result = py_normalize_description(text, fmt)
        status = "PASS" if rs_result == py_result == expected else "FAIL"
        if status == "FAIL":
            print(f"  [{status}] normalize({text!r}, {fmt!r}): RS={rs_result!r} PY={py_result!r} expected={expected!r}")

    print("  Normalizer fidelity check done")


if __name__ == "__main__":
    print("Running fidelity tests...")
    test_normalizer()
    success = run_tests()
    sys.exit(0 if success else 1)
