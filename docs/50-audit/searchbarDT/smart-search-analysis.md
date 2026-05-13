# Smart Search Bar para DataTable — Análisis y Decisión de Implementación

---

## Decisión

**Opción elegida: B — Server-Side Smart Search.**

Justificación: el refactoring de hooks (Fases 1-5, completado 2026-05-13) dejó la infraestructura hook-side en un estado que hace la Opción B directamente ejecutable. Los hooks ya aceptan `filters` tipados, incluyen los filtros en `queryKey`, y tienen `staleTime` configurado. El trabajo restante es frontend (parser + UI de chips + sync URL) y normalización puntual de `filterset_fields` en Django. La Opción A (client-side) no escala y la Opción C (hybrid) introduce complejidad de contrato innecesaria cuando B ya es alcanzable.

---

## TL;DR

El proyecto está **listo para implementar la Opción B**. La infraestructura más difícil ya existe y ya fue migrada:

- Backend: `DjangoFilterBackend` + `filterset_class` en la mayoría de endpoints ✅
- Hooks: todos declarativos (`useQuery`), aceptan `filters`, incluyen filtros en `queryKey` ✅
- Cache: `staleTime` en los 41 hooks, invalidación cross-module granular ✅
- Transport: `?search=&status=&ordering=` como contrato establecido ✅

El gap real es en **Capa 1 (UX/Parsing)** y en la sincronización URL ↔ filterState.

---

## 1. ¿Qué existe hoy?

### Lo que YA existe

| Capa | Qué hay | Calidad |
|---|---|---|
| **Backend FTS** | `GlobalSearchIndex` con GIN index + Postgres `spanish` stemming + SearchRank | ✅ Producción |
| **Universal Search** | `UniversalSearch.tsx` — Ctrl+K, debounce 200ms, segmentadores por tipo, keyboard nav | ✅ Producción |
| **UniversalRegistry** | `core/registry.py` — entidades registradas con templates de display, URL, permisos | ✅ Producción |
| **Filter backends** | `DjangoFilterBackend` + `filterset_class` en la mayoría de vistas | ✅ Producción |
| **Client filters** | `DataTableFilters` + `DataTableFacetedFilter` + `customFilters` (DateRange) | ✅ Producción |
| **Ordering** | `?ordering=field,-other` en API contracts | ✅ Contrato |
| **Hooks con `filters`** | Todos los hooks de lista aceptan `filters?: TypedFilters` en queryKey + queryFn | ✅ Post-audit |
| **staleTime universal** | 41 hooks con staleTime según tier (1–60 min) | ✅ Post-audit |
| **queryKeys centralizadas** | `queryKeys.ts` por dominio, Variante A/B según complejidad | ✅ Post-audit |
| **Invalidación cross-module** | Grafo completo: facturas → órdenes, BOMs → productos, etc. | ✅ Post-audit |

### Lo que NO existe (gap real)

| Qué falta | Impacto | Quién lo cierra |
|---|---|---|
| Parser de tokens `campo:valor` en frontend | Alto | Frontend |
| **`nuqs` para sync URL ↔ filterState** | Alto | Frontend (nueva dep) |
| UI de chips editables en el input | Alto | Frontend |
| Normalización de `filterset_fields` en endpoints faltantes | Medio | Backend, por módulo |
| Reset de cursor al cambiar filtros | Medio | Frontend (ver §5) |
| Sugerencias de valores por campo (enum estático o endpoint) | Bajo | Backend opcional |

---

## 2. Separación de sistemas — No mezclar

```
UniversalSearch (Ctrl+K)          DataTable Smart Search Bar
──────────────────────────        ──────────────────────────
Navega a un registro              Filtra la lista actual
Entre todas las entidades         Dentro de una sola entidad
Usa GlobalSearchIndex (FTS)       Usa DjangoFilterBackend + queryParams
Resultado: router.push(/entity/)  Resultado: TanStack Query refetch
```

**Regla:** No refactorizar `GlobalSearchIndex` para los filtros de lista. Son sistemas complementarios con responsabilidades distintas.

---

## 3. El problema en tres capas

