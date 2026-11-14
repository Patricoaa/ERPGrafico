# Sincronización de ventas del terminal de cobro TUU

Fecha: 2026-11-13 · Estado: borrador para aprobación

## Intención y por qué

El negocio cobra en un terminal TUU (Haulmer): efectivo, débito, prepago y crédito, emitiendo boleta (39),
comprobante de pago (48) o factura afecta (33). Hoy el ERP no sabe nada de esas ventas: los lotes de
liquidación (`TerminalBatch`) se registran a mano y no hay forma de ver comisiones ni fechas de abono.

Esta primera iteración es deliberadamente **solo de captura**: traer todo lo que TUU entrega, guardarlo íntegro
y mostrarlo. Cuanta más información se recupere, mejor; el uso contable/conciliación viene después, cuando se
conozcan mejor los datos. El usuario pidió explícitamente empezar simple y complejizar más adelante.

## Objetivos

1. Una tarea Celery diaria, con reintentos, descarga los 3 reportes de TUU para cada proveedor TUU activo.
2. Se guarda cada respuesta cruda (cada página de cada reporte) tal cual llegó.
3. Con esas respuestas se construye **una fila por venta** que unifica los 3 reportes, sin duplicados, y que se
   actualiza en cada re-consulta (para completar abonos y cambios de estado).
4. Las ventas se ven en una nueva pestaña **Ventas** en `/treasury/terminal-cobro/`, con su entidad y ClientView.
5. Tesorería gana una pestaña **Configuración** (como los demás módulos) con la sección de sincronización TUU.

## No-objetivos (esta iteración)

- No se crean asientos contables, movimientos de tesorería ni `TerminalBatch`.
- No se vinculan ventas TUU con notas de venta, sesiones POS ni lotes existentes.
- No se obtiene el folio del DTE: ninguna API de TUU lo entrega (verificado: saleId 14015 ↔ folio 72745 no
  aparece en ninguna respuesta). Tampoco RUT/razón social del receptor de facturas 33.
- No se editan ni anulan ventas desde el ERP: es un espejo de solo lectura de TUU.
- No se soportan otros proveedores (Transbank, MercadoPago…), aunque el diseño no debe impedirlo.

## Anti-objetivos (sería un fracaso aunque funcione)

- Duplicar ventas al re-sincronizar un rango ya traído.
- Perder datos: si un campo de TUU no se mapea a columna, igual debe quedar en el crudo y en la copia por venta.
- Exponer la API key en logs, respuestas de la API, crudos guardados o mensajes de error.
- Que una falla en un proveedor o en un día deje la sincronización en un estado silencioso: toda ejecución deja
  rastro visible (estado, error, contadores).

## Fuente: APIs de TUU (verificadas el 2026-11-13 con datos reales)

Base `https://integrations.payment.haulmer.com`, header `X-API-Key`, `Content-Type: application/json`,
`pageSize` máximo 20. La key ya existe cifrada en `PaymentTerminalProvider.gateway_config` vía
`get_api_key()` / `set_api_key()` (`backend/treasury/models.py`, `core/crypto.py`).

| Llamada | Endpoint y body | Qué aporta | Particularidades |
|---|---|---|---|
| A. Sucursal tarjeta | `POST /BranchReport/branch-report` `{startDate, endDate, page, pageSize}` | ventas con tarjeta: `documentType`, `transactionType` fino (DEBIT/CREDIT/PREPAID), `cardBrand`, `cardBin`, `cardIssuer`, `cardOrigin`, `installmentType/Count`, `tipAmount`, `cashbackAmount`, `instance`, `locationId`, `serialNumber` | sin filtro **solo** devuelve tarjeta; listas separadas por coma en `typeTransaction` no funcionan; rango máx. documentado 30 días (doc dice 30 y 60, usar 30); envelope `metadata.code` (`BR-00` éxito, `BR-27` sin datos) + `pagination` |
| B. Sucursal efectivo | igual + `typeTransaction: "CASH"` | ventas en efectivo con `documentType` (39), `locationId` | `sequenceNumber` es `null`; `status` y tipo en otra capitalización (`Completed`, `Cash`) |
| C. Reporte general | `POST /Report/get-report` `{Filters:{StartDate, EndDate, SerialNumber?}, page, pageSize}` | **todas** las ventas; `amountCommission`, `amountWithoutCommission`, `reconciliations[]` (`paymentDate`, `installmentNumber`, `amount`, `reconciliationId`), `extraData.items` | colapsa PREPAID en DEBIT; en tarjeta `saleId` y `posSerialNumber` vienen `"N/A"`/vacíos; en efectivo `sequenceNumber` es `"N/A"`; rango máx. 1 mes; envelope `{code, message, content:{reports, totalItems, totalPages, page}}`; 404 = sin transacciones |

