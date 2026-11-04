---
layer: 20-contracts
doc: permission-config-entities
task: "Clasificación de entidades: configuración, datos maestros, operacionales"
triggers:
  - "nuevo modelo"
  - "ViewSet de configuración"
  - "datos maestros"
  - "settings singleton"
  - "permission_classes settings"
status: active
owner: backend-team
last_review: 2026-11-04
---

# Contrato — Clasificación de entidades y niveles de acceso

> **Decisión:** ADR-0112 — leer antes de crear cualquier ViewSet de configuración o datos maestros.

## Las tres clases

| Clase | Criterio resumido | GET (lectura) | POST/PUT/PATCH (escritura) |
|---|---|---|---|
| **A — Settings singleton** | Un único objeto de config global por app | `{app}.read` | `{app}.manage` |
| **B — Datos maestros** | Tabla de referencia estructural, modificación tiene efecto transversal | `{app}.read` | `{app}.manage` |
| **C — Entidades operacionales** | Registros de la operación diaria | `{app}.read` | `{app}.operate` |

> Las entidades Clase C siguen el comportamiento estándar de ADR-0104. Este contrato solo registra las Clases A y B.

---

## Clase A — Settings singleton

Patrón: un único objeto en BD (`get_or_create(pk=1)`), modificado vía `PUT /api/{app}/settings/current/`.

| App | Modelo | ViewSet | GET requiere | PUT/PATCH requiere |
|---|---|---|---|---|
| `sales` | `SalesSettings` | `SalesSettingsViewSet` | `sales.view_salessettings` | `sales.change_salessettings` |
| `accounting` | `AccountingSettings` | `AccountingSettingsViewSet` | `accounting.view_accountingsettings` | `accounting.change_accountingsettings` |
| `hr` | `GlobalHRSettings` | `GlobalHRSettingsViewSet` | `hr.view_globalhrsettings` | `hr.change_globalhrsettings` |
| `workflow` | `WorkflowSettings` | `WorkflowSettingsViewSet` | `workflow.view_workflowsettings` | `workflow.change_workflowsettings` |
| `treasury` | `ReconciliationSettings` | `ReconciliationSettingsViewSet` | `treasury.view_reconciliationsettings` | `treasury.change_reconciliationsettings` |
| `core` | `CompanySettings` | `CompanySettingsViewSet` | `core.view_companysettings` | `core.change_companysettings` |
| `production` | `ProductionSettings` | *(sin ViewSet expuesto — deuda técnica)* | — | — |

**Regla de implementación:** el ViewSet sobreescribe `get_permissions()` y usa `require_perms()` para ambos verbos. El permiso de escritura (`change_*`) queda en `{app}.manage` vía OVERRIDES en `bundles.py`; el permiso de lectura (`view_*`) queda en `{app}.read` por la regla base. Coherente.

```python
# Patrón correcto para cualquier Settings singleton
def get_permissions(self):
    if self.action == "current":
        verb = "view" if self.request.method in ("GET", "HEAD", "OPTIONS") else "change"
        return [require_perms(f"{app}.{verb}_{model_name}")()]
    return super().get_permissions()
```

---

## Clase B — Datos maestros

Tablas de referencia consumidas por entidades operacionales. Modificarlas tiene efecto estructural.

### Inventario

| Modelo | ViewSet | Lectura | Escritura |
|---|---|---|---|
| `ProductCategory` | `CategoryViewSet` | `inventory.read` → `inventory.view_productcategory` | `inventory.manage` → `inventory.add/change_productcategory` |
| `UoMCategory` | `UoMCategoryViewSet` | `inventory.read` → `inventory.view_uomcategory` | `inventory.manage` → `inventory.add/change_uomcategory` |
| `UoM` | `UoMViewSet` | `inventory.read` → `inventory.view_uom` | `inventory.manage` → `inventory.add/change_uom` |
| `Warehouse` | `WarehouseViewSet` | `inventory.read` → `inventory.view_warehouse` | `inventory.manage` → `inventory.add/change_warehouse` |
| `PricingRule` | `PricingRuleViewSet` | `inventory.read` → `inventory.view_pricingrule` | `inventory.manage` → `inventory.add/change_pricingrule` |
| `ProductUoMPrice` | `ProductUoMPriceViewSet` | `inventory.read` → `inventory.view_productuomprice` | `inventory.manage` → `inventory.add/change_productuomprice` |

**Roles con acceso de escritura:** Jefatura de Producción (`inventory.manage`), Gerencia, Administrador del sistema.  
**Roles con solo lectura:** Bodega y Despacho, Producción, Ventas (todos tienen `inventory.read`).

### Tesorería

