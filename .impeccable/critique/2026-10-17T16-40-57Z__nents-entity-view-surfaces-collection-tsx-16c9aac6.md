---
target: entity-view prototype (Collection, EditableCollection)
total_score: 20
max_score: 36
na_heuristics: 10
p0_count: 1
p1_count: 4
target_identity: "file:/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/components/entity-view/surfaces/Collection.tsx"
target_fingerprint: "sha256:ed711b32ec7cf126997703aa9273ffd3a7a272196dcf00c73bcd5d025260a058"
target_path: /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/components/entity-view/surfaces/Collection.tsx
timestamp: 2026-10-17T16-40-57Z
slug: nents-entity-view-surfaces-collection-tsx-16c9aac6
---
## 5. Crítica de diseño (`impeccable critique`)

Dos evaluaciones aisladas en subagentes: A (diseño, sin detector) y B (detector + overlay en el navegador). Puntuaciones de A **antes** de los arreglos de esta fase.

### 5.1 Veredicto y heurísticas (A)

**Mayormente específico del producto, con huecos genéricos.** Lo propio de imprenta está en el contenido (totales por unidad, "cantidad a despachar" con motivo "Requiere producción", cabecera canónica, K100). El marco (toolbar, estados, grilla) era un CRUD genérico.

| # | Heurística | Nota | Tras los arreglos |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | Skeleton por columna con la altura real de fila |
| 2 | Lenguaje del mundo real | 3 | "Despachar todo lo pendiente"; "Sin pendiente" |
| 3 | Control y libertad | 2 | "Reintentar" en el estado de error |
| 4 | Consistencia | 2 | Vacío uniforme "—"; "Máx." en pista y error; tags alineados al cabezal |
| 5 | Prevención de errores | 3 | Filas con tope 0 deshabilitadas; el pie excluye celdas inválidas |
| 6 | Reconocer antes que recordar | 2 | Celda principal subrayada en hover/foco. **Pendiente**: hub sin etiquetas |
| 7 | Flexibilidad y eficiencia | 2 | **Pendiente**: navegación por teclado entre filas; recordar la vista elegida |
| 8 | Estética minimalista | 2 | Densidad recuperada (57 → 40 px) |
| 9 | Recuperación de errores | 2 | Copy operativo en lugar de "Error 500"; reintento |
| 10 | Ayuda | n/a | — |
| | **Total** | **20/36** | Sin re-puntuar (requiere otra corrida A) |

### 5.2 Evidencia mecánica (B)

- **CLI:** 0 hallazgos.
- **Overlay en 7 stories:**
  - `undersized-ui-text`: cabeceras de 10 px y etiquetas de card de 9 px. Patrón del sistema de diseño (track B); se registra como alerta de legibilidad para el sistema de diseño.
  - `low-contrast`: chips **warning 1,2–1,3:1** ("Menor", "Dinámico") y **success 2,4–2,7:1** ("Mayor"). Son tokens heredados de `StatusBadge`/`Chip`, no del spike. Los grises de 3,0–3,2:1 corresponden a `muted-foreground` en metadatos.
- **Respaldo:** 0 desbordes de página y 0 errores de consola. Checkboxes de card sin etiqueta (heredado; resuelto en el spike con un checkbox propio).

### 5.3 Prioridades y estado

| Prioridad | Problema | Propiedad | Estado |
|---|---|---|---|
| P1 | Densidad compact incumplida: filas de 57 px por la regla Fitts global (`globals.css:766`) sobre los `Button` de cabecera y celda principal | Spike, disparado por una regla heredada | **Corregido localmente** (`h-7` + margen negativo → 40 px). Corrección de fondo = prerrequisito R3 (§7) |
| P2 | La celda principal no parece enlace y pierde el renderer de su tipo | Spike | **Parcial**: subrayado en hover/foco. El renderer completo dentro del botón no es posible porque `DataCell` renderiza `div` (HTML inválido dentro de `button`) → prerrequisito R1 |
| P3 | Loading con salto de layout; error sin salida y con mensaje crudo; vacío sin distinguir el filtro | Spike | **Corregido** (skeleton por columna, error dentro del marco con reintento, `isFiltered`) |
| P4 | Despacho: input lejos de "Pendiente", tope 0 editable, decimales y forma inconsistentes, pie que sumaba inválidos | Spike | **Corregido** (a–d, f). **Pendiente** (e): a 390 px la primera columna no es fija |
| P5 | Alineación y vacíos inconsistentes; icono de orden mal colocado en columnas numéricas | Spike / heredado | **Corregido** lo propio. Heredado: "$-48.000" en negativos (formatter de `DataCell.Currency`) |
| — | Contraste de chips warning/success | Heredado | Prerrequisito R6 (§7) |
| — | Hub de 3–4 anillos sin texto; vocabulario de estado distinto en tabla (badge) y card (hub) | Decisión de diseño | Pregunta abierta (§9) |
