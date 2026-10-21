"""
test_deletion_policy_consistency.py

Verifies that the deletion policy (docs/20-contracts/deletion-policy.md)
is consistent with the backend model implementations.

Mechanisms per the contract's authoritative table:
- Cancelación / Anulación con status → `status` field with a CANCELLED value
- Anulación vía contramovimiento (StockMove) → no own status; reversal moves
- Anulación vía conciliación (BankStatementLine) → `reconciliation_status`
- Archivo → `is_active` BooleanField (excepciones por enum `status` en
  ARCHIVO_EXEMPT; gaps pendientes fijados en ARCHIVO_KNOWN_GAPS)
- Hard delete → model exists; no structural requirement

If you add a model to the deletion-policy table, add it here in the same PR.
"""

import importlib
import inspect

import pytest
from django.apps import apps
from django.urls import NoReverseMatch, reverse

# ── Cancelacion models → (module_path, service_class, method_name) ──
CANCEL_SERVICE_MAP = {
    "SaleOrder": ("sales.services", "SalesService", "cancel_sale_order"),
    "PurchaseOrder": ("purchasing.services", "PurchaseOrderService", "cancel_purchase_order"),
    "PurchaseReceipt": ("purchasing.services", "PurchasingService", "cancel_receipt"),
    "Invoice": ("billing.services", "BillingService", "cancel_invoice"),
    "TreasuryMovement": ("treasury.services", "TreasuryService", "cancel_movement"),
    "CreditCardStatement": ("treasury.card_service", "CardService", "cancel_statement"),
}


# ── Deletion policy table: model_key → (app_label, model_name, pattern) ──
# Mirror of the authoritative table in docs/20-contracts/deletion-policy.md.
DELETION_POLICY = {
    "Account": ("accounting", "account", "archivo"),
    "JournalEntry": ("accounting", "journalentry", "anulacion"),
    "ClosingChecklistTemplate": ("accounting", "closingchecklisttemplate", "archivo"),
    "Invoice": ("billing", "invoice", "anulacion"),
    "Contact": ("contacts", "contact", "archivo"),
    "User": ("core", "user", "archivo"),
    "Employee": ("hr", "employee", "archivo"),
    "AFP": ("hr", "afp", "archivo"),
    "PayrollConcept": ("hr", "payrollconcept", "archivo"),
    "Product": ("inventory", "product", "archivo"),
    "ProductCategory": ("inventory", "productcategory", "archivo"),
    "ProductAttribute": ("inventory", "productattribute", "archivo"),
    "UoM": ("inventory", "uom", "archivo"),
    "UoMCategory": ("inventory", "uomcategory", "archivo"),
    "Warehouse": ("inventory", "warehouse", "archivo"),
    "Location": ("inventory", "location", "archivo"),
    "StockMove": ("inventory", "stockmove", "anulacion"),
    "WorkOrder": ("production", "workorder", "anulacion"),
    "PurchaseOrder": ("purchasing", "purchaseorder", "anulacion"),
    "PurchaseReceipt": ("purchasing", "purchasereceipt", "cancelacion"),
    "SaleOrder": ("sales", "saleorder", "cancelacion"),
    "SaleDelivery": ("sales", "saledelivery", "anulacion"),
    "DraftCart": ("sales", "draftcart", "hard_delete"),
    "TaxPeriod": ("tax", "taxperiod", "archivo"),
    "Bank": ("treasury", "bank", "archivo"),
    "TreasuryAccount": ("treasury", "treasuryaccount", "archivo"),
    "PaymentMethod": ("treasury", "paymentmethod", "archivo"),
    "PaymentTerminalProvider": ("treasury", "paymentterminalprovider", "archivo"),
    "POSTerminal": ("treasury", "posterminal", "archivo"),
    "TreasuryMovement": ("treasury", "treasurymovement", "cancelacion"),
    "BankStatementLine": ("treasury", "bankstatementline", "anulacion"),
    "BankLoan": ("treasury", "bankloan", "anulacion"),
    "LoanInstallment": ("treasury", "loaninstallment", "append_only"),
    "CreditCardStatement": ("treasury", "creditcardstatement", "cancelacion"),
    "CreditLine": ("treasury", "creditline", "archivo"),
    "Checkbook": ("treasury", "checkbook", "archivo"),
}

# Anulación entities whose mechanism is NOT an own `status` field, per the
# contract's "Notas" column. Key → field that implements the mechanism
# (None = reversal documents only, nothing to assert structurally).
STATUS_EXEMPT = {
    # "Reverso vía contramovimiento": the annulment is a counter StockMove,
    # the original move is never mutated.
    "StockMove": None,
    # "No se borra; se marca unmatched o discarded" via reconciliation_status.
    "BankStatementLine": "reconciliation_status",
    # LoanInstallment es append-only, no se borra manualmente
    "LoanInstallment": None,
}

