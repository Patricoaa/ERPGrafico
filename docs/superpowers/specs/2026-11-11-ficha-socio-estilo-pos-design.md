# Ficha del socio al estilo de la sesión POS — diseño

Fecha: 2026-11-11 · Estado: borrador para aprobación · Relacionado: ADR-0132 (ficha y acciones de socio), `component-document-sheet.md` §6b (sesión POS), ADR-0087 (entity-view), ADR-0118 (zero N+1).

## Intención

Hoy `PartnerDrawer` tiene 4 pestañas (Resumen, Libro, Participación, Distribuciones) y **todas** las acciones viven en el header y en el menú de fila de la lista. No avisa qué requiere atención ni deja operar dentro de cada pestaña. La ficha de sesión POS (`POSSessionSheet`) resuelve esto: un Resumen que explica en segundos qué pasó y qué necesita atención (alertas con botón al tab que las investiga), KPIs con `StatCard`, y pestañas que responden preguntas distintas sin duplicarse.

Se busca que la ficha del socio funcione igual: el Resumen dice cómo está el socio y qué hacer; cada pestaña responde una pregunta y aloja sus acciones secundarias; la lista de composición queda reducida a «abrir ficha», «añadir socio» y «transferir capital».

## Objetivos

1. Ficha con 6 pestañas: **Resumen · Capital · Resultados y retiros · Distribuciones · Libro · Relaciones**.
2. Acciones secundarias dentro de la pestaña a la que pertenecen; el header conserva solo «Dar de baja» en un menú «⋯».
3. Resumen con alertas accionables, KPIs, datos del socio y composición del patrimonio, alimentado por un endpoint `overview` de query count fijo.
4. `/finances/partners/composition`: la fila/tarjeta solo abre la ficha; la barra tiene **Añadir socio** (primaria) y **Transferencia** (secundaria).
5. La transferencia de capital también se inicia desde la pestaña Capital, con el socio actual como origen prellenado.

## No-objetivos

- Historial de auditoría / pestaña «Actividad» (decisión del usuario: no se incorpora).
- Anular distribuciones `EXECUTED` (sigue fuera de alcance, ADR pendiente).
- Cambiar la página `/finances/partners/distributions`, sus wizards o sus acciones.
- Cambiar reglas contables de aportes, retiros, dividendos o transferencias: solo cambia **desde dónde** se invocan.
- Migrar datos o cambiar la forma de los endpoints de escritura existentes.

## Anti-objetivos (fracaso aunque «funcione»)

- Acciones duplicadas en varias superficies sin fuente única (debe seguir existiendo `partnerActions` como única declaración de acciones).
- Alertas que repiten el cálculo de visibilidad de las acciones con reglas distintas.
- N+1 en `overview` (invariante 14).
- Acciones tachadas por CSS en vez de ocultas o deshabilitadas con motivo.

## Restricciones

- Invariantes de `CLAUDE.md`: cero `any`, tokens semánticos, hooks de feature para `useQuery`/`useMutation`, barrels, `StatusBadge` para estados, `StatCard` para KPIs, tablas vía `@/components/entity-view`, vistas Django ≤ 20 líneas con lógica en `services.py`/selectors.
- Las escrituras monetarias exigen `Idempotency-Key` (ya cableado en `usePartnerMutations`).
- Cambiar el contrato de la ficha (`component-document-sheet`/ADR-0132) requiere **ADR nuevo** (invariante 12) y actualizar los docs de contrato.
- Mantener el panel lateral de comentarios (`EntitySidebar`, colapsable) como hoy.
- Permisos: las acciones respetan los permisos actuales (`contacts.post_partnertransaction`, etc.).

## Estructura de la ficha

Header: título = nombre del socio; subtítulo = ID fiscal · «socio desde {fecha}». Menú «⋯» con **Dar de baja**: si `demoteBlockedReason` ≠ null, el ítem aparece deshabilitado y muestra el motivo (hoy desaparece).