Observaciones de datos reales:
- Clave natural de unión: **efectivo → `saleId`**, **tarjeta → `sequenceNumber`**. Con días 2026-10-26
  (47 ventas) y 2026-11-13 (40 ventas) el cruce A+B ↔ C fue 1:1 sin huérfanos.
- `reconciliationId` vale `"0"` mientras el abono está pendiente y luego un id real (ej. `19720426`, común a
  todas las ventas abonadas el mismo día); en efectivo `"No reconciliation"`. Por eso hay que re-consultar días pasados.
- Capitalización inconsistente: `completed`/`Completed`, `DEBIT`/`debit`/`Cash`; `transactionType` a veces `""`.
- Ítems casi siempre `"\x02Nombre ítem 1"` (carácter de control al inicio); `code` nulo.
- `transactionDateTime` sin zona horaria: se asume hora de Chile (`America/Santiago`).
- Montos enteros en CLP (C los devuelve como float).
- No se observaron ventas `Reversed`; el modelo debe aceptarlas igual (status normalizado).

## Decisiones del usuario

- Tarea diaria Celery con reintentos para traer los 3 reportes.
- Se guarda el fetch crudo y además un reporte unificado por venta en BD.
- Exposición en frontend bajo `/treasury/terminal-cobro/` con su endpoint, entidad (`defineEntity`) y ClientView;
  campos indispensables: `documentType`, tipo de pago, emisor de tarjeta, `saleId`, fecha, monto, comisiones, "entre
  más info mejor".
- Todo configurable desde una nueva pestaña **Configuración** de Tesorería: activación de la tarea, días hacia
  atrás a revisar, hora de ejecución, entre otros.
- La configuración es **global** y aplica a todos los proveedores TUU activos (no por proveedor).

## Diseño

### Configuración (singleton global)

Modelo singleton nuevo en `treasury` (p. ej. `TerminalSyncSettings`), patrón de `WorkflowSettings`
(`get_settings()`). Campos:

| Campo | Default | Nota |
|---|---|---|
| `enabled` | `False` | nada corre hasta activarlo |
| `run_hour` | `3` | 0–23, hora local Chile |
| `lookback_days` | `7` | días hacia atrás (incluido ayer) que re-consulta cada ejecución diaria |
| `history_start_date` | `null` | piso: la tarea nunca consulta antes de esta fecha; fecha por defecto de "Cargar historial" |
| `max_retries` | `3` | reintentos por proveedor ante error transitorio |
| `retry_delay_minutes` | `10` | espera entre reintentos |
| `last_run_at`, `last_run_status` (solo lectura) | — | se derivan de la última ejecución; pueden ser propiedades en vez de columnas |

UI: panel de settings con autosave (`useAutoSaveForm` + `AutoSaveStatusBadge`, playbook
`add-settings-panel.md`), sin botón Guardar. Debajo, lista de las últimas ejecuciones (solo lectura).

### Programación (decisión de Claude)

`CELERY_BEAT_SCHEDULE` es code-first con `PersistentScheduler`, así que la hora no puede editarse en el scheduler.
Se registra **una entrada horaria** (minuto fijo, ej. `:10`) que llama a una tarea despachadora; esta solo trabaja
si `enabled`, la hora local actual ≥ `run_hour` y no hay una ejecución automática exitosa hoy. Así un servidor
caído a la hora exacta se recupera en la hora siguiente. Mismo espíritu que `workflow.tasks.daily_workflow_checks`.
Cuidar que el nombre registrado de la tarea coincida con el `"task"` del schedule (ver Riesgos).

### Ejecución de la sincronización

- Por cada `PaymentTerminalProvider` con `provider_type=TUU`, `is_active=True` y API key configurada, se crea una
  **ejecución** (`TerminalSyncRun`): proveedor, rango, origen (`SCHEDULED`/`MANUAL`), estado
  (`RUNNING`/`SUCCESS`/`PARTIAL`/`FAILED`), error legible (sin la key), contadores (traídas, creadas,
  actualizadas), inicio/fin.
- Rango diario: `max(history_start_date, hoy - lookback_days)` … ayer. Decisión de Claude: el día en curso se
  incluye solo en la sincronización manual, porque el diario corre de madrugada.
