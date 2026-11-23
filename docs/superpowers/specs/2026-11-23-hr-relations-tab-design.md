# Pestaña «Relaciones» en la ficha de empleado, dominio RRHH y ventana reciente

Fecha: 2026-11-23 · Estado: borrador para aprobación · Depende de: ADR-0154 (Employee archivable), ADR-0080/0083 (relaciones documentales)

## Intención

La ficha de empleado (`EmployeeDrawer`) hoy no muestra nada de lo que rodea al empleado: sus liquidaciones, anticipos, inasistencias, pagos y los asientos/contraparte asociados. Se quiere:

1. Una pestaña **Relaciones** en el drawer del empleado con esas relaciones.
2. Un **área (dominio) «RRHH»** en el agrupador de la pestaña, para que lo propio de RRHH no caiga en «Otros».
3. Una **ventana reciente con «Ver más»** en la pestaña de relaciones, **para todas las entidades**, porque un empleado antiguo acumula decenas de liquidaciones y cientos de filas indirectas.
4. Dejar listo el camino para **extender la pestaña al resto de entidades de RRHH** (liquidación, anticipo, inasistencia, pago, concepto, AFP) en un paso posterior.

## Objetivos / no objetivos / antiobjetivos

**Objetivos**
- Pestaña Relaciones en `EmployeeDrawer` (modos vista y edición, solo con empleado existente; también para archivados).
- Tipos documentales de RRHH registrados con dominio `hr` y proveedores de relaciones tipados.
- Ventana reciente en el servidor (`window`) con conteo de ocultos y «Ver más».

**No objetivos (esta iteración)**
- Pestaña en los demás drawers de RRHH (se habilita después; el backend ya queda listo).
- Optimizar la *resolución* de vínculos: la ventana recorta respuesta y render, no el costo de armar los vínculos (ver Enfoques).
- Acciones por área (`sectionActions`) como «+ Registrar anticipo»: la pestaña arranca de solo lectura (como `PartnerDrawer`).
- Paginación por cursor; no se agrupa por año.

**Antiobjetivos**
- Ocultar jamás un vínculo de dependencia (`is_dependency`) ni cambiar lo que ven los consumidores actuales de `relations` (OV/OC, facturas, cierre de período, OT).
- Parsear texto o heurísticas en los proveedores (regla del contrato: solo FKs tipadas).

## Enfoques considerados

- **A. Solo frontend:** pide todo y oculta lo viejo. Simple; el costo del servidor crece con el historial. Descartado.
- **B. Ventana en el servidor (elegido):** `window=recent|all`, `hidden` por área, «Ver más (N)» re-pide con `all`. Acota payload y render; no ahorra la resolución.
- **C. Ventana también en los proveedores:** filtran por fecha en su queryset. Resuelve el costo real pero cambia la firma de los proveedores de una decena de apps. Queda como optimización posterior.

## Diseño

### Backend

**Tipos y dominio.** `DEFAULT_DOMAIN_BY_APP["hr"] = "hr"` (hoy `hr.payroll` cae en `other`). Registrar en `hr/relations.py`: `hr.employee`, `hr.absence`, `hr.salaryadvance`, `hr.payrollpayment` (junto a los existentes `hr.payroll`, `hr.payrollconcept`). Cada uno declara estado/fecha/importe/`detail` coherentes con sus modelos. Todo tipo registrado debe tener URL canónica o drawer en `ENTITY_DRAWERS` (lo exige `test_document_routes_sync`): `hr.payrollpayment` no tiene drawer, así que su URL canónica apunta a su liquidación.

**Proveedores** (solo FKs tipadas; `select_related`/`prefetch_related` en cada uno):

| Documento | Vínculos |
|---|---|
| `hr.employee` | liquidaciones (`payrolls`), anticipos (`advances`), inasistencias (`absences`), pagos de liquidación (vía `payrolls__payments`) |
| `hr.payroll` | + empleado; mantiene pagos de tesorería y asientos |
| `hr.salaryadvance` | empleado, liquidación (si hay), asiento, movimiento de tesorería |
| `hr.absence` | empleado |
| `hr.payrollpayment` | liquidación, empleado, asiento, movimiento de tesorería |