| Pestaña | Responde | Contenido | Acciones secundarias |
|---|---|---|---|
| **Resumen** | ¿Cómo está y qué requiere atención? | Alertas primero, cada una con botón (ejecuta la acción o lleva a la pestaña): exceso de capital, capital pendiente, dividendos por pagar, utilidades retenidas sin destino. Luego KPIs (`StatCard`, sin divisor): participación %, capital suscrito, capital enterado, patrimonio neto. Datos del socio: contacto vinculado (enlace a su ficha de contacto), socio desde, ID fiscal. Composición del patrimonio: capital, utilidades retenidas, dividendos por pagar, retiros provisorios. | Las de cada alerta |
| **Capital** | ¿Cuánto suscribió, aportó y debe? | Suscrito / enterado / pendiente / exceso con la fórmula visible. Historial de participación (absorbe la pestaña «Participación» actual, misma entity-view `partnerStake`). Movimientos de capital (aportes, suscripciones, reducciones, transferencias) tomados del libro. | Registrar aporte · Pagar capital pendiente · Suscribir / reducir · Formalizar exceso · **Transferir a otro socio** (origen prellenado) |
| **Resultados y retiros** | ¿Qué le corresponde y qué retiró? | Utilidades retenidas, dividendos por pagar, retiros provisorios y los movimientos de cada uno (tabla con filtro por tipo). | Registrar retiro · Pagar dividendos · Distribuir utilidades retenidas |
| **Distribuciones** | ¿En qué repartos participó? | Igual que hoy (`partnerDistribution` entity-view); cada fila abre la distribución. | — |
| **Libro** | ¿Qué asientos lo respaldan? | Libro auxiliar actual (`PartnerLedgerPanel`) con filtros por tipo de movimiento. | — |
| **Relaciones** | ¿Con qué se vincula? | Patrón de documentos relacionados (ADR-0080, `DocumentRelationsTab`): contacto, asientos, distribuciones. Requiere proveedor de relaciones para `contacts.partner` (ver «Backend»). | — |

Reglas de visibilidad de acciones: se conservan las de `partnerActions` (`partner_excess_capital > 0`, `partner_pending_capital > 0`, `partner_dividends_payable_balance > 0`, `partner_earnings_balance > 0`; «Registrar aporte» y «Registrar retiro» siempre). `partnerActions` sigue siendo la única fuente: cada acción gana un campo `placement` (`"capital" | "results" | "menu"`) para que cada pestaña renderice solo las suyas; las alertas del Resumen **derivan de las mismas condiciones** (no se reimplementan).

## Vista de composición

- `onOpen` abre la ficha (`?selected=id`); se elimina `actions={partnerActions.forCollection(...)}` y el menú por fila.
- Barra de herramientas: **Añadir socio** (primaria) y **Transferencia** (secundaria, `variant="outline"`). Se retiran «Nueva suscripción» y «Registrar aporte».
- Estado sin socios: solo «Añadir socio».
- `createAction` del page (`ToolbarCreateButton`, `?modal=add-partner`) se mantiene y se evita duplicar el botón «Añadir socio».
- La transferencia sigue usando el flujo actual (`run({ type: "transfer" })` / `partnersApi.recordTransfer`).

## Backend

- **Nuevo** `GET /contacts/{id}/partner_overview/` (acción en `ContactViewSet`, ≤ 20 líneas, lógica en un selector/servicio de `contacts`, p. ej. `partner_overview.py` como `treasury/pos_session_overview.py`): devuelve alertas (código, severidad, importe, pestaña destino), KPIs, datos del socio y composición del patrimonio. **Query count fijo** con test de N+1 (ADR-0118). Permiso de lectura análogo a `partner_statement`.
- Reutilizar `_partner_metrics_map` para las métricas (ya usado por `partner_statement`); no calcular importes con ORM por fila.
- **Relaciones:** registrar un proveedor de relaciones `contacts.partner` (contacto, asientos de sus `PartnerTransaction`, distribuciones en las que participa) siguiendo `document-relations.md`.
- Los endpoints de escritura no cambian.
- Se evalúa retirar `partners_summary` (sin consumidor en el frontend) — decisión del implementador, fuera del camino crítico.

## Frontend

- `PartnerDrawer` pasa a 6 pestañas; paneles nuevos en `features/partners/components/` (`PartnerSummaryPanel`, `PartnerCapitalPanel`, `PartnerResultsPanel`); `StakesPanel` se fusiona en Capital.
- Hook nuevo `usePartnerOverview(id)` en `features/partners/hooks/` con clave en `PARTNER_KEYS`; las mutaciones existentes invalidan el árbol `partners`, así que el Resumen se refresca solo.
- `usePartnerActions` / `PartnerActionModal` se reutilizan: las acciones por pestaña llaman `run(...)` igual que hoy.
- Las pestañas usan `Collection`/entity-view (invariante 13) y los componentes de carga/vacío/error (invariante 8).
- Se actualiza `component-document-sheet.md` con una sección «ficha de socio (`contacts.partner`)» y se escribe un ADR (0133) que reemplaza la lista de pestañas de ADR-0132.

