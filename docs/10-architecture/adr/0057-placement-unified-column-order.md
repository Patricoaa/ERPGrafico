# ADR 0057: Placement como fuente de verdad unificada para orden de columnas

## Estado

Aceptado

## Contexto

Históricamente existían dos sistemas de ordenación independientes en `entity-fields.tsx`:

- **`cardPlacement`** (tipo `CardPlacement`): determinaba la zona de layout en tarjeta (`title → subtitle → header → detail → metric → footer`)
- **`order`**: determinaba el orden izquierda-derecha de columnas en la vista de lista (menor número = más a la izquierda)

Esto significaba que un campo con `cardPlacement: 'header'` podía tener `order: 60` (apareciendo a la derecha en la tabla), y un campo con `cardPlacement: 'detail'` podía tener `order: 10` (apareciendo a la izquierda). La importancia visual de un campo en tarjeta no se reflejaba en la vista de lista.

## Decisión

Unificar ambos sistemas usando `placement` como fuente de verdad para el orden en ambas vistas:

1. **Renombrar** `CardPlacement` → `Placement` (con alias `CardPlacement` deprecated)
2. **Renombrar** propiedad `cardPlacement` → `placement` en `FieldDef<T>` y `CardField`
3. **Modificar `toColumns()`** para usar `placement` como sort primario y `order` como sort secundario

### Sort en `toColumns()`

```typescript
.sort(([, a], [, b]) => {
    const pa = (a.placement ?? a.cardPlacement) ?? ROLE_TO_PLACEMENT[TYPE_TO_ROLE[a.type]]
    const pb = (b.placement ?? b.cardPlacement) ?? ROLE_TO_PLACEMENT[TYPE_TO_ROLE[b.type]]
    const za = ZONE_ORDER[pa] ?? 3
    const zb = ZONE_ORDER[pb] ?? 3
    if (za !== zb) return za - zb
    return (a.order ?? Infinity) - (b.order ?? Infinity)
})
```

### Jerarquía de orden (izquierda → derecha)

| ZONE_ORDER | Placement | Descripción |
|------------|-----------|-------------|
| 0 | `title` | Campo identificador principal |
| 1 | `subtitle` | Nombre / etiqueta principal |
| 2 | `header` | Badges, valores KPI, estados |
| 3 | `detail` | Campos descriptivos (default) |
| 4 | `metric` | Progreso, métricas |
| 5 | `footer` | Resumen |

### Resolución de placement para `toColumns()`

1. Si `def.placement` está definido → úsalo
2. Si `def.cardPlacement` está definido (deprecated) → úsalo (backward-compat)
3. Si no → derivar de `TYPE_TO_ROLE[field.type]` → `ROLE_TO_PLACEMENT[role]`
4. Sin cascade ni auto-detect (solo en `toCardFields()`)

### Resolución de placement para `toCardFields()` (sin cambios funcionales)

El pipeline de resolución de tarjeta se mantiene igual:
1. `TYPE_TO_ROLE` → `ROLE_TO_PLACEMENT`
2. Auto-detect (title/subtitle)
3. Override explícito
4. Cascade (capacity limits)

Solo se cambia `def.cardPlacement` → `def.placement ?? def.cardPlacement` para backward-compat.

## Consecuencias

### Positivas
- **Fuente de verdad única**: un campo importante en tarjeta (`header`) también aparece primero en lista
- **Menos configuración manual**: entidades sin `order` explícito ahora tienen un orden razonable derivado del tipo
- **Backward-compat**: `cardPlacement` sigue funcionando como alias deprecated
- **`order` preservado**: sigue funcionando como sub-orden dentro de cada zona

### Negativas
- **Cambio visual**: entidades existentes pueden ver reordenamiento de columnas (aceptable — el nuevo orden es más semántico)
- **Renombre amplio**: ~53 referencias a `cardPlacement` en el códigobase (mitigado por alias deprecated)

### Archivos modificados
- `frontend/components/shared/entity-fields.tsx` — core del cambio
- `frontend/components/shared/AutoEntityCard.tsx` — referencias a `f.placement`
- `frontend/components/shared/__tests__/entity-fields.test.ts` — tests actualizados + nuevos
- `frontend/features/inventory/productFields.tsx` — `cardPlacement` → `placement`
- `frontend/features/accounting/journalEntryFields.ts` — `cardPlacement` → `placement`
- `frontend/app/(dashboard)/accounting/entries/journalEntryFields.ts` — `cardPlacement` → `placement`
