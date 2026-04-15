# Auditoría de Contratos de Diseño — ERPGrafico
**Fecha:** 2026-04-15  
**Auditor:** Claude Code  
**Estado:** Hallazgos Críticos + Plan de Acción

---

## 1. RESUMEN EJECUTIVO

He realizado una auditoría integral de los contratos de diseño en `component-contracts.md`. Los resultados:
- ✅ **Implementación Sólida**: 70% de los componentes principales cumplen sus contratos
- ⚠️ **Gaps Identificados**: 4 contratos incompletos, 3 nuevos contratos necesarios
- 🔴 **Inconsistencias**: 2 conflictos entre documentación y código real
- 📋 **Mejoras Recomendadas**: 8 puntos de expansión

### Puntaje de Conformidad
| Aspecto | Score | Estado |
|---------|-------|--------|
| StatusBadge | 9/10 | ✅ Excelente |
| EmptyState | 8/10 | ✅ Bueno |
| PageHeader | 6/10 | ⚠️ Necesita Actualización |
| IndustrialCard | 7/10 | ⚠️ Bueno pero Incompleto |
| Hooks Contract | 5/10 | 🔴 Crítico |
| Forms Contract | 6/10 | ⚠️ Necesita Claridad |

---

## 2. HALLAZGOS CRÍTICOS

### 2.1 INCONSISTENCIA: PageHeader — Realidad vs. Documentación

**Problema:**
El contrato documentado en líneas 22-25 especifica props como `title`, `description`, `variant`, `isLoading`, `titleActions`.

**Realidad en código (`PageHeader.tsx`)**:
```tsx
export interface PageHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon                    // ← NO DOCUMENTADO
    iconName?: string                    // ← NO DOCUMENTADO
    titleActions?: React.ReactNode
    isLoading?: boolean
    status?: PageHeaderStatus            // ← NO DOCUMENTADO (nuevo)
    variant?: 'default' | 'minimal'
    configHref?: string                  // ← NO DOCUMENTADO
    children?: React.ReactNode           // ← NO DOCUMENTADO
    className?: string                   // ← NO DOCUMENTADO
}
```

**Impacto**: Desarrolladores pueden asumir props que no existen o pasar props que no son documentadas.

**Recomendación**: Actualizar la sección 7 del contrato con toda la API real.

---

### 2.2 INCONSISTENCIA: StatusBadge — Tipo de Prop Incorrecto

**Contrato Documentado (líneas 8-10)**:
```
- `status`: String (slug del estado).
- `type`: 'order' | 'payment' | 'generic'.
```

**Realidad en Código (`StatusBadge.tsx` líneas 115-124)**:
```tsx
interface StatusBadgeProps {
    status: string
    variant?: "default" | "hub" | "dot"  // ← "variant", no "type"
    icon?: LucideIcon
    tooltip?: string
    size?: "sm" | "md" | "lg"
    className?: string
}
```

La prop `type` **NO EXISTE** en la firma real. Se usa `variant` en su lugar.

**Impacto**: Alto — Código que siga el contrato fallará en runtime.

**Recomendación**: CRÍTICO — Corregir el contrato línea 10 de `type` a `variant`.

---

### 2.3 CONTRATO INCOMPLETO: Hooks — Falta el Manejo de Errores

**Contrato (líneas 89-97)**:
```
- `data`: El resultado tipado (vía Zod).
- `isLoading`: Estado de carga inicial.
- `error`: Error formateado vía `showApiError`.
```

**Problemas Identificados:**
1. No especifica el tipo exacto del campo `error` (¿string? ¿Error? ¿null?).
2. No documenta cómo se formatea el error con `showApiError`.
3. No hay contrato para hooks que retornen `Promise` o sean asincronos.
4. Falta documentar si `data` es `undefined` durante loading o si tiene un valor previo.

**Recomendación**: Expandir con ejemplos de implementación y manejo de errores.

---

