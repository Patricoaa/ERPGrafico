"""
EntityPrefix — canonical enum of all ERP entity display prefixes.

This is the **single source of truth** for prefix strings used in display_id
properties, UniversalRegistry templates, frontend ENTITY_REGISTRY, and any
other surface that renders entity identifiers.

Every prefix must be defined here and only here.
Adding a new prefix requires:
  1. Add a member to this enum
  2. Use it in the model's display_id (or direct template in apps.py)
  3. Register it in UniversalRegistry (apps.py)
  4. Add to frontend ENTITY_REGISTRY (via API consumption)
"""

from __future__ import annotations

from enum import StrEnum


class EntityPrefix(StrEnum):
    """Canonical prefix strings for all ERP document entities."""

    # ── Sales ──────────────────────────────────────────────────────────
    SALE_ORDER = "NV"
    SALE_DELIVERY = "DES"
    SALE_RETURN = "DEV"

    # ── Purchasing ─────────────────────────────────────────────────────
    PURCHASE_ORDER = "OCS"
    PURCHASE_RECEIPT = "REC"
    PURCHASE_RETURN = "DEV"

    # ── Billing / DTE ──────────────────────────────────────────────────
    INVOICE_FACTURA = "FACV"
    INVOICE_EXENTA = "FAC-EX"
    INVOICE_BOLETA = "BOL"
    INVOICE_BOLETA_EXENTA = "BE"
    INVOICE_COMPRA = "FACC"
    NOTA_CREDITO = "NC"
    NOTA_DEBITO = "ND"
    COMPROBANTE_PAGO = "CPE"
    GUIA_DESPACHO_DTE = "GUI"

    # ── Production ─────────────────────────────────────────────────────
    WORK_ORDER = "OT"
    BOM = "BOM"

    # ── Inventory ──────────────────────────────────────────────────────
    STOCK_MOVE = "MOV"
    PRODUCT = "PRD"
    CATEGORY = "CAT"
    SUBSCRIPTION = "SUB"
    PRICING_RULE = "REG"
    CUSTOM_FIELD = "CF"

    # ── Treasury ───────────────────────────────────────────────────────
    TREASURY_MOVEMENT = "TES"
    BANK_STATEMENT = "CAR"
    CHECK = "CHQ"
    BANK_LOAN = "CRE"
    CREDIT_LINE = "CL"
    LOAN_INSTALLMENT = "CUO"
    CREDIT_CARD_STMT = "EST"
    CARD_PURCHASE_GROUP = "CPG"
    CARD_PENDING_CHARGE = "CHG"
    TERMINAL_BATCH = "LOT"
    TRANSFER = "TRF"

    # ── Accounting ─────────────────────────────────────────────────────
    JOURNAL_ENTRY = "AS"
    FISCAL_YEAR = "EJ"
    BUDGET = "BUD"

    # ── HR ─────────────────────────────────────────────────────────────
    EMPLOYEE = "EMP"
    PAYROLL = "LIQ"
    ABSENCE = "AUS"
    SALARY_ADVANCE = "ANT"
    PAYROLL_CONCEPT = "CON-LIQ"

    # ── Contacts ───────────────────────────────────────────────────────
    CONTACT = "CON"
    PARTNER_TRANSACTION = "PT"
    PROFIT_DISTRIBUTION = "DIST"

    # ── Core ───────────────────────────────────────────────────────────
    USER = "USR"

    # ── POS ────────────────────────────────────────────────────────────
    POS_SESSION = "POS"
    POS_TERMINAL = "POS-C"

    # ── Tax ────────────────────────────────────────────────────────────
    F29_DECLARATION = "F29"
    ACCOUNTING_PERIOD = "PER"
    TAX_PERIOD = "IMP"

    # ── Workflow ───────────────────────────────────────────────────────
    TASK = "TASK"

    # ── Finance ────────────────────────────────────────────────────────
    BANK_JOURNAL = "BJ"
    PAYMENT = "PAY"

    @classmethod
    def as_dict(cls) -> dict[str, str]:
        """Returns {member_name: prefix_value} for API serialization."""
        return {member.name: member.value for member in cls}
