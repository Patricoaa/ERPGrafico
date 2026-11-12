# Wizard unificado de F29 y checklist de cierre contable accionable

Fecha: 2026-11-12 · Estado: borrador para aprobación

## Intención y por qué

Hoy el cierre de un período F29 está repartido en tres piezas desacopladas:

- `DeclarationWizard`: pasos previos (auditoría de IVA, campos manuales, registrar declaración).
- `F29PaymentModal`: registrar el pago.
- `F29CloseModal`: adjuntar comprobante y cerrar el período.

Las dos últimas se disparan desde acciones sueltas en `AccountingClosuresClientView`. La fricción: el usuario
piensa solo en la declaración y olvida el pago y el cierre, porque nada lo conduce a ellos. Además, un fallo
del cierre pasaba en silencio (corregido el 2026-11-12: el error ahora se muestra y el modal queda abierto).

El checklist del cierre **contable** (`AccountingPeriodCloseChecklist`) muestra ítems con estado pero sin acción:
el usuario ve "4 asientos en borrador" y no puede resolverlos desde ahí. Además usa tarjetas de color por ítem
que se leen como plantilla genérica.

Se trabajan juntos porque el ítem "F29 cerrado" del checklist debe poder abrir el wizard unificado.

## Objetivos

1. Un solo wizard F29 con tres fases: **Pasos previos**, **Pago**, **Cierre**.
2. El wizard se puede dejar en una fase intermedia (solo declarado; declarado y pagado) y retomarse desde el
   ClientView con una única acción por período.
3. El checklist del cierre contable lista los **documentos pendientes** de cada categoría; cada documento abre
   su drawer existente encima del checklist, sin perder el contexto; el checklist se recalcula al cerrar el drawer.
4. El ítem F29 del checklist abre el wizard unificado encima del checklist, en la fase que corresponda.
5. Checklist visualmente sobrio: lista densa dividida en Obligatorios y Sugeridos, sin tarjetas de color por ítem.

## No-objetivos

- No se construyen vistas de resolución nuevas por categoría (asientos, facturas, remuneraciones, conciliaciones):
  se reutilizan los drawers registrados en `ENTITY_DRAWERS`.
- No se cambia qué es obligatorio para cerrar el período contable. Hoy bloquean: F29 cerrado, asientos en borrador
  y facturas en borrador (`is_fully_closable`). Remuneraciones sin contabilizar y extractos sin confirmar siguen
  siendo informativos/sugeridos.
- No se agrega un campo "paso actual" en el backend.
- No se modifica la lógica de negocio de `TaxPeriodService.close_period` ni sus validaciones.

## Anti-objetivos (fracaso aunque funcione)

- Que el usuario pueda cerrar un período F29 sin pasar por pago cuando hay saldo pendiente.
- Que quede cualquier acción de pago/cierre F29 suelta en el ClientView además de la acción única de continuar.
- Que un error del backend (400) vuelva a pasar sin aviso.
- Que el checklist vuelva a verse como un montón de tarjetas coloreadas.

## Diseño

### 1. Wizard F29 unificado

**Fase derivada del estado existente** (sin persistir paso):

| Estado del período | Fase en la que abre |
|---|---|
| Sin declaración registrada | Pasos previos |
| Declarada, con saldo pendiente de pago | Pago |
| Declarada y pagada (o sin monto a pagar), período abierto | Cierre |
| Período cerrado | Solo lectura (resumen) |

La fuente es `TaxPeriod.declaration_summary` (`vat_to_pay`, `total_paid`, `is_fully_paid`, `payments`,
`folio_number`) más `TaxPeriod.status`.

**Comportamiento**

- Los pasos de pago y cierre reutilizan la lógica de `F29PaymentModal` y `F29CloseModal`, extraída a componentes
  de paso. Si un componente de paso queda sin uso fuera del wizard, se elimina el modal.
- Cerrar el wizard en cualquier fase deja el estado ya persistido (declaración registrada, pagos creados).
  Reabrirlo calcula la fase de nuevo.
- Las claves de idempotencia son una por operación (registrar, pagar, cerrar) y se regeneran tras un fallo que
  el servidor ya cacheó, para no reutilizar una respuesta 400 almacenada.
- Errores: toda mutación del wizard muestra el mensaje del backend (`showApiError`) dentro del wizard y no
  avanza de fase.
- El cierre exige el comprobante PDF adjunto (comportamiento actual de `F29CloseModal`).

**ClientView**

- Cada período F29 muestra una sola acción primaria contextual: "Declarar", "Registrar pago", "Cerrar período" o
  "Ver", según la fase. Todas abren el mismo wizard en la fase correspondiente.
- Se eliminan `closeF29PeriodId`/`closeF29Declaration` y `handlePayF29` como estados y handlers independientes
  del ClientView; el wizard obtiene lo que necesita por `periodId`.

### 2. Checklist del cierre contable

**Backend** — `TaxPeriodService.get_period_status` (`backend/tax/services.py`) agrega a la respuesta listas de
pendientes por categoría, acotadas (p. ej. hasta 50 por categoría, con el total real en el `*_count` existente):

