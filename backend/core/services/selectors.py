from core.models import ActionLog


class CoreSelector:
    @staticmethod
    def get_background_jobs_for_user(user):
        from core.models import BackgroundJob

        qs = BackgroundJob.objects.all()
        if not user.is_superuser:
            qs = qs.filter(user=user)
        return qs

    @staticmethod
    def get_global_audit_log(limit, category=None):
        # --- contacts ---
        from contacts.models import Contact

        # --- accounting ---
        from accounting.models import Account, FiscalYear

        # --- inventory ---
        from inventory.models import (
            InventoryCount,
            InventoryCountLine,
            InventoryDocument,
            PricingRule,
            Product,
            ProductAttribute,
            ProductAttributeValue,
            ProductCategory,
            StockMove,
            UoM,
            UoMCategory,
            Warehouse,
        )

        # --- production ---
        from production.models import WorkOrder

        # --- treasury ---
        from treasury.models import (
            Bank,
            BankLoan,
            BankStatement,
            BankStatementLine,
            Check,
            CreditCardStatement,
            LoanInstallment,
            PaymentAllocation,
            PaymentMethod,
            PaymentTerminalDevice,
            PaymentTerminalProvider,
            POSSession,
            POSTerminal,
            ReconciliationMatch,
            ReconciliationSettings,
            TerminalBatch,
            TreasuryAccount,
            TreasuryMovement,
        )

        # --- hr ---
        from hr.models import Absence, Employee, Payroll

        # --- tax ---
        from tax.models import F29Declaration

        from core.serializers import ActionLogSerializer, HistoricalRecordSerializer

        _SECURITY_TYPES = frozenset({"LOGIN", "LOGOUT", "SECURITY"})
        _TECHNICAL_TYPES = frozenset({"OTHER", "TECHNICAL"})
        _BUSINESS_TYPES = frozenset({"EXPORT", "PRINT", "BUSINESS"})

        def _action_category(action_type):
            if action_type in _SECURITY_TYPES:
                return "security"
            if action_type in _TECHNICAL_TYPES:
                return "technical"
            if action_type in _BUSINESS_TYPES:
                return "business"
            return "config"

        logs = ActionLogSerializer(ActionLog.objects.all()[:limit], many=True).data

        models = [
            # contacts
            (Contact, "contact", "Contacto"),
            # accounting
            (Account, "account", "Cuenta Contable"),
            (FiscalYear, "fiscal_year", "Ejercicio Fiscal"),
            # inventory
            (Product, "product", "Producto"),
            (ProductCategory, "product_category", "Categoría de Producto"),
            (UoMCategory, "uom_category", "Categoría de U. de Medida"),
            (UoM, "uom", "Unidad de Medida"),
            (ProductAttribute, "product_attribute", "Atributo de Producto"),
            (ProductAttributeValue, "product_attribute_value", "Valor de Atributo"),
            (Warehouse, "warehouse", "Bodega"),
            (StockMove, "stock_move", "Movimiento de Stock"),
            (InventoryDocument, "inventory_document", "Documento de Inventario"),
            (PricingRule, "pricing_rule", "Regla de Precios"),
            (InventoryCount, "inventory_count", "Conteo de Inventario"),
            (InventoryCountLine, "inventory_count_line", "Línea de Conteo"),
            # production
            (WorkOrder, "work_order", "Orden de Trabajo"),
            # treasury
            (TreasuryMovement, "treasury_movement", "Movimiento de Tesorería"),
            (TreasuryAccount, "treasury_account", "Cuenta de Tesorería"),
            (ReconciliationMatch, "reconciliation_match", "Conciliación Bancaria"),
            (BankStatement, "bank_statement", "Extracto Bancario"),
            (BankStatementLine, "bank_statement_line", "Línea de Extracto"),
            (Bank, "bank", "Banco"),
            (POSTerminal, "pos_terminal", "Terminal POS"),
            (POSSession, "pos_session", "Sesión POS"),
            (TerminalBatch, "terminal_batch", "Lote de Terminal"),
            (PaymentAllocation, "payment_allocation", "Imputación de Pago"),
            (PaymentMethod, "payment_method", "Método de Pago"),
            (PaymentTerminalProvider, "payment_terminal_provider", "Proveedor de Terminal"),
            (PaymentTerminalDevice, "payment_terminal_device", "Dispositivo Terminal"),
            (Check, "check", "Cheque"),
            (BankLoan, "bank_loan", "Préstamo Bancario"),
            (LoanInstallment, "loan_installment", "Cuota de Préstamo"),
            (CreditCardStatement, "credit_card_statement", "Resumen de Tarjeta"),
            (ReconciliationSettings, "reconciliation_settings", "Config. Conciliación"),
            # hr
            (Employee, "employee", "Empleado"),
            (Payroll, "payroll", "Liquidación de Sueldo"),
            (Absence, "absence", "Ausencia"),
            # tax
            (F29Declaration, "f29_declaration", "Declaración F29"),
        ]

        # Build a slug → human label map from the models list (used to enrich action_logs)
        _entity_label_map: dict[str, str] = {t_slug: t_lbl for _, t_slug, t_lbl in models}
        # Fallback labels for system-level entity types
        _entity_label_map.update({"system": None, "user": "Usuario", "group": "Rol/Grupo"})

        # Enrich action_log entries with category and entity_label
        for log in logs:
            cat = _action_category(log["action_type"])
            e_type = log.get("entity_type") or "system"
            e_label = _entity_label_map.get(e_type)  # None for "system"
            log.update(
                {
                    "source": "action_log",
                    "entity_type": e_type,
                    "entity_id": log.get("entity_id"),
                    "entity_label": e_label,
                    "date": log["timestamp"],
                    "type_label": log["action_type_display"],
                    "category": cat,
                }
            )

        # Identifier fields tried in order to build a human-readable description
        _id_fields = ["number", "name", "code", "year", "internal_code", "display_id", "id"]

        all_hist = []
        for m, t_slug, t_lbl in models:
            if not hasattr(m, "history"):
                continue
            for r in HistoricalRecordSerializer(m.history.all()[:limit], many=True).data:
                verb = (
                    "creó"
                    if r["history_type"] == "+"
                    else "editó"
                    if r["history_type"] == "~"
                    else "eliminó"
                )
                obj_name = str(
                    next((r.get(f) for f in _id_fields if r.get(f)), "")
                )
                r.update(
                    {
                        "source": "history",
                        "entity_type": t_slug,
                        "entity_label": t_lbl,
                        "entity_id": r.get("id"),
                        "date": r["history_date"],
                        "description": f"{verb.capitalize()} {t_lbl.lower()} {obj_name}".strip(),
                        "user_name": r["history_user_username"],
                        "category": "business",
                    }
                )
                all_hist.append(r)

        combined = logs + all_hist
        combined.sort(key=lambda x: x["date"], reverse=True)
        if category:
            combined = [e for e in combined if e.get("category") == category]
        return combined[:limit]