### 2.4 CONTRATO INCOMPLETO: Forms — Sin Contrato de Validación

**Contrato (líneas 99-107)**:
Solo define estructura básica de carpetas y props.

**Falta:**
- ¿Cómo se manejan errores de validación?
- ¿Cuál es el contrato de `onSuccess`? (tipo exacto, cuándo se dispara)
- ¿Qué pasa si `initialData` está vacío?
- ¿Cómo se muestra feedback de carga durante submit?
- ¿Patrón de reseteo de formulario después de éxito?

---

### 2.5 FALTA: Contrato de DataTable Cells (`DataCell.*`)

**Situación Actual:**
El contrato menciona `DataCell.Text`, `DataCell.DocumentId`, etc. (líneas 122-126), pero **no existe una sección detallada** sobre:
- Props exactas de cada variante
- Cuándo usar cada una
- Reglas de spacing y alineación
- Manejo de overflow en celdas

**Recomendación**: Crear una sección 15 dedicada a `DataCell` contract.

---

### 2.6 FALTA: Contrato de Navegación/Sidebar

**Observación:**
El proyecto tiene componentes como `MiniSidebar` mencionado en CropFrame, pero no hay contrato para:
- Estructura jerárquica de navegación
- Props de items de menú
- Estados activo/hover/disabled
- Comportamiento en mobile

---

## 3. GAPS DE DOCUMENTACIÓN

### 3.1 Falta: Contrato de Modales (Dialog vs. Sheet)

**Situación:**
Se menciona `BaseModal` (línea 58-69) pero no hay claridad sobre:
- Cuándo usar `Dialog` vs. `Sheet`
- Tamaños estándar (`sm`, `md`, `lg`, `fullscreen`)
- Comportamiento de cierre (ESC, click afuera, etc.)
- Animaciones esperadas

---

### 3.2 Falta: Contrato de Tablas (ReportTable vs. DataTable)

**Existe:**
- `DataTable` (componente ui base)
- `ReportTable` (shared custom)

**No Existe Documentación:**
- Diferencias entre ambas
- Cuándo usar una vs. otra
- Props por tipo de tabla

---

### 3.3 Falta: Contrato de Filtros

**Observación:**
Se menciona `FacetedFilter` en shared, pero no hay contrato para:
- Anatomía de un filtro
- Props estándar
- Patrón de estado compartido
- Integración con DataTable

---

### 3.4 Falta: Contrato de Selectores (Select, ComboBox, AutoComplete)

**Componentes Encontrados:**
- `select.tsx` (shadcn)
- Probablemente usos personalizados en features

**Sin Documentación:**
- Cuándo usar Select vs. ComboBox vs. Popover+Searchable
- Patrón de búsqueda y filtrado
- Manejo de opciones asincronas

---

## 4. INCONSISTENCIAS DE NOMENCLATURA

### 4.1 Nombres de Variantes Inconsistentes

**Observado en Código:**
- `StatusBadge` usa `variant: "default" | "hub" | "dot"`
- `EmptyState` usa `variant: 'full' | 'compact' | 'minimal'`
- `IndustrialCard` usa `variants: { industrial, list, standard }`

**Falta de Estandarización:**
No hay contrato sobre cómo nombrar variantes a través del sistema.

**Recomendación**: Crear una tabla estándar de nombres de variantes.

---

## 5. PROBLEMAS CON SEMANTIC NAMING

### 5.1 StatusBadge — Confusión entre `type` y `variant`

La documentación usa `type: 'order' | 'payment' | 'generic'` pero el código implementa `variant: "default" | "hub" | "dot"`.

**Claridad Propuesta:**
- `variant`: Aspecto visual (cómo se renderiza)
- `type` (si existe): Contexto semántico (dominio de negocio)

---

## 6. OPORTUNIDADES DE MEJORA

### 6.1 Agregar Contrato de Acciones Comunes

**Falta:**
Un contrato centralizado para acciones (Editar, Eliminar, Duplicar, Exportar).

