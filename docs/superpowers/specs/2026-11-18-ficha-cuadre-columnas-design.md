# Ficha de cuadre en columnas con guardado único

**Fecha:** 2026-11-18 · **Estado:** borrador para aprobación
**Base:** ADR-0141 (cuadre unificado por grupo). Referencia visual: `docs/Captura de pantalla de 2026-11-18 12-54-31.png`.

## 1. Intención

Hoy `FiscalMatchDrawer` muestra el grupo como bloques apilados (ERP, TUU, RCV). Cada unión o desvinculación se aplica en el acto con su propia llamada. Los candidatos aparecen recién al pulsar un botón: son hasta 20, sin buscador, sin orden y sin indicador de coincidencia.

El usuario quiere **armar el cuadre de forma visual**:

- columnas lado a lado (una por registro), cada una con buscador, conteo, orden y tarjetas, como en la captura de referencia;
- un indicador de coincidencia por tarjeta;
- un **pie con «Guardar cambios»**: las selecciones quedan en espera y se aplican juntas.

Se mantienen **todas las reglas del cuadre** ya definidas (ADR-0141).

## 2. Objetivos, no objetivos, anti-objetivos

**Objetivos**

1. Columnas:
   - **Ventas:** `01 Documento ERP` → `02 Pagos TUU` → `03 RCV (SII)`.
   - **Compras:** `01 Documento ERP` → `02 RCV (SII)`.
2. Cada columna lista **todos los registros sin cuadrar** de esa parte, ordenados por coincidencia con el grupo. También muestra los que no cumplen una regla, con su advertencia visible.
3. Los cambios (seleccionar o quitar) quedan **en espera en pantalla**. El pie muestra «N cambios sin guardar», «Descartar» y «Guardar cambios».
4. «Guardar cambios» aplica todo **o nada**, con las mismas validaciones y el mismo candado del motor. Si algo falla, se marca la tarjeta que falló y no se guarda ningún cambio.

**No objetivos**

- Cambiar las reglas del motor, los estados o la tarea automática.
- Unir registros de un grupo ya **Cuadrado** con otro grupo: solo se ofrecen registros sin cuadrar.
- Edición en lote de varios grupos a la vez: la ficha trabaja sobre un solo grupo.

**Anti-objetivos**

- Que el guardado deje un grupo a medias: si falla un cambio, se aplican cero.
- Que el puntaje de coincidencia **decida** algo. Solo ordena y orienta; la unión siempre la confirma el usuario.
- Que una tarjeta con advertencia se guarde sin que el usuario la haya visto (la advertencia está en la tarjeta, junto a la selección).
- Consultas por fila (ADR-0118).

## 3. Restricciones

Valen todas las reglas de ADR-0141, en particular:

- **Pago por pago:** un pago TUU se une a un pago del ERP (`matched_movement`). Un documento puede tener N pagos TUU.
- **Efectivo:** un pago TUU en efectivo solo respalda boletas 39/41.
- **Ventas anuladas:** no cuentan.
- **Boletas 39/41:** se unen sin control de RUT.
- **Facturas y notas:** el RCV exige la misma dirección, el mismo tipo y el mismo RUT.
- **Partes «No aplica» y «Solo resumen»:** su columna no ofrece candidatos.
- **Vínculos manuales:** quedan protegidos (`linked_manually` / `rcv_linked_manually`). Quitar un registro lo deja huérfano y protegido.
- **Candado del motor:** si la tarea automática está corriendo, el guardado responde 409 con «El cuadre automático se está ejecutando. Reintente en unos segundos.».
- **Idempotencia:** el POST lleva `Idempotency-Key`.
- **Permisos:** leer requiere `tax.view_taxperiod`; guardar requiere `tax.change_taxperiod`. Sin permiso de cambio, la ficha es de solo lectura (sin selección ni pie).
- **Repo:** cero `any`, `StatusBadge`, barrels, hooks de feature, views ≤ 20 líneas, sin colores crudos y término «Cuadre».

## 4. Enfoques

| | Enfoque | Trade-off |
|---|---|---|
| **A (elegido)** | La ficha actual se ensancha a casi pantalla completa, en columnas. Los cambios quedan en espera en el cliente y hay un endpoint de guardado atómico más uno de búsqueda de candidatos con puntaje. | Requiere dos endpoints nuevos y reescribir la ficha. Conserva los puntos de entrada actuales (`openEntity`, `?selected`). |
| B | Página propia `/accounting/rcv/cuadre/{id}`. | Deja dos maneras de ver un grupo y saca al usuario de la lista. |
| C | Columnas con cambios inmediatos, sin pie. | No cumple el guardado único y choca con el candado del motor en cada clic. |

