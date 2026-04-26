---
layer: 20-contracts
doc: form-layout-architecture
status: active
owner: frontend-team
last_review: 2026-04-25
changelog:
  - 2026-04-25: Agregado contrato completo de ActivitySidebar (§5). Reglas de cuándo usar, posición, separadores, entityType válidos. Corrección de padding §4 (px-1→px-4). FormFooter obligatorio en §7.
stability: contract-changes-require-ADR
preconditions:
  - component-form-patterns.md
  - component-visual-hierarchy.md
---

# Form Layout Architecture

Este contrato define las reglas estructurales para organizar componentes **dentro** de formularios. Para decisiones de más alto nivel (qué surface usar, cuándo usar tabs, cuándo derivar a un wizard), ver **[component-form-patterns.md](./component-form-patterns.md)**.

## 1. Grid Systems

El proyecto usa dos sistemas de grid dependiendo del tamaño del contenedor:

### 4-Column Grid (Modals, Sheets, Sidebars)
Standard para contenedores medianos a pequeños (e.g., `BaseModal` size `md` a `lg`).
- **Base Class**: `grid grid-cols-4 gap-4`
- **Logic**: Permite granularidad de 25% (1/4, 1/2, 3/4, Full).

### 12-Column Grid (Main Pages, Full-Screen Views)
Standard para formularios desktop-first con alta densidad de datos.
- **Base Class**: `grid grid-cols-12 gap-6`
- **Logic**: Permite layouts más complejos (e.g., 1/3, 1/6 increments).

---

## 2. Standard Field Widths (4-Column System)

Los campos deben tener un ancho proporcional a los datos que contienen y su importancia.

| Data Type | Standard Span | Rationale |
| :--- | :--- | :--- |
| **Primary Names / IDs** | `col-span-3` or `Full` | High visibility, usually contains long text. |
| **Short Metadata** (Priority, Code) | `col-span-1` | Compact data. Use `font-mono` and `font-black`. |
| **Entity Selectors** (Product, Account) | `col-span-3` or `Full` | Needs room for names and internal badges. |
| **Standard Selects** (Status, Category) | `col-span-1` or `col-span-2` | Depends on text length of options. |
| **Dates / Times** | `col-span-2` | Standard width for consistency with other date fields. |
| **Price / Quantity** | `col-span-1` | Always `font-mono font-black`. If paired, use 1:1 ratio. |
| **Boolean Toggles** (Notched) | `col-span-1` to `Full` | Description left, Switch right. Use border-dashed if inactive. |
| **Text Areas / Notes** | `Full` | Maximum room for multi-line text. |

---

## 3. Semantic Ordering (The Layered Approach)

Seguir este orden dentro del flujo vertical del formulario para mejorar la cognición del usuario:

### Layer 1: Scope & Context (The "What")
- **Components**: Name, Code, Product, Category, Customer.
- **Goal**: Identify the entity being created/edited.

### Layer 2: Configuration & Parameters (The "How")
- **Components**: Quantities, Rules, Filters, Types, Methods.
- **Goal**: Define the logic of the action.

### Layer 3: Results & Impacts (The "Outcome")
- **Components**: Price (Net/Gross), Discounts, Totals, Taxes.
- **Goal**: Show the immediate effect of the configuration.

### Layer 4: Lifecycle & Metadata (The "When/Status")
- **Components**: Validity dates, Active/Inactive status, Internal notes.
- **Goal**: Manage state and history.

---

## 4. Spacing & Separators

