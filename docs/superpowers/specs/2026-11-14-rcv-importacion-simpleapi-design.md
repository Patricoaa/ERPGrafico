# Importación del Registro de Compras y Ventas (RCV) del SII vía SimpleAPI

Fecha: 2026-11-14 · Estado: borrador para aprobación

## Intención y por qué

El SII mantiene el Registro de Compras y Ventas (RCV) de la empresa: todo lo que se le facturó (compras) y
todo lo que emitió (ventas), mes a mes. Hoy el ERP no ve ese registro. El objetivo final es revisarlo y
**cuadrarlo contra las facturas y boletas del ERP**, pero el cuadre queda **fuera de alcance**: esta
iteración solo **trae, guarda y muestra** el RCV, para que el usuario lo revise y se familiarice con los datos.

El patrón es el de la sincronización de ventas TUU
(`docs/superpowers/specs/2026-11-13-tuu-sincronizacion-ventas-terminal-design.md`): configuración desde el
frontend, tarea Celery programada + botón manual, ejecución registrada, crudo guardado y entidad por registro
con upsert. La diferencia principal: el proveedor (SimpleAPI) se usa con **varias API keys gratuitas** de cupo
mensual limitado, y la importación tiene que repartir y cuidar ese cupo.

## Objetivos

1. Importar el RCV de un mes (compras y/o ventas) desde SimpleAPI con RUT empresa, RUT usuario y clave SII.
2. Guardar **cada documento** del detalle como registro individual (documento RCV), sin duplicar al re-importar.
3. Guardar **cada importación** como entidad propia, con sus **resúmenes por tipo de DTE** (incluidos los tipos
   que solo existen en resumen, como el comprobante de pago 48), la key usada, conteos, errores y el crudo.
4. Importación **automática** configurable (cada N días a una hora) y **manual** (botón).
5. Configuración desde el frontend: credenciales SII y **varias API keys** con seguimiento de su consumo mensual.
6. Manejar con claridad el agotamiento del cupo: rotar a otra key, y si no queda ninguna, fallar con un mensaje
   explícito, sin reintentar en loop.

## No-objetivos (esta iteración)

- Cuadre/conciliación RCV ↔ facturas/boletas del ERP, y cualquier vínculo entre documentos RCV y documentos ERP.
- Asientos contables, libro de IVA, F29 o cualquier efecto contable.
- Acciones sobre el RCV en el SII (aceptar/reclamar facturas, acuse de recibo).
- Consultas por día (endpoints `/{dia}/{mes}/{anio}`); solo por mes.
- Variante con certificado digital (`/api/rcv-certificado`); solo clave SII.
- Varias empresas (multi-RUT): una sola empresa.
- Descarga de XML/PDF de DTE (SimpleAPI no los entrega).

## Anti-objetivos (sería un fracaso aunque funcione)

- Exponer la clave SII o una API key en logs, respuestas de la API del ERP, crudos guardados o mensajes de error.
- Gastar el cupo mensual en reintentos automáticos ciegos (cada intento puede costar una consulta).
- Duplicar documentos al re-importar un mes.
- Que una importación falle en silencio: toda ejecución deja estado, error legible y contadores visibles.
- Perder datos: un campo del SII que no se mapee a columna debe quedar en la copia cruda del documento.

## Fuente: SimpleAPI RCV Clave SII (verificada el 2026-11-14 con datos reales de octubre 2026)

- Docs: https://documentacion.simpleapi.cl (colección Postman "Simple API" > Registro Compras y Ventas >
  RCV Clave SII). Producto: https://www.simpleapi.cl/Productos/SimpleAPI-RCV.
- Endpoints (método **POST**, `multipart/form-data`):
  - `https://servicios.simpleapi.cl/api/rcv-clavesii/ventas/{mes}/{anio}`
  - `https://servicios.simpleapi.cl/api/rcv-clavesii/compras/{mes}/{anio}`
  - La ruta antigua `/api/rcvempresas/...` **caduca el 01-01-2027**: usar solo la nueva.
- Header `Authorization: <API key>` (sin prefijo).
- Campo de formulario `input` con JSON:
  `{"RutEmpresa":"8973356-1","RutUsuario":"8973356-1","PasswordSII":"…","Ambiente":1,"Detallado":false,"ProcesaBoletas":true}`.
  `Ambiente=1` producción. Los RUT van con guion y DV.