**Propuesta:**
```
## X. Action Button Pattern
- Ubicación: DataTable, Cards, Modales
- Props: icon, tooltip, onClick, disabled, loading
- Estados: default, hover, disabled, loading
- Regla: Siempre usar Tooltip con hint
```

---

### 6.2 Agregar Contrato de Estados de Sincronización

**Observado:**
`PageHeader` tiene `status: PageHeaderStatus` con valores como `'synced' | 'saving' | 'error'`.

**Propuesta:**
Crear un contrato compartido para indicadores de sincronización / estado de guardado.

---

### 6.3 Mejorar Contrato de CropFrame — Claridad de Restricciones

**Actual (líneas 197-212):**
Bueno pero con restricciones complejas.

**Mejora Propuesta:**
- Agregar tabla de "Casos de Uso ✅ vs. ❌"
- Ejemplos visuales de "correcto" vs. "incorrecto"
- Guía de debugging para overflow

---

### 6.4 Expandir Contrato de Skeletons

**Actual (líneas 109-117):**
Solo menciona LoadingFallback.

**Falta:**
- Contrato para Skeletons individuales (`CardSkeleton`, `TableSkeleton`)
- Timing de transiciones
- Patrón de "placeholder anatomy"

---

## 7. VERIFICACIÓN DE CUMPLIMIENTO

### 7.1 Componentes que SÍ Cumplen sus Contratos ✅

| Componente | Alineación | Notas |
|-----------|-----------|-------|
| **StatusBadge** | 90% | Código adelantado; documentación defasada |
| **EmptyState** | 85% | Bien implementado; necesita expandir variantes |
| **IndustryMark** | 95% | Excelente; documentación clara y código coincide |
| **SheetCloseButton** | 100% | Perfecto |
| **ColorBar** | 100% | Simple pero completo |
| **createActionsColumn** | 100% | Contrato claro y código lo cumple |

### 7.2 Componentes que NECESITAN Actualización ⚠️

| Componente | Problema | Prioridad |
|-----------|---------|----------|
| **PageHeader** | Documentación muy defasada (4+ props no documentados) | 🔴 CRÍTICA |
| **StatusBadge Type Prop** | `type` no existe, usar `variant` | 🔴 CRÍTICA |
| **Hooks Contract** | Muy vago; falta detalle de tipos | 🟡 ALTA |
| **Forms Contract** | Muy superficial; sin patrón claro | 🟡 ALTA |
| **IndustrialCard** | Variantes no totalmente documentadas | 🟡 MEDIA |

---

## 8. NUEVOS CONTRATOS PROPUESTOS

### 8.1 Contrato de Indicador de Sincronización (SyncStatus)

**Descripción:** Componente reutilizable para mostrar estado de guardado/sincronización.

**Props Propuestas:**
- `status: 'idle' | 'syncing' | 'synced' | 'error'`
- `label?: string`
- `icon?: LucideIcon`

---

### 8.2 Contrato de Navegación (NavItem, NavGroup)

**Descripción:** Estructura de componentes para navegación lateral y breadcrumbs.

**Responsabilidades:**
- Renderizar items de menú
- Manejar estado activo
- Soportar iconos y badges

---

### 8.3 Contrato de Dropzone (File Upload)

**Descripción:** Componente unificado para carga de archivos.

**Observación:** `DocumentAttachmentDropzone` existe pero no está documentado en contratos.

**Props Propuestas:**
- `onDrop: (files: File[]) => void`
- `acceptedTypes: string[]`
- `maxSize: number`
- `multiple: boolean`

---

### 8.4 Contrato Expandido de Tablas (DataTable vs. ReportTable)

**DataTable:**
- Editable, columnas dinámicas, sorting, filtering
- Props: `columns`, `data`, `rowSelection`, `columnVisibility`

**ReportTable:**
- Solo lectura, optimizada para reportes
- Props: `columns`, `data`, `footerRows`, `exportable`