- Rangos > 30 días se parten en tramos de ≤ 30 días. Cada tramo: A, B y C con paginación completa.
- Cada página de cada llamada se guarda como **respuesta cruda** (`TerminalSyncPayload`): ejecución, tipo de
  reporte (`BRANCH_CARD`/`BRANCH_CASH`/`GENERAL`), rango, página, HTTP status, body JSON tal cual. El body enviado
  se guarda sin headers.
- "Sin datos" (`BR-27`, 404 de C) es éxito con cero ventas, no error.
- Errores transitorios (timeout, 5xx, `BR-01/13/18/19`) → reintento según settings. Errores de credencial (401,
  `KEY-003`) o de plan (`BR-25`, `BR-30`) → `FAILED` sin reintentar, con mensaje claro.
- Un proveedor que falla no detiene a los demás.
- La construcción de ventas de un tramo ocurre en `services.py` bajo `@transaction.atomic`, después de tener
  las 3 llamadas completas del tramo; si una llamada del tramo falla, el tramo no actualiza ventas (sus crudos sí
  quedan) y la ejecución queda `PARTIAL` o `FAILED`.

### Venta unificada (`TerminalSale`)

Una fila por venta, única por `(provider, natural_key)` donde `natural_key` = `cash:<saleId>` o
`card:<sequenceNumber>`. Re-sincronizar hace upsert (actualiza campos, no duplica).

Campos (normalizados; todos opcionales salvo identidad, fecha y total):
- Identidad: `provider`, `device` (FK nullable a `PaymentTerminalDevice` por `serial_number`; si no hay match
  queda nulo y se guarda `serial_number` en texto), `sale_id`, `sequence_number`, `location_id`.
- Momento y estado: `transaction_at` (aware, Chile), `status` (`COMPLETED`/`REVERSED`/otro, normalizado),
  `payment_type` (`CASH`/`DEBIT`/`CREDIT`/`PREPAID`/`UNKNOWN`, tomado de A/B por ser el más fino; C como respaldo).
- Documento: `document_type` (int SII: 33, 39, 48…) con etiqueta legible derivada (factura afecta, boleta,
  comprobante de pago), `instance`.
- Tarjeta: `card_brand`, `card_bin`, `card_issuer`, `card_origin`, `installment_type`, `installment_count`,
  `acquirer_id`. `"N/A"` y `""` se guardan como nulo.
- Montos (CLP, entero/decimal sin float): `sale_amount`, `tip_amount`, `cashback_amount`, `total_amount`,
  `commission_amount`, `net_amount`, `currency`.
- Abono: `settlement_date`, `settlement_id` (nulo si `"0"`, `"No reconciliation"` o vacío), `settlement_amount`,
  y la lista completa de `reconciliations` (JSON) por si hay varias cuotas.
- Ítems: JSON con `code`, `name` (limpiando caracteres de control), `quantity`, `price`.
- Copia cruda por venta: JSON con el objeto original de cada reporte en que apareció (`branch`, `general`), para
  no perder campos no mapeados.
- `first_seen_run`, `last_seen_run`, `created_at`, `updated_at`.

Una venta que aparece en A/B pero no en C (o al revés) se guarda igual con lo disponible y se marca
(`sources` = qué reportes la trajeron). Fuente de verdad por campo: tipo de pago/documento/tarjeta desde A/B;
comisión/neto/abono desde C; monto total desde A/B, con C como respaldo.

### API

En `backend/treasury/urls.py` (convención existente de `terminal-providers`, `terminal-devices`,
`terminal-batches`):
- `terminal-sales/` — solo lectura, lista paginada con filtros (rango de fechas, proveedor, terminal, tipo de
  pago, tipo de documento, estado, con/sin abono) y un resumen del período filtrado (cantidad, bruto, comisión,
  neto, desglose por tipo de pago). Detalle incluye ítems, reconciliaciones y copia cruda.
- `terminal-sync-runs/` — solo lectura; acción `sync` (POST, con `Idempotency-Key`) que encola una
  sincronización manual con `start_date`/`end_date` opcionales (por defecto: `history_start_date` o
  `lookback_days`).
- `terminal-sync-settings/` — singleton GET/PATCH (patrón `reconciliation-settings`).
- Vistas ≤ 20 líneas; selectores sin N+1 (`select_related` provider/device).

### Frontend

