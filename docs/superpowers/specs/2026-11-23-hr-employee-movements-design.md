# Movimientos con el empleado: pago de remuneración, anticipo y préstamo unificados

Fecha: 2026-11-23 · Estado: borrador para aprobación · Subproyecto 1 de 3 · Depende de: ADR-0154 (Employee archivable), ADR-0155 (dominio `hr`, ventana reciente), ADR-0091 (edición económica inmutable)

Los otros dos subproyectos, que **no** se diseñan aquí: (2) Previred por período, Otros descuentos, nuevas categorías de concepto y cuentas en ajustes; (3) rediseño de la UI de liquidaciones (lista y ficha). Se mencionan solo donde este diseño deja un hueco para ellos.

## Intención

Hoy el anticipo (`SalaryAdvance`) y el pago de remuneración (`PayrollPayment` tipo SALARIO) son dos conceptos separados, y no existen préstamos. El anticipo solo se puede descontar **completo** en una liquidación (`payroll` único y opcional) y la ficha del empleado no muestra un historial de estos movimientos con su estado.

Se quiere un solo documento, **Movimiento con el empleado**, con tres tipos (pago de remuneración, anticipo, préstamo), que se **asigna a liquidaciones** por el total o por una parte, con préstamos que devengan interés, y un **historial único en el drawer del empleado** con el estado de cada movimiento.

## Objetivos

- Un modelo `EmployeeMovement` con `kind` ∈ {pago de remuneración, anticipo, préstamo}, reemplazando `SalaryAdvance` y los `PayrollPayment` de tipo SALARIO.
- Asignación de un movimiento a una o más liquidaciones por un monto parcial o total (`PayrollAllocation`); el saldo pendiente del movimiento se deriva de sus asignaciones.
- Préstamo con tasa mensual o anual, plazo en cuotas y plan de cuotas generado al crearlo; la cuota es editable al asignarla a la liquidación y, al editarla, **se recalcula el resto** manteniendo el plazo original.
- Pestaña de historial unificado en `EmployeeDrawer` con tipo, fecha, monto, saldo pendiente y estado; los préstamos se expanden a su plan de cuotas.
- Contabilidad y tesorería equivalentes a las de hoy para anticipo y pago de sueldo; el préstamo suma capital (activo) e interés (ingreso financiero) al descontarse.
- Migración reversible de los datos existentes (solo hay entorno de desarrollo; no existe producción).

## No objetivos

- **Pago de Previred y Otros descuentos** (subproyecto 2): `PayrollPayment` sigue existiendo solo para Previred hasta entonces.
- Rediseño de la lista y la ficha de liquidaciones (subproyecto 3). Aquí solo se añade a la ficha de liquidación lo mínimo para ver y editar sus asignaciones.
- Prepago o refinanciación de préstamos, interés moratorio, préstamos a quien no sea empleado, reajuste por UF/IPC.
- Cambiar el cálculo de liquidación (haberes, descuentos legales) más allá de cómo descuenta anticipos y préstamos.

## Antiobjetivos (fallaría aunque «funcione»)

- Que el saldo de un movimiento o de una liquidación se calcule distinto en el listado, el drawer y el asiento contable.
- Que un asiento de liquidación contabilizada cambie por editar una cuota después (ADR-0091).
- Que migrar datos pierda el vínculo a asientos o a movimientos de tesorería de los anticipos y pagos existentes.
- Reintroducir N+1 en los listados nuevos (invariante 14).

## Aproximaciones consideradas

- **A. Documento unificado con migración** (elegida por el usuario). Una tabla de movimientos, asignaciones y cuotas; `SalaryAdvance` y los pagos de sueldo migran. Es lo que se pidió; cuesta reescribir `post_payroll`, el cálculo de saldos y migrar asientos, con riesgo bajo porque no hay producción.
- B. Unificar solo anticipo y préstamo y dejar el pago de sueldo aparte: menos riesgo, pero no cumple los «tres tipos asignables» y el historial seguiría uniendo dos tablas.
- C. Vista unificada sobre las tablas existentes: más barata, no resuelve asignaciones parciales ni préstamos.

## Diseño

### Modelo

`EmployeeMovement` (app `hr`)
- `employee` (FK PROTECT), `kind` (`PAYMENT` | `ADVANCE` | `LOAN`), `date`, `amount` (capital entregado o monto pagado, enteros en CLP), `notes`.
- `status`: `DRAFT` | `POSTED` | `SETTLED` | `CANCELLED`. `POSTED` = el dinero ya salió por tesorería; `SETTLED` = anticipo/préstamo totalmente asignado y descontado; el pago de remuneración nunca pasa a `SETTLED` (queda `POSTED` mientras tenga su asignación contabilizada).
- Vínculos contables: `journal_entry` (asiento del desembolso/pago, mismo vínculo que hoy) y el movimiento de tesorería se resuelve por `journal_entry.treasury_movement`, como en `annul_advance`.
- Solo `LOAN`: `rate` (decimal), `rate_period` (`MONTHLY` | `ANNUAL`), `installments_count`, `first_installment_period` (año/mes de la primera cuota).
- `edit_policy`: editable en `DRAFT`; con estado bloqueado solo `notes` y las asignaciones aún no contabilizadas (ADR-0091). Borrador eliminable; el contabilizado se anula (patrón Anulación, `deletion-policy.md`).

