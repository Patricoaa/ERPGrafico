---
layer: 20-contracts
doc: component-decision-tree
status: active
owner: frontend-team
last_review: 2026-05-06
stability: stable
---

# Component Decision Tree

Use esta guía rápida para decidir qué componente de interfaz gráfica debe utilizar para resolver un problema específico. Esto garantiza consistencia visual y evita duplicación de código.

## 1. Modales y Diálogos

```mermaid
graph TD
    A[¿Qué tipo de Modal necesitas?]
    A -->|Confirmar acción (Ej. Eliminar)| B(ActionConfirmModal)
    A -->|Proceso paso a paso| C(GenericWizard)
    A -->|Completar/Adjuntar Factura| D(DocumentCompletionModal)
    A -->|Ver detalle de transacción| E(TransactionViewModal)
    A -->|Otro tipo (Custom)| F(BaseModal)
```

- **`ActionConfirmModal`**: Úsalo siempre que requieras que el usuario confirme una acción antes de ejecutar una llamada asíncrona (conecta con `onConfirm` para manejar estados de carga).
- **`BaseModal`**: Es la primitiva. Nunca uses `Dialog` de shadcn directamente, siempre envuelve en `BaseModal` para garantizar el layout con `ScrollArea` y el footer estándar.

## 2. Presentación de Datos y Contenedores

```mermaid
graph TD
    A[¿Qué necesitas mostrar?]
    A -->|Dinero o Divisa| B(MoneyDisplay)
    A -->|Estado de una entidad| C(StatusBadge)
    A -->|Tag o etiqueta genérica| D[Badge de shadcn]
    A -->|Contenedor/Tarjeta simple| E[Card de shadcn]
    A -->|Sin resultados/Vacio| F(EmptyState)
    A -->|Reporte jerárquico contable| G(ReportTable)
```

- **`MoneyDisplay`**: **Obligatorio** para montos. Nunca uses `Number.prototype.toLocaleString()` en bruto.
- **`StatusBadge`**: **Obligatorio** para el estado de las entidades (ej. `in_production`, `paid`). Lee `state-map.md`.
- **`Card` de shadcn**: Contenedor estándar. [Ver documentación oficial (component-card.md)](./component-card.md). Nunca uses wrappers propietarios y está **estrictamente prohibido** emular tarjetas usando clases utilitarias crudas (ej. `<div className={FORM_STYLES.card}>`). Usa siempre `<Card variant="...">`.

## 3. Inputs y Formularios

**Regla de entrada:** Para cualquier campo de texto o textarea simple, usa `LabeledInput`. Para casos complejos de negocio, usa las especializaciones.

> [!WARNING]
> `FORM_STYLES.label` y `FORM_STYLES.input` están **deprecated**. No usarlos en código nuevo.

```mermaid
graph TD
    A["¿Qué tipo de Input?"]
    A -->|Texto, número, email, password simple| B(LabeledInput)
    A -->|Textarea / multiline| B
    A -->|Subir/Arrastrar Archivo| C(DocumentAttachmentDropzone)
    A -->|Seleccionar Fecha simple| D(DatePicker)
    A -->|Fecha con validación de Cierre| E(PeriodValidationDateInput)
    A -->|Folio de DTE| F(FolioValidationInput)
    A -->|Rango de fechas - Filtro| G(DateRangeFilter)
    A -->|"Input en celda de tabla editable"| H(["Table Cell Input \n raw shadcn — ver contrato"])
    A -->|"Búsqueda/filtro en toolbar"| I(["Toolbar Filter Input \n raw shadcn — ver contrato"])
```

