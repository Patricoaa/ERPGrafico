# Análisis: Smart Search Bar para DataTable (estilo GitHub)

## TL;DR

El proyecto está **bien posicionado** para implementar esto. Ya existe la infraestructura más difícil (GlobalSearchIndex con Postgres FTS + stemming en español). El gap principal está en el **frontend del DataTable** — pasar de filtros de tabla client-side a una barra de búsqueda expresiva. La complejidad real es de UX, no de infraestructura.

---

## 1. ¿Qué tienes hoy?

### Lo que YA existe (ventaja enorme)

| Capa | Qué hay | Calidad |
|---|---|---|
| **Backend FTS** | `GlobalSearchIndex` con GIN index + Postgres `spanish` stemming + SearchRank | ✅ Producción |
| **Universal Search** | `UniversalSearch.tsx` — Ctrl+K, debounce 200ms, segmentadores por tipo, keyboard nav | ✅ Producción |
| **UniversalRegistry** | `core/registry.py` — entidades registradas con templates de display, URL, permisos | ✅ Producción |
| **Filter backends** | `DjangoFilterBackend` + `filterset_class` en la mayoría de vistas | ✅ Producción |
| **Client filters** | `DataTableFilters` + `DataTableFacetedFilter` + `customFilters` (DateRange) | ✅ Producción |
| **Ordering** | `?ordering=field,-other` en API contracts | ✅ Contrato |

### Lo que NO existe

| Qué falta | Impacto |
|---|---|
| Parser de sintaxis `campo:valor` en frontend | Alto |
| Endpoint de "filter suggestions" por entidad | Alto |
| Persistencia de filtros en URL (algunos módulos ya lo hacen, pero inconsistente) | Medio |
| Token visual de filtros aplicados (chips/badges) | Medio |
| Autocompletado contextual de valores por campo | Medio |

---

## 2. El problema en tres capas

```
┌─────────────────────────────────────────────┐
│  CAPA 1: UX/Parsing (Frontend)              │
│  Tokenizar "estado:pagado cliente:Acme"     │
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
│  (ya existe, con cobertura desigual)        │
└─────────────────────────────────────────────┘
```

**El cuello de botella está en la Capa 1.** Las capas 2 y 3 son sólidas.

---

## 3. Los tres enfoques posibles

### Opción A — Client-Side Filter Bar (sin server changes)

Convierte los filtros actuales en una barra de texto con chips visuales. El filtrado sigue siendo client-side con TanStack Table.

```
[  🔍 buscar... | estado: Pagado ✕ | tipo: Factura ✕  ]
```

**Cómo funciona:**
1. Input + dropdown de sugerencias de campos disponibles
2. Al seleccionar un campo → muestra opciones (enum/facets del dataset actual)
3. Al confirmar → añade un chip al input y aplica `column.setFilterValue()`
4. Los datos siguen siendo los mismos (cargados en memoria)

**Pros:** Sin cambios en backend. Funciona hoy.  
**Contras:** Solo filtra datos ya descargados. Incompatible con paginación server-side real. No escala a datasets grandes.  
**Esfuerzo:** ~3-4 días de trabajo en frontend.

---

### Opción B — Server-Side Smart Search (el "verdadero" GitHub approach)

Cada keystroke construye una URL con query params y dispara un refetch al backend.

```
usuario escribe:    "estado:pagado cliente:Acme fecha:2026-01"
                          ↓ parser
query params:       ?status=PAID&search=Acme&date_from=2026-01-01&date_to=2026-01-31
                          ↓ Django
                    filterset_class aplica los filtros
                          ↓ respuesta paginada
```

**Cómo funciona:**
1. Parser tokeniza la query (regex simple o lib como `search-query-parser`)
2. Tokens se mapean a `QueryParam` definitions declaradas por módulo
3. TanStack Query hace refetch con los nuevos params
4. Backend ya tiene `DjangoFilterBackend` en la mayoría de endpoints

