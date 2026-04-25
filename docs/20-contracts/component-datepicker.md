---
layer: 20-contracts
doc: component-datepicker
status: active
owner: frontend-team
last_review: 2026-04-25
stability: beta
---

# Date Picker Components — Contracts

Todos los selectores de fecha deben seguir uno de los **dos patrones estándar** definidos aquí. No crear nuevas implementaciones ad-hoc con `Popover + Calendar` manual.

---

## Cuándo usar cada patrón

| Contexto | Patrón | Componente |
|----------|--------|------------|
| Campo de fecha en formulario (suelto o con validación de periodo) | Single date en form | `PeriodValidationDateInput` |
| Filtro de rango en dashboard / reporte / toolbar | Date range | `DateRangeFilter` |

---

## Patrón 1 — Single date en formulario: `PeriodValidationDateInput`

### Props 🟡

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `date` | `Date \| undefined` | ✅ | — | Fecha controlada |
| `onDateChange` | `(date: Date \| undefined) => void` | ✅ | — | Callback al seleccionar |
| `label` | `string` | ❌ | `"Fecha Emisión"` | Legend del fieldset |
| `placeholder` | `string` | ❌ | `"Seleccionar fecha"` | Texto cuando no hay fecha |
| `disabled` | `boolean` | ❌ | `false` | |
| `required` | `boolean` | ❌ | `true` | Muestra `*` rojo |
| `validationType` | `'tax' \| 'accounting' \| 'both'` | ❌ | `'tax'` | Tipo de validación de periodo |
| `onValidityChange` | `(isValid: boolean) => void` | ❌ | — | Notifica si el periodo está abierto |
| `className` | `string` | ❌ | — | Clases adicionales en el LabeledContainer |

### Uso estándar

```tsx
// Fecha de emisión (validación tributaria — caso más común)
<PeriodValidationDateInput
  date={docDate}
  onDateChange={setDocDate}
  label="Fecha Emisión"
  validationType="tax"
  onValidityChange={onPeriodValid}
/>

// Asiento contable (validación contable)
<PeriodValidationDateInput
  date={selectedDate}
  onDateChange={setSelectedDate}
  label="Fecha"
  validationType="accounting"
/>

// Fecha sin validación de periodo (NO usar custom inline — aún usar este componente)
<PeriodValidationDateInput
  date={transferDate}
  onDateChange={setTransferDate}
  label="Fecha del Traspaso"
  validationType="tax"      // requerido — pasar el tipo más apropiado
  required={false}
/>
```

### Características técnicas

- **Wrapper**: `LabeledContainer` (fieldset notched-field)
- **Trigger height**: alineado con estándar `min-h-[1.5rem]` — igual que `LabeledInput`
- **Ícono**: `CalendarIcon` **dentro del Button**, no en prop `icon=` del LabeledContainer
- **Locale**: `es` siempre (declarado explícitamente)
- **Formato display**: `"PPP"` → "1 de enero de 2025"
- **Validación**: hook `usePeriodValidation` — **no usar `validateAccountingPeriod` action directamente**
- **Spinner**: `Loader2` como suffix durante validación asíncrona

### Invariante de altura

El trigger Button debe usar `h-[1.5rem] p-0` (igual que todos los triggers en notched-field). `DatePicker.tsx` interno pasa `className` al Button — `PeriodValidationDateInput` debe forzar estas clases vía el prop `className` del `DatePicker`.

> [!WARNING]
> `DatePicker.tsx` standalone usa `h-10` por defecto. Al usarlo dentro de `PeriodValidationDateInput` o cualquier `LabeledContainer`, siempre pasar `className` que incluya `h-[1.5rem] p-0`.

---

## Patrón 2 — Date range en filtros: `DateRangeFilter`

### Props 🟡

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `onRangeChange` | `(range: DateRange \| undefined) => void` | ✅ | — | |
| `label` | `string` | ❌ | `"Filtrar por fecha"` | Texto del trigger |
| `defaultRange` | `DateRange` | ❌ | — | |
| `className` | `string` | ❌ | — | |

### Uso estándar

```tsx
// En toolbar de listado
<DateRangeFilter
  onRangeChange={setDateRange}
  label="Período"
/>

// Con rango inicial
<DateRangeFilter
  onRangeChange={setDateRange}
  defaultRange={{ from: startOfMonth(new Date()), to: new Date() }}
  label="Rango de Reporte"
/>
```