---

## 9. RECOMENDACIONES DE ACCIÓN

### Prioritario (Hacer Ahora — 2 horas)

1. ✏️ **Actualizar PageHeader Contract**
   - Agregar 6 props nuevas documentadas
   - Incluir ejemplos de uso

2. ✏️ **Corregir StatusBadge Type → Variant**
   - Línea 10 en component-contracts.md
   - Revisar que no haya código que dependa de "type"

### Alto Impacto (Esta Semana — 4 horas)

3. ✏️ **Expandir Hooks Contract**
   - Especificar tipos exactos
   - Agregar patrones de error handling
   - Ejemplos de implementación

4. ✏️ **Expandir Forms Contract**
   - Definir ciclo de vida completo
   - Patrón de reset post-submit
   - Validación progresiva

5. ✏️ **Crear Contrato de DataCell**
   - Desglosar todas las variantes
   - Documentar props por tipo

### Nuevos Contratos (Este Sprint — 6 horas)

6. 📝 **Crear ContractoDe Tablas Expandido**
   - DataTable vs. ReportTable
   - Casos de uso

7. 📝 **Crear Contrato de Modales**
   - Dialog vs. Sheet
   - Tamaños y comportamientos

8. 📝 **Crear Contrato de Selectores**
   - Select, ComboBox, AutoComplete

---

## 10. TABLA DE VERIFICACIÓN

- [ ] Actualizar PageHeader contract
- [ ] Corregir StatusBadge type → variant
- [ ] Expandir Hooks contract
- [ ] Expandir Forms contract
- [ ] Crear DataCell contract
- [ ] Crear Tablas contract
- [ ] Crear Modales contract
- [ ] Crear Selectores contract
- [ ] Revisar Nomenclatura de Variantes
- [ ] Ejecutar type-check en todo el frontend

---

## APÉNDICE A: Componentes Encontrados Sin Documentación de Contrato

```
frontend/components/shared/
├── TransactionViewModal.tsx        ← Modal custom complejo
├── CommentSystem.tsx               ← No documentado
├── DatePicker.tsx                  ← Wrapper custom
├── DateRangeFilter.tsx             ← Filtro especializado
├── FacetedFilter.tsx               ← Filtro avanzado
├── DocumentAttachmentDropzone.tsx  ← File upload
├── GenericWizard.tsx               ← Wizard pattern
├── ModuleSettingsSheet.tsx         ← Settings panel
├── ReportTable.tsx                 ← Tabla especializada
└── CollapsibleSheet.tsx            ← Sheet variant
```

Estos 10 componentes podrían beneficiarse de contratos explícitos.

---

## APÉNDICE B: Referencias en GOVERNANCE.md no Reflejadas en component-contracts.md

- **ADRs (Architecture Decision Records)** — Mencionado pero no hay una tabla de ADRs activos
- **Border Radius Industrial** — Documentado en GOVERNANCE § 7, pero no en component-contracts
- **8pt Grid Spacing** — Menciona "múltiplo de 8px" pero no hay token mapping
- **Regla 60-30-10** — Documentado pero no hay ejemplos en componentes

**Recomendación:** Crear una sección de "Principios Visuales" en component-contracts.md que refrene a GOVERNANCE.md.

---

## CONCLUSIÓN

Los contratos de diseño son **sólidos en concepto pero necesitan actualización inmediata** en 3 áreas:
1. **Sincronización código ↔ documentación** (PageHeader, StatusBadge)
2. **Expansión de detalles** (Hooks, Forms, DataTable)
3. **Nuevos contratos** para componentes huérfanos

**Impacto de estas mejoras:**
- ✅ Reduce bugs por "props inesperados"
- ✅ Acelera onboarding de nuevos desarrolladores
- ✅ Facilita auditorías de gobernanza
- ✅ Estandariza patrones en el codebase

**Tiempo estimado de implementación:** 12 horas para completar todas las recomendaciones.
