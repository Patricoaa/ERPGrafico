# POS: modo de caja multiusuario y operador identificado — diseño

Fecha: 2026-11-10 · Estado: pendiente de aprobación

Las decisiones marcadas **(decisión del diseño)** las tomé yo y no fueron conversadas; el resto viene del dueño del producto.

## 1. Intención y porqué

Hoy todo el POS atribuye las acciones a `request.user`, la cuenta que inició sesión en el dispositivo:

| Acción | Atribución actual | Dónde |
|---|---|---|
| Venta POS | `salesperson = user` | `backend/sales/services.py:68` |
| Borradores | `created_by`, `last_modified_by`, `locked_by` | `backend/sales/draft_cart_service.py` |
| Retiros y movimientos de caja | `created_by = request.user` | `backend/treasury/pos_service.py:250` |
| Cierre de sesión | `closed_by`; solo quien abrió o superusuario | `backend/treasury/pos_service.py:138` |
| Historial | `simple_history` con el usuario del request | `backend/config/settings.py:146` |

Hay cajas donde el dispositivo mismo es compartido: varias personas operan sobre un único login que dura días (token de acceso 1 día, refresco 7). En esas cajas no se sabe quién creó un borrador, quién vendió, quién retiró dinero ni quién modificó una nota de venta. El PIN de POS, que era el único mecanismo que separaba persona de login, se eliminó con el ADR-0122.

Se quiere saber qué persona hizo cada cosa en las cajas compartidas, sin agregar fricción a las cajas que usa una sola persona.

## 2. Objetivos

1. Cada sesión de caja tiene un **modo**, elegido en el wizard de apertura: *un solo usuario* o *multiusuario*.
2. En modo multiusuario, cada transacción inicializadora exige identificar al **operador** antes de ejecutarse.
3. La identificación vale para **una sola transacción**; iniciar otra invalida la anterior.
4. La orden de venta conserva **quién modificó por última vez cada paso** del wizard, heredado del borrador, y sigue registrando las modificaciones posteriores.
5. Se guardan siempre **dos identidades**: la cuenta logueada en el dispositivo y el operador.
6. La identificación queda preparada para sumar PIN y tarjeta escaneable en una segunda edición sin rehacer el resto.

## 3. Fuera de alcance (primera edición)

- PIN, tarjeta con código de barras o QR, y su configuración en el perfil del usuario.
- Bloqueo por intentos fallidos (no hay secreto que fallar).
- Modo por defecto configurable por terminal.
- Cambiar el modo de una sesión abierta: hay que cerrarla y abrir otra.
- Identificación para consultar; solo se pide para modificar.
- Cambios al login principal, a la duración de los tokens o a la forma de unirse a una sesión.

## 4. Lo que haría fracasar esto aunque funcione

- Que el modo un solo usuario cambie en cualquier cosa visible: un clic más, un modal, una espera.
- Que el modo multiusuario se pueda saltar llamando a la API sin identificación. La exigencia vive en el backend, no solo en la pantalla.
- Que la primera edición se presente como prueba. Sin secreto es un **registro de buena fe**: cualquiera puede elegir el nombre de otro. La interfaz y la documentación no deben sugerir lo contrario.
- Que la traza se pierda al cerrar la sesión. Los borradores se borran en cascada con la sesión; el seguimiento de una orden vendida no puede depender de ellos.

## 5. Comportamiento

### 5.1 Modo de caja

- `POSSession` gana un campo `mode` con valores `SINGLE` y `MULTI`, por defecto `SINGLE`. Las sesiones existentes quedan en `SINGLE`.
- El wizard de apertura (`SessionOpenModal`) agrega la elección del modo. Lo elige la cuenta logueada que abre.
- El modo es inmutable mientras la sesión está abierta y se expone de solo lectura en la API.
- El modo es de la sesión, no del dispositivo: quien se une a una sesión `MULTI` desde otro dispositivo también debe identificarse **(decisión del diseño)**.
- La lista de sesiones y el encabezado del POS muestran el modo.

### 5.2 Transacciones que piden identificación (solo `MULTI`)

| Transacción | Cuándo se pide | Qué cubre la identificación |
|---|---|---|
| Borrador / venta | Al crear un borrador o al cargar uno existente | Todo el recorrido: carrito y todos los pasos del wizard hasta cobrar o soltar el borrador |
| Retiro o movimiento de caja | Al abrir el formulario | Ese único registro |
| Cierre de sesión | Al iniciar el cierre | Ese único cierre |
| Modificación desde los drawers de órdenes de venta | Al primer intento de modificar un documento | Ese documento mientras siga abierto en el panel; volver a la lista o abrir otro la termina **(decisión del diseño)** |

Consultar (listas, fichas, reportes) nunca pide identificación.

### 5.3 Identificación del operador

- Se muestra un selector con los usuarios activos que pueden operar el POS. Hoy las acciones de sesión solo exigen estar autenticado, así que no existe un permiso de "operar POS"; la regla exacta de quién aparece queda a quien construya (ver §9).
- En la primera edición basta con elegir el nombre.
- El backend responde con un **pase de operador**: una credencial opaca atada a sesión, operador, cuenta del dispositivo, pestaña del navegador, propósito y, si corresponde, el borrador o documento.
- El pase viaja en un encabezado en cada request de esa transacción.
- Mientras hay un pase vigente, el POS muestra quién es el operador activo.