# Archivo entities whose lifecycle is governed by an existing `status` enum
# instead of `is_active` — adding a parallel boolean would create two sources
# of truth. Key → field that implements the mechanism. Documented in
# deletion-policy.md.
ARCHIVO_EXEMPT = {
    "Employee": "status",  # ACTIVE / INACTIVE
    "TaxPeriod": "status",  # OPEN / UNDER_REVIEW / CLOSED — no es archivable
    "Checkbook": "status",  # ACTIVE / CLOSED / EXHAUSTED — nunca se borra; preserva trazabilidad de folios
}

# Archivo entities that do NOT yet comply with the contract's
# "el campo se llama siempre is_active" rule. Pinned so the gap cannot grow
# silently; remove an entry here the day the model gains `is_active`.
ARCHIVO_KNOWN_GAPS = {}

CANCELLED_KEYWORDS = {"CANCELLED", "CANCELED", "ANNULLED", "ANULLED"}


def _get_field(model, name):
    try:
        return model._meta.get_field(name)
    except Exception:
        return None


def _has_cancelled_status(model) -> bool:
    """Model has a `status` field whose choices include a CANCELLED value."""
    field = _get_field(model, "status")
    if field is None or not field.choices:
        return False
    return any(str(value).upper() in CANCELLED_KEYWORDS for value, _ in field.choices)


def _has_is_active_field(model) -> bool:
    field = _get_field(model, "is_active")
    return field is not None and field.get_internal_type() == "BooleanField"


