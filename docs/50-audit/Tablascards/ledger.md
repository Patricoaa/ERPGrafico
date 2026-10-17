# Ledger — hallazgos y decisiones

> Un registro por hallazgo o decisión. Estados: pendiente | en análisis | aprobado | implementado | validado | bloqueado.
> Desde la Fase 1, las causas raíz definitivas son **RC1–RC8** (`01-rigidity-forensics.md` §1). Equivalencias con las tentativas: R1→RC1, R2→RC2, R3→RC3, R4→RC4, R5→RC5, R6→RC6, R7→RC7, R8→RC8.

### TC-001 · Medición · Verificado
- Evidencia: `00-system-map.md` §1 (cada cifra con su comando)
- Hallazgo: varias cifras del §2 del prompt estaban desactualizadas: `DataTableProps` 57 (no 56), `FieldType` 15 (no 10), `*Fields` 65 (no ~25), `toColumns` 62 archivos (no 57), consumidores de la familia 202 (no >139).
- Estado: validado

### TC-002 · Rigidez · Verificado
- Evidencia: 44 `renderCard={…}`; script de `00-system-map.md` §3.1 → solo `app/(dashboard)/settings/jobs/JobsView.tsx:189` no envuelve `AutoEntityCard`
- Necesidad: pasar identidad por fila (icono o color según tipo, avatar, miniatura, `entityLabel` por modo), unir datos externos y cablear acciones y `defaultAction`
- Restricción raíz: R4. El esquema no expresa identidad por fila y cada vista repite el cableado. **Refuta** la hipótesis "zonas insuficientes" salvo en JobsView (progreso).
- Entidades afectadas: 43 vistas (lista en `00-system-map.md` §3.1)
- Decisión vinculada: —
- Estado: en análisis

### TC-003 · Rigidez · Verificado
- Evidencia: `components/shared/entity-fields.tsx:345`, `:727`, `:741`, `:791`, `:976-978`
- Necesidad: decidir qué campo es título, subtítulo o KPI de cabecera
- Restricción raíz: R2. Se infiere con regex sobre el nombre de la clave (`/name/`, `/total|salary/`, `/number|code|id|display/`). Renombrar un campo altera la card y el orden de columnas.
- Entidades afectadas: todas las que usan `toCardFields` o `toColumns` sin `placement` explícito
- Estado: en análisis

### TC-004 · Rigidez · Verificado
- Evidencia: `entity-fields.tsx:370-549` (`switch`), `:250-252`; 51 `computed` en 35 `*Fields`; 10/23 miembros de `DataCell` no alcanzables desde el esquema
- Restricción raíz: R1, registro de tipos cerrado
- Estado: en análisis (la Fase 1 clasifica cada `computed`)

### TC-005 · Invariante · Verificado
- Evidencia: `components/shared/AutoEntityCard.tsx:390` → `intent={item.intent as any}`
- Hallazgo: viola la invariante #1 (zero `any`) en el núcleo compartido
- Restricción raíz: R8. `SubtitleItem.intent` no está tipado como el `intent` de `Badge`.
- Estado: pendiente. **Decisión del usuario (2026-10-17): esperar al rediseño.**

### TC-006 · Fuente de verdad · Verificado
- Evidencia: `AutoEntityCard.tsx:291-297`, `:423-427` lee `entity-registry` (`viewPolicy.cardVariant`, `cardConfig.workflow`, `dateLabel`, icono); dos `journalEntryFields.ts` divergentes (`diff -q`)
- Restricción raíz: R7, varias fuentes de verdad de presentación
- Estado: en análisis

### TC-007 · Formato y tipado · Verificado (código) / Probable (impacto)
- Evidencia: `AutoEntityCard.tsx:379` formatea moneda con `Intl.NumberFormat('es-CL')` en línea; `entity-fields.tsx:825-828` usa `accessorKey: def.key` aunque exista `get` (orden y filtro sobre el dato crudo); `:716-720` comprueba presencia ignorando `get`
- Restricción raíz: R8
- Estado: en análisis (la Fase 1 debe buscar un caso real donde el orden no coincida con lo mostrado)

### TC-008 · Código muerto · Verificado
- Evidencia: `AutoEntityCard.tsx:247-251` (`bodyDetail` siempre `[]`) → el bloque `:442-448` nunca se renderiza
- Restricción raíz: R2 (la zona `detail` se reasignó al centro del header sin retirar la ruta antigua)
- Estado: pendiente