Los asientos y la contraparte del empleado (su `contact`) llegan por los vínculos indirectos que ya añade el servicio; no se duplican en el proveedor. La semántica de cada `Link` la fija el implementador siguiendo la tabla del contrato (`association` para empleado↔liquidación/anticipo/inasistencia, `settlement`/`posting` para pagos y asientos).

**Ventana reciente.** `GET /api/core/documents/{label}/{id}/relations/?window=recent|all`. Default de la API: **`all`** (compatibilidad: ningún consumidor actual cambia). `DocumentRelationsTab` pide `recent` explícitamente, por lo que aplica a todas las entidades que usen la pestaña.

Regla, aplicada por área (`target.domain`) *después* de resolver y deduplicar:
- Solo se recorta un área con **más de 10** vínculos.
- Nunca se ocultan los `is_dependency` ni los sin fecha.
- Se conservan los de los **últimos 12 meses** (por `target.date`); si quedaran menos de 10 visibles en el área, se completan con los 10 más recientes.
- La respuesta añade `hidden: {<domain>: <n>}` (vacío si nada se ocultó) y `window`. Campos aditivos; `unresolved` no cambia.
- Constantes `RELATIONS_RECENT_MONTHS = 12` y `RELATIONS_MIN_VISIBLE = 10` en `core/documents/relations.py`.

### Frontend

- `DOCUMENT_DOMAINS` y `documentDomainSchema` incorporan `hr`; `DOCUMENT_DOMAIN_META.hr = { label: "RRHH", icono de personal, order: tras "capital" y antes de "contacts" }`.
- Esquema de la respuesta: `hidden` con default `{}`; `documentsApi.getRelations` y `useDocumentRelations` aceptan `window` (parte de la query key).
- `DocumentRelationsTab` pide `recent` por defecto (prop `window` para forzar `all`). Cada área con ocultos muestra «+N anteriores»; el pie de la pestaña ofrece **«Ver más (N)»**, que cambia a `all` para toda la pestaña (un solo refetch). Mantiene `loading`/`empty`/`error`.
- `EmployeeDrawer`: pestaña «Relaciones» (`Link2`, con `badge` del conteo) con `<DocumentRelationsTab label="hr.employee" id={employee.id} sectionActions={{}} rowActions={() => []} />`, visible si `employee?.id`. Las filas se abren con `useOpenRelatedDocument` (ya existente).

### Contratos y documentación
- **ADR-0155**: dominio `hr`, parámetro `window`/campo `hidden`, ventana por defecto de la pestaña (cambia contrato de capa 20 → ADR obligatorio).
- Actualizar `document-relations.md` (§2 endpoint, §5 dominios, §3 cobertura) y `component-document-sheet.md` (pestaña de relaciones).

### Pruebas
- Backend: relaciones del empleado (liquidaciones/anticipos/inasistencias/pagos + asiento + contacto); `window=recent` oculta lo viejo solo en áreas > 10, nunca dependencias ni sin fecha, completa hasta 10, devuelve `hidden`; `window=all` y default reproducen la respuesta actual; `test_document_routes_sync` y `test_deletion_policy_consistency` siguen en verde.
- Frontend: `DocumentRelationsTab` (ocultos, «Ver más» refetch con `all`); drawer del empleado muestra la pestaña solo con registro.

## Restricciones
- Contrato `document-relations.md` (solo lectura, FKs tipadas); invariante 12 (ADR); invariantes 3–5 (barrels, hooks), zero-any, tokens semánticos; zero-N+1 en proveedores nuevos.

## Decisiones tomadas por mí (corrígelas si no te sirven)
1. Default de la API = `all`; la pestaña pide `recent`.
2. 12 meses y mínimo 10 filas por área, sin recorte en áreas ≤ 10.
3. «Ver más» expande toda la pestaña, no un área.
4. Orden del área RRHH: antes de «Contactos».
5. Pestaña de solo lectura al inicio (sin acciones por área).

## Pendiente para quien implemente
Semántica exacta de cada `Link`, textos de `detail` de cada tipo, icono del área RRHH y estructura interna de los tests.