| Modelo | ViewSet | Lectura | Escritura |
|---|---|---|---|
| `Bank` | `BankViewSet` | `treasury.read` | `treasury.manage` |
| `PaymentMethod` | `PaymentMethodViewSet` | `treasury.read` | `treasury.manage` |
| `PaymentTerminalProvider` | `PaymentTerminalProviderViewSet` | `treasury.read` | `treasury.manage` |
| `PaymentTerminalDevice` | `PaymentTerminalDeviceViewSet` | `treasury.read` | `treasury.manage` |
| `POSTerminal` | `POSTerminalViewSet` | `treasury.read` | `treasury.manage` |

**Roles con acceso de escritura:** Tesorero (`treasury.manage`), Gerencia, Administrador del sistema.

### RRHH

| Modelo | ViewSet | Lectura | Escritura |
|---|---|---|---|
| `AFP` | `AFPViewSet` | `hr.read` | `hr.manage` |
| `PayrollConcept` | `PayrollConceptViewSet` | `hr.read` | `hr.manage` |

**Roles con acceso de escritura:** RRHH (`hr.manage`), Gerencia, Administrador del sistema.

### Producción

| Modelo | ViewSet | Lectura | Escritura |
|---|---|---|---|
| `BillOfMaterials` / `BillOfMaterialsLine` | `BillOfMaterialsViewSet` | `production.read` | `production.manage` |

**Roles con acceso de escritura:** Jefatura de Producción (`production.manage`), Gerencia, Administrador del sistema.

---

## Implementación en `bundles.py` — OVERRIDES

Los permisos `add_*` / `change_*` de Clase A y Clase B se declaran en `OVERRIDES` para que `expand()` los asigne solo a `{app}.manage`, sacándolos de `{app}.operate`:

```python
OVERRIDES: dict[str, list[str]] = {
    "core.view_actionlog": ["core.security"],

    # Inventario — datos maestros
    "inventory.add_productcategory":       ["inventory.manage"],
    "inventory.change_productcategory":    ["inventory.manage"],
    "inventory.add_uomcategory":           ["inventory.manage"],
    "inventory.change_uomcategory":        ["inventory.manage"],
    "inventory.add_uom":                   ["inventory.manage"],
    "inventory.change_uom":                ["inventory.manage"],
    "inventory.add_warehouse":             ["inventory.manage"],
    "inventory.change_warehouse":          ["inventory.manage"],
    "inventory.add_pricingrule":           ["inventory.manage"],
    "inventory.change_pricingrule":        ["inventory.manage"],
    "inventory.add_productuomprice":       ["inventory.manage"],
    "inventory.change_productuomprice":    ["inventory.manage"],

    # Tesorería — datos maestros
    "treasury.add_bank":                       ["treasury.manage"],
    "treasury.change_bank":                    ["treasury.manage"],
    "treasury.add_paymentmethod":              ["treasury.manage"],
    "treasury.change_paymentmethod":           ["treasury.manage"],
    "treasury.add_paymentterminalprovider":    ["treasury.manage"],
    "treasury.change_paymentterminalprovider": ["treasury.manage"],
    "treasury.add_paymentterminaldevice":      ["treasury.manage"],
    "treasury.change_paymentterminaldevice":   ["treasury.manage"],
    "treasury.add_posterminal":                ["treasury.manage"],
    "treasury.change_posterminal":             ["treasury.manage"],

    # RRHH — datos maestros
    "hr.add_afp":               ["hr.manage"],
    "hr.change_afp":            ["hr.manage"],
    "hr.add_payrollconcept":    ["hr.manage"],
    "hr.change_payrollconcept": ["hr.manage"],

    # Producción — datos maestros
    "production.add_billofmaterials":       ["production.manage"],
    "production.change_billofmaterials":    ["production.manage"],
    "production.add_billofmaterialsline":   ["production.manage"],
    "production.change_billofmaterialsline": ["production.manage"],
}
```

---

## Checklist para nuevo modelo

Al crear un modelo y su ViewSet, el autor responde:

```
¿El registro se crea/modifica en la operación diaria?
├── Sí → Clase C: no tocar OVERRIDES, flujo estándar ADR-0104
└── No → ¿Es un único objeto global (singleton)?
    ├── Sí → Clase A: agregar get_permissions() con require_perms; no OVERRIDES necesarios
    │         (change_* ya cae en operate, el PR reviewer debe verificar si debe subir a manage)
    └── No → Clase B: agregar a OVERRIDES en bundles.py + actualizar esta tabla
                      + ejecutar sync_permissions en el servidor
```

---

## Deuda técnica registrada

| Item | Descripción | Prioridad |
|---|---|---|
| `ProductionSettings` sin ViewSet | El modelo existe pero no hay endpoint expuesto. Decidir si se expone o se gestiona solo desde Django Admin. | Baja |
| Settings singleton de `sales` / `accounting` aún con `IsAuthenticated()` en GET | Deben migrarse a `require_perms` según este contrato. | Media |
| Test `test_rbac_bundles.py` sin cobertura de OVERRIDES | Debe verificar que los permisos de Clase B no aparezcan en `expand("{app}.operate")`. | Media |