- `draft_entries`: asientos en borrador → `{id, label, amount, date}` (label registry `accounting.journalentry`)
- `draft_invoices`: facturas en borrador → (`billing.invoice`)
- `unposted_payrolls`: remuneraciones no contabilizadas → (`hr.payroll`)
- `unconfirmed_statements`: extractos bancarios sin confirmar → (`treasury.bankstatement`)

Reglas: respeta la política zero-N+1 (una consulta por categoría, `only()`/`values()` de lo que la respuesta lee,
sin serializadores que consulten); el endpoint sigue siendo de lectura; los conteos actuales se mantienen para no
romper consumidores.

**Frontend** — `AccountingPeriodCloseChecklist.tsx`:

- Dos secciones: **Obligatorios** y **Sugeridos**. Cada ítem es una fila (estado, título, detalle, CTA).
- Ítem con pendientes: se expande y lista los documentos; cada fila abre su drawer con `openEntity(label, id)`.
- Ítem F29: CTA que abre el wizard unificado encima del checklist en la fase correspondiente.
- Al cerrar un drawer o el wizard, se recarga el estado del checklist (invalidación/refetch).
- Sin colores de fondo por ítem; el estado se comunica con icono y texto, usando solo tokens semánticos.
- Cumple loading / empty / error de componentes compartidos.

**Sobre apilado:** los drawers y el wizard se abren con el modal del checklist aún montado. Hay que verificar
el orden de capas (z-index/portal) y el manejo de foco con `BaseModal`; es un riesgo técnico a resolver en la
implementación, no una decisión de producto.

### Contratos y gobernanza

- Cambia el contrato de la respuesta del checklist y la composición de `DeclarationWizard`: requiere un ADR
  (siguiente número libre: 0134) y actualización de `docs/20-contracts` donde aplique
  (`component-entity-drawers.md` no cambia; el estado del F29 se refleja en `state-map.md` si corresponde).
- Respetar invariantes: sin `any`, tokens semánticos, hooks de feature para mutaciones, barrel imports, formularios con
  react-hook-form + zodResolver, vistas Django ≤ 20 líneas con lógica en `services.py`.

## Decisiones ya tomadas por el usuario

- El checklist sigue siendo el del cierre contable (no del F29).
- Los CTA se abren encima del checklist, sin perder contexto.
- Solo el F29 se resuelve en una superficie nueva; los demás ítems usan los drawers existentes.
- El checklist lista los documentos pendientes y cada uno abre su drawer.
- El wizard puede dejarse en pasos intermedios y retomarse desde el ClientView.

## Decisiones mías (a revisar)

- Fase derivada del estado, sin campo persistido.
- Tope de 50 pendientes por categoría en la respuesta.
- Qué es obligatorio vs. sugerido no cambia.
- Eliminar `F29PaymentModal`/`F29CloseModal` si quedan sin consumidores tras la extracción.

## Qué se deja al implementador

- Estructura exacta de archivos de pasos y del reducer/estado del wizard.
- Diseño visual fino de filas y expansión del checklist (siguiendo `DESIGN.md`).
- Estrategia de capas/foco para apilar drawers sobre el modal del checklist.
- Tests: backend (pendientes por categoría, conteo de queries constante), frontend (fase derivada, CTA por
  estado, recarga del checklist).

## Aclaraciones tras la revisión del diseño

Respondidas por el código:

- **Cierre con saldo pendiente:** el backend ya lo rechaza. `TaxPeriodService.close_period` exige declaración
  registrada y, si `total_amount_due > 0`, pagos POSTED >= monto. La UI no es la única barrera; el wizard solo
  guía y muestra el error del servidor si algo se salta.
- **Datos del wizard por `periodId`:** `TaxPeriodViewSet` es un `ModelViewSet`; `retrieve` ya devuelve
  `declaration_summary` y `status`. No hace falta endpoint nuevo.
- **Mapeo checklist -> F29:** el checklist es por `(year, month)` y `TaxPeriod` tiene la misma clave. Se agrega
  `tax_period_id` (o null si no existe) a la respuesta de `get_period_status`; si es null, el CTA crea/abre el
  wizard por año y mes como ya hace `DeclarationWizard` con `propYear/propMonth`.
- **Drawers:** `accounting.journalentry`, `billing.invoice`, `hr.payroll` y `treasury.bankstatement` están
  registrados en `ENTITY_DRAWERS`.

Mis decisiones (menores):

- Monto a pagar 0 o negativo (remanente): no hay fase Pago; el wizard pasa de Pasos previos a Cierre.
- Pago parcial permitido; Cierre solo se habilita con saldo cubierto.
- Filas de pendientes: asiento y factura muestran folio/glosa, fecha y monto; remuneración muestra empleado y
  período; extracto muestra cuenta y fecha. Sin monto donde no aplica.
- El orden de cada lista es por fecha ascendente.

Decididas por el usuario tras la revisión:

- **Tope de pendientes:** el checklist lista hasta 50 por categoría y, si hay más, muestra "y N más" con un
  enlace a la lista completa filtrada. No hay paginación ni carga incremental dentro del checklist.
- **Pasos previos tras registrar:** quedan de solo lectura. El wizard permite navegar a ellos para revisar, pero
  sin edición ni reenvío (el backend rechaza registrar dos veces la misma declaración).