- Límites: 1 consulta/segundo, 5/minuto, 100/hora (headers `x-rate-limit-limit: 1h`,
  `x-rate-limit-remaining`, `x-rate-limit-reset`). **El cupo mensual de la key no viene en la respuesta**: el
  plan gratuito "RCV Clave SII" da 10 consultas/mes, se reinicia el día 1, y la key gratuita vence al año.
- Latencia observada: 32–46 s por consulta (scraping del portal SII). Tamaño: ventas 443 KB, compras 18 KB.

### Forma de la respuesta

```
{ "caratula": {"rutEmpresa","nombreMes","mes","anio","dia","periodo":"202610"},
  "compras": {"resumenes":[...], "detalleCompras":[...]},
  "ventas":  {"resumenes":[...], "detalleVentas":[...]} }
```
El endpoint de ventas trae `compras` vacío y viceversa.

**Resumen** (por tipo de DTE): `tipoDte`, `tipoDteString`, `totalDocumentos`, `montoExento`, `montoNeto`,
`ivaRecuperable`, `ivaUsoComun`, `ivaNoRecuperable`, `montoTotal`, `estado` (null en ventas, "Confirmada" en
compras).

**Detalle de ventas** (35 campos): `tipoDTEString`, `tipoDte`, `tipoVenta`, `rutCliente`, `razonSocial`, `folio`,
`fechaEmision`, `fechaRecepcion`, `montoExento`, `montoNeto`, `montoIva`, `montoIvaRecuperable`, `montoTotal`,
`tipoDocReferencia`, `folioDocReferencia`, `codigoOtroImpuesto`, `totalOtrosImpuestos`, `ivaRetenidoTotal`,
`ivaRetenidoParcial`, `ivaNoRetenido`, `ivaPropio`, `ivaTerceros`, `rutEmisorLiqFactura`,
`netoComisionLiqFactura`, `exentoComisionLiqFactura`, `ivaComisionLiqFactura`, `ivaFueraPlazo`,
`creditoEmpresaConstructora`, `garantiaDepEnvases`, `numeroInterno`, `nceNdeFacturaCompra`, `montoNoFacturable`,
`indicadorVentaSinCosto`, `indicadorServicioPeriodico`, `estado`; las boletas agregan `indicadorServicio`.

**Detalle de compras** (29 campos): `tipoDTEString`, **`tipoDTE`** (mayúsculas, distinto de ventas),
`tipoCompra`, `rutProveedor`, `razonSocial`, `folio`, `fechaEmision`, `fechaRecepcion`, `acuseRecibo`,
`montoExento`, `montoNeto`, `montoIvaRecuperable`, `montoIvaNoRecuperable`, `codigoIvaNoRecuperable`,
`montoTotal`, `montoNetoActivoFijo`, `ivaActivoFijo`, `ivaUsoComun`, `impuestoSinDerechoCredito`,
`ivaNoRetenido`, `tabacosPuros`, `tabacosCigarrillos`, `tabacosElaborados`, `nceNdeFacturaCompra`,
`valorOtroImpuesto`, `tasaOtroImpuesto` (strings vacíos), `codigoOtroImpuesto`, `estado`, `fechaAcuse`.

### Observaciones de datos reales (octubre 2026)

- Ventas: 45 facturas (33) + 522 boletas (39) en detalle; el resumen además trae **401 comprobantes de pago
  electrónico (48) sin detalle**. La suma del detalle por tipo cuadra exacto con el resumen.
- Compras: 24 facturas (33); `acuseRecibo` ∈ {"Recibo otorgado por el receptor", "No reclamado en plazo"};
  `fechaAcuse` solo cuando hubo recibo. Solo vinieron documentos "Confirmada" (registro); no se sabe si
  pendientes/reclamados/no incluir llegan por este endpoint (no hubo casos).
- `fechaEmision` **nunca trae hora** (`T00:00:00`). `fechaRecepcion` trae hora en facturas y es `null` en boletas.
- El período lo define la recepción en el SII, no la emisión (factura emitida 30-09, recibida 02-10 → octubre).
- Boletas: `rutCliente` = `66666666-6` (genérico), `razonSocial` null, la mayoría de campos opcionales en `null`
  (en facturas vienen en `0`/`""`). `rutEmisorLiqFactura` usa `"-"` como vacío.
- Montos enteros CLP. Fechas sin zona: interpretar como hora de Chile (`America/Santiago`).
- Los errores de SimpleAPI (key inválida, cupo agotado, clave SII incorrecta, SII caído) **no se han observado**:
  su forma exacta debe determinarse al implementar (ver "Lo que queda al builder").

## Decisiones del usuario