- **Ventas**: nuevo sub-tab en `TERMINAL_COBRO_SUB_TABS` (`frontend/features/treasury/navigation.ts`), ruta
  `/treasury/terminal-cobro/sales`. Entidad `terminalSale.entity.ts` con `defineEntity`, renderizada con
  `@/components/entity-view`. Filtros arriba, totales del período, botón "Sincronizar ahora" (diálogo con rango).
  Fila → drawer de detalle con todos los campos, ítems, reconciliaciones y crudo plegable.
- **Configuración**: nuevo tab de nivel 1 en `TREASURY_TABS`, ruta `/treasury/settings/...` con la sección
  "Terminal de cobro". Seguir el patrón de `sales/settings` (redirect a la primera sección).
- Estados `loading`/`empty`/`error`; `StatusBadge` para estado de venta y de ejecución.
- Hooks en `features/treasury/hooks/`, API en `features/treasury/api/`.

### Permisos

Las ventas reutilizan los permisos de ver terminales de cobro; la configuración y "Sincronizar ahora" requieren
permiso de gestión. Concretar según `add-role-permission.md` y ADR-0116.

## Decisiones de Claude tras la revisión (verificables por el usuario)

1. **Unicidad de la clave natural.** Se asume que `saleId` y `sequenceNumber` son únicos a nivel de cuenta TUU,
   no por terminal: los `saleId` observados son un correlativo continuo compartido por efectivo y tarjeta
   (13347–13393, 14001–14040), y `sequenceNumber` tiene forma de número de transacción del adquirente.
   Mitigación: si al hacer upsert una venta existente trae un `serialNumber` distinto al guardado, no se
   sobrescribe; se registra un aviso en la ejecución (`PARTIAL`) para detectarlo pronto.
2. **Una cuenta TUU = un proveedor.** Al guardar la API key de un proveedor TUU activo se valida que ningún otro
   proveedor TUU activo tenga la misma key (comparando descifrado, porque Fernet no es determinista). Así no se
   duplican ventas ni se inflan totales.
3. **Anulaciones.** Se guarda lo que TUU entregue, sea un cambio de estado o una fila aparte. Los totales del
   resumen suman solo ventas `COMPLETED`; las demás se muestran como conteo y monto separados. Revisar cuando
   aparezca la primera anulación real.
4. **"Ya corrió hoy".** El despachador horario considera atendido a un proveedor si tiene **cualquier** ejecución
   automática hoy (exitosa, parcial o fallida). Los errores transitorios se reintentan dentro de la misma
   ejecución (`max_retries`/`retry_delay_minutes`); los de credencial/plan no se reintentan hasta el día
   siguiente. "Sincronizar ahora" siempre puede forzar una ejecución.
5. **Alcance de la pestaña Configuración.** En esta iteración solo contiene la sección "Terminal de cobro". La
   configuración de conciliación bancaria (`ReconciliationSettings`) no se mueve; queda como mejora futura.

## Lo que queda al builder

- Nombres finales de modelos, campos, choices y rutas (los de arriba son orientativos).
- Estructura exacta del cliente HTTP (stdlib/`requests`, timeouts, módulo), manteniéndolo aislado en un único
  módulo para poder mockearlo en tests.
- Si `last_run_*` son columnas o propiedades derivadas.
- Retención de crudos: por ahora sin purga; anotar volumen esperado (≈ 3 llamadas × páginas × proveedores × días).
- Tests: cliente mockeado con fixtures construidos a partir de las respuestas reales (anonimizando nombre/RUT del
  comercio y BINs), cubriendo cruce A+B↔C, upsert sin duplicados, actualización de abono, tramos > 30 días,
  "sin datos", errores de credencial y reintentos.

## Riesgos y notas

- **Bug existente confirmado (fuera de alcance, issue #261):** las tareas de Tesorería se registran como
  `treasury.<fn>` pero `CELERY_BEAT_SCHEDULE` las invoca como `treasury.tasks.<fn>`, así que no corren. La tarea
  nueva debe registrarse con exactamente el mismo nombre que usa el schedule, con un test que lo verifique.
- La documentación de TUU es inconsistente (rango 30 vs 60 días, `pageSize` 20 vs 50). Usar los valores
  conservadores y tratar el error de rango (`BR-08`) como señal para partir más fino.
- El caché del lado de TUU (respuestas marcadas `(cached)`) puede devolver datos viejos en re-consultas
  inmediatas; el upsert diario lo corrige con el tiempo.
- Las API keys usadas en la exploración quedaron en una conversación: el usuario debe revocarlas y cargar una
  nueva en el proveedor TUU del ERP.