```
┌─────────────────────────────────────────────┐
│  CAPA 1: UX/Parsing (Frontend)              │
│  Tokenizar "estado:pagado cliente:Acme"     │
│  → nuqs sincroniza filterState ↔ URL        │
│  → mostrar chips editables en el input      │
└─────────────────────────────────────────────┘
            ↓ construye query params
┌─────────────────────────────────────────────┐
│  CAPA 2: Transport (API)                    │
│  ?search=Acme&status=PAID&ordering=-date    │
│  (ya existe en la mayoría de endpoints)     │
└─────────────────────────────────────────────┘
            ↓ ejecuta
┌─────────────────────────────────────────────┐
│  CAPA 3: Backend Filtering (Django)         │
│  DjangoFilterBackend + filterset_class      │
│  (ya existe, cobertura ~85%)                │
└─────────────────────────────────────────────┘
```

**El cuello de botella está en la Capa 1.** Las capas 2 y 3 son sólidas.

---

## 4. Cómo funciona la Opción B con la arquitectura actual

```
usuario escribe:    "estado:pagado cliente:Acme fecha:2026-01"
                          ↓ parser (Zod schema)
filterState:        { status: 'PAID', search: 'Acme', date_from: '2026-01-01', date_to: '2026-01-31' }
                          ↓ nuqs
URL:                ?status=PAID&search=Acme&date_from=2026-01-01&date_to=2026-01-31
                          ↓ hook recibe filters desde URL
useProducts({ filters })  →  queryKey: [...PRODUCTS_QUERY_KEY, filters]
                          ↓ TanStack detecta queryKey distinta → refetch
                          ↓ queryFn construye ?status=PAID&search=Acme&...
                          ↓ Django DjangoFilterBackend aplica filtros
                          ↓ respuesta paginada (page_size: 50)
```

El hook ya incluye `filters` en `queryKey` — TanStack cachea automáticamente por combinación de filtros. Cada combinación distinta es una entrada de cache independiente.

---

## 5. Problema crítico: cursor-pagination al cambiar filtros

**El contrato de API usa cursor-based pagination** (`?cursor=…&page_size=N`). Cuando el usuario cambia un filtro, el cursor activo es inválido para el nuevo dataset.

**Solución requerida:** al cambiar cualquier filtro, eliminar el cursor del state URL antes del refetch.

```ts
// Con nuqs — patrón obligatorio
const [filters, setFilters] = useQueryState('filters', parseAsJson<FilterState>())
const [cursor, setCursor] = useQueryState('cursor')

function applyFilter(newFilter: Partial<FilterState>) {
  setCursor(null)          // reset cursor ANTES de cambiar filtros
  setFilters({ ...filters, ...newFilter })
}
```

**No implementar esto causa:** el usuario filtra por "estado:pagado", TanStack envía el cursor de la página anterior al nuevo filtro, el backend devuelve 404 o resultados incorrectos.

---

## 6. URL como fuente de verdad — `nuqs`

`nuqs` es la librería estándar para sync URL ↔ state en Next.js App Router, type-safe, con SSR support. Es la pieza central de esta implementación, no un nice-to-have.

```ts
import { useQueryState, parseAsJson } from 'nuqs'

const FilterSchema = z.object({
  status: z.enum(['PAID', 'DRAFT', 'CANCELLED']).optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  search: z.string().optional(),
})
type FilterState = z.infer<typeof FilterSchema>

// En el SmartSearchBar
const [filters, setFilters] = useQueryState(
  'q',
  parseAsJson<FilterState>().withDefault({})
)
```

**Por qué no `useState` + `router.push` manual:**
- Cada módulo lo reimplementaría distinto (violación del contrato de consistencia ya documentado)
- No es SSR-safe (Next.js App Router requiere manejo explícito de searchParams)
- `nuqs` elimina el boilerplate de `searchParams.get()` que se repite en cada módulo

**Coordinación con `?selected=<id>`:** `useSelectedEntity` usa el param `selected` para el patrón deeplink → modal. Los filtros deben usar un param distinto (`q` u otros params planos). Verificar que `setFilters` preserve el param `selected` si está presente al componer la URL.

---

## 7. Declaración de filtros por módulo — `SearchDefinition`

Cada módulo declara sus filtros disponibles. Este objeto es la única configuración que varía entre módulos.