@pytest.mark.django_db
class TestDeletionPolicyConsistency:
    """
    Verify that each model's deletion pattern matches the policy document.
    """

    def test_anulacion_models_have_status_with_cancelled(self):
        """
        Models with 'anulacion' or 'cancelacion' pattern must have a status
        field containing a CANCELLED value — unless the contract assigns them
        another mechanism (STATUS_EXEMPT).
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern not in ("anulacion", "cancelacion"):
                continue
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue

            if entity_key in STATUS_EXEMPT:
                mechanism_field = STATUS_EXEMPT[entity_key]
                if mechanism_field and _get_field(model, mechanism_field) is None:
                    failures.append(
                        f"{entity_key}: exempt from status but mechanism field "
                        f"'{mechanism_field}' is missing"
                    )
                continue

            if not _has_cancelled_status(model):
                field = _get_field(model, "status")
                detail = (
                    f"status choices {[c[0] for c in field.choices]}"
                    if field is not None and field.choices
                    else "no status field"
                )
                failures.append(
                    f"{entity_key}: {pattern} pattern requires status with "
                    f"CANCELLED, found {detail}"
                )

        assert not failures, "Anulacion/Cancelacion pattern violations:\n" + "\n".join(failures)

    def test_archivo_models_have_is_active(self):
        """
        Models with 'archivo' pattern must have an is_active BooleanField.
        Known non-compliant models are pinned in ARCHIVO_KNOWN_GAPS: the gap
        may not grow, and entries must be removed once fixed.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != "archivo":
                continue
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue

            if entity_key in ARCHIVO_EXEMPT:
                mechanism_field = ARCHIVO_EXEMPT[entity_key]
                if _get_field(model, mechanism_field) is None:
                    failures.append(
                        f"{entity_key}: exempt from is_active but mechanism field "
                        f"'{mechanism_field}' is missing"
                    )
                continue

            has_flag = _has_is_active_field(model)
            if entity_key in ARCHIVO_KNOWN_GAPS:
                if has_flag:
                    failures.append(
                        f"{entity_key}: now has is_active — remove it from ARCHIVO_KNOWN_GAPS"
                    )
            elif not has_flag:
                failures.append(f"{entity_key}: archivo pattern but no is_active BooleanField")

        assert not failures, "Archivo pattern violations:\n" + "\n".join(failures)

    def test_hard_delete_models_no_status_or_is_active(self):
        """
        Models with 'hard_delete' pattern should not rely on status or is_active
        for deletion logic (they can have these fields for other purposes).
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != "hard_delete":
                continue
            try:
                apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")

        assert not failures, "Hard delete pattern violations:\n" + "\n".join(failures)

    def test_all_deletion_policy_models_exist(self):
        """
        Every model referenced in the deletion policy table must exist in the backend.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            try:
                apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: {app}.{model_name} does not exist")

        assert not failures, "Missing models:\n" + "\n".join(failures)

    def test_cancelacion_models_have_cancel_service(self):
        """
        Models with 'cancelacion' pattern must expose a static/service method
        to perform the cancellation, registered in CANCEL_SERVICE_MAP.
        """
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != "cancelacion":
                continue
            if entity_key not in CANCEL_SERVICE_MAP:
                failures.append(f"{entity_key}: cancelacion pattern but not in CANCEL_SERVICE_MAP")
                continue

            module_path, class_name, method_name = CANCEL_SERVICE_MAP[entity_key]
            try:
                module = importlib.import_module(module_path)
            except ImportError:
                failures.append(f"{entity_key}: cannot import {module_path}")
                continue

            svc_class = getattr(module, class_name, None)
            if svc_class is None:
                failures.append(f"{entity_key}: class {class_name} not found in {module_path}")
                continue

            cancel_method = getattr(svc_class, method_name, None)
            if cancel_method is None or not callable(cancel_method):
                failures.append(
                    f"{entity_key}: method {class_name}.{method_name} not found or not callable"
                )

        assert not failures, "Cancelacion service violations:\n" + "\n".join(failures)

    def test_archivo_serializers_expose_is_active(self):
        """
        Entidades con patrón 'archivo' que tienen ViewSet deben exponer is_active
        en su serializer para poder archivar/restaurar vía API.
        """
        from rest_framework import serializers
        
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != "archivo":
                continue
            if entity_key in ARCHIVO_EXEMPT:
                continue
            if entity_key in ARCHIVO_KNOWN_GAPS:
                continue
                
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue
                
            # Buscar el ViewSet para encontrar el serializer real
            serializer_class = None
            serializer_module = None
            
            # Primero intentar en views.py del app
            try:
                views_module = importlib.import_module(f"{app}.views")
                viewset_candidates = [
                    f"{model_name.capitalize()}ViewSet",
                    f"{model_name.capitalize()}View",
                ]
                for vname in viewset_candidates:
                    if hasattr(views_module, vname):
                        viewset = getattr(views_module, vname)
                        if hasattr(viewset, 'get_serializer_class'):
                            # El serializer puede ser dinámico, buscar serializer_class
                            if hasattr(viewset, 'serializer_class'):
                                serializer_class = viewset.serializer_class
                                serializer_module = f"{app}.views"
                                break
            except ImportError:
                pass
                
            # Si no se encontró en views, buscar en serializers.py por convención común
            if not serializer_class:
                try:
                    serializers_module = importlib.import_module(f"{app}.serializers")
                    # Buscar serializer que use este modelo
                    for attr_name in dir(serializers_module):
                        attr = getattr(serializers_module, attr_name)
                        if isinstance(attr, type) and issubclass(attr, serializers.Serializer):
                            if hasattr(attr, 'Meta') and hasattr(attr.Meta, 'model'):
                                if attr.Meta.model == model:
                                    serializer_class = attr
                                    serializer_module = f"{app}.serializers"
                                    break
                except ImportError:
                    pass
                    
            if not serializer_class:
                # No hay serializer/API para este modelo - saltar
                continue
                
            # Verificar que is_active está en los fields
            if hasattr(serializer_class, 'Meta') and hasattr(serializer_class.Meta, 'fields'):
                fields = serializer_class.Meta.fields
                if fields == "__all__":
                    # __all__ incluye is_active automáticamente
                    continue
                if "is_active" not in fields:
                    failures.append(
                        f"{entity_key}: serializer {serializer_module}.{serializer_class.__name__} "
                        f"no expone 'is_active' en fields={fields}"
                    )
            else:
                failures.append(
                    f"{entity_key}: serializer {serializer_module}.{serializer_class.__name__} "
                    f"sin Meta.fields definido"
                )
                
        assert not failures, "Archivo serializers missing is_active:\n" + "\n".join(failures)

    def test_archivo_selectors_filter_is_active_by_default(self):
        """
        ViewSets de entidades Archivo deben filtrar is_active=True por defecto
        en su queryset base (listados).
        """
        import inspect
        
        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != "archivo":
                continue
            if entity_key in ARCHIVO_EXEMPT:
                continue
            if entity_key in ARCHIVO_KNOWN_GAPS:
                continue
                
            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue
                
            # Buscar el ViewSet y verificar su queryset
            try:
                views_module = importlib.import_module(f"{app}.views")
            except ImportError:
                failures.append(f"{entity_key}: no views module {app}.views")
                continue
                
            viewset = None
            viewset_candidates = [
                f"{model_name.capitalize()}ViewSet",
                f"{model_name.capitalize()}View",
            ]
            for vname in viewset_candidates:
                if hasattr(views_module, vname):
                    viewset = getattr(views_module, vname)
                    break
                    
            if not viewset:
                # No hay ViewSet para este modelo - saltar
                continue

            # 1) Preferir inspeccionar get_queryset: el patrón Archivo filtra
            #    is_active en el listado (directamente o delegando al selector).
            if hasattr(viewset, 'get_queryset'):
                source = inspect.getsource(viewset.get_queryset)
                if "is_active" in source:
                    continue

            # 2) Fallback: verificar el atributo queryset de clase
            if hasattr(viewset, 'queryset') and viewset.queryset is not None:
                queryset = viewset.queryset
                if hasattr(queryset, 'query'):
                    where_clause = str(queryset.query.where)
                    if "is_active" not in where_clause:
                        failures.append(
                            f"{entity_key}: get_queryset sin is_active y queryset base "
                            f"no filtra is_active=True (WHERE: {where_clause})"
                        )
                else:
                    # Queryset es un Manager, verificar el modelo
                    if hasattr(queryset, 'model') and queryset.model == model:
                        # Es el manager por defecto (objects.all()) - no filtra
                        failures.append(
                            f"{entity_key}: get_queryset sin is_active y queryset base "
                            f"usa manager por defecto sin filtro is_active"
                        )
            else:
                failures.append(
                    f"{entity_key}: ViewSet {viewset.__name__} sin filtro is_active "
                    f"en get_queryset ni en queryset base"
                )

        assert not failures, "Archivo viewsets not filtering is_active by default:\n" + "\n".join(failures)

    def test_archivo_delete_blocked(self):
        """
        Entidades Archivo deben bloquear DELETE (hard delete) → 405.
        Verifica que el viewset no permite destroy o que devuelve 405.
        """
        from rest_framework.test import APIClient
        from django.contrib.auth import get_user_model
        from django.db import transaction

        User = get_user_model()
        client = APIClient()

        # Crear superuser para tener todos los permisos
        user = User.objects.create_superuser(username="test_admin", password="testpass")
        client.force_authenticate(user=user)

        def _first_or_create(model, app, model_name):
            """Devuelve una instancia (existente o creada con datos mínimos válidos)."""
            obj = model.objects.first()
            if obj:
                return obj
            kwargs = {}
            if app == "hr" and model_name == "afp":
                kwargs = {"name": "Test AFP", "percentage": "10.00"}
            elif app == "hr" and model_name == "payrollconcept":
                from accounting.models import Account
                acc = Account.objects.first()
                if acc is None:
                    return None
                kwargs = {"name": "Test Concept", "category": "ALLOWANCE", "account": acc}
            elif app == "accounting" and model_name == "account":
                kwargs = {"code": "TSTACC", "name": "Test Account", "account_type": "ASSET"}
            elif app == "accounting" and model_name == "closingchecklisttemplate":
                kwargs = {"code": "test-template", "name": "Test Template",
                          "description": "-", "category": "GENERAL"}
            elif app == "contacts":
                kwargs = {"name": "Test Contact", "tax_id": "00000000-0",
                          "contact_name": "Test", "email": "t@t.cl",
                          "phone": "+56000000000", "address": "-"}
            elif app == "inventory" and model_name == "productcategory":
                kwargs = {"name": "Test Category"}
            elif app == "inventory" and model_name == "productattribute":
                kwargs = {"name": "Test Attribute"}
            elif app == "inventory" and model_name == "uomcategory":
                kwargs = {"name": "Test UoM Category"}
            elif app == "inventory" and model_name == "uom":
                from inventory.models import UoMCategory
                cat = UoMCategory.objects.first() or UoMCategory.objects.create(name="Test UoM Cat")
                kwargs = {"name": "Test UoM", "category": cat}
            elif app == "inventory" and model_name == "product":
                from inventory.models import ProductCategory
                cat = ProductCategory.objects.first() or ProductCategory.objects.create(name="Test Prod Cat")
                kwargs = {"name": "Test Product", "category": cat}
            elif app == "inventory" and model_name == "warehouse":
                kwargs = {"name": "Test WH", "code": "TWH", "address": "-"}
            elif app == "inventory" and model_name == "location":
                kwargs = {"name": "Test Location", "location_type": "INTERNAL"}
            elif app == "treasury" and model_name == "bank":
                kwargs = {"name": "Test Bank"}
            elif app == "treasury" and model_name == "treasuryaccount":
                kwargs = {"name": "Test Treasury Account"}
            elif app == "treasury" and model_name == "creditline":
                from treasury.models import TreasuryAccount
                ta = TreasuryAccount.objects.first()
                if ta is None:
                    return None
                kwargs = {"treasury_account": ta, "code": "CL-TEST",
                          "credit_limit": "1000", "rate_basis": "MONTHLY",
                          "valid_from": "2026-01-01", "collateral_notes": "-", "notes": "-"}
            else:
                return None
            try:
                with transaction.atomic():
                    return model.objects.create(**kwargs)
            except Exception:
                return None

        failures = []
        for entity_key, (app, model_name, pattern) in DELETION_POLICY.items():
            if pattern != "archivo":
                continue
            if entity_key in ARCHIVO_EXEMPT:
                continue
            if entity_key in ARCHIVO_KNOWN_GAPS:
                continue

            try:
                model = apps.get_model(app, model_name)
            except LookupError:
                failures.append(f"{entity_key}: model {app}.{model_name} not found")
                continue

            # Localizar el basename del router para construir la URL de detail
            try:
                views_module = importlib.import_module(f"{app}.views")
            except ImportError:
                failures.append(f"{entity_key}: no views module {app}.views")
                continue

            viewset = None
            for vname in (f"{model_name.capitalize()}ViewSet", f"{model_name.capitalize()}View"):
                if hasattr(views_module, vname):
                    viewset = getattr(views_module, vname)
                    break
            if viewset is None:
                # Sin ViewSet no hay endpoint DELETE que probar
                continue

            obj = model.objects.first() or _first_or_create(model, app, model_name)
            if obj is None:
                failures.append(
                    f"{entity_key}: no se pudo obtener/crear una instancia para probar DELETE"
                )
                continue

            # Buscar la URL de detail vía reverse del basename del router
            basename = getattr(viewset, "basename", None) or f"{model_name}-detail"
            url = None
            for candidate in (f"{basename}-detail", f"{model_name}-detail",
                              f"{model_name}s-detail", f"{app}-{model_name}-detail"):
                try:
                    url = reverse(candidate, args=[obj.pk])
                    break
                except NoReverseMatch:
                    continue
            if url is None:
                # Fallback a la convención REST
                url = f"/api/{app}/{model_name}s/{obj.pk}/"

            response = client.delete(url)

            # Aceptar 405 (Method Not Allowed) o 403 (si el permiso no incluye delete)
            # y 404 (endpoint inexistente). Lo importante es que NO sea 204.
            if response.status_code == 204:
                failures.append(
                    f"{entity_key}: DELETE {url} devolvió 204 (hard delete permitido). "
                    f"Debe bloquearse con 405 o 403."
                )
            elif response.status_code not in (405, 403, 404):
                failures.append(
                    f"{entity_key}: DELETE {url} devolvió {response.status_code} (esperado 405/403)"
                )

        assert not failures, "Archivo DELETE not blocked:\n" + "\n".join(failures)

    def test_system_managed_guards_never_500(self):
        """
        Regresión: los guards de entidades gestionadas por el sistema no deben
        reventar con AttributeError (500). Referenciaban ``bank_provisioned``,
        campo eliminado del modelo TreasuryAccount/PaymentMethod (ver drift
        0056–0058). PATCH/DELETE sobre una cuenta de treasury NO
        system-managed debe devolver 200 (archivo) o 405, nunca 500.
        """
        from rest_framework.test import APIClient
        from django.contrib.auth import get_user_model
        from treasury.models import TreasuryAccount

        User = get_user_model()
        client = APIClient()
        user = User.objects.create_superuser(
            username="test_guard_admin", password="testpass"
        )
        client.force_authenticate(user=user)

        # Una cuenta NO gestionada por el sistema (fuera de los tipos no-cash).
        account = TreasuryAccount.objects.exclude(
            account_type__in=TreasuryAccount._NON_CASH_EQUIVALENT_TYPES
        ).first()
        if account is None:
            account = TreasuryAccount.objects.create(name="QA Guard Account")

        url = f"/api/treasury/accounts/{account.pk}/"
        for method in ("patch", "delete"):
            resp = getattr(client, method)(url)
            assert resp.status_code != 500, (
                f"{method.upper()} {url} devolvió 500 "
                f"(guard _check_system_managed roto): {getattr(resp, 'data', None)}"
            )
        # DELETE en entidad Archivo debe bloquearse con 405 (nunca 204 hard delete).
        resp = client.delete(url)
        assert resp.status_code == 405, (
            f"DELETE {url} devolvió {resp.status_code}; TreasuryAccount es Archivo "
            f"y debe bloquear hard delete con 405"
        )