## 5. Diseño

### 5.1 Ficha

- **Ancho:** `master` (75 %) del sistema de anchos de ficha (`lib/form-widths.ts`). Si en pantallas estrechas no caben las columnas, se apilan.
- **Encabezado:** título del grupo, `StatusBadge` del grupo, dirección («Venta»/«Compra»), fecha y última revisión (sin tipo ni RUT: decisión del usuario, 2026-11-18). Los avisos (`notice`, alerta de período cerrado, error de emisión) siguen ahí.
- **Acciones inmediatas:** «Reintentar emisión» y «Devolver al cruce automático» siguen siendo inmediatas en el encabezado, porque no son uniones.
- **Columnas,** con numeración y flechas entre ellas como en la captura. Cada columna tiene:
  - título, subtítulo y el `StatusBadge` de su parte (`erp_state` / `tuu_state` / `rcv_state`);
  - **arriba, «En este cuadre»:** las tarjetas ya unidas al grupo, cada una con «Quitar» (queda en espera);
  - **debajo, «Sin cuadrar»:** buscador, «N resultados», un selector de orden («Mejor coincidencia» por defecto, «Más recientes») y las tarjetas candidatas, paginadas al hacer scroll (20 por página);
  - si la parte está en «No aplica» o «Solo resumen»: no hay lista, solo un mensaje («Este documento no espera pagos TUU», «El SII solo informa el resumen mensual de los 48»).
- **Tarjeta** (componente de feature `FiscalMatchCandidateCard`, sobre las superficies de tarjeta compartidas):
  - ícono, número o folio, contraparte o dispositivo, fecha (con hora en TUU), total;
  - un chip «N % coincidencia» (`intent` success ≥ 90, warning 60–89, neutral < 60);
  - chips de advertencia («Otro monto», «Otro día», «Otro RUT», «Tipo distinto», «Efectivo en factura»);
  - estado visual de selección: seleccionada, en espera de quitar, deshabilitada con motivo.
- **Selección por columna:**
  - **ERP:** se puede elegir un documento solo si el grupo es huérfano, y uno solo.
  - **TUU:** se pueden seleccionar varias ventas. Cada una pide **elegir el pago** del documento entre sus pagos compatibles (hora · medio). Si hay uno solo, se asigna solo.
  - **RCV:** se pueden seleccionar varios registros en boletas y uno en facturas y notas.
  - Si el grupo es huérfano y aún no hay un documento elegido, las columnas TUU y RCV muestran los registros propios del grupo y no ofrecen candidatos hasta elegir el documento.
- **Pie** (componente compartido `FormFooter`, siempre visible si hay permiso de cambio):
  - a la izquierda, «N cambios sin guardar» y la lista resumida al pasar el cursor;
  - a la derecha, «Descartar» y «Guardar cambios» (deshabilitado sin cambios o mientras guarda).
  - Al cerrar la ficha con cambios en espera, se pide confirmación («Hay cambios sin guardar»).

### 5.2 Búsqueda de candidatos con puntaje

`GET /api/tax/fiscal-matches/{id}/search/?part=erp|tuu|rcv&q=&ordering=score|recent&page=`

- **Universo «sin cuadrar» por parte** (respecto de la dirección del grupo):
  - **erp:** documentos de la misma dirección que se pueden evaluar, cuyo grupo no está `MATCHED` ni `EXCLUDED` y no tiene ya registros de la parte que el grupo trae (TUU o RCV);
  - **tuu:** ventas TUU `COMPLETED` que están en grupos huérfanos (sin documento);
  - **rcv:** registros RCV de la misma dirección en grupos huérfanos sin ventas TUU, sin `missing_since_import`.
- **Búsqueda (`q`):** número o folio, RUT, monto exacto, nombre de contraparte o dispositivo.
- **Puntaje 0–100,** calculado en el servidor contra el grupo (su documento o, si es huérfano, su registro externo):
  - **monto:** igual, 40; distinto, 0. En TUU se compara con el monto de algún pago libre del documento.
  - **fecha:** el mismo día local, 25; si no, `max(0, 15 − 3 × días de diferencia)`.
  - **contraparte:** el mismo RUT normalizado, 20; vale 20 también si la parte no tiene RUT (TUU o boletas).
  - **tipo compatible:** 15 (las reglas de tipo de ADR-0141, incluido efectivo solo con boletas).
  - **folio igual** (RCV ↔ documento con número): 100 directo.