## Pruebas esperadas

- Backend: test del endpoint `partner_overview` (alertas por estado del socio, 400/404 si no es socio) y test de N+1 con varios socios.
- Frontend: `PartnerDrawer` (6 pestañas, acciones en su pestaña, «Dar de baja» deshabilitada con motivo), `PartnersClientView` (solo abrir ficha, barra con Añadir socio y Transferencia, sin menú por fila), alertas del Resumen que disparan la acción.
- Definition of done: `npm run type-check`, `npm run lint`, tests afectados y `ruff`/`pytest` del módulo `contacts`.

## Decisiones del usuario

- Transferencia también desde la ficha (pestaña Capital), con origen prellenado.
- Estructura Capital + Resultados y retiros (Participación se fusiona en Capital).
- Panel lateral de comentarios se mantiene.
- Pestaña Relaciones incluida.
- Sin pestaña ni historial de auditoría.
- Endpoint `overview` incluido en este trabajo.

## Decisiones mías (a revisar)

- Libro se conserva como pestaña propia en vez de absorberlo en Capital / Resultados.
- Campo `placement` en `partnerActions` para repartir acciones por pestaña.
- Nombre del endpoint `partner_overview` y del ADR (0133).
- «Dar de baja» deshabilitada con motivo en vez de oculta.
- `partners_summary` queda a criterio del implementador.

## Qué queda al implementador

Forma exacta del payload de `overview`, textos de alertas, orden de columnas de las tablas, y el diseño visual fino siguiendo `DESIGN.md` y los tokens de `globals.css`.

## Aclaraciones tras la revisión (decisiones mías, a revisar)

- **Propiedad de las alertas:** el backend es dueño de la lista de alertas. `partner_overview` calcula umbrales una sola vez y devuelve cada alerta con `code`, `severity`, `amount`, `target_tab` y `action` (el `type` de `PartnerActionRequest`, p. ej. `contribution`). El frontend no recalcula umbrales: mapea `action` a `run(...)`. `partnerActions` conserva su `visible` por fila (misma regla numérica; un test de paridad compara ambos para un conjunto de socios).
- **Relaciones es trabajo nuevo, no reutilización fina:** hoy solo existe el tipo de documento `contacts.partnertransaction` en `contacts/relations.py`; no hay proveedor para `contacts.partner`. Se crea el proveedor (contacto, asientos de sus movimientos, distribuciones) y el plan debe verificar al inicio que `DocumentRelationsTab` acepta una entidad maestra; si exige un documento, se extiende el contrato (queda cubierto por el ADR 0133). Es la parte de mayor incertidumbre y va **al final** del orden de implementación, después del Resumen.
- **Datos de Capital y Resultados:** salen de `partner_statement` (`transactions` con `transaction_type`; hay tipos distintos para retiro provisorio, aporte, suscripción, reducción y dividendos). El filtrado por tipo es del lado del cliente sobre esa lista. Si el plan descubre que falta un tipo para clasificar utilidades retenidas, se amplía el serializador (cambio de lectura permitido; las escrituras no cambian).
- **Fórmulas:** patrimonio neto, enterado, pendiente y exceso son las que ya expone `_partner_metrics_map` / `partner_net_equity`. El `overview` las reutiliza tal cual y no define fórmulas nuevas; la pestaña Capital solo las muestra.
- **Transferir:** una sola declaración. `partnerActions` gana la acción `transfer` con `placement: "capital"` y origen prellenado; la barra de la lista usa la misma acción a nivel colección, sin origen. Un único `PartnerActionRequest` `{ type: "transfer"; fromPartnerId?: number }`.
- **Dar de baja:** `demoteBlockedReason` se calcula en el frontend con los campos que ya trae el socio; la ficha ya los tiene al abrirse con `?selected=id`. No se agrega al `overview`.
- **Añadir socio:** el `ToolbarCreateButton` del page sigue siendo el botón primario; solo se añade «Transferencia» como secundaria junto a él y se elimina el botón «Añadir socio» duplicado que `PartnersClientView` dibuja cuando no hay socios.
- **ADR:** el número 0133 está libre (el último es 0132).