### 5.4 Vida del pase

- **Emitir un pase nuevo invalida el anterior** de la misma sesión y pestaña. Así se cumple "ante cada nueva acción el anterior expira".
- Pase de borrador: vive mientras la pestaña conserve el bloqueo del borrador (el heartbeat que ya existe). Termina al cobrar, al soltar el borrador o al vencer el bloqueo.
- Pases de retiro, movimiento y cierre: de un solo uso; se consumen al completarse la operación y vencen solos a los pocos minutos si no se usan **(decisión del diseño)**.
- Pase de edición de documento: termina al salir del documento.
- Un pase vencido o invalidado hace que el backend rechace la operación con un código específico; el frontend vuelve a pedir identificación y reintenta sin perder lo escrito.

### 5.5 Atribución

En `MULTI`, el **actor** de cada operación es el operador del pase; en `SINGLE` es `request.user`, como hoy.

- `SaleOrder.salesperson`, `DraftCart.created_by` / `last_modified_by` / `locked_by`, `TreasuryMovement.created_by` y `POSSession.closed_by` reciben al actor.
- La cuenta del dispositivo queda en el pase, que no se borra y sirve de registro de cada identificación.
- La regla de cierre vigente (solo quien abrió o un superusuario) se evalúa contra el operador en `MULTI` **(decisión del diseño)**.
- `simple_history` sigue registrando la cuenta del dispositivo; el operador se obtiene del seguimiento (§5.6) y de los pases **(decisión del diseño)**.

### 5.6 Seguimiento de la orden

Una tabla nueva registra quién tocó qué, en ambos modos (en `SINGLE` el operador es la cuenta logueada):

- **Etapa borrador**: una fila por borrador y paso, que se actualiza en sitio con el último operador y la fecha. Pasos: carrito, cliente, documento tributario, detalles de fabricación, pago, entrega. No se agrega una fila por cada autoguardado **(decisión del diseño)**.
- **Al cobrar**: las filas del borrador pasan a la orden de venta y se agrega el evento de cobro. No guardan referencia dura al borrador, porque este se borra con la sesión.
- **Después de la venta**: cada modificación hecha desde los drawers agrega una fila nueva (no se sobrescribe) con el documento afectado.
- Cada fila guarda operador, cuenta del dispositivo, sesión, paso o acción, fecha y el pase si lo hubo.
- La ficha de la orden muestra este seguimiento **(decisión del diseño: dónde exactamente queda a quien construya)**.

El backend decide qué paso cambió comparando lo guardado con lo recibido; el frontend no declara el paso.

## 6. Decisiones de construcción

Todas son **decisión del diseño**:

- El pase es una fila en base de datos (app `treasury`), no un token firmado, porque debe poder invalidarse al emitir otro y porque sirve de registro.
- La "pestaña" se identifica con la misma clave que ya usa el bloqueo de borradores (`lock_session_key`).
- La exigencia del pase se resuelve en un solo punto del backend que entrega el actor a los servicios; las vistas siguen delgadas (invariante 10) y la lógica vive en `services.py`.
- La verificación de identidad es una única función que hoy recibe solo el usuario elegido. El endpoint de identificación ya acepta un campo opcional de credencial, ignorado en esta edición. PIN y tarjeta entrarán ahí.
- La tabla de seguimiento vive en `sales`.
- En el frontend hay un único mecanismo de "pedir operador y ejecutar", usado por borradores, movimientos, cierre y edición en drawers; el encabezado del pase lo agrega el cliente de API desde el estado del POS. Se respetan los invariantes de hooks, formularios con Zod y componentes compartidos.

## 7. Documentación

- ADR nuevo (0125): modo de caja y operador identificado. Convive con el ADR-0122; lo reemplazará la edición que traiga el PIN.
- Actualizar `state-map.md` (POSSession), `api-contracts.md` (endpoints nuevos, encabezado, código de rechazo) y el contrato de borradores si cambia su payload.

## 8. Pruebas mínimas

- `SINGLE`: ninguna operación exige pase y la atribución es idéntica a la actual.
- `MULTI`: cada transacción de §5.2 se rechaza sin pase, con pase vencido, con pase de otro propósito y con pase de otra sesión o pestaña.
- Emitir un pase invalida el anterior.
- Un borrador trabajado por dos operadores en pasos distintos produce una orden con el operador correcto en cada paso, y la traza sobrevive al cierre de la sesión.
- El vendedor de la orden es el operador que cobra.
- Sin N+1 en la lista de operadores ni en el seguimiento (invariante 14).

## 9. Queda a quien construya

- Nombres de modelos, endpoints, encabezado y código de rechazo.
- Regla exacta de quién aparece en el selector de operadores, a partir del RBAC existente.
- Duración del vencimiento de los pases de un solo uso.
- Diseño visual del selector (táctil primero) y del indicador de operador activo.
- Qué endpoints concretos corresponden a "modificar desde los drawers de órdenes de venta"; hay que inventariarlos desde el panel de ventas del POS (ADR-0121).
- Dónde se muestra el seguimiento en la ficha de la orden.