- **Advertencias:** cada criterio que no suma su máximo agrega su chip. Las advertencias bloqueantes (ver §7c) marcan la tarjeta como «no se puede unir», con el mismo texto que dará el servidor.
- **Orden:** puntaje descendente, luego fecha más reciente. Con `ordering=recent`, fecha descendente.
- **Paginación** estándar (20). Consultas fijas: el puntaje se calcula en Python sobre la página, a partir de datos precargados. El universo se filtra en SQL; el orden por puntaje se resuelve con anotaciones SQL (montos, fechas y RUT), sin traer todo a memoria.
- La respuesta de cada tarjeta incluye los campos para mostrarla, `score`, `warnings: [{code, label, blocking}]` y, en TUU, `compatible_movements` (como hoy).

### 5.3 Guardado atómico

`POST /api/tax/fiscal-matches/{id}/apply/` con `Idempotency-Key`. Cuerpo:

```
{ "changes": [
    {"op": "link",   "part": "erp", "id": 12},
    {"op": "link",   "part": "tuu", "id": 81, "movement": 501},
    {"op": "unlink", "part": "rcv", "id": 33}
] }
```

- **Servicio:** `apply_changes(group, changes) -> FiscalMatch`, bajo `_exclusive` + `@transaction.atomic`. Aplica primero las desvinculaciones, luego la unión ERP (si el grupo es huérfano, pasa a trabajar sobre el grupo del documento) y después las uniones TUU y RCV. Cada paso reutiliza `link_invoice`, `link_terminal_sale`, `link_rcv_document` y `unlink`, en su variante sin candado ni transacción propios (refactor interno: las funciones públicas actuales quedan como envoltorios).
- **Errores:** si un cambio falla, se revierte todo y la respuesta es 400 con el sobre estándar de errores: `error.message`, `error.code` y `error.details.change_index` (= i) para marcar esa tarjeta. Si el motor está corriendo, la respuesta es 409.
- **Respuesta:** el detalle del grupo resultante (puede ser otro id, si un huérfano se unió a un documento). La ficha lo sigue igual que hoy (`onGroupChange`, `?selected`).
- **Endpoints de unión individuales:** `link`, `unlink` y `candidates` quedan sin consumidor en el frontend y **se eliminan** (backend, API cliente, hooks, pruebas). `release` y `retry-issue` se mantienen.

### 5.4 Estado en el cliente

- Hook de feature `useFiscalMatchDraft(group)`: guarda la lista de cambios en espera, la deriva para pintar las tarjetas (unida, a quitar, seleccionada, pago elegido), detecta si hay cambios y produce el cuerpo de `apply`.
- Mutación `useApplyFiscalMatch()` sobre `useGroupMutation`: invalida, sigue al grupo resultante y descarta la espera si guardó bien.
- Si llega un 400 con `change_index`, esa tarjeta se marca en error y los demás cambios siguen en espera.

## 6. Inventario

| Elemento | Acción |
|---|---|
| `FiscalMatchDrawer.tsx` | Reescribir: encabezado, columnas y pie |
| Bloques `ErpBlock`, `TuuBlock`, `RcvBlock`, `*Candidates`, `PaymentChoice` | Reemplazar por `FiscalMatchColumn`, `FiscalMatchCandidateCard` y el selector de pago dentro de la tarjeta |
| `FiscalMatchRegisterSection` (alimentación de compras) | Se mantiene, como sección bajo la columna RCV de un huérfano de compra |
| `services.py` | Agregar `apply_changes` y variantes internas sin candado; eliminar `group_candidates` y los `_*_candidates` si `search` los reemplaza (reutilizar su lógica de compatibilidad) |
| `views.py` / `serializers.py` / `urls` | Agregar `search` y `apply`; eliminar `link`, `unlink` y `candidates` |
| `fiscalMatchApi.ts`, `useFiscalMatches.ts`, tipos | Agregar `search` y `apply` y sus tipos; eliminar `link`, `unlink` y `candidates` |
| ADR-0141 / `api-contracts.md` / `idempotency.md` | Documentar `search`, `apply`, el puntaje y el scope `tax.fiscal_match.apply` (reemplaza `link` y `unlink`) |

## 7. Llamadas mías (revisables)

