---
layer: 20-contracts
doc: component-decision-tree
status: active
owner: frontend-team
last_review: 2026-10-17
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
    A -->|Ver detalle de transacción| E["Drawer de entidad<br/>(openEntity — ADR-0028)"]
    A -->|Otro tipo (Custom)| F(BaseModal)
```

- **`ActionConfirmModal`**: Úsalo siempre que requieras que el usuario confirme una acción antes de ejecutar una llamada asíncrona (conecta con `onConfirm` para manejar estados de carga).
- **`BaseModal`**: Es la primitiva. Nunca uses `Dialog` de shadcn directamente, siempre envuelve en `BaseModal` para garantizar el layout con `ScrollArea` y el footer estándar.

## 1.5 Acciones de Fila y Tarjeta (Row & Card Actions)

> 📄 Contrato completo en **[component-row-actions.md](./component-row-actions.md)**.

Cualquier acción CRUD que aparezca en una fila de `DataTable`, en el footer de una `EntityCard` o en una tarjeta de Kanban DEBE provenir del registry cerrado **`ROW_ACTIONS`** (`@/lib/row-actions`) y renderizarse con uno de los componentes oficiales — nunca con `<Button>` o `<Popover>` hechos a mano.

```mermaid
graph TD
    A["¿Dónde renderizo la acción?"]
    A -->|"Fila de DataTable"| B["createEntityActions + .auto(ctx)"]
    A -->|"Footer de EntityCard / tarjeta Kanban"| C["createEntityActions + .render(item, ctx)"]
    B --> D{"auto() detecta # acciones visibles"}
    D -->|"0"| E["Celda vacía"]
    D -->|"1"| F["DataCell.ActionSingle — ArrowRight en hover"]
    D -->|"2+"| G["DataCell.ActionMenu — kebab MoreVertical"]
    C --> H["DataCell.Action icons individuales"]
```

- **Patrón preferido:** Definir acciones como datos estructurados (`StructuredAction[]`) y usar `.auto(ctx)` — el sistema detecta automáticamente ActionSingle vs ActionMenu.
- **`auto()`** lee `visible` flags en tiempo de render, filtra acciones ocultas, y elige el componente correcto por fila.
- **Cards / Kanban:** `.render(item, ctx)` convierte datos estructurados → iconos `DataCell.Action` individuales.
- **Forma legacy (JSX):** `.column(ctx)` sigue funcionando pero no soporta auto-detección.
- **Acciones específicas del módulo (no CRUD):** usar `action` key del registry o pasar `icon` + `title` propios — se conservan tamaño, tooltip, paleta sidebar.
- **Apertura de modales / sheets vía URL:** usa el hook **`useEntityRouteActions`** (`?selected` edit · `?hub` CollapsibleSheet). Para ver el detalle de una entidad, `openEntity(label, id)` con `mode='view'` ([component-entity-drawers.md](./component-entity-drawers.md), ADR-0028; `?detail` quedó deprecado). Nunca uses `?id`, `?edit` para edición de entidades — `?selected` es el canónico (ver [list-modal-edit-pattern.md](./list-modal-edit-pattern.md)). `?modal` está reservado para apertura de wizards de creación/import (ver [list-modal-edit-pattern.md §9](./list-modal-edit-pattern.md#9-parámetro-modal-para-wizards-de-creaciónimport)). Reserva `?view` exclusivamente para el switch de viewMode.
- **Orden canónico (siempre):** `view → detail → hub → edit → duplicate → pay → deliver → receive → download → print → share → archive → restore → lock/unlock → annul → delete`. `annul` y `delete` siempre al final, en ese orden.
- **`annul` vs `delete`:** `annul` para documentos transaccionales (factura, OV, pago — preserva el registro para auditoría); `delete` para masters/config (categoría, almacén — borra el registro). Ambas son destructivas.
- **Confirmación destructiva obligatoria:** `annul` y `delete` SIEMPRE abren `ActionConfirmModal` con `variant="destructive"`. Nunca destruyen directo.

## 2. Presentación de Datos y Contenedores

```mermaid
graph TD
    A[¿Qué necesitas mostrar?]
    A -->|Dinero o Divisa| B(MoneyDisplay)
    A -->|Estado de una entidad| C(StatusBadge)
    A -->|Tag o etiqueta genérica| D[Chip]
    A -->|Contenedor/Tarjeta simple| E[Card de shadcn]
    A -->|KPI / métrica / stat| H(StatCard)
    A -->|Título de sección dentro de card o listado| I(SectionHeader)
    A -->|Sin resultados/Vacio| F(EmptyState)
    A -->|Reporte jerárquico contable| G(ReportTable)