### Características técnicas

- **Wrapper**: Popover standalone (sin fieldset — es un filtro, no un campo de formulario)
- **Height**: `h-9` (size="sm")
- **Locale**: `es`
- **Formato display**: `"LLL dd, y"` → "ene 01, 2025"
- **Clear button**: incluido (X en hover)
- **Calendar mode**: `range`, `numberOfMonths={2}`
- **Width**: `w-auto` (**excepción** al invariante de ancho de dropdowns). Debido a que muestra 2 meses, el popover debe expandirse horizontalmente más allá del ancho del trigger.

> **No usar `DateRangeSelector`** (`features/finance/`) — es una implementación legacy sin clear button. Usar siempre `DateRangeFilter` de `components/shared/`.

---

## Implementaciones encontradas — estado actual

| Archivo | Patrón usado | ✅/⚠️ | Problema |
|---------|-------------|--------|----------|
| `PeriodValidationDateInput.tsx` | Componente base | ✅ | — |
| `DatePicker.tsx` | Primitivo | ✅ | `h-10` solo válido standalone |
| `DateRangeFilter.tsx` | Range base | ✅ | — |
| checkout `Step1_CustomerDTE.tsx` | PeriodValidationDateInput | ✅ | — |
| checkout `Step3_Delivery.tsx` | PeriodValidationDateInput | ✅ | — |
| `JournalEntryForm.tsx` | Custom inline | ⚠️ | locale faltante (ya corregido), acción directa en vez de hook |
| `TerminalBatchForm.tsx` | Custom inline | ⚠️ | `h-8`, locale inconsistente |
| `TransferModal.tsx` | Custom inline (`<div>` no `<Button>`) | ⚠️ | `h-8`, locale faltante, div en vez de button |
| `DateRangeSelector.tsx` (finance) | Range legacy | ⚠️ | Sin clear button, `w-[300px]` fijo |

---

## Reglas de estandarización

### DO

```tsx
// ✅ Fecha en formulario — siempre PeriodValidationDateInput
<PeriodValidationDateInput
  date={field.value}
  onDateChange={field.onChange}
  label="Fecha"
  validationType="accounting"
/>

// ✅ Rango en toolbar — siempre DateRangeFilter
<DateRangeFilter onRangeChange={setRange} label="Período" />
```

### DON'T

```tsx
// ❌ Custom Popover+Calendar inline en formularios
<Popover>
  <PopoverTrigger asChild>
    <Button className="h-auto py-2">  {/* rompe altura estándar */}
      <CalendarIcon /> {date ? format(date, "PPP") : "Seleccione"}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Calendar ... />  {/* sin locale={es} */}
  </PopoverContent>
</Popover>

// ❌ DatePicker.tsx dentro de LabeledContainer sin ajustar height
<LabeledContainer label="Fecha">
  <DatePicker date={date} onDateChange={setDate} />  {/* h-10 → rompe alineación */}
</LabeledContainer>

// ❌ validateAccountingPeriod action para validar periodo (usar hook)
const check = await validateAccountingPeriod(dateStr)  // ❌
const { isClosed } = usePeriodValidation()             // ✅

// ❌ DateRangeSelector legacy
import { DateRangeSelector } from '@/features/finance/components/DateRangeSelector'  // ❌ legacy
import { DateRangeFilter } from '@/components/shared'  // ✅
```

---

## Tabla de invariantes

| Invariante | Valor correcto |
|-----------|----------------|
| Trigger height en formulario | `h-[1.5rem] p-0` |
| Locale Calendar | `locale={es}` siempre |
| Formato display single date | `"PPP"` con `{ locale: es }` |
| Formato display range | `"LLL dd, y"` con `{ locale: es }` |
| Formato envío backend | `"yyyy-MM-dd"` (formato ISO) |
| Validación periodo | `usePeriodValidation` hook — nunca action directa |
| Ícono en formulario | `CalendarIcon` dentro del Button (no en `icon=` de LabeledContainer) |
| Placeholder estándar | `"Seleccionar fecha"` |

---

## Relación con otros contratos

- [component-input.md → LabeledContainer](./component-input.md#labeledcontainer) — wrapper fieldset usado por `PeriodValidationDateInput`
- [component-selectors.md → Trigger display](./component-selectors.md) — mismo patrón de altura `min-h-[1.5rem]`