**Pros:** Escala a millones de registros. Paginación real. Filtros persistidos en URL.  
**Contras:** Requiere que cada endpoint tenga los `filterset_fields` correctos (algunos faltan). Requiere endpoint de "sugerencias" para autocompletado de valores.  
**Esfuerzo:** ~8-12 días (frontend 4-5 + backend 4-6 para normalizar filtros por módulo).

---

### Opción C — Hybrid (recomendado)

Capa de presentación unificada que decide internamente si filtrar client-side o server-side según capacidad del endpoint.

```tsx
// Declaración por módulo
const searchDef: SearchDefinition = {
  fields: [
    { key: 'search', label: 'Texto', type: 'text', serverParam: 'search' },
    { key: 'status', label: 'Estado', type: 'enum', 
      options: STATUS_OPTIONS, serverParam: 'status', clientColumn: 'status' },
    { key: 'date', label: 'Fecha', type: 'daterange', 
      serverParam: 'date_from', serverParamEnd: 'date_to' },
  ]
}
```

Si el endpoint tiene el `serverParam` → filtra server-side. Si no → filtra client-side como hoy.

**Esfuerzo:** ~6-8 días + rollout gradual por módulo.

---

## 4. ¿Qué hacen los mejores?

| Producto | Técnica | Lección |
|---|---|---|
| **GitHub** | Sintaxis `is:issue state:open author:me` — tokens pre-definidos, no free-form | Vocabulario cerrado = parseable + predecible |
| **Linear** | Chips visuales por campo + keyboard shortcuts — `F` para filtros | UX > poder expresivo |
| **Notion** | Filter builder visual (no texto libre) | El parsing de lenguaje natural es un anti-pattern |
| **Retool** | Filtros declarados en config JSON del widget | La declaración de filtros vive cerca del dato |
| **Algolia** | Index externo, facets pre-computados | Overkill para ERP interno con Postgres FTS |

**El patrón ganador para ERP interno:** vocabulario cerrado de tokens (`campo:valor`) con chips visuales, persistido en URL. No lenguaje natural. No AI. Simple, predecible, testeable.

---

## 5. Restricciones desde tu documentación

### `api-contracts.md` — **Contrato firmado**
> "Filtering: `django_filter` query params"

✅ Indica que el mecanismo canónico es query params. Cualquier implementación debe usar ese contrato.

> "Pagination: DRF cursor — `?cursor=…&page_size=N` (max 100)"

⚠️ **Restricción importante:** Si migras a server-side filtering, la paginación es cursor-based. Esto significa que no puedes saltar a "página 5" — solo next/previous. El DataTablePagination actual usa offset pagination en modo cliente, cursor en modo servidor. Hay que unificar.

### `component-datatable-views.md` — **Contrato activo**
> "Nunca usar `useState` local para la vista activa. El estado efímero provoca que la vista se pierda."

✅ Esto ya indica la dirección correcta: los filtros también deben ir a URL, no solo la vista.

> "`isLoading` obligatorio con skeleton"

✅ Si los filtros disparan refetch, el `isLoading` skeleton ya está implementado.

### `unified-search-index.md` — **Arquitectura existente**
El `GlobalSearchIndex` fue diseñado para el **search global** (Ctrl+K), no para los filtros de lista. Son sistemas complementarios:
- `UniversalSearch` → navega a un registro específico entre todas las entidades
- `DataTable search bar` → filtra la lista actual dentro de una entidad

No mezclar. No refactorizar el `GlobalSearchIndex` para los filtros de lista.

### `hook-contracts.md` — **Patrón de datos**
Los hooks de features (`useProducts`, `useSalesOrders`, etc.) reciben `filters` como parámetros. Este es el punto de inyección natural para los filtros generados por la nueva search bar.

---

## 6. ¿Qué tan lejos están?

```
Infraestructura Backend   ████████████░░  85% — Solo faltan algunos filterset_fields
Infraestructura Frontend  ████████░░░░░░  60% — DataTableFilters funciona pero no tiene UX de "smart search"  
UX / Parsing              ██░░░░░░░░░░░░  15% — El parser de tokens no existe
Persistencia en URL       ████░░░░░░░░░░  30% — Algunos módulos sí, la mayoría no
```