`PayrollAllocation`
- `movement` (FK), `payroll` (FK a `Payroll`), `amount` (total aplicado a esa liquidación), `principal_part`, `interest_part` (la suma da `amount`; en anticipo y pago el interés es 0), `installment` (FK opcional a `LoanInstallment`).
- Una asignación `PAYMENT` cubre el pago a una sola liquidación (el pago es individual por liquidación, decisión del usuario); en `ADVANCE`/`LOAN` puede haber varias a lo largo del tiempo, nunca más que el saldo.
- Regla: la suma de asignaciones de un movimiento no excede su saldo (capital pendiente más interés devengado).

`LoanInstallment`
- `movement`, `number`, `period` (año/mes), `principal`, `interest`, `amount`, `status` (`PENDING` | `APPLIED`). Se genera al crear el préstamo.

Saldo pendiente de un movimiento = capital entregado − Σ `principal_part` de asignaciones contabilizadas.

### Interés y plan de cuotas (decisiones del usuario salvo lo marcado)

- Sistema de **cuota fija** (francés). Tasa mensual `r`; si se ingresa anual, `r = (1 + anual)^(1/12) − 1` *(mi decisión: equivalente efectivo; confirmar si se prefiere anual/12)*.
- `cuota = P·r / (1 − (1+r)^−n)`, redondeo a pesos enteros; la última cuota absorbe la diferencia de redondeo. Tasa 0 es válida (cuota = P/n).
- **Interés se reconoce al aplicar la cuota**: `interest_part = saldo_capital × r` del período; `principal_part = cuota − interest_part`.
- **Cuota editable al asignarla** a una liquidación en borrador. Al editar se recalculan las cuotas **restantes** con el nuevo saldo y el plazo restante original (decisión del usuario). Validaciones: la cuota no puede ser menor al interés del período (capital negativo) ni mayor al saldo más su interés (si lo iguala, el préstamo queda `SETTLED`).
- Las cuotas ya aplicadas (`APPLIED`) no cambian.

### Servicios y flujos

- `EmployeeMovementService.create_*`: crea el movimiento; si hay `treasury_account` genera el movimiento de tesorería de egreso (como `create_advance_with_payment`). El préstamo crea además el plan de cuotas.
- `allocate(movement, payroll, amount=None)`: solo sobre liquidaciones `DRAFT` del mismo empleado y movimientos `POSTED`; `amount` por defecto es el saldo (anticipo) o la cuota del período (préstamo). Valida el tope legal (abajo).
- `post_payroll` (hoy en `hr/services.py`) lee las asignaciones de la liquidación: por cada una acredita `account_anticipos` (anticipo) o `account_prestamos_trabajadores` por el capital y `account_intereses_prestamos` por el interés (préstamo), marca cuotas `APPLIED` y pasa el movimiento a `SETTLED` si su saldo llega a 0. El pasivo «Remuneraciones por pagar» se acredita por `net_salary − Σ asignaciones`.
- Saldo a pagar de una liquidación = `net_salary − Σ asignaciones de anticipo/préstamo − Σ pagos de remuneración contabilizados`; **una sola función** usada por serializador, servicio de pago y PDF (hoy está repetida).
- Pago de remuneración: `EmployeeMovementService.pay_payroll(payroll, ...)` crea un movimiento `PAYMENT` con su asignación y el egreso de tesorería, con el mismo asiento de hoy.
- Anulación: `annul_movement` solo si no tiene asignaciones contabilizadas; en caso contrario se debe anular primero la liquidación. Anular una liquidación `POSTED` libera sus asignaciones (cuotas vuelven a `PENDING`, el movimiento a `POSTED`); si hoy no hay anulación de liquidación, el builder define cómo se reutiliza lo existente.
- **Tope legal** *(mi decisión)*: al asignar, si la suma de descuentos por préstamos/anticipos supera el porcentaje configurable (`GlobalHRSettings`, por defecto 15 % de la remuneración total, **a confirmar con el contador**), se devuelve una **advertencia** no bloqueante.
- Empleados archivados: no reciben movimientos nuevos (misma regla de ADR-0154); los existentes siguen mostrándose.

### Contabilidad y ajustes