- Patrón de importación similar a TUU.
- Listados en **Contabilidad > RCV > Compras** y **Contabilidad > RCV > Ventas**: directamente el listado
  (ClientView) + drawer; cada fila del RCV es una **entidad individual** de documento.
- Guardar también los **resúmenes**. La **importación es una entidad separada**; en ella se ven los tipos que
  solo tienen resumen (p. ej. 48) y la información relevante de la importación.
- Configuración en un **nuevo tab de la Configuración de Contabilidad**: credenciales (RUT empresa, RUT usuario,
  clave SII) y **varias API keys** (gratuitas, con límite mensual).
- Importación **automática** y **manual**, como TUU. La automática corre **cada X días a la hora X**, configurable
  desde el frontend. El manual debe contemplar errores por límite de consultas gratuitas.
- **Período de la automática**: fecha de ejecución − 3 días; el mes/año de esa fecha es el que se consulta.
- **Permisos**: los mismos que ya usa contabilidad.
- El cuadre con facturas/boletas del ERP se hará en el futuro, no ahora.

## Diseño

### Ubicación

- Backend: app **`accounting`** (rutas `/api/accounting/`). Se eligió sobre `tax` porque el usuario pidió permisos de
  Contabilidad y `core/rbac/bundles.py` no admite mapear permisos de una app a bundles de otra.
- Frontend: `features/accounting/` (hooks, api, entity-view, componentes); rutas bajo `/accounting/...`.

### Modelos (nombres orientativos)

**`RCVSettings`** (singleton, patrón `get_settings()` como `TerminalSyncSettings`):

| Campo | Default | Nota |
|---|---|---|
| `company_rut` | `""` | con DV, normalizado `12345678-9` |
| `user_rut` | `""` | ídem |
| `sii_password` | `""` | **cifrado** con `core/crypto.py`; write-only en API (`has_sii_password: bool` al leer) |
| `enabled` | `False` | activa la importación automática |
| `interval_days` | `7` | cada cuántos días corre (≥ 1) |
| `run_hour` | `6` | 0–23, hora Chile |
| `period_offset_days` | `3` | fijo por decisión del usuario; puede ser constante en vez de campo |
| `include_purchases` / `include_sales` | `True` / `True` | qué trae la automática |

**`RCVApiKey`** (varias):
`label`, `key` (cifrada; se muestra enmascarada `1747-…-4472`), `is_active`, `monthly_limit` (default 10),
`exhausted_until` (fecha, nulo si tiene cupo), `last_used_at`, `last_error`, `created_at`. Unicidad: no se
admiten dos keys iguales (comparar descifrado, como `find_provider_with_same_key` en TUU).
Uso del mes = cantidad de intentos (`RCVImportAttempt`) con esa key en el mes calendario actual que llegaron a
hacer la petición HTTP (propiedad derivada o anotación en el selector, sin N+1).

**`RCVImport`** (una por consulta: período + dirección):
`direction` (`PURCHASES`/`SALES`), `year`, `month`, `trigger` (`SCHEDULED`/`MANUAL`), `triggered_by`,
`status` (`QUEUED`/`RUNNING`/`SUCCESS`/`FAILED`), `started_at`, `finished_at`, `error_code` + `error_message`
(legibles, sin secretos), `warnings` (JSON), `received_count`, `created_count`, `updated_count`,
`missing_count` (ver "Documentos que desaparecen"), `api_key` (FK a la key que tuvo éxito, nullable),
`raw_response` (JSON completo tal cual; el request se guarda **sin** clave SII ni key).

**`RCVImportAttempt`** (cada petición HTTP de una importación): `rcv_import`, `api_key`, `http_status`,
`outcome` (`OK`/`QUOTA_EXHAUSTED`/`RATE_LIMITED`/`AUTH_KEY`/`AUTH_SII`/`TRANSIENT`/`OTHER`), `duration_ms`,
`error_message`, `rate_limit_remaining`, `created_at`. Es la base del conteo de cupo y de la trazabilidad
de la rotación.

**`RCVImportSummary`** (filas de resumen de una importación): `rcv_import`, `dte_type`, `dte_type_label`,
`document_count`, `exempt_amount`, `net_amount`, `vat_recoverable`, `vat_common_use`, `vat_non_recoverable`,
`total_amount`, `status`, `has_detail` (si el detalle trae documentos de ese tipo), `detail_count`,
`detail_total` (suma del detalle importado de ese tipo, para el control de completitud).
Se guardan por importación: dos importaciones del mismo mes conservan cada una el resumen que vieron.