**Distancia total:** 6-10 días de trabajo enfocado para Opción C (Hybrid).

---

## 7. Plan de implementación recomendado

### Fase 0 — Diseño (1 día)
- Definir el vocabulario de tokens: `estado:`, `fecha:`, `tipo:`, `cliente:`, `texto:`
- Decidir la API declarativa de `SearchDefinition` por módulo
- Mockup de la UI (chip input + dropdown de sugerencias)

### Fase 1 — Componente `SmartSearchBar` (3 días)
- Reemplaza el `<Input>` de search y los `FacetedFilter` buttons con un único input
- Chips visuales por filtro activo (removibles con ✕)
- Dropdown de autocompletado: primero muestra campos disponibles, luego valores
- Persistencia de estado en URL (`?q=status:PAID+search:Acme`)
- Sin cambios en backend — funciona client-side sobre los datos ya descargados

### Fase 2 — Server-side por módulo (4-6 días, rollout gradual)
- Normalizar `filterset_fields` en endpoints prioritarios (SalesOrders, Invoices, Products)
- Hooks actualizados para aceptar `filters` estructurados desde la URL
- El `SmartSearchBar` detecta si el módulo tiene `serverSearchDef` y dispara refetch

### Fase 3 — Sugerencias de valores (2 días)
- Endpoint ligero `GET /api/[entity]/filter-options/?field=status` → `["PAID", "DRAFT", ...]`
- O simplemente usar los facets del dataset actual (sin nuevo endpoint)

---

## 8. Soluciones que no habías considerado

### `cmdk` — Command Menu primitivo
Ya usas un Dialog custom en `UniversalSearch`. La librería **cmdk** (usada por shadcn) ofrece primitivos de command palette con keyboard nav, grupos, y búsqueda integrada. Podría simplificar la implementación del dropdown de sugerencias.

### URL como fuente de verdad con `nuqs`
La librería **nuqs** (Next.js URL Query State) maneja la sincronización URL ↔ state de forma type-safe, con SSR support. Eliminaría el boilerplate de `searchParams.get()` / `router.push()` que se repite en cada módulo.

```ts
// Con nuqs — type-safe, SSR-friendly
const [filters, setFilters] = useQueryState('q', parseAsJson<FilterState>())
```

### Postgres `ts_headline` para highlight
Tu `GlobalSearchIndex` ya usa `SearchRank`. Si expandes esto a los endpoints de lista, puedes usar `ts_headline()` para marcar qué parte del texto hizo match — como hace Notion al buscar en documentos.

### Zod para el parser de tokens
En lugar de regex custom, usar Zod para parsear y validar la query string de filtros:
```ts
const FilterTokenSchema = z.object({
  status: z.enum(['PAID','DRAFT','CANCELLED']).optional(),
  date_from: z.string().date().optional(),
  search: z.string().optional(),
})
```
Esto es consistente con el uso de Zod en el resto del frontend.

---

---

## 9. Uso de recursos por opción — Análisis con datos reales del codebase

### El problema preexistente (independiente de qué opción elijas)

El audit del código actual revela algo crítico: **varios módulos ya tienen un problema de recursos más grave que cualquier decisión de toolbar**.

| Hook / API | Qué hace hoy | Tamaño real |
|---|---|---|
| `useTreasuryMovements` | `GET /treasury/movements/` sin parámetros | Todos los movimientos |
| `useProducts` (ProductList) | `page_size: 1000` | 1000 objetos Product completos |
| `inventoryApi.getCategories` | `page_size: 9999` | Todas las categorías |
| `billingApi.getInvoices` | Sin page_size + filter client-side en JS | Todas las facturas |
| `useSalesOrders` | Sin page_size explícito | Default del backend |
| POS `useProducts` | `page_size: 2000` | 2000 productos para búsqueda instantánea |

Además: **ninguno de los hooks principales tiene `staleTime`** configurado (excepto POS y universal search). Esto significa que cada `window focus` o `mount` del componente puede disparar un refetch de 1000+ registros.

---