- **Between Sections**: Use `FormSection` with icons and a standard vertical gap (`space-y-6` on form, but `pt-4` inside `FormSection`).
- **Between Fields**: `gap-4` (Standard) or `gap-6` (Complex grids).
- **Internal Padding (forma directa en BaseModal)**: Usar `px-4 pb-4 pt-2` en el contenedor `<form>` cuando el modal mantiene su `ScrollArea` nativa.
- **Internal Padding (con FormSplitLayout)**: Pasar `contentClassName="p-0"` **y** `hideScrollArea={true}` al `BaseModal`. El padding lo inyecta `FormSplitLayout` en su área principal. Ver [§6](#6-split-layouts-formspitlayout) para el patrón completo.

> **Anti-patrón "double padding"**: Nunca dejar el padding por defecto de `BaseModal` (`p-6`) activo cuando `FormSplitLayout` es el hijo directo. Obtendrás padding duplicado y dos barras de scroll. Ver [§6](#6-split-layouts-formspitlayout).

---

## 5. Form Structure Components

### FormSection 🟢

Separador visual estandarizado para agrupar campos lógicamente. Implementa el **Level 1** de la [jerarquía visual](./component-visual-hierarchy.md).

```tsx
<FormSection title="Alcance y Referencia" icon={Layers} />
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `title` | `string` | ✅ | — | Texto del separador |
| `icon` | `LucideIcon \| ElementType` | ❌ | — | Icono opcional a la izquierda |
| `className` | `string` | ❌ | — | Clases adicionales |

Patrón visual: `──── [Icon] TITLE ────` (línea-título-línea centrada).

#### ¿Cuándo usar FormSection?

| Señal | Decisión |
|:---|:---|
| Formulario con **≥2 grupos temáticos distintos** (ej: identidad + ubicación + contacto) | ✅ Usar `FormSection` para separar cada grupo |
| Formulario con **un grupo condicional** que aparece/desaparece (ej: opciones de lista, detalles de envío) | ✅ Usar `FormSection` para el grupo condicional |
| Formulario con **≥15 campos** que necesitan orientación visual para el escaneo | ✅ Usar `FormSection` |
| Formulario embebido en tabs donde cada tab ya es un dominio lógico | ✅ Usar solo si dentro del tab hay ≥2 sub-grupos |

#### ¿Cuándo NO usar FormSection?

| Señal | Decisión |
|:---|:---|
| Formulario con **≤6 campos todos del mismo dominio** (ej: UoM: nombre, categoría, tipo, ratio) | ❌ No usar — el título del modal ya provee contexto |
| Formulario con **1 solo campo** (ej: renombrar grupo, cambiar estado) | ❌ No usar — es ruido visual |
| **Una sola sección** que abarcaría todo el formulario | ❌ No usar — si todo pertenece al mismo tema, el separador no separa nada |
| El título del `FormSection` es idéntico o redundante con el título del modal/tab | ❌ No usar — información duplicada |

> **Regla de oro**: Un `FormSection` solo se justifica cuando el usuario **necesita saber que los campos que siguen pertenecen a un tema diferente** del anterior. Si todos los campos hablan del mismo tema, el separador es ruido.

### FormSplitLayout 🟢

Layout estándar para formularios en modo edición que incluyen un sidebar de auditoría/actividad.

```tsx
<FormSplitLayout
    sidebar={<ActivitySidebar entityId={id} entityType="product" />}
    showSidebar={!!initialData?.id}
>
    {/* Form Content / Tabs */}
</FormSplitLayout>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `children` | `ReactNode` | ✅ | — | Contenido principal del formulario |
| `sidebar` | `ReactNode` | ❌ | — | Contenido del sidebar (típicamente `ActivitySidebar`) |
| `showSidebar` | `boolean` | ❌ | `false` | Mostrar sidebar (típicamente solo en edit mode) |
| `sidebarWidth` | `string` | ❌ | `"w-72"` | Ancho del sidebar |
| `className` | `string` | ❌ | — | Clases para el área del formulario |

**Reglas:**
- El sidebar solo se muestra en modo **edición** (`showSidebar={!!initialData?.id}`).
- El sidebar es `hidden lg:flex` por defecto (responsive).
- El área del formulario es scrollable; el sidebar es fijo.

### ActivitySidebar 🟢

Sidebar de auditoría que muestra el historial de cambios de una entidad (via Django Simple History). Se integra **exclusivamente** como prop `sidebar` de `FormSplitLayout`; nunca se instancia de forma independiente.

```tsx
<FormSplitLayout
    sidebar={<ActivitySidebar entityId={initialData.id} entityType="employee" />}
    showSidebar={!!initialData?.id}
>
    {/* Form Content */}
</FormSplitLayout>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `entityId` | `number \| string` | ✅ | — | PK de la entidad — nunca pasar si no existe aún |
| `entityType` | ver tabla abajo | ✅ | — | Tipo registrado en Django Simple History |
| `title` | `string` | ❌ | `"Actividad"` | Título del header interno del sidebar |
| `className` | `string` | ❌ | `""` | Solo para spacing overrides puntuales |

#### Valores válidos de `entityType`

| Valor | Entidad |
|:------|:--------|
| `product` | Producto |
| `contact` | Contacto |
| `sale_order` | Orden de venta |
| `purchase_order` | Orden de compra |
| `invoice` | Factura |
| `payment` | Pago |
| `sale_delivery` | Despacho |
| `purchase_receipt` | Recepción de compra |
| `user` | Usuario |
| `company_settings` | Configuración de empresa |
| `work_order` | Orden de trabajo |
| `journal_entry` | Asiento contable |
| `stock_move` | Movimiento de stock |
| `pricing_rule` | Regla de precio |
| `reordering_rule` | Regla de reabastecimiento |
| `treasuryaccount` | Cuenta de tesorería |
| `bank` | Banco |
| `paymentmethod` | Método de pago |
| `terminal` | Terminal POS |
| `category` | Categoría |
| `warehouse` | Bodega |
| `uom` | Unidad de medida |
| `uom_category` | Categoría de UoM |
| `attribute` | Atributo de variante |
| `account` | Cuenta contable |
| `bank_journal` | Diario bancario |
| `employee` | Empleado |
| `salaryadvance` | Anticipo de sueldo |

> Si una entidad nueva necesita historial, agregar su valor aquí **y** registrar el modelo en Django Simple History. Son dos cambios coordinados.

#### ¿Cuándo usar ActivitySidebar?

| Condición | Decisión |
|:----------|:---------|
| Modo **edición** con `initialData?.id` o `entity?.id` definido | ✅ Siempre mostrar |
| Formulario de categoría **Estándar, Complejo o Ficha Maestra** | ✅ Válido |
| Modo **creación** (sin ID todavía) | ❌ Nunca — no hay historia que mostrar |
| Formulario **Micro o Simple** (1–6 campos) | ❌ No — ocupa demasiado espacio relativo |
| Dentro de `GenericWizard` | ❌ No — los wizards no tienen modo edición |
| Dentro de `ActionConfirmModal` | ❌ No — no es un formulario |
| Dentro de `BaseDrawer` | ❌ No — BaseDrawer ya es una subvista de solo lectura |

#### Posición en el layout

El sidebar **siempre** ocupa el lado derecho del área del formulario. Lo posiciona `FormSplitLayout`; no se debe mover ni reposicionar manualmente.

```
BaseModal (hideScrollArea + contentClassName="p-0")
  └─ FormTabs [opcional]
       └─ FormTabsContent
            └─ FormSplitLayout          ← gestiona la bipartición
                 ├─ form (izquierda, flex-1, scrollable)
                 └─ ActivitySidebar     ← SIEMPRE derecha, w-72, fijo
```

- **Ancho fijo**: `w-72` (288 px). No modificar.
- **Responsive**: el sidebar es `hidden lg:flex` — en pantallas < lg no se muestra. No añadir fallback visible.
- **Scroll**: el sidebar tiene su propio `ScrollArea` interno; el área del formulario tiene el suyo. Ambos son independientes.

#### Separadores

| Separador | Quién lo provee | Clase |
|:----------|:----------------|:------|
| Línea vertical entre form y sidebar | `FormSplitLayout` | `border-l bg-muted/5` |
| Línea horizontal bajo el título interno del sidebar | `ActivitySidebar` internamente | `border-b pb-3 mb-4` |

**Regla**: no añadir `border`, `shadow`, ni `Card` alrededor de `ActivitySidebar`. El único separador exterior es el `border-l` que inyecta `FormSplitLayout`.

#### Pattern completo (modo edición con tabs)

```tsx
// BaseModal con tabs vertical — el sidebar va DENTRO del primer tab
<BaseModal
    size={initialData ? "xl" : "lg"}
    hideScrollArea={true}
    contentClassName="p-0"
    allowOverflow={true}
    footer={<FormFooter actions={<>...</>} />}
>
    <FormTabs orientation="vertical" ...>
        <FormTabsContent value="general">
            <FormSplitLayout
                sidebar={<ActivitySidebar entityId={initialData.id} entityType="product" />}
                showSidebar={!!initialData?.id}
            >
                <form className="space-y-6 px-4 pb-4 pt-2">
                    {/* campos */}
                </form>
            </FormSplitLayout>
        </FormTabsContent>
        <FormTabsContent value="config">
            {/* sin sidebar en tabs secundarios */}
        </FormTabsContent>
    </FormTabs>
</BaseModal>
```

> El sidebar **solo aparece en el primer tab** (o en el tab de "General"). Los tabs secundarios no lo repiten.

---

### FormFooter 🟢

Layout estandarizado para el footer de formularios y modales.

```tsx
<FormFooter
    leftActions={<DangerButton onClick={handleDelete}>Eliminar</DangerButton>}
    actions={
        <>
            <CancelButton onClick={close} />
            <SubmitButton loading={isPending}>Guardar</SubmitButton>
        </>
    }
/>
```

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `actions` | `ReactNode` | ✅ | — | Acciones principales (derecha): Cancel + Submit |
| `leftActions` | `ReactNode` | ❌ | — | Acciones secundarias/peligrosas (izquierda): Delete, Void |
| `className` | `string` | ❌ | — | Clases adicionales |

**Reglas de footer:**
- **Primary Action**: `SubmitButton` o `ActionSlideButton` con `shadow-lg shadow-primary/20`.
- **Secondary**: `CancelButton` (Outline/Ghost) a la izquierda del primary.
- **Contextual**: Danger actions (`DangerButton`) al extremo izquierdo.
- **Typography**: Todos los botones deben ser `font-black text-[11px] uppercase tracking-widest`.

---

## 6. Split Layouts (FormSplitLayout)

Cuando un formulario incluye un sidebar de auditoría o actividad (típicamente en modo "Edit"), usar el componente `FormSplitLayout`.

### Standard Configuration
- **Sidebar Width**: `w-72` fixed.
- **Form Area**: Scrollable and flexible.
- **Sidebar Slot**:
    - **Visuals**: `border-l bg-muted/5`
    - **Responsive**: `hidden lg:flex` (Standard for high-density forms)

### Implementation Pattern
> [!WARNING]
> **Anti-Patrón de Doble Padding:** `BaseModal` inyecta padding (`p-6`) y scroll por defecto. `FormSplitLayout` también inyecta su propio padding y scroll. Si usas ambos sin configuración, obtendrás barras de scroll dobles y paddings gigantes. **SIEMPRE** debes pasar `hideScrollArea={true}` y `contentClassName="p-0"` al `BaseModal` cuando su hijo directo sea `FormSplitLayout`.

```tsx
<BaseModal
    open={open}
    onOpenChange={setOpen}
    size="lg"
    hideScrollArea={true}   // 1. Elimina el ScrollArea default y su p-6
    contentClassName="p-0"  // 2. Asegura que el contenedor no tenga margen
>
    <FormSplitLayout 
        sidebar={<ActivitySidebar entityId={id} entityType="type" />}
        showSidebar={!!initialData?.id}
    >
        <form className="space-y-6">
            {/* Form Content */}
        </form>
    </FormSplitLayout>
</BaseModal>
```

---

## 7. Form Footer

Todo formulario modal **debe** usar `FormFooter` en la prop `footer` de `BaseModal`. Nunca usar `<div>` raw.

**Reglas:**
- **Primary Action**: `SubmitButton` o `ActionSlideButton` — obligatorio a la derecha.
- **Secondary**: `CancelButton` (Outline/Ghost) — obligatorio a la izquierda del primary.
- **Contextual**: `DangerButton` (Delete, Void) — al extremo izquierdo via `leftActions`.
- **Typography**: Todos los botones deben ser `font-black text-[11px] uppercase tracking-widest`.

### Footer estándar (sin acciones peligrosas)

```tsx
<BaseModal
    footer={
        <FormFooter
            actions={
                <>
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <SubmitButton loading={isPending} form="my-form-id">
                        Guardar Cambios
                    </SubmitButton>
                </>
            }
        />
    }
>
```

### Footer con acción peligrosa (izquierda)

```tsx
<BaseModal
    footer={
        <FormFooter
            leftActions={
                <DangerButton onClick={handleDelete} loading={isDeleting}>
                    Eliminar
                </DangerButton>
            }
            actions={
                <>
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <SubmitButton loading={isPending} form="my-form-id">
                        Guardar Cambios
                    </SubmitButton>
                </>
            }
        />
    }
>
```

> ❌ **Forbidden**: `<div className="flex justify-end gap-3">` directo como footer. Siempre `FormFooter`.

> Ver [component-button.md](./component-button.md) para la API completa de `CancelButton`, `SubmitButton` y `ActionSlideButton`.
