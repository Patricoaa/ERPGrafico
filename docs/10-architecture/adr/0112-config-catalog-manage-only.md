---
id: 0112
title: Taxonomía de acceso a entidades de configuración y datos maestros
status: Accepted
date: 2026-11-04
author: core-team
---

# ADR-0112 — Taxonomía de acceso a entidades de configuración y datos maestros

**Relacionado:** ADR-0104 (RBAC — bundle taxonomy, GroupProfile), contrato [`permission-config-entities.md`](../../20-contracts/permission-config-entities.md).

## Contexto

El sistema de bundles de ADR-0104 asigna permisos de forma mecánica por app:

| Bundle | Qué incluye |
|---|---|
| `{app}.read` | `view_*` del app (menos permisos sensibles) |
| `{app}.operate` | Todo lo anterior + `add_*` + `change_*` + verbos no destructivos |
| `{app}.manage` | Todo lo anterior + `delete_*` + verbos destructivos |

Esta regla mecánica no distingue entre **entidades operacionales** (OT, factura, movimiento de tesorería) y **entidades de configuración** (parámetros del módulo, datos maestros de referencia). Resultado: un operario de Ventas con `sales.operate` puede modificar los parámetros de crédito globales; un operario de Bodega con `inventory.operate` puede crear bodegas y unidades de medida.

Dos problemas adicionales:
1. Los endpoints GET de los settings singleton responden con `IsAuthenticated()` en lugar de requerir `{app}.read`, lo que permite a cualquier usuario autenticado leer configuración aunque no tenga acceso al módulo.
2. No existe documentación canónica de qué modelos son configuración vs entidades operacionales.

## Decisión

### 1. Taxonomía de tres clases

| Clase | Criterio | Acceso lectura | Acceso escritura |
|---|---|---|---|
| **A — Settings singleton** | Un único objeto de config global por app (patrón `get_or_create(pk=1)`) | `{app}.read` | `{app}.manage` |
| **B — Datos maestros** | Tablas de referencia consumidas transversalmente por entidades operacionales; su modificación tiene efecto estructural sobre todo el módulo | `{app}.read` | `{app}.manage` |
| **C — Entidades operacionales** | Registros creados en la operación diaria (pedidos, facturas, OT, movimientos) | `{app}.read` | `{app}.operate` (+ `{app}.manage` para destructivos) |

Los catálogos de Clase B se leen con la misma exigencia que el módulo (`{app}.read`) y solo se modifican desde el nivel de gestión (`{app}.manage`). Las entidades de Clase C mantienen el comportamiento actual de ADR-0104.

### 2. Inventario canónico

Ver tabla completa en [`permission-config-entities.md`](../../20-contracts/permission-config-entities.md).

### 3. Implementación técnica

**Opción elegida: `BUNDLES` OVERRIDES para datos maestros + `get_permissions()` explícito para settings singleton.**

#### 3a. Settings singleton — `get_permissions()` explícito

Reemplaza el `IsAuthenticated()` en GET por `require_perms(f"{app}.view_{model}")()`:

```python
# Antes (permisivo):
def get_permissions(self):
    if self.action == "current" and self.request.method == "GET":
        return [IsAuthenticated()]
    return super().get_permissions()

# Después (correcto):
def get_permissions(self):
    if self.action == "current":
        verb = "view" if self.request.method in ("GET", "HEAD", "OPTIONS") else "change"
        return [require_perms(f"{app}.{verb}_{model_name}")()]
    return super().get_permissions()
```

Dado que el permiso de escritura (`change_*`) queda en `{app}.manage` vía OVERRIDES (3b), el GET pasa a requerir `view_*` que ya está en `{app}.read`. Consistente.

#### 3b. Datos maestros — OVERRIDES en `bundles.py`

Los permisos `add_*` y `change_*` de los modelos de datos maestros se **sobreescriben** para quedar solo en `{app}.manage`, sacándolos de `{app}.operate`:

```python
# core/rbac/bundles.py
OVERRIDES: dict[str, list[str]] = {
    "core.view_actionlog": ["core.security"],

    # ---- Inventario — datos maestros ----
    "inventory.add_productcategory":    ["inventory.manage"],
    "inventory.change_productcategory": ["inventory.manage"],
    "inventory.add_uomcategory":        ["inventory.manage"],
    "inventory.change_uomcategory":     ["inventory.manage"],
    "inventory.add_uom":                ["inventory.manage"],
    "inventory.change_uom":             ["inventory.manage"],
    "inventory.add_warehouse":          ["inventory.manage"],
    "inventory.change_warehouse":       ["inventory.manage"],
    "inventory.add_pricingrule":        ["inventory.manage"],
    "inventory.change_pricingrule":     ["inventory.manage"],
    "inventory.add_productuomprice":    ["inventory.manage"],
    "inventory.change_productuomprice": ["inventory.manage"],

    # ---- Tesorería — datos maestros ----
    "treasury.add_bank":                     ["treasury.manage"],
    "treasury.change_bank":                  ["treasury.manage"],
    "treasury.add_paymentmethod":            ["treasury.manage"],
    "treasury.change_paymentmethod":         ["treasury.manage"],
    "treasury.add_paymentterminalprovider":  ["treasury.manage"],
    "treasury.change_paymentterminalprovider": ["treasury.manage"],
    "treasury.add_paymentterminaldevice":    ["treasury.manage"],
    "treasury.change_paymentterminaldevice": ["treasury.manage"],
    "treasury.add_posterminal":              ["treasury.manage"],
    "treasury.change_posterminal":           ["treasury.manage"],

    # ---- RRHH — datos maestros ----
    "hr.add_afp":            ["hr.manage"],
    "hr.change_afp":         ["hr.manage"],
    "hr.add_payrollconcept": ["hr.manage"],
    "hr.change_payrollconcept": ["hr.manage"],
}
```

Los permisos `delete_*` de datos maestros ya estaban solo en `manage` (son destructivos por la regla base). Los OVERRIDES solo elevan los `add_*` / `change_*`.

> **Nota:** `delete_*` de datos maestros con `NoDestroyModelMixin` está bloqueado por código. Los OVERRIDES son redundantes para esos casos pero no dañinos; los dejamos por completitud semántica.

### 4. Impacto en roles sembrados

Ningún rol pierde acceso que necesitara operacionalmente:

| Rol | Situación antes | Situación después |
|---|---|---|
| Ventas | Podía cambiar `SalesSettings` (con `sales.operate`) | Ya no puede ✅ |
| Bodega y Despacho | Podía crear/modificar Categorías, Bodegas, UoM | Ya no puede ✅ |
| Producción | Podía cambiar `ProductionSettings` si hubiera ViewSet expuesto | Ya no podría ✅ |
| RRHH | Podía crear/modificar AFP, Conceptos de Nómina (con `hr.operate`) | Tiene `hr.manage` → sigue pudiendo ✅ |
| Tesorero | Podía crear/modificar Bancos, Métodos de Pago, Terminales (con `treasury.operate`) | Tiene `treasury.manage` → sigue pudiendo ✅ |
| Jefatura de Producción | Tiene `production.manage` → sigue pudiendo gestionar config de producción ✅ | Sin cambio |
| Gerencia | Tiene `*.manage` de todos los módulos no sensibles ✅ | Sin cambio |
| Administrador del sistema | `is_system`, todos los bundles ✅ | Sin cambio |

### 5. Settings singleton sin ViewSet expuesto

`ProductionSettings` tiene modelo pero no ViewSet en `production/views.py`. Queda pendiente decidir si se expone. Por ahora no aplica 3a. Se registra como deuda técnica.

## Consecuencias

**Positivo:**
- Un operario nunca puede alterar configuración estructural de su módulo.
- La lectura de settings requiere como mínimo pertenecer al módulo (`{app}.read`).
- La taxonomía queda documentada y es el referente para cualquier nuevo modelo.

**Negativo / neutral:**
- `sync_permissions` debe ejecutarse tras aplicar los OVERRIDES para re-materializar todos los grupos ROLE.
- Los tests `test_rbac_bundles.py` deben actualizarse para validar los nuevos OVERRIDES.
- Los roles que hoy usan `operate` para mutar datos maestros (ninguno con necesidad operacional real) pierden ese acceso silenciosamente hasta que se re-materialicen.

## Criterio para clasificar nuevos modelos

Al crear un modelo, el autor responde:

```
¿Es creado/modificado en la operación diaria (cada turno, cada venta, cada OT)?
├── Sí → Clase C (operacional) — operate para add/change, manage para destructivos
└── No → ¿Es un parámetro único del módulo (singleton)?
    ├── Sí → Clase A (settings singleton) — read para GET, manage para PUT/PATCH
    └── No → ¿Es una tabla de referencia consumida por entidades operacionales?
        └── Sí → Clase B (datos maestros) — read para GET, manage para add/change/delete
```