```

```mermaid
graph TD
    T[¿Qué tipo de tabla o colección?]
    T -->|Colección de una entidad: lista, cards, lista embebida en drawer/ficha| TA("defineEntity + Collection.Root/View (@/components/entity-view)")
    T -->|Pantalla que cambia de entidad: órdenes ↔ notas| TM(CollectionModes)
    T -->|Cantidad a procesar / reparto contra tope en wizard o modal| TB(defineEditable + EditableCollection)
    T -->|Líneas editables de un formulario de documento| TD(FormLineItemsTable / AccountingLinesTable)
    T -->|Reporte jerárquico contable| TE(ReportTable)
    T -->|Kanban, árbol, conciliación u otra vista de dominio| TF("Superficie de la feature sobre EntityCollection<T>")
```

**Colección de una entidad (ADR-0087).** Toda colección nueva o migrada se declara una vez con
`defineEntity<T>()` en `features/<f>/entity-view/<entidad>.entity.ts` y se compone por superficie con
`Collection.*`. Contrato: **[component-entity-view.md](./component-entity-view.md)**.
`DataTable`/`DataTableView`/`AutoEntityCard`/`createEntityFields` están **congelados**: solo para las
pantallas aún no migradas, sin props ni consumidores nuevos ([component-datatable-views.md](./component-datatable-views.md),
[component-fields.md](./component-fields.md)). Las tablas `<table>` hechas a mano en features están prohibidas
(ratchet en `lib/__tests__/entity-view.contract.test.ts`).

**¿Cómo renderizo un campo de una entidad (texto, código, fecha, dinero, flujo, referencia…)?** →
Elegir el **tipo de valor** (`f.text`, `f.code`, `f.date`, `f.money`, `f.flow`, `f.quantity`,
`f.status`, `f.hubStatus`, `f.contact`, `f.tags`, `f.progress`…) en la definición de entidad. Una
referencia a otro documento es `docRef(f, …)` de `@/features/documents`. Si ningún tipo encaja, la
feature registra **su propio tipo** (component-entity-view.md §3); nunca JSX inline ni `DataCell.*`
directamente.

- **`StatusBadge`**: **Obligatorio** para el estado de las entidades (ej. `in_production`, `paid`). Lee `state-map.md`.
- **`SectionHeader`**: **Obligatorio** para títulos de sección dentro de cards y listados. 2 variantes (`card` y `list`). [Ver contrato completo](./component-section-header.md).
- **`StatCard`**: **Obligatorio** para tarjetas de métrica/resumen con label + valor. 3 variantes (default, compact, minimal), 7 acentos, trend, href, onClick. [Ver contrato completo](./component-statcard.md).
- **`Card` de shadcn**: Contenedor estándar para contenido arbitrario (formularios, charts, tablas). [Ver documentación oficial (component-card.md)](./component-card.md).

## 3. Inputs y Formularios

**Regla de entrada:** Para cualquier campo de texto o textarea simple, usa `LabeledInput`. Para casos complejos de negocio, usa las especializaciones.

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
    A -->|"Elegir 1 opción visual (documento, entrega, pago, contacto)"| J(ChoiceCard + ChoiceGroup)
```