- La ficha usa el ancho `master` y no una página propia (enfoque A).
- «En este cuadre» va arriba y «Sin cuadrar» abajo en cada columna.
- Los pesos del puntaje son los de §5.2.
- Los registros de grupos ya cuadrados no se ofrecen.
- Los endpoints `link`, `unlink` y `candidates` se eliminan al quedar sin uso.

## 7b. Decisiones tras la revisión (mis llamadas)

- **Pago de las ventas propias de un huérfano al elegir el documento:** el cambio `{"op":"link","part":"erp","id":…}` lleva `"payments": {"<sale_id>": <movement_id>, …}`. En la UI, al elegir el documento, las ventas propias del huérfano aparecen en la columna TUU con su selector de pago (se asigna solo si hay un único pago compatible). `_assign_payments` se extiende para recibir el mapa.
- **ERP no tiene «Quitar»:** el grupo *es* el documento. Para separar registros se quitan los TUU o RCV. Solo un huérfano puede elegir un documento.
- **Orden dentro de `apply_changes`:** primero los `unlink` (sobre el grupo actual), luego `link erp` (el huérfano se fusiona con el grupo del documento) y luego los `link` TUU y RCV sobre el grupo resultante. `change_index` es el índice en la lista enviada. Al inicio se bloquean todos los grupos involucrados y se verifica que cada registro siga donde la UI lo vio; si no, la respuesta es `MOVED` con su índice.
- **Consecuencias visibles:** si al unir una venta TUU su boleta RCV huérfana viaja con ella (regla actual), la UI la muestra en el borrador como «se moverá también» antes de guardar.
- **409 y reintentos:** el borrador se conserva tras un 409 o un 400. La clave de idempotencia se renueva por intento después de un rechazo del servidor (comportamiento de `useIdempotencyKey`).
- **Datos que cambian mientras se edita:** tras cada refresco del grupo o de las columnas, los cambios en espera cuyo registro ya no está disponible se descartan con un aviso («1 cambio ya no aplica: la venta TUU #81 se cuadró en otro grupo»).
- **Referencia del puntaje:** el documento del grupo. En un huérfano, su primer registro externo (la venta TUU, si no el RCV). «Folio igual = 100» solo cuando también calzan la dirección y el tipo.
- **Universo ERP:** documentos de los últimos 62 días (`SCAN_DAYS`). Con texto de búsqueda (`q`), sin límite de fecha.
- **Ventas anuladas:** no se ofrecen; no se pueden unir.
- **Documentación:** se enmiendan ADR-0141 D7/D8 e `idempotency.md` (se retiran los scopes `link`/`unlink` y se agrega `apply`).

## 7c. Reglas al guardar (decisión del usuario, 2026-11-18)

El servidor endurece la unión manual (hoy solo la UI evita estos casos):

- **Bloquean** el guardado (400, con `error.code`, `error.details.change_index` y el motivo), porque rompen el cuadre:
  - un tipo de documento incompatible, incluido un pago TUU en efectivo hacia algo que no es una boleta 39/41;
  - otra dirección (compra o venta);
  - un pago del ERP ya tomado por otra venta TUU;
  - un segundo documento ERP;
  - un segundo registro RCV en una factura o nota;
  - una venta TUU anulada.
- **Se permiten con aviso:**
  - otro RUT (en facturas y notas);
  - otro día;
  - otro monto.

  Otro RUT y otro monto dejan el grupo en el estado `DIFF` hasta que se corrija; otro día solo avisa en la tarjeta y no cambia el estado (decisión del usuario, 2026-11-18). Las tarjetas muestran esas advertencias, que no son bloqueantes.
- **Etiquetas:** el estado de grupo `DIFF` pasa de «Con diferencia» a **«Con advertencias»** (en el backend `FiscalMatchStatus`, en `lib/fiscal-match.ts`, en el glosario y en ADR-0141). Por coherencia, el estado de parte `DIFF` pasa de «Diferencia» a **«Advertencia»** (llamada mía).
- **Advertencias bloqueantes:** en la búsqueda (§5.2), las advertencias que bloquean llevan `blocking: true`. La tarjeta se muestra deshabilitada con el motivo y no se puede seleccionar.
- **RUT en el puntaje:** el criterio «otro RUT» deja de ser una regla bloqueante para facturas y notas (ajusta §5.2).

## 8. Queda para el builder

- La forma exacta de las anotaciones SQL del puntaje.
- Las animaciones y transiciones de selección (siguiendo DESIGN.md).
- Cómo se apilan las columnas en pantallas estrechas.