**`RCVDocument`** (una por fila del detalle):
- Identidad: `direction`, `company_rut`, `period` (`YYYYMM`, de la carátula), `dte_type`, `folio`,
  `counterparty_rut` (cliente o proveedor), `counterparty_name`.
  Unicidad: `(company_rut, direction, dte_type, folio, counterparty_rut)` — en ventas el `counterparty_rut`
  forma parte igual (boletas: siempre `66666666-6`), así una sola restricción sirve para ambos lados.
- Fechas: `issue_date` (DateField, sin hora), `received_at` (aware, nullable), `acknowledged_at` (compras,
  nullable).
- Clasificación: `operation_type` (`tipoVenta`/`tipoCompra`), `status` (`estado`), `acknowledgement`
  (`acuseRecibo`, compras), `service_indicator` (`indicadorServicio`, boletas).
- Montos (DecimalField sin decimales, nunca float): `exempt_amount`, `net_amount`, `vat_amount` (ventas),
  `vat_recoverable`, `vat_non_recoverable` (compras), `total_amount`, `other_taxes_total`.
- Referencia: `reference_dte_type`, `reference_folio` (ventas, notas de crédito/débito).
- `raw` (JSON con el objeto original completo: ahí quedan todos los campos no mapeados).
- `first_import`, `last_import` (FK a `RCVImport`), `missing_since_import` (nullable), timestamps.

Normalización: aceptar `tipoDte` y `tipoDTE`; `null`, `""` y `"-"` → vacío/nulo; RUT normalizado.

### Ejecución de una importación

1. Validar configuración: credenciales completas y al menos una key activa; si falta algo, `FAILED` con
   mensaje ("Falta la clave SII", "No hay API keys activas").
2. **Elegir key**: activas, con `exhausted_until` nulo o vencido, y con uso del mes < `monthly_limit`;
   preferir la de menor uso del mes (reparte el consumo). Tomar la key con bloqueo (`select_for_update`) para
   que dos importaciones simultáneas no la cuenten mal.
3. Llamar al endpoint (timeout amplio, ≥ 180 s). Registrar `RCVImportAttempt`.
4. Clasificar el resultado:
   - **OK** → procesar (abajo).
   - **Cupo mensual agotado** → marcar key `exhausted_until = día 1 del mes siguiente`, volver al paso 2 con
     otra key. Sin keys disponibles → `FAILED` con "Sin cupo en las API keys hasta el 01-MM-AAAA".
   - **Key inválida/vencida** → registrar `last_error` en la key, desactivarla para la rotación del mes
     (mismo mecanismo `exhausted_until` o flag aparte) y probar otra.
   - **Límite por minuto/hora** (rate limit) → no es agotamiento: reintentar la misma key después de esperar
     (`x-rate-limit-reset` o 60 s), máximo 2 veces.
   - **Clave SII incorrecta / usuario sin autorización** → `FAILED` de inmediato, **sin rotar keys** (fallaría
     con todas y gastaría cupo). Mensaje: "El SII rechazó la clave del usuario X".
   - **SII o SimpleAPI caído / timeout / 5xx** → `FAILED` con mensaje claro; **no** reintentar dentro de la
     misma importación (cada intento puede costar cupo). La siguiente corrida automática o un manual lo resuelve.
5. **Procesar** (en `services.py`, `@transaction.atomic`): guardar resúmenes, upsert de documentos por la clave
   de unicidad, contadores, `last_import`. Una importación sin documentos es éxito con cero.
6. Una importación de "compras y ventas" crea **dos** `RCVImport` independientes, encoladas en serie con una
   pausa de ≥ 15 s entre ellas (límite 5/min y latencia alta).

### Documentos que desaparecen

Al re-importar un período/dirección con éxito, un documento de ese período que ya no viene (p. ej. pasó a
reclamado) **no se borra**: se marca `missing_since_import` y se cuenta en `missing_count`; si vuelve a aparecer
se limpia la marca. El listado lo muestra con un indicador.

**Decisión de Claude:** la marca de faltantes solo se aplica si el control de completitud cuadra (para cada tipo
con detalle, la cantidad y suma del detalle coinciden con el resumen). Si no cuadra —detalle truncado por el
scraping—, la importación queda `SUCCESS` con advertencia visible, hace el upsert de lo recibido y **no** marca
faltantes, para no ensuciar datos válidos.

### Programación