- **`LabeledInput`**: Primitivo estándar. Renderiza `fieldset + legend` (patrón Notched). Soporta `as="textarea"`. Compatible con `react-hook-form` via `{...field}`. Ver [component-input.md](./component-input.md).
- **`PeriodValidationDateInput`**: Obligatorio en documentos donde la fecha impacte contabilidad o impuestos para validar si el periodo está cerrado.
- **`FolioValidationInput`**: Úsalo para prevenir folios duplicados por proveedor asíncronamente mientras el usuario tipea.
- **Table Cell Input**: `<Input>` de shadcn sin notched, dentro de `<TableCell>` en una tabla editable (spreadsheet). Ver [component-table-cell-input.md](./component-table-cell-input.md). Usar el shell `FormLineItemsTable` o `AccountingLinesTable`.
- **`ChoiceCard` + `ChoiceGroup`**: "Elige una de estas cartas" en pasos de checkout (documento tributario, entrega, método de pago, contacto) y wizards/selectores ligeros (modo de producción, tipo de recurso, preferencias comerciales). Ver [component-choice-card.md](./component-choice-card.md) — variantes `stacked` (media strip) y `light` (lead + texto + rail).
- **Toolbar Filter Input**: `<Input>` de shadcn para filtros/búsqueda en toolbars compactos. Ver sección de excepciones en [component-input.md](./component-input.md#toolbar-filter-input).

## 4. Layout de Página

- **`PageHeader`**: Para el título de la vista principal, migas de pan y acciones globales arriba a la derecha.
- **`PageTabs`**: Para navegación secundaria dentro de una página.
- **`CollapsibleSheet`**: Cuando necesites un panel lateral con contenido secundario (ej. Ver el detalle de una orden al lado de un listado).
- **`Drawer`**: Superficie modal que se despliega desde los bordes de la página. Compatible con **formularios CRUD** (create/edit) y subvistas de datos (tablas, históricos, libros mayores). Preserva el contexto visual de la página subyacente. Para formularios, usar `side="left"` y dimensionar según la tabla en [component-drawer.md](./component-drawer.md).
- **`EntityDetailPage`**: ~~Shell de página completa para rutas `[id]`.~~ **Eliminado (T-95).** Las rutas `[id]` redirigen server-side a `<list_url>?selected={id}` per ADR-0020. Ver [list-modal-edit-pattern.md](./list-modal-edit-pattern.md).
- **Skeletons (`SkeletonShell`, `CardSkeleton`, `PageLayoutSkeleton`)**: Úsalos durante el renderizado inicial y las transiciones asíncronas para evitar el salto de layout (CLS). El skeleton de tablas está integrado en `Collection.*` (`isLoading` de la fuente) y, en el sistema congelado, en `DataTable` (`isLoading` + `skeletonRows`).


## 5. Formularios y Surfaces

> 📄 Documentación completa en **[component-form-patterns.md](./component-form-patterns.md)**.
> 📄 Para el patrón canónico de edición desde lista (modal + query param `?selected`), consulta **[list-modal-edit-pattern.md](./list-modal-edit-pattern.md)**.

Antes de construir un formulario, decide **qué contenedor** (surface) usar:

```mermaid
graph TD
    A["¿Qué surface necesito?"]
    A -->|"Solo confirmar (Sí/No)"| B(ActionConfirmModal)
    A -->|"Flujo paso a paso (≥3 pasos)"| C(GenericWizard)
    A -->|"CRUD simple (1–6 campos)"| D["BaseModal (sm/md)"]
    A -->|"CRUD estándar (7–15 campos)"| E["BaseModal (lg/xl)<br/>o Drawer (50–55%)"]
    A -->|"Ficha maestra (16+ campos, ≥5 dominios)"| F["BaseModal (full)<br/>+ TabBar vertical<br/>o Drawer (65–75%)"]
    A -->|"Historial / subvista sin perder contexto de página"| H(Drawer)
```

- **`TabBar`**: Obligatorio en Complejo/Ficha Maestra, y en Estándar con ≥5 dominios. Horizontal para 2–4 tabs; Vertical (sawtooth) para ≥5 tabs o modal `xl`+. Ver [component-form-patterns.md §3](./component-form-patterns.md).
- **`FormSplitLayout`**: Obligatorio en modo edición para integrar `ActivitySidebar`.
- **`FormSection`**: Separador visual dentro de un tab o formulario sin tabs.
- **`FormFooter`**: **Obligatorio** en todo formulario modal. Layout de botones: danger (izquierda) + cancel/submit (derecha). Nunca `<div>` raw.
- **`Drawer`**: Para subvistas que se superponen sobre la página sin perder su contexto. Compatible con formularios CRUD y subvistas de solo lectura (tablas, históricos). Ancho recomendado: `40%–75%` según categoría del formulario (ver [component-drawer.md](./component-drawer.md)).

---

## 6. Botón de cierre (Cross) — Regla canónica

**`SheetCloseButton` (`@/components/shared/SheetCloseButton`) es la única cruz permitida** en toda la aplicación: modales, drawers, sheets y panels.

- ✅ `BaseModal` y `Drawer` ya renderizan `SheetCloseButton` vía `PanelHeader` (prop `showCloseButton` / `onClose`).
- ✅ `UniversalSearch` usa `SheetCloseButton` inline (excepción autorizada).
- ❌ **Prohibido**: usar el X nativo de Radix (`DialogPrimitive.Close` / `SheetPrimitive.Close` desde `@/components/ui/`).
- ❌ **Prohibido**: `<X />` o `<Button><X /></Button>` inline como botón de cerrar.
- ❌ **Prohibido**: modificar `components/ui/dialog.tsx` o `components/ui/sheet.tsx` para cambiar el estilo del X.

El ESLint rule `dialog/no-direct-usage` (error) bloquea imports directos de `DialogContent`/`SheetContent` fuera de la allowlist. Ver [ADR-0091](../10-architecture/adr/0091-single-close-button.md) y [component-contracts.md](./component-contracts.md#SheetCloseButton-🟢).