```ts
// Tipo central — vive en @/components/shared o features/[x]/components/
type FieldDef =
  | { key: string; label: string; type: 'text';      serverParam: string }
  | { key: string; label: string; type: 'enum';      serverParam: string; options: { label: string; value: string }[] }
  | { key: string; label: string; type: 'daterange'; serverParamStart: string; serverParamEnd: string }

type SearchDefinition = {
  fields: FieldDef[]
}

// Uso en módulo de facturas
const invoiceSearchDef: SearchDefinition = {
  fields: [
    { key: 'search',     label: 'Texto',  type: 'text',      serverParam: 'search' },
    { key: 'status',     label: 'Estado', type: 'enum',      serverParam: 'status',
      options: [{ label: 'Pagada', value: 'PAID' }, { label: 'Borrador', value: 'DRAFT' }] },
    { key: 'date',       label: 'Fecha',  type: 'daterange', serverParamStart: 'date_from', serverParamEnd: 'date_to' },
  ]
}
```

El `SmartSearchBar` recibe `searchDef` como prop y construye el parser, el dropdown de sugerencias y los chips automáticamente.

---

## 8. Parser de tokens — Zod como validador

No usar regex custom. Usar Zod para parsear y validar la query string, consistente con el resto del frontend.

```ts
// Zod schema derivado de SearchDefinition (generado dinámicamente)
function buildFilterSchema(def: SearchDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of def.fields) {
    if (field.type === 'text')      shape[field.key] = z.string().optional()
    if (field.type === 'enum')      shape[field.key] = z.enum(field.options.map(o => o.value) as [string, ...string[]]).optional()
    if (field.type === 'daterange') {
      shape[field.serverParamStart] = z.string().date().optional()
      shape[field.serverParamEnd]   = z.string().date().optional()
    }
  }
  return z.object(shape)
}
```

Ventaja: los filtros inválidos son ignorados silenciosamente (`.safeParse`), no crashean la UI.

---

## 9. Sugerencias de valores — facets vs enum estático

**Para campos de tipo `enum`:** las opciones son estáticas, declaradas en `SearchDefinition`. No requieren endpoint adicional. Funciona correctamente incluso con paginación server-side porque los valores posibles no dependen del dataset actual.

**Para campos de tipo `text` (autocompletado):** los facets del dataset actual solo cubren la página actual (`page_size: 50`), no el universo total. Opciones:
- **Endpoint ligero:** `GET /api/[entity]/filter-suggestions/?field=contact_name&q=Acme` → array de strings. Recomendado para campos de alta cardinalidad (nombres de cliente, producto).
- **Sin autocompletado:** el campo de texto funciona sin sugerencias, el backend filtra con `?search=`. Válido como punto de partida.

**No usar** los facets de la página actual para autocompletar campos de texto — el resultado sería inconsistente y confuso.

---

## 10. Prerequisitos por módulo

Antes de activar la search bar server-side en un módulo, verificar:

| Prerequisito | Cómo verificar |
|---|---|
| El hook acepta `filters?: TypedFilters` | Leer el hook — post-audit todos lo hacen |
| `filterset_fields` o `filterset_class` en el ViewSet | `grep -n filterset backend/[app]/views.py` |
| `search_fields` si se usa `?search=` | `grep -n search_fields backend/[app]/views.py` |
| `page_size` no es ∞ (P2 resuelto) | El hooks audit marcó 6 pendientes — verificar antes de activar |
| Cursor reset implementado al cambiar filtros | Test manual: filtrar → cambiar filtro → no debe haber 404 |

**P2 pendientes (6 hooks):** si un módulo tiene un hook que todavía trae todos los registros sin `page_size`, la search bar mostrará chips correctos pero sin mejora de performance. Resolver P2 antes de marcar el módulo como "server-side activo".

---

## 11. ¿Qué hacen los mejores ERPs y productos?

| Producto | Técnica | Lección aplicable |
|---|---|---|
| **GitHub** | Tokens pre-definidos `is:issue state:open author:me` — vocabulario cerrado | Vocabulario cerrado = parseable + predecible + testeable |
| **Linear** | Chips visuales por campo + `F` para filtros | UX > poder expresivo |
| **Notion** | Filter builder visual (no texto libre) | El parsing de lenguaje natural es un anti-pattern |
| **Odoo** | Filtros declarados en `arch` XML del componente | La declaración de filtros vive cerca del dato — igual que `SearchDefinition` |
| **Retool** | Filtros declarados en config JSON del widget | Mismo patrón |
| **Algolia** | Index externo, facets pre-computados | Overkill para ERP interno con Postgres FTS existente |

**El patrón ganador para ERP interno:** vocabulario cerrado de tokens con chips visuales, persistido en URL. No lenguaje natural. No AI. Simple, predecible, testeable.

---

## 12. Plan de implementación