Igual que TUU: una entrada horaria fija en `CELERY_BEAT_SCHEDULE` que llama a un despachador. El despachador
actúa solo si `enabled`, la hora local ≥ `run_hour`, y la última importación **automática** se inició hace
≥ `interval_days` días (comparando fechas locales; si nunca corrió, corre). Período = mes/año de
(hoy − 3 días).

**Cierre garantizado del mes anterior (decisión del usuario):** si el mes anterior no tiene ninguna importación
exitosa (automática o manual) de esa dirección iniciada desde el día 1 del mes siguiente (es decir, nadie "vio"
el mes ya cerrado), la corrida también consulta el mes anterior completo, por cada dirección activada.
Costo: ≈ 2 consultas extra al mes; la estimación de consumo de la configuración lo incluye.

Crea las `RCVImport` de las direcciones activadas y las encola. Una importación automática
fallida cuenta como "ya corrió" (no reintenta cada hora quemando cupo).

El nombre registrado de la tarea debe coincidir exactamente con el `"task"` del schedule, con test que lo
verifique (bug conocido de Tesorería, issue #261).

### API (`/api/accounting/`)

- `rcv-documents/` — solo lectura, paginado; filtros: dirección, período (año/mes), tipo DTE, contraparte
  (RUT o razón social, búsqueda), estado, acuse, rango de fecha de emisión, "faltante". Detalle incluye `raw` y
  la importación que lo trajo.
- `rcv-imports/` — solo lectura; detalle con resúmenes e intentos. Acción `start` (POST, con
  `Idempotency-Key`, ver `idempotency.md`) con `year`, `month`, `directions` → crea y encola. Rechaza si ya hay
  una importación en curso del mismo período/dirección.
- `rcv-settings/` — singleton GET/PATCH; `sii_password` write-only.
- `rcv-api-keys/` — CRUD; la key es write-only (lectura enmascarada) y se devuelve el uso del mes.
- Vistas ≤ 20 líneas, lógica en `services.py`, selectores sin N+1.

### Frontend

Navegación (`frontend/features/accounting/navigation.ts`):
- Tab nivel 1 nuevo **RCV** en `ACCOUNTING_TABS` con sub-tabs **Compras** (`/accounting/rcv/purchases`),
  **Ventas** (`/accounting/rcv/sales`) e **Importaciones** (`/accounting/rcv/imports`).
- Sub-tab nuevo **RCV / SII** en `ACCOUNTING_CONFIG_SUB_TABS` (`/accounting/settings/rcv`).

Pantallas:
- **Compras / Ventas**: ClientView con entidad `defineEntity` (`rcvDocument.entity.ts`) renderizada con
  `@/components/entity-view`; columnas distintas por dirección (compras muestra acuse; ventas no). Filtros arriba;
  período por defecto: ninguno (como el listado TUU). Fila → **drawer** del documento con todos los campos
  agrupados (identificación, fechas, montos, IVA/impuestos, estado/acuse, referencia), enlace a la importación
  y crudo plegable.
- **Importaciones**: ClientView de `RCVImport` (período, dirección, origen, estado con `StatusBadge`,
  conteos, key enmascarada, duración) + botón **"Importar ahora"** (modal con mes, año y compras/ventas/ambas,
  RHF + Zod). Drawer de la importación: estado y error, **tabla de resúmenes por tipo** (los tipos sin detalle,
  como 48, marcados "solo resumen"; los con detalle muestran el control resumen vs. suma importada y un
  aviso si no cuadra), conteos (recibidos/creados/actualizados/faltantes), intentos con la key usada en cada
  uno, y crudo plegable.
- **Configuración RCV / SII**: panel con autosave (`add-settings-panel.md`):
  - Credenciales: RUT empresa, RUT usuario (validación de DV), clave SII write-only ("Configurada" / "Cambiar").
  - Programación: activar, cada N días, hora; texto derivado "Hoy consultaría: octubre 2026" y estimación
    "≈ N consultas/mes vs. cupo total X".
  - API keys: lista (entity-view embebida) con etiqueta, key enmascarada, activa, uso "3/10 este mes",
    "agotada hasta 01-12", último error; alta/edición en drawer.
- Estados `loading`/`empty`/`error`; hooks en `features/accounting/hooks/`, API en `features/accounting/api/`.

### Permisos

**Decisión del usuario: permisos de Contabilidad** (opción a). Con los modelos en `accounting`, las reglas
mecánicas de `core/rbac/bundles.py` ya dan `view_*` a `accounting.read`; se agregan `OVERRIDES` (ADR-0116) para que
la escritura quede en `accounting.manage`:
- `accounting.read`: ver documentos RCV, importaciones y resúmenes.
- `accounting.manage`: "Importar ahora" (`add_rcvimport`), configuración RCV (incluida la clave SII) y API keys.

El usuario **acepta el riesgo** de que quien gestiona Contabilidad pueda cambiar la clave SII y las keys (no se
usa un bundle sensible aparte); la clave y las keys siguen siendo write-only y nunca se devuelven.
Registrar `RCVSettings` (Clase A) y `RCVApiKey` (Clase B) en `docs/20-contracts/permission-config-entities.md`.

## Decisiones de Claude (verificables por el usuario)

1. **Backend en `accounting`** y frontend en `features/accounting` (cambiado desde `tax` al confirmar permisos de
   Contabilidad: evita el mapeo cruzado de permisos y su ADR).
2. **Una entidad para compras y ventas** (`RCVDocument` con `direction`) en lugar de dos modelos: comparten casi
   todo; los campos propios de un lado son nulos en el otro y todo queda en `raw`.
3. **Historial de importaciones como tercera sub-pestaña** de RCV, con el botón "Importar ahora" ahí.
4. **Conteo de cupo local**: la respuesta no informa el cupo mensual, así que el ERP cuenta las peticiones
   HTTP por key y mes calendario; `monthly_limit` editable (default 10) por si alguna key es de plan pagado.
5. **Reparto de consumo**: se usa primero la key con menos uso del mes.
6. **Sin reintentos automáticos ante caídas** (cada intento puede costar cupo); solo se reintenta ante rate limit
   por minuto/hora y se rota ante cupo agotado o key inválida. La clave SII incorrecta corta de inmediato.
7. **Resúmenes por importación**, no por período: conservan lo que el SII decía en cada momento.
8. **Documentos que desaparecen se marcan, no se borran.**
9. **Valores por defecto** de la programación: cada 7 días a las 06:00, desactivada; ambas direcciones.
10. `Detallado: false` y `ProcesaBoletas: true` fijos (lo probado). No configurables en esta iteración.

## Lo que queda al builder

- Nombres finales de modelos, campos, choices y rutas (los de arriba son orientativos).
- **Determinar la forma de los errores de SimpleAPI** (key inválida, cupo agotado, clave SII incorrecta,
  rate limit) para la clasificación del paso 4. Sugerido: probar con una key inventada y con una clave SII
  errónea (coste: posiblemente una consulta), o consultar a contacto@simpleapi.cl. Mientras no se conozcan,
  clasificar de forma conservadora: 429 → rate limit; 401/403 con texto de "límite/cupo/plan" → cupo agotado;
  401/403 restante → key inválida; texto de autenticación SII → `AUTH_SII`; resto → `OTHER` sin rotar.
- Cliente HTTP aislado en un único módulo (p. ej. `accounting/integrations/simpleapi_client.py`) para mockearlo.
- Si el uso del mes es propiedad derivada o columna mantenida.
- Retención del crudo: sin purga por ahora (ventas ≈ 450 KB por importación).
- Tests con fixtures construidos desde las respuestas reales del 2026-11-14 (anonimizando RUT/razón social):
  normalización `tipoDte`/`tipoDTE`, nulos de boletas, upsert sin duplicados, documentos faltantes, resúmenes con
  tipo 48 sin detalle, control de completitud, rotación de keys, cupo agotado en todas, clave SII incorrecta sin
  rotar, cálculo del período (hoy − 3 días) y del intervalo del despachador, nombre de la tarea Celery.

## Riesgos y notas

- **Scraping**: SimpleAPI scrapea el portal del SII; cambios del SII o caídas rompen la importación sin aviso.
- **Ruta antigua caduca el 01-01-2027**: usar `/api/rcv-clavesii/` desde el inicio.
- **Cupo ajustado**: cada 7 días × 2 direcciones ≈ 8–10 consultas/mes = una key gratuita completa. La UI debe
  mostrar la estimación para que el usuario agregue keys o reduzca la frecuencia.
- **Vencimiento de keys gratuitas** (1 año): aparecerá como key inválida; el `last_error` lo hace visible.
- **Estados de compras no observados** (pendientes, reclamadas, no incluir): el modelo los acepta como texto en
  `status`; revisar cuando aparezcan.
- **Credenciales expuestas en la conversación de exploración** (clave SII y API key): el usuario debería
  cambiar la clave SII y, si corresponde, regenerar la key, y cargarlas luego desde la configuración del ERP.
