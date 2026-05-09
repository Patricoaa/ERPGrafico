---
description: Contrato de interfaz para formularios generados desde backend (Schema-Driven).
precondition: [form-layout-architecture.md, component-form-patterns.md, component-selectors.md, component-visual-hierarchy.md]
---

# Contrato: Schema-Driven Forms (EntityForm)

Este documento define la estructura y semántica permitida para que el backend dictamine cómo el frontend debe renderizar un formulario genérico a través de `EntityForm`. La filosofía es **cero invención de primitives**: el schema no define CSS, define qué componentes funcionales preexistentes del Design System se deben instanciar.

## 1. Vocabulario del FormMeta

El backend expone un JSON `FormMeta` con los siguientes nodos admitidos:

- `sections`: Lista de objetos que agrupan campos. `[{ "id": string, "title": string, "icon": string, "fields": string[] }]`
- `grid_cols`: Define la cuadrícula base del formulario. Valores permitidos: `4` o `12`.
- `field_widget`: Mapa de `nombre_campo` a `tipo_widget` (ver Sección 2).
- `widget_props`: Mapa de `nombre_campo` a opciones de configuración adicionales específicas para el widget.
- `visible_if`: Lógica condicional para campos condicionales. `{ "field_a": { "equals": "value" }, "field_b": { "in": ["val1", "val2"] } }`
- `sidebar`: Configuración opcional de barra lateral. `{ "entity_type": string }`
- `actions`: Botones extra a inyectar en el footer, aparte del submit.
- `tabs`: (Opcional) Agrupación superior si las secciones no bastan.

## 2. Mapping Canónico `widget` → `Componente`

| `widget` | Componente Renderizado | `widget_props` |
|----------|------------------------|----------------|
| `account_selector` | `AccountSelector` | `account_type`, `is_reconcilable`, `show_all` |
| `product_selector` | `ProductSelector` | `product_type`, `allowed_types`, `restrict_stock` |
| `category_selector` | `CategorySelector` | `exclude_id`, `allow_none` |
| `uom_selector` | `UoMSelector` | `category_id` |
| `contact_selector` | `ContactSelector` | `is_partner`, `is_customer`, `is_supplier` |
| `icon_picker` | `RichIconSelector` | `categories[]` |
| `labeled_switch` | `LabeledSwitch` | `description_on`, `description_off` |
| `fk_async` | `AsyncSelect` (genérico) | `endpoint`, `display_field` |
| `string`/`text`/`enum`/`date`/`decimal`| `LabeledInput`/`LabeledSelect`/`DatePicker`| (ninguno) |

## 3. Reglas de Coherencia con Contratos UI Base

- `sections` se mapea estáticamente a `<FormSection title="..." icon={...} />`.
- `grid_cols=4` inyecta `grid grid-cols-4 gap-4` en el contenedor del formulario.
- `sidebar` causa que todo el formulario se monte dentro de `<FormSplitLayout showSidebar={true} sidebar={<ActivitySidebar entityType="..." />} >`.
- `actions` se inyectan como `children` dentro de `<FormFooter actions={...} />`.

## 4. Decision Tree (Cuándo SÍ / Cuándo NO usar Schema-Driven)

**Regla de Oro:** "Si el formulario requiere un widget que no existe en el registro, usa React puro. NUNCA fuerces el schema a hacer algo para lo que no está diseñado".

**NO uses EntityForm si:**
- Es `Account`, `JournalEntry`, `Contact`, `Product` (manufacturable), `WorkOrder`.
- Necesitas grillas editables (`EditableTable`) como los items de una factura o cotización.
- Tienes cálculos reactivos en tiempo real entre campos.
- El flujo de guardado es multi-paso o requiere validación asíncrona intermedia (como integración de pago).

**SÍ usa EntityForm si:**
- Es un catálogo simple (e.g., `UoMCategory`, `Tax`, `PaymentMethod`).
- Es una entidad administrativa de lectura o con metadatos planos (e.g., `Budget`, `FiscalYear`).
- El modelo es un catálogo plano con 1 o 2 FK simples.

## 5. Ejemplos Canónicos

### Caso Micro: UoMCategory
```json
{
  "grid_cols": 4,
  "sections": [{ "id": "main", "title": "General", "fields": ["name", "description"] }]
}
```

### Caso Estándar: Budget
```json
{
  "grid_cols": 4,
  "sections": [{ "id": "main", "title": "Presupuesto", "fields": ["name", "start_date", "end_date", "description"] }],
  "field_widget": { "description": "text" }
}
```

### Caso Ficha Maestra: ProductCategory
```json
{
  "grid_cols": 4,
  "sidebar": { "entity_type": "productcategory" },
  "sections": [
    { "id": "main", "title": "General", "fields": ["name", "prefix", "icon", "parent"] },
    { "id": "accounting", "title": "Cuentas Contables", "fields": ["has_custom_accounting", "asset_account", "income_account", "expense_account"] }
  ],
  "field_widget": {
    "icon": "icon_picker",
    "parent": "category_selector",
    "has_custom_accounting": "labeled_switch",
    "asset_account": "account_selector"
  },
  "visible_if": {
    "asset_account": { "has_custom_accounting": { "equals": true } }
  }
}
```

## 6. Versionado del Contrato

Cualquier adición al vocabulario (una nueva key de root) requiere un ADR.
Cualquier widget nuevo añadido a la tabla (Sección 2) requiere actualizar este contrato y extender la implementación en el **Widget Registry** del frontend.
