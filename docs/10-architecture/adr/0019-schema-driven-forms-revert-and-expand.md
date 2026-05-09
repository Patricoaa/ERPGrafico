# ADR-0019: Schema-Driven Forms - Reversión y Expansión

**Fecha:** 2026-05-09
**Estado:** Aceptado
**Fase:** F8
**Firmas Stakeholder:** @pato

## 1. Contexto y Origen del Problema

Durante la **Fase 4 (Commit `9387cb91`)**, se intentó unificar la creación de entidades implementando formularios guiados por esquemas generados desde el backend (`EntityForm`). Se migraron tres entidades iniciales:
- `Budget` (Presupuesto)
- `ProductCategory` (Categoría de Producto)
- `UoM` (Unidad de Medida)

Tras la auditoría de la arquitectura frontend, se descubrió que esta migración fue **prematura y produjo regresiones**. El contrato del esquema actual (`FormMeta`) estaba limitado a proveer `tabs`, `fields`, `actions` y `transitions`.

### Consecuencias de la limitación del contrato:
1. **Bifurcación de flujos:** Al no poder expresar componentes avanzados, la interfaz de creación quedó como un formulario genérico simple generado por `EntityForm`, mientras que la vista de edición (Detalle) utilizaba el formulario rico preexistente.
2. **Pérdida de expresividad visual:** El esquema no podía expresar agrupamiento semántico (`sections`), distribución espacial (`grid_cols`), componentes avanzados interactivos (widgets ricos como `RichIconSelector`, `AccountSelector`, `LabeledSwitch`), ni lógica condicional para mostrar/ocultar campos (`visible_if`).
3. **Pérdida de layout:** Faltaba soporte para incluir la barra lateral (`sidebar`) utilizada por el `FormSplitLayout` en las vistas detalladas.

## 2. Decisión

Se decide adoptar un enfoque **Opción B+A**: revertir las tres migraciones de la Fase 4 para restaurar la paridad visual, publicar un nuevo contrato estricto de UI para los formularios guiados por esquema y, posteriormente, expandir la capacidad del backend y el frontend antes de retomar nuevas migraciones.

### 2.1 Alcance de la Reversión (Revert)
Se debe restaurar la funcionalidad original (pre-`9387cb91`) para que **tanto la creación como la edición utilicen el mismo componente de formulario rico**, eliminando la bifurcación:
- **Budget Create:** Volver a usar `LabeledInput` o consolidar usando `BudgetEditor`.
- **ProductCategory Create:** Volver a usar `CategoryForm` (con `RichIconSelector`, `AccountSelector`, etc.).
- **UoM Create:** Volver a usar `UoMForm`.

### 2.2 Alcance de la Expansión
Se desarrollará un nuevo contrato `schema-driven-forms.md` (T-84) que estandarizará el uso de la arquitectura dirigida por esquemas con un vocabulario enriquecido:
- **Vocabulario `FormMeta`:** Se incorporarán atributos para secciones (`sections`), grillas (`grid_cols`), widgets específicos por campo (`field_widget`, `widget_props`), visibilidad condicional (`visible_if`) y layout (`sidebar`).
- **Widget Registry:** El frontend implementará un registro canónico y dinámico que mapeará los widgets del esquema hacia componentes React reales respetando los contratos UI base.

### 2.3 Lista Negra de Entidades (No-Schema)
Existen modelos cuya complejidad de negocio, reglas de validación en cascada e interacciones UI especializadas superan los beneficios de un esquema dinámico. Las siguientes entidades **NUNCA** calificarán para schema-driven y requerirán formularios especializados 100% custom en React:
- **`Account` / `JournalEntry` (Contabilidad):** Altamente estructurados, con requerimientos de balanceo en tiempo real, cuadre de columnas, cálculo automático de totales y selectores jerárquicos de nivel de cuenta.
- **`Contact`:** Requiere adaptación dinámica profunda de la UI basada en los flags `is_partner`, `is_customer`, `is_supplier` e interacciones multi-entidad que romperían un esquema lineal.
- **`Product` (Manufacturable):** Su formulario incluye gestión de Bill of Materials (BoM), variantes complejas y listados de atributos dinámicos embebidos en la misma vista de edición.
- **`WorkOrder` (Producción):** Posee controles de estado interactivos, temporizadores, asignación de operarios en tiempo real y componentes de avance visual de producción que un esquema estático no puede representar.

## 3. Consecuencias

- **Positivas:** Se asegura la coherencia visual en todo el sistema (creación y edición serán visualmente idénticas). El nuevo esquema permitirá en el futuro migrar entidades complejas sin perder riqueza visual.
- **Negativas:** Retraso a corto plazo en la estandarización de creación de `Budget`, `ProductCategory` y `UoM` mientras se expande el esquema de backend.
- **Responsabilidad compartida:** El backend deberá construir una respuesta estandarizada más rica, y el frontend deberá implementar un Factory robusto para renderizar la UI solicitada en el esquema dinámicamente.
