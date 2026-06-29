from decimal import Decimal


class GlosaBuilder:
    """Centralized builder for journal entry descriptions and item labels.

    Uses each model's own ``display_id`` as the canonical document identifier,
    so any prefix change in a model is automatically reflected in glosas.

    **Entry description format (255 chars max)** ::

        ACCIÓN | DOCUMENTO | PARTNER | $MONTO | EXTRA

    **Item label format (255 chars max)** ::

        ROL: DETALLE (DOC_REF)

    If truncation is needed the *rightmost* parts are sacrificed first:
    extra → monto → partner → documento → acción.
    """

    SEP = " | "

    # ------------------------------------------------------------------
    # Entry-level glosa
    # ------------------------------------------------------------------
    @classmethod
    def build(
        cls,
        action: str,
        document: str = None,
        partner: str = None,
        amount: Decimal | int | float = None,
        extra: list[str] = None,
    ) -> str:
        """Build a journal entry description (glosa).

        Parameters
        ----------
        action:
            Standardised action verb, e.g. ``"Venta"``, ``"Compra"``,
            ``"Costo de Venta"``, ``"Recepción"``.
        document:
            Document identifier — always prefer ``obj.display_id``.
        partner:
            Contact, supplier, customer or partner name.
        amount:
            Monetary amount (will be formatted with thousand separators).
        extra:
            Extra contextual parts, e.g. ``["Período Ene-2026"]``.
        """
        parts = [action]
        if document:
            parts.append(document)
        if partner:
            parts.append(partner)
        if amount is not None:
            parts.append(cls._fmt_amount(amount))
        if extra:
            parts.extend(extra if isinstance(extra, list) else [extra])
        return cls._truncate(cls.SEP.join(parts), 255)

    @classmethod
    def build_reversal(cls, original_description: str, doc: str = None) -> str:
        """Build a description for a reversal entry."""
        if doc:
            return cls._truncate(f"Anulación {doc}: {original_description}", 255)
        return cls._truncate(f"REVERSO: {original_description}", 255)

    # ------------------------------------------------------------------
    # Item-level labels
    # ------------------------------------------------------------------
    @classmethod
    def item(cls, role: str, detail: str = "", doc_ref: str = None) -> str:
        """Build a journal item label.

        Parameters
        ----------
        role:
            Accounting role, e.g. ``"Cuenta por Cobrar"``, ``"IVA Débito"``,
            ``"Inventario"``, ``"Costo de Venta"``.
        detail:
            Specific detail — product code, partner name, concept, etc.
        doc_ref:
            Optional document reference to append in parentheses.
        """
        label = f"{role}: {detail}" if detail else role
        if doc_ref:
            label += f" ({doc_ref})"
        return cls._truncate(label, 255)

    @classmethod
    def item_reversal(cls, role: str, detail: str = "", doc_ref: str = None) -> str:
        """Build a journal item label for a reversal."""
        label = f"Anulación {role}"
        if detail:
            label += f": {detail}"
        if doc_ref:
            label += f" ({doc_ref})"
        return cls._truncate(label, 255)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    @classmethod
    def _fmt_amount(cls, amount: Decimal | int | float) -> str:
        try:
            integer_part = int(round(float(amount)))
            return f"${integer_part:,}".replace(",", ".")
        except (ValueError, TypeError):
            return str(amount)

    @classmethod
    def _truncate(cls, s: str, n: int) -> str:
        if len(s) <= n:
            return s
        return s[: n - 1] + "…"

    # ------------------------------------------------------------------
    # Standardised action constants  (to be used as ``action=``)
    # ------------------------------------------------------------------
    # -- Ventas / Facturación --
    VENTA = "Venta"
    NOTA_CREDITO = "Nota de Crédito"
    NOTA_DEBITO = "Nota de Débito"
    COSTO_DE_VENTA = "Costo de Venta"
    CONCILIACION_ANTICIPOS = "Conciliación Anticipos"
    ANULACION_FACTURA = "Anulación Factura"

    # -- Compras --
    COMPRA = "Compra"
    RECEPCION = "Recepción"
    DEVOLUCION = "Devolución"
    DEVOLUCION_FISICA = "Devolución Física"

    # -- Tesorería --
    INGRESO = "Ingreso"
    EGRESO = "Egreso"
    TRANSFERENCIA = "Transferencia"
    LIQUIDACION_TC = "Liquidación TC"
    CARGOS_FINANCIEROS = "Cargos Financieros"
    CARGOS_DIFERIDOS = "Cargos Diferidos TC"
    DESEMBOLSO = "Desembolso"
    PAGO_CUOTA = "Pago Cuota"
    DEVENGO_INTERESES = "Devengo Intereses"
    AJUSTE_BANCARIO = "Ajuste Bancario"
    TRASPASO_CONCILIACION = "Traspaso por Conciliación"

    # -- Socios / Patrimonio --
    SUSCRIPCION_CAPITAL = "Suscripción Capital"
    APORTE_CAPITAL = "Aporte Capital"
    REDUCCION_CAPITAL = "Reducción Capital"
    TRANSFERENCIA_CAPITAL = "Transferencia Capital"
    PAGO_DIVIDENDOS = "Pago Dividendos"
    RETIRO_PROVISORIO = "Retiro Provisorio"
    MOVILIZACION_RETENIDAS = "Movilización Retenidas"
    DISTRIBUCION_RESULTADOS = "Distribución Resultados"

    # -- RRHH --
    REMUNERACIONES = "Remuneraciones"
    PAGO_F29 = "Pago F29"

    # -- Castigos --
    CASTIGO = "Castigo"
    RECUPERACION_CASTIGO = "Recuperación Castigo"

    # -- Inventario / Producción --
    AJUSTE_STOCK = "Ajuste Stock"
    CONSUMO_PRODUCCION = "Consumo Producción"

    # -- Fiscal --
    APERTURA = "Apertura"
    CIERRE_ANUAL = "Cierre Anual"

    # -- Devoluciones de pago --
    DEVOLUCION_PAGO = "Devolución Pago"