### TC-009 · Superficie de tabla · Probable
- Evidencia: híbridos `column()` + inline en `app/(dashboard)/production/orders/WorkOrdersPageClient.tsx:162-181`, `UoMClientView`, `WarehouseClientView` y `UnbilledChargesClientView`; 22 tablas crudas en features (`00-consumer-inventory.md`)
- Restricción raíz: R5 (el esquema no cubre la tabla completa) y R6 (colección monolítica que no se deja componer)
- Estado: en análisis

### TC-010 · Decisión propuesta · Selección de pantallas
- Pantallas S1–S10 en `00-system-map.md` §5 (máxima rigidez: compras, OV, productos; trivial: UoM; documental: OV + `OrderSummaryTab`; imprenta: OT; card manual: Jobs)
- Estado: **aprobado en la Puerta A (2026-10-17)**: UoM, OV y Compras para la Fase 4. Las tablas de wizard/modal entran como caso de uso específico (decisión del usuario, 2026-10-17).

### TC-011 · Rigidez · Verificado
- Evidencia: 51 `computed` clasificados (`01-rigidity-forensics.md` §2.1): A referencias 20 · B compuestos 7 · C condicionales 4 · D `DataCell` inalcanzable 4 · E dominio 4 · F opción faltante 8 · G hub documental 4
- Necesidad: sobre todo "este valor apunta a otra entidad o documento" (40 %), con el renderer canónico `DocumentRefLink` ya existente
- Restricción raíz: RC1
- Estado: aprobado como diagnóstico (pendiente de la Puerta A)

### TC-012 · Bug · Verificado (código)
- Evidencia: `features/orders/components/sheet/OrderSummaryTab.tsx:51` → `exclude: ["work_order_summary"]`; `toColumns` filtra por la clave de la definición (`components/shared/entity-fields.tsx:905`), que es `work_order` (`features/orders/orderLineFields.tsx:55`)
- Efecto: la columna "OT" no se excluye en las líneas de OC
- Restricción raíz: RC8 (`column()` usa la clave del dato y `exclude`, la de la definición; ambas son `string`)
- Estado: pendiente. **Decisión del usuario (2026-10-17): se corrige en la migración** (lote de `orders`/líneas de documento, Fase 7).

### TC-013 · Rigidez · Verificado
- Evidencia: 43 `placement: 'detail'` en 9 `*Fields` de líneas; comentario explícito en `features/orders/orderLineFields.tsx:9`
- Necesidad: columnas en el orden de definición en tablas sin card
- Restricción raíz: RC3 (y RC2)
- Estado: aprobado como diagnóstico

### TC-014 · Rigidez · Verificado
- Evidencia: 21 de 67 props de `DataTable` + `DataTableView` con 0–1 consumidores (`01-rigidity-forensics.md` §2.5)
- Restricción raíz: RC6
- Estado: aprobado como diagnóstico

### TC-015 · Caso de uso wizard/modal · Verificado
- Evidencia: 21 tablas crudas en 19 archivos; patrones P1 cantidad a procesar (7), P2 reparto de montos (4; `BillChargesModal` reclasificado a P5 en la Fase 2), P3 editor de líneas (3, con 2 copias idénticas en `PurchaseOrderModal.tsx:256/:413`), P4 reporte (3), P5 solo lectura (4), P6–P7 (1+1)
- Necesidad: colección editable con tope y validación por fila, más un pie de totales y diferencia
- Restricción raíz: RC6
- Decisión vinculada: DP-2 (Fase 2)
- Estado: en análisis

### TC-016 · Decisión propuesta · `journalEntryFields` canónico
- Evidencia: `diff` → solo difieren en la línea 49 (la copia de `app/` tiene `meta.title`); la copia de `features/accounting/` no tiene importadores ni export de barrel; el único consumidor es `app/(dashboard)/accounting/entries/EntriesClientView.tsx:10`
- Determinación: el contenido canónico es el de `app/`; la ubicación canónica es `features/accounting/`; la copia de `features/` está muerta. Ambas se sustituyen al migrar la entidad (Fase 7).
- Estado: pendiente de la Puerta A

### TC-017 · Pendiente-backend
- Evidencia: cadenas de fallback en `get` (`features/orders/orderLineFields.tsx:36,:44`) y en columnas de notas (`PurchasingOrdersClientView.tsx:751`)
- Hallazgo: los serializers de OV/OC/notas no comparten nombres de campo para el mismo concepto
- Estado: pendiente (solo se registra)

### TC-018 · Tipado · Verificado
- Evidencia: `features/sales/components/SalesOrdersView.tsx:380` → `fields={viewMode === 'orders' ? salesOrderFields as unknown as … : undefined as unknown as …}`
- Necesidad: card de notas (`billing.invoice`) dentro de la vista de OV
- Restricción raíz: RC5 (modos que cambian de entidad) + RC8
- Estado: en análisis

