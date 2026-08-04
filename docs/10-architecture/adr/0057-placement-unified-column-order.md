# ADR 0057: Placement como fuente de verdad unificada para orden de columnas

## Estado

Aceptado — **§toColumns extendido por ADR-0059** (subtitle/header intra-zone mirror de la card).

> **Nota (ADR-0059):** este ADR definió la zona `subtitle` y `header` para `toColumns()`,
> pero con orden de definición dentro de la zona. ADR-0059 hace que `toColumns()` use los
> mismos criterios intra-zona que la card: `buildSubtitleOrder` (name → relation → temporal →
> primary-value → explícito) y `headerPriorityIndex` (complex → total/salary → primary-value →
> flow → tag). La jerarquía de zonas de este ADR no cambia.

> **Enmendado por ADR-0067:** la jerarquía de zonas cambia — la zona `header` pasa al
> índice 3 (última, antes de la columna de acciones) y las zonas `metric` / `footer` se
> eliminan (cero productores). Ver ADR-0067.

## Contexto

Históricamente existían dos sistemas de ordenación independientes en `entity-fields.tsx`:

- **`cardPlacement`** (tipo `CardPlacement`): determinaba la zona de layout en tarjeta (`title → subtitle → header → detail → metric → footer`)
- **`order`**: determinaba el orden izquierda-derecha de columnas en la vista de lista (menor número = más a la izquierda)

Esto significaba que un campo con `cardPlacement: 'header'` podía tener `order: 60` (apareciendo a la derecha en la tabla), y un campo con `cardPlacement: 'detail'` podía tener `order: 10` (apareciendo a la izquierda). La importancia visual de un campo en tarjeta no se reflejaba en la vista de lista.

## Decisión

Unificar ambos sistemas usando `placement` como **única fuente de verdad** para el orden en ambas vistas. Se eliminan completamente `order` y `cardPlacement`:

1. **Eliminar** tipo `CardPlacement` — solo existe `Placement`
2. **Eliminar** propiedad `order` de `FieldDef<T>`
3. **Eliminar** propiedad `cardPlacement` de `FieldDef<T>`
4. **Eliminar** `order: NN` de todos los `*Fields.ts` del codebase (~146 ocurrencias en 23 archivos)
5. **Modificar `toColumns()`** para sortear exclusivamente por `placement`

### Sort en `toColumns()`

```typescript
.sort(([, a], [, b]) => {
    const pa = a.placement ?? ROLE_TO_PLACEMENT[TYPE_TO_ROLE[a.type]]
    const pb = b.placement ?? ROLE_TO_PLACEMENT[TYPE_TO_ROLE[b.type]]
    return (ZONE_ORDER[pa] ?? 3) - (ZONE_ORDER[pb] ?? 3)
})
```

Dentro de la misma zona, los campos mantienen su **orden de definición** (insertion order de `Object.entries`). *(Ver ADR-0059: a partir de 0059, las zonas `subtitle` y `header` usan criterios intra-zona espejados de la card en vez de orden de definición.)*

### Jerarquía de orden (izquierda → derecha)

*Actualizada por ADR-0067: `header` al final, `metric`/`footer` eliminadas.*

| ZONE_ORDER | Placement | Descripción |
|------------|-----------|-------------|
| 0 | `title` | Campo identificador principal |
| 1 | `subtitle` | Nombre / etiqueta principal |
| 2 | `detail` | Campos descriptivos (default) |
| 3 | `header` | Badges, valores KPI, estados — KPIs distintivos antes de acciones |

### Resolución de placement para `toColumns()`

1. Si `def.placement` está definido → úsalo
2. Si no → derivar de `TYPE_TO_ROLE[field.type]` → `ROLE_TO_PLACEMENT[role]`
3. Sin cascade ni auto-detect (solo en `toCardFields()`)

### Resolución de placement para `toCardFields()` (sin cambios funcionales)

El pipeline de resolución de tarjeta se mantiene igual:
1. `TYPE_TO_ROLE` → `ROLE_TO_PLACEMENT`
2. Auto-detect (title/subtitle)
3. Override explícito via `placement`
4. Cascade (capacity limits)

## Consecuencias

### Positivas
- **Fuente de verdad única**: un campo importante en tarjeta (`header`) también aparece primero en lista
- **Configuración mínima**: solo `placement` define la posición — sin `order` que mantener
- **Consistencia**: la misma semántica (`title→subtitle→header→detail→metric→footer`) governa ambas vistas
- **Menos código**: eliminadas ~146 propiedades `order` y el tipo `CardPlacement`

### Negativas
- **Cambio visual**: columnas se reordenan según placement zone (aceptable — el nuevo orden es semántico)
- **Pérdida de sub-orden**: dentro de la misma zona, el orden depende de la definición del objeto (no hay control fino)

### Archivos modificados
- `frontend/components/shared/entity-fields.tsx` — core: eliminados `order`, `cardPlacement`, `CardPlacement`
- `frontend/components/shared/AutoEntityCard.tsx` — solo `f.placement`
- `frontend/components/shared/__tests__/entity-fields.test.ts` — tests actualizados
- 23 archivos `*Fields.ts(x)` — eliminadas propiedades `order`
- 3 archivos `*Fields.ts(x)` — migrados `cardPlacement` → `placement`