class Roles:
    """Standardised accounting roles for item labels."""

    CXC = "Cuenta por Cobrar"
    CXP = "Cuenta por Pagar"
    INGRESO = "Ingreso"
    IVA_DEBITO = "IVA Débito"
    IVA_CREDITO = "IVA Crédito"
    IVA_CAPITALIZADO = "IVA Capitalizado"
    IVA_NO_RECUPERABLE = "IVA No Recuperable"
    COSTO_VENTA = "Costo de Venta"
    INVENTARIO = "Inventario"
    PUENTE_RECEPCION = "Puente Recepción"
    GASTO = "Gasto"
    CAPITAL_COBRAR = "Capital por Cobrar"
    CAPITAL_SOCIAL = "Capital Social"
    CAPITAL_EXCEDENTE = "Capital Excedente"
    DIVIDENDO_PAGAR = "Dividendo por Pagar"
    RETIRO_PROVISORIO = "Retiro Provisorio"
    RETENIDAS = "Utilidades Retenidas"
    REINVERSION = "Reinversión Capital"
    REMUNERACION_PAGAR = "Remuneración por Pagar"
    OBLIGACIONES_PREVIRED = "Obligaciones Previred"
    PERDIDA_INCOBRABLE = "Pérdida Incobrable"
    RECUPERACION_INCOBRABLE = "Recuperación Incobrable"
    COMISION = "Comisión"
    ANTICIPO = "Anticipo"
    INTERES = "Gasto Interés"
    SEGURO = "Gasto Seguro"
    PENALIZACION = "Penalización"
    BANCO = "Banco"
    EFECTIVO = "Efectivo"
    IVA_PAGAR = "IVA por Pagar"
    IVA_REMANENTE = "IVA Remanente"
    RESULTADO = "Resultado"
    PROVISION_PPM = "Provisión PPM"
    CIERRE_IVA = "Cierre IVA"
    CIERRE_RETENCIONES = "Cierre Retenciones"
    CONSUMO = "Consumo"
    COSTO_PRODUCCION = "Costo Producción"
    PASIVO_PRESTAMO = "Pasivo Préstamo"
    PASIVO_TC = "Pasivo TC"
    INTERES_PAGAR = "Interés por Pagar"
    APERTURA_CTA = "Apertura"
    CIERRE_CTA = "Cierre"