### TC-019 · Comportamiento · Verificado (código) / Pd-backend (origen)
- Evidencia: `features/treasury/components/TreasuryMovementsClientView.tsx:53-58`; `manualPagination={!effectiveGrouping}` en OV y OT
- Hallazgo: agrupar pasa a modo cliente, con un tope de 200 filas
- Restricción raíz: RC6; falta saber si el backend puede agrupar o paginar por grupo
- Estado: pendiente

### TC-020 · Fuente de verdad · Verificado
- Evidencia: `sales.saledelivery`, `sales.salereturn`, `purchasing.purchasereceipt` y `purchasing.purchasereturn` declaran `list+card` sin lista; `features/sales/salesOrderFields.tsx:50` declara `kanban` sin kanban en el registro; dos entradas de registro para el terminal POS y para el usuario
- Restricción raíz: RC7
- Estado: en análisis

### TC-021 · Duplicación · Verificado
- Evidencia: `features/finance/bank-reconciliation/components/StatementDetailPanel.tsx:311` frente a `app/(dashboard)/treasury/reconciliation/[id]/page.tsx:382`; mayor de cuenta inline (página) frente a `ledgerMovementFields` (drawer); `features/treasury/loans/loanRegisterFields.ts` sin uso en `LoanDetailModal`
- Restricción raíz: RC5, RC7
- Estado: en análisis

### TC-022 · Accesibilidad · Verificado
- Evidencia: `features/sales/components/DeliveryDrawer.tsx:508-516` (`LabeledInput` sin `label`); el mismo patrón se repite en las 11 colecciones P1/P2
- Requisito: ED-1 (etiqueta accesible por celda editable, derivada de la fila)
- Estado: pendiente (Fase 3)

### TC-023 · Pendiente-backend
- Evidencia: `features/treasury/loans/loanFields.tsx` (moneda, tasa, plazo y próximo vencimiento como texto); `features/profile/components/PartnerProfileTab.tsx:49-55` (saldo acumulado calculado en cliente)
- Estado: pendiente (solo se registra)

### TC-024 · Accesibilidad · Verificado
- Evidencia: `components/shared/DataTable.tsx:869-896` y `:790-812` (cabecera y cuerpo en dos `<table>`); `:603` (`role="grid"` sin teclado); `:629,:675` (fila clicable sin teclado); `DataTableColumnHeader.tsx:22-49` (sin `aria-sort`); `EntityCard.tsx:64-82` (interactivos anidados)
- Requisitos: AX-1 … AX-5 (`03-constraints-and-references.md` §1.3)
- Decisión vinculada: `role="grid"` → `role="table"` en `compact`, **aprobado en la Puerta A (2026-10-17)**
- Estado: aprobado

### TC-025 · Rendimiento · Verificado / Probable
- Evidencia: volúmenes legacy reales (7 980 OV en 10 años, máx. 1 829 al año; 2 843 clientes; 8 556 pagos); tamaño de página 500 en `ProductClientView.tsx:633` y `AccountsClientView.tsx:155` sin virtualizar; `react-virtuoso` instalado y usado solo en `ProductGrid.tsx`; 20/60 vistas sin `useMemo` cercano a `toColumns()` (P)
- Requisitos: PF-1 … PF-6
- Estado: en análisis

### TC-026 · Tipado · Verificado
- Evidencia: 0 tests de tipos; `ColumnMeta` sin aumentar; claves de campo y de `exclude` libres
- Requisitos: TY-1 … TY-7
- Estado: en análisis

### TC-027 · Puerta A · Aprobada (2026-10-17)
- Aprobado: causas RC1–RC8, matriz de requisitos común/frecuente/específico, lista de fortalezas a preservar, pantallas de la Fase 4 (UoM, OV, Compras), cambio de `role` en `compact`
- Exportación: **requisito** del nuevo sistema (aclarado por el usuario el 2026-10-17)
- Estado: aprobado

### TC-028 · Decisión propuesta · Arquitectura (Puerta B)
- Evidencia: `04-architecture-options.md` §2 y §4 (matriz: A 80, B 71, C 91, ADR-0078 46)
- Propuesta: alternativa C (esquema semántico + composición por superficie), ADR-0087 *Proposed*; ADR-0078 → *Superseded* al aceptarse
- Restricciones nuevas: el tipo `docRef` debe registrarse en `features/documents` (FSD, invariante #3); la exportación sigue `export-formats.md` (hook por feature)
- Estado: **aprobado en la Puerta B (2026-10-17)**: alternativa C, gobierno (≥3 entidades / ≥2 features; ≤12 props), objetivo ≥85 % sin código a medida, ADR-0078 → *Superseded* al aceptar ADR-0087, identidad en `entity-registry`