- **`LabeledInput`**: Primitivo estándar. Renderiza `fieldset + legend` (patrón Notched). Soporta `as="textarea"`. Compatible con `react-hook-form` via `{...field}`. Ver [component-input.md](./component-input.md).
- **`PeriodValidationDateInput`**: Obligatorio en documentos donde la fecha impacte contabilidad o impuestos para validar si el periodo está cerrado.
- **`FolioValidationInput`**: Úsalo para prevenir folios duplicados por proveedor asíncronamente mientras el usuario tipea.
- **Table Cell Input**: `<Input>` de shadcn sin notched, dentro de `<TableCell>` en una tabla editable (spreadsheet). Ver [component-table-cell-input.md](./component-table-cell-input.md). Usar el shell `FormLineItemsTable` o `AccountingLinesTable`.
- **Toolbar Filter Input**: `<Input>` de shadcn para filtros/búsqueda en toolbars compactos. Ver sección de excepciones en [component-input.md](./component-input.md#toolbar-filter-input).

## 4. Layout de Página

- **`PageHeader`**: Para el título de la vista principal, migas de pan y acciones globales arriba a la derecha.
- **`PageTabs`**: Para navegación secundaria dentro de una página.
- **`CollapsibleSheet`**: Cuando necesites un panel lateral con contenido secundario (ej. Ver el detalle de una orden al lado de un listado).
- **`BaseDrawer`**: Panel inferior (bottom drawer) para subvistas secundarias ricas en datos (tablas, históricos, libros mayores) **cuando el usuario no debe perder el contexto visual de la página principal**. El drawer se superpone parcialmente sin tapar la UI subyacente. No usar para formularios — solo para lectura/navegación de datos relacionados.
- **`EntityDetailPage`**: Shell de página completa para rutas `[id]` de entidades del Universal Registry. Provee header sticky (icono + displayId + breadcrumb), slot de form (`children`), sidebar opcional (`ActivitySidebar`) y footer de acciones. Usar cuando el detalle de una entidad vive en `/[module]/[entity-plural]/[id]`. Soporta prop `readonly` para entidades sin form editable. Ver [module-layout-navigation.md §7](./module-layout-navigation.md#7-searchable-entity-detail-route).
- **Skeletons (`SkeletonShell`, `CardSkeleton`, `TableSkeleton`)**: Úsalos durante el renderizado inicial y las transiciones asíncronas para evitar el salto de layout (CLS).


## 5. Formularios y Surfaces

> 📄 Documentación completa en **[component-form-patterns.md](./component-form-patterns.md)**.

Antes de construir un formulario, decide **qué contenedor** (surface) usar:

```mermaid
graph TD
    A["¿Qué surface necesito?"]
    A -->|"Solo confirmar (Sí/No)"| B(ActionConfirmModal)
    A -->|"Flujo paso a paso (≥3 pasos)"| C(GenericWizard)
    A -->|"CRUD simple (1–6 campos)"| D["BaseModal (sm/md)"]
    A -->|"CRUD estándar (7–15 campos)"| E["BaseModal (lg/xl)"]
    A -->|"Ficha maestra (16+ campos, ≥5 dominios)"| F["BaseModal (full)<br/>+ FormTabs vertical"]
    A -->|"Panel junto a listado"| G(CollapsibleSheet)
    A -->|"Historial / subvista sin perder contexto de página"| H(BaseDrawer)
```

- **`FormTabs`**: Obligatorio en Complejo/Ficha Maestra, y en Estándar con ≥5 dominios. Horizontal para 2–4 tabs; Vertical (sawtooth) para ≥5 tabs o modal `xl`+. Ver [component-form-patterns.md §3](./component-form-patterns.md).
- **`FormSplitLayout`**: Obligatorio en modo edición para integrar `ActivitySidebar`.
- **`FormSection`**: Separador visual dentro de un tab o formulario sin tabs.
- **`FormFooter`**: **Obligatorio** en todo formulario modal. Layout de botones: danger (izquierda) + cancel/submit (derecha). Nunca `<div>` raw.
- **`BaseDrawer`**: Para subvistas de solo lectura (tablas, históricos) que se superponen sobre la página sin perder su contexto. Altura máxima `90vh`. No usar para formularios.