### Comparativa de recursos por opción

#### Opción A — Client-Side Filter Bar

```
Carga inicial: IGUAL que hoy (1 fetch, todos los registros)
Filtrado:      CPU del browser (TanStack Table, O(n) por filtro)
Por keystroke: 0 requests adicionales
Memoria RAM:   IGUAL — todos los objetos viven en el QueryCache
Concurrencia:  1 request por mount (sin cambios)
```

**Para el toolbar en sí mismo: neutro en recursos.** El problema de datos que ya existe no cambia.

#### Opción B — Server-Side Smart Search

```
Carga inicial: Solo la primera página (20-50 registros)
Filtrado:      0 CPU en browser, 1 query Django por cambio de filtro
Por keystroke: 1 request cada ~300ms (con debounce)
Memoria RAM:   Mínima — solo la página actual en QueryCache
Concurrencia:  N requests paralelas si el usuario filtra rápido
```

**Mejor en todo para datasets grandes. Pero introduce latencia perceptible por filtro.**

#### Opción C — Hybrid (declarativa)

```
Carga inicial: Igual que hoy si el módulo no migra a server-side
Filtrado:      Client-side por defecto, server-side si se declara
Por keystroke: 0 o 1 request según configuración del módulo
Memoria RAM:   Igual que hoy hasta que se migre el módulo
Concurrencia:  Controlable por módulo
```

**Es la opción que permite mejorar recursos gradualmante, módulo a módulo, sin big-bang.**

---

### La verdad: la pregunta correcta NO es «qué opción de toolbar es más eficiente»

La respuesta honesta es: **el toolbar es irrelevante para el consumo de recursos. Lo que lo determina es cuántos datos trae el hook.**

```
Opción A + hook que trae 1000 registros  = 1000 registros en memoria
Opción B + hook que trae 1000 registros  = 1000 registros en memoria (sin cambio)
Opción C + hook que trae 1000 registros  = 1000 registros en memoria (sin cambio)

Opción B + hook que trae 20 registros    = 20 registros en memoria ← esto sí cambia todo
```

La Opción B solo mejora los recursos si **también se migra el hook** a paginación real server-side. No es una propiedad de la UI — es una propiedad del data fetching.

---

### Cuándo cada opción es la correcta

| Escenario | Recomendación |
|---|---|
| Dataset pequeño (≤500 registros, crecimiento lento) | **A o C client-side** — instantáneo, sin latencia, sin complejidad |
| Dataset mediano (500-5000 registros) | **C hybrid** — client-side hoy, migración progresiva |
| Dataset grande (>5000 registros, crece con el uso) | **B o C server-side** — obligatorio para performance |
| Módulo con datos en memoria necesarios de todos modos (POS) | **A** — ya tienes los datos, filtrar client-side es gratis |
| Módulo de reportes / análisis temporal | **B** — los filtros definen QUÉ datos traer, no cómo filtrarlos |

### Para tu ERP específicamente

| Módulo | Dataset esperado | Recomendación |
|---|---|---|
| Productos | ~200-2000 (catálogo estático) | C client-side (pero fix `page_size: 1000` → paginar) |
| Contactos | ~100-1000 | C client-side |
| Movimientos Tesoreros | Crece indefinidamente | **C/B server-side urgente** — hoy trae TODO sin límite |
| Facturas | Crece indefinidamente | **C/B server-side** — ya trae todo sin page_size |
| Órdenes de Venta | Crece indefinidamente | **C/B server-side** |
| POS Sesiones | Pocas activas a la vez | A — datos pequeños, complejidad baja |

---

## Veredicto final

**La implementación es completamente factible y no requiere dependencias externas nuevas.** El mayor trabajo está en diseñar bien la **declaración de filtros por módulo** (la `SearchDefinition`) y el **componente de UI**. Una vez que ese contrato exista, el rollout módulo a módulo es mecánico.

La Opción C (Hybrid) es la más pragmática porque permite lanzar la nueva UX sin bloquear en la normalización de backends, y el rollout puede hacerse módulo a módulo en paralelo con otras features.