### Prerequisito global (antes de Fase 1)

Instalar `nuqs`:
```bash
cd frontend && npm install nuqs
```

---

### Fase 1 — Componente `SmartSearchBar` (3-4 días)

**Objetivo:** reemplazar `<Input>` de search + botones `FacetedFilter` con un único componente declarativo.

Entregables:
- `components/shared/SmartSearchBar.tsx` — acepta `searchDef: SearchDefinition`
- Chips visuales por filtro activo (removibles con ✕)
- Dropdown de sugerencias: primero muestra campos disponibles, luego opciones de valor
- `nuqs` como fuente de verdad del filterState ↔ URL
- Cursor reset al aplicar/remover cualquier filtro (ver §5)
- Sin cambios en backend — el hook recibe los filtros desde URL

**Componentes auxiliares:**
- `cmdk` (ya disponible via shadcn) para el dropdown de sugerencias con keyboard nav
- Zod schema generado dinámicamente desde `searchDef` (ver §8)

---

### Fase 2 — Rollout por módulo (4-5 días, gradual)

Orden recomendado (por impacto de dataset + P2 ya resuelto):

| Módulo | Dataset | P2 resuelto | `filterset_class` | Prioridad |
|---|---|---|---|---|
| Facturas (`useInvoices`) | Crece indefinidamente | ✅ (migrado Fase 2 audit) | ✅ | 1 |
| Movimientos Tesorería | Crece indefinidamente | ✅ (migrado Fase 2 audit) | Verificar | 2 |
| Órdenes de Venta | Crece indefinidamente | Verificar | Verificar | 3 |
| Productos | ~200-2000, estático | ⚠️ page_size:1000 → fix primero | ✅ | 4 |
| Contactos | ~100-1000 | Verificar | Verificar | 5 |

Para cada módulo:
1. Verificar prerequisitos (§10)
2. Definir `searchDef` con los campos que el filterset ya soporta
3. Reemplazar los `DataTableFilters` + `FacetedFilter` buttons con `<SmartSearchBar searchDef={invoiceSearchDef} />`
4. El hook ya acepta `filters` — pasar los filtros leídos desde URL

---

### Fase 3 — Sugerencias de valores para campos text (2 días, opcional)

Solo si se quiere autocompletado en campos de alta cardinalidad (cliente, producto):

```python
# backend/[app]/views.py
@action(detail=False, methods=['get'])
def filter_suggestions(self, request):
    field = request.query_params.get('field')
    q     = request.query_params.get('q', '')
    # ...query al modelo filtrando por q, devuelve los primeros 10 valores únicos
    return Response(values[:10])
```

Sin esto la feature funciona igual — el campo texto filtra sin autocompletar. Implementar solo cuando el UX lo justifique.

---

## 13. Estimado de esfuerzo (actualizado)

| Fase | Esfuerzo | Bloqueante |
|---|---|---|
| Fase 1 — SmartSearchBar + nuqs | 3-4 días | Ninguno |
| Fase 2 — Rollout módulos prioritarios (3-4) | 3-4 días | P2 resuelto en módulos seleccionados |
| Fase 3 — Sugerencias de valores | 2 días | Opcional, no bloquea las fases anteriores |
| **Total** | **8-10 días** | |

**Comparado con el estimado original (8-12 días para la Opción B):** la diferencia es que el hooks audit completado elimina todo el trabajo de migración hook-side que el estimado original incluía. El backend sigue requiriendo normalización puntual de `filterset_fields` pero es incremental y no bloquea el rollout.

---

## 14. Restricciones del contrato activo

### `api-contracts.md`
> "Filtering: `django_filter` query params"

✅ La Opción B usa exactamente este mecanismo.

> "Pagination: DRF cursor — `?cursor=…&page_size=N` (max 100)"

⚠️ **Requiere cursor reset al cambiar filtros** — implementado en §5. No opcional.

### `hook-contracts.md`
> Los hooks de features reciben `filters` como parámetros.

✅ Este es el punto de inyección de los filtros generados por `SmartSearchBar`.

> `useSelectedEntity` usa `?selected=<id>`.

⚠️ Los params de filtro no deben sobreescribir `selected`. Usar `nuqs` con `shallow: true` y preservar params existentes al aplicar filtros.

### `component-datatable-views.md`
> "Nunca usar `useState` local para la vista activa."

✅ `nuqs` en URL es la implementación correcta de este principio extendido a filtros.