- Cuentas globales en `AccountingSettings`: se mantienen `account_anticipos` y `account_remuneraciones_por_pagar`; se añaden `account_prestamos_trabajadores` (activo) y `account_intereses_prestamos` (ingreso financiero) *(mi decisión: cada tipo de movimiento mapea su cuenta en ajustes contables, no en `/hr/settings/concepts`; los conceptos quedan para haberes y descuentos calculados)*. La pantalla de ajustes las muestra junto a las existentes.
- Desembolso: Dr cuenta del tipo (anticipos / préstamos), Cr tesorería. Pago: Dr remuneraciones por pagar, Cr tesorería (sin cambio).

### API

- `GET/POST /api/hr/employee-movements/` (`?kind=`, `?employee=`, `?status=`), detalle con cuotas y asignaciones; acciones: `annul`, `allocate`, `loan-schedule-preview` (calcula el plan sin guardar, para el formulario). Un selector con `prefetch` para cuotas y asignaciones (invariante 14).
- Reemplaza `/api/hr/salary-advances/` y la lectura de `PayrollPayment` SALARIO; el frontend se migra, no se mantiene doble API.
- Permisos: mismos grupos que anticipos hoy, ampliados al préstamo (`add-role-permission.md`).

### Frontend

- `EmployeeDrawer`: pestaña **Movimientos** (nombre provisional) con la lista unificada: icono/etiqueta de tipo, fecha, monto, saldo pendiente, `StatusBadge`; filas de préstamo expandibles a su plan de cuotas. Acciones: nuevo anticipo, nuevo préstamo, registrar pago.
- Página de lista (hoy `/hr/advances`) pasa a la entidad unificada con `defineEntity` (invariante 13) y filtro por tipo; ruta provisional `/hr/movements`.
- Drawer del movimiento (reemplaza `AdvanceDrawer`) con pestañas Datos y Relaciones; formulario de préstamo con vista previa del plan (`loan-schedule-preview`).
- Ficha de liquidación: sección **Asignaciones** (anticipos/préstamos asignados, cuota editable por fila, advertencia de tope). Es lo mínimo; el rediseño completo es el subproyecto 3.
- Documentos y relaciones: nuevo tipo `hr.employeemovement` (dominio `hr`, ADR-0155) con relaciones empleado ↔ movimiento ↔ liquidación; `hr.salaryadvance` desaparece o se redirige en `canonical_url` mientras existan enlaces antiguos.

### Migración

- Migración de datos reversible: cada `SalaryAdvance` → `EmployeeMovement(kind=ADVANCE)` conservando `journal_entry`, estado equivalente (`DRAFT`→`DRAFT`, `PAID`→`POSTED`, `DISCOUNTED`→`SETTLED`, `CANCELLED`→`CANCELLED`) y, si tenía `payroll`, una `PayrollAllocation` por el monto completo. Cada `PayrollPayment` SALARIO → `EmployeeMovement(kind=PAYMENT)` con su asignación a la liquidación. Los pagos PREVIRED no se tocan.
- Ajustar los `related_name` de `journal_entry` y la referencia de tesorería (`treasury/services.py` lista `salary_advances` y `payroll_payments` para el borrado/validación de asientos).
- Después de migrar se eliminan `SalaryAdvance` y la lógica SALARIO de `PayrollPayment`.

### Documentación y reglas del repo

- ADR nuevo (siguiente número libre; 0156 si no se ha usado) con la decisión de unificar, el modelo, el cálculo de interés y la migración; actualizar `deletion-policy.md`, `state-map.md`, `document-relations.md` y el contrato de ajustes si cambia la pantalla.
- Playbooks aplicables: `add-feature`, `add-endpoint`, `add-migration`, `add-role-permission`, `add-selector`.

## Pruebas mínimas

- Plan de cuotas: suma de capital = principal; tasa 0; tasa anual vs. mensual; última cuota absorbe redondeo.
- Edición de cuota: recalcula las restantes con plazo original; rechaza cuota menor al interés; cuota que liquida deja `SETTLED`.
- Asignación parcial de anticipo a dos liquidaciones sucesivas; no excede el saldo.
- `post_payroll`: asiento cuadrado con anticipo + préstamo (capital e interés) y pasivo `net − Σ`.
- Saldo a pagar idéntico en serializador, servicio de pago y PDF (una sola función).
- Migración hacia adelante y atrás conserva `journal_entry` y estados.
- Query count del listado de movimientos no crece con filas.
- Empleado archivado: rechaza movimientos nuevos.
- Historial del empleado muestra tipo, saldo y estado de cada movimiento.

## Preguntas para el constructor (decididas con criterio propio, a confirmar)

1. Nombre visible de la pestaña y de la ruta (provisional: «Movimientos»).
2. Conversión de tasa anual a mensual (efectiva vs. anual/12).
3. Tope legal por defecto de 15 % de la remuneración total, a confirmar con el contador.
4. Qué pasa con los enlaces/URLs de `hr.salaryadvance` ya emitidos.
