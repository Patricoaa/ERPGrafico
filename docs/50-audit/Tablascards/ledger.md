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
- Estado: **corregido en el lote 3a** (2026-10-18). `orderLineViews.purchase` declara sus columnas y `without()` solo acepta ids de campo. Verificado en la app: la OC 10 no muestra OT.

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
- 2026-10-18 (oleada 0): borrada la copia muerta de `features/accounting/`. La de `app/` se sustituye en la oleada B2.
- Estado: implementado (parcial)

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
- Estado: **aprobado en la Puerta B (2026-10-17)**; prototipo validado técnicamente en la Fase 5 (pendiente Puerta C): alternativa C, gobierno (≥3 entidades / ≥2 features; ≤12 props), objetivo ≥85 % sin código a medida, ADR-0078 → *Superseded* al aceptar ADR-0087, identidad en `entity-registry`

### TC-029 · Prototipo · Verificado
- Evidencia: `05-prototype-report.md` §3–§4; tsc 0 errores, lint limpio, 32 unitarios + 21 stories en verde, 16 configuraciones inválidas rechazadas en compilación, 0 `computed`/`renderCard` en 6 entidades
- Estado: **aprobado en la Puerta C (2026-10-17)**; ADR-0087 Accepted, ADR-0078 Superseded

### TC-030 · Arquitectura · Verificado (prueba de alta)
- Evidencia: `evidence/onboarding-probe/`; el registro de extensiones solo existía en las stories y obligaba a un import profundo entre features
- Decisión: A1, las extensiones exportan un constructor que registra su tipo al usarse; A2, `label` tipado (pendiente)
- Estado: A1 implementado en el spike; A2 pendiente (Fase 6)

### TC-031 · Rigidez heredada · Verificado
- Evidencia: regla Fitts `frontend/app/globals.css:766-769` (40 px mínimo para `button`) que infla tablas densas; `DataCell` centra y pinta "-" en `null`; `EntityCard` sin etiqueta de selección ni slot de meta; contraste de `StatusBadge`/`Chip` warning 1,2:1 y success 2,5:1 (overlay `impeccable`)
- Decisión vinculada: prerrequisitos R1–R8 (`05` §7)
- Estado: aprobado (Puerta C): R1–R5 = lote 1 de la Fase 7; R6 = ADR de color aparte

### TC-032 · Bug del sistema actual · Verificado
- Evidencia: `evidence/legacy/compras--card.390.png` — en la card de OC a 390 px el título aparece como "-", las métricas se cortan y la paginación muestra "Página 1 de NaN"
- Restricción raíz: RC4/RC6 (card por zonas fijas; paginación de la vista card sin total)
- Estado: pendiente (se resuelve al migrar Compras; el prototipo no lo reproduce)

### TC-033 · Decisión · Vocabulario de estado (Puerta C)
- Decisión del usuario (2026-10-17): unificar el estado documental como **hub con etiqueta** en tabla y card
- Implementación: `hubStatus` exige `caption: StatusValue` (StatusBadge con texto, antes de los anillos); orden y exportación usan ese texto; test de tipos que rechaza un hub sin etiqueta
- Estado: implementado (spike)

### TC-034 · Guarda rota del sistema actual · Verificado
- Evidencia: en `frontend/eslint.config.mjs`, el bloque "UI component data fetching" (`files: ["components/**/*.tsx", "features/**/*.tsx"]`) redefine `no-restricted-imports` solo con TanStack. La configuración plana se queda con la última definición, así que la guarda de imports entre features **no se aplica en los `.tsx` de `features/`**. Sonda: `import { useUoMs } from "@/features/inventory/hooks/useUoMs"` da error en `features/sales/zzProbe.ts` y pasa en `zzProbe2.tsx` (2026-10-17)
- Efecto visible: dos stories hacen imports profundos entre features sin aviso: `Purchasing.stories.tsx` → `@/features/billing/entity-view/purchaseInvoice.entity` y `SaleOrder.stories.tsx` → `@/features/orders/entity-view/orderLine.entity`. Se resuelven al exportar esas entidades por sus barrels en la migración
- Propuesta: fusionar las restricciones en un único bloque `no-restricted-imports` y medir las violaciones destapadas antes de activarlo (tarea propia, fuera del alcance de la Fase 6)
- Estado: tarea aparte, aprobada por el usuario (2026-10-17) → https://github.com/Patricoaa/ERPGrafico/issues/176 (alcance: 9 imports en 6 archivos)

### TC-035 · Gobierno · Verificado
- Evidencia: `docs/README.md:114` numeraba "Zero N+1" como invariante #13 y omitía la de `*Fields.ts`; `CLAUDE.md:91` tenía `*Fields.ts` como #13 y omitía N+1. Las dos decían "the same 13"
- Decisión propuesta: #13 = nueva redacción de entity-view; "Zero N+1" = #14 en las tres listas (ya es GOVERNANCE #43)
- Estado: aprobado por el usuario (2026-10-17)

### TC-036 · Corrección de hipótesis · Verificado
- Evidencia: `docs/20-contracts/component-card.md` documenta el `Card` de shadcn (contenedor genérico), no la card de entidad. La card de entidad estaba repartida entre `component-fields.md` §5 y `component-datatable-views.md` §6
- Decisión: `component-card.md` no se modifica; la card de entidad pasa a `component-entity-view.md` §6.3
- Estado: implementado

### TC-037 · Fase 6 · Especificación y guardas · Verificado
- Evidencia: `06-spec.md`; contrato `docs/20-contracts/component-entity-view.md`; `frontend/eslint-rules/entity-view-guards.mjs` (4 reglas; una sonda las dispara todas); `frontend/lib/__tests__/entity-view.contract.test.ts` (12/12 en verde; la mutación hace fallar 6 aserciones); `docRef` exportado por `@/features/documents`; tsc 0 errores; vitest del sistema 44/44
- Decisiones: D-1 (segundo barrel autorizado, invariante #6), D-2 (convención de archivo verificada por test), sin overrides por superficie (§7), lote 1 ampliado con R7, R8, el provider en el shell y el estado en la URL (propuesta)
- Estado: aprobado (2026-10-17): lote 1 = R1–R5 + R7 + R8 + provider + estado en la URL

### TC-038 · Corrección · Verificado
- Evidencia: `docs/10-architecture/adr/0022-list-url-source-of-truth.md` trata del `list_url` de las entidades buscables. Hoy en la URL viven los filtros (`components/shared/UnifiedSearchBar/useUnifiedSearch.ts`, nuqs), la vista (`hooks/useViewMode.ts`, `?view=`) y la selección (`?selected=`, ADR-0020). El orden y la página son `useState` local (`app/(dashboard)/production/orders/WorkOrdersPageClient.tsx:44`, `app/(dashboard)/accounting/entries/EntriesClientView.tsx:31`)
- Error corregido: el §2.2 del prompt y `06` §5.3 atribuían a ADR-0022 "filtros, orden y página en la URL". La pregunta 2 de `06` §15 se apoyaba en esa premisa falsa
- Decisión: el lote 1 implementa **paridad** (vista controlada + `useViewMode`, filtros en `Toolbar children`, `selectedId`). El orden y la página en la URL pasan a mejora opcional (pendiente de decisión 3, Puerta D)
- Estado: corregido en `06` §5.3 y en el contrato §10.1

### TC-039 · Deuda del sistema actual · Verificado
- Evidencia: `frontend/lib/__tests__/no-unsafe.contract.test.ts` falla en `master` sin los cambios del lote 1 (comprobado con `git stash -u`). Hay 4 archivos por encima de su línea base (`features/sales/api/salesApi.ts` 6>4, `ProfitDistributionDrawer.tsx` 26>22, `CashMovementDrawer.tsx` 33>26, `TerminalBatchDrawer.tsx` 30>20) y 8 entradas obsoletas (archivos sin advertencias, como `OrderHubPanel.tsx` y `useOrderHubData.ts`)
- Decisión: fuera del alcance de entity-view; tarea aparte aprobada por el usuario (2026-10-17)
- Estado: https://github.com/Patricoaa/ERPGrafico/issues/177

### TC-040 · Defecto encontrado por R8 · Verificado
- Evidencia: `features/orders/entity-view/orderLine.entity.ts` declaraba `label: "sales.saleline"`, que no existe en `ENTITY_REGISTRY`. Con `EntityLabel`, ya no compila
- Necesidad: las líneas no tienen ficha propia. Con el provider montado, la celda principal habría llamado a `openEntity("sales.saleline", …)`
- Decisión: la identidad pasa a ser una unión discriminada `label` (abrible, del registro) \| `title` (embebida, sin acción por defecto ni icono)
- Estado: implementado (lote 1)

### TC-041 · Defecto del registro · Verificado
- Evidencia: `frontend/lib/entity-registry.ts`, en la entrada `inventory.uom`, tiene `listUrl: '/inventory/products/units'`. Esa ruta no existe: el navegador termina en `/inventory/products`. La pantalla real es `/inventory/products/uoms/units` (`app/(dashboard)/inventory/products/uoms/units/page.tsx`)
- Efecto: los enlaces de lista a UoM que usan el registro (búsqueda, redirecciones `?selected=`) llevan a Productos
- Decisión: se corrige al migrar UoM (lote 2); `entity-registry-routes.contract.test.ts` debería haberlo detectado (revisar su alcance)
- Estado: pendiente

### TC-042 · Defecto del registro · Verificado
- Evidencia: el test de rutas solo comprobaba `detailUrlPattern` y aceptaba que un segmento literal coincidiera con `[param]`. Al extenderlo a `listUrl` (exigiendo una página estática) aparecen **23 entidades** cuyo `listUrl` no existe (p. ej. `sales.saledelivery → /sales/deliveries`, `pos.session → /pos/sessions`). No hay redirecciones en `next.config` ni rutas catch-all que las resuelvan
- Decisión: corregidas `inventory.uom` e `inventory.uomcategory` (lote 2a); el resto queda como ratchet `KNOWN_BROKEN_LIST_URLS` en `lib/__tests__/entity-registry-routes.contract.test.ts` (verificado por mutación); tarea aparte aprobada por el usuario
- Estado: https://github.com/Patricoaa/ERPGrafico/issues/178

### TC-043 · Defecto del sistema actual · Verificado
- Evidencia: `features/inventory/components/ProductClientView.tsx` pasaba `initialData` (datos renderizados en servidor) a `useProducts`, y TanStack Query lo usa para *cualquier* `queryKey` nueva mientras la caché esté vacía, además de tratarlo como fresco (`staleTime.stable`). En la app real, al ordenar no se hacía ninguna petición (captura de red de Playwright, 2026-10-17). `page.tsx` además pedía otra consulta (200 filas, con variantes) y fabricaba `count = results.length`
- Decisión: `useProducts({ initial: { page, params } })` aplica los datos solo si `hashKey` coincide; `page.tsx` pide la consulta por defecto del cliente y pasa el sobre DRF completo
- Pendiente: el mismo patrón puede existir en otros hooks con `initialData` (revisar al migrar OV y Compras en el 2b, que también reciben datos del servidor)
- Estado: corregido en Productos (lote 2a)

### TC-044 · Ciclo de imports · Verificado
- Evidencia: `@/components/shared` (DataCell → GlobalModalProvider) → registro de drawers → vistas de features → `@/components/entity-view`. Con `ProductClientView` sobre entity-view, todos los tests de entity-view fallaban con `registerValueKind is not a function`
- Decisión: el barrel evalúa primero `core/*`, que no tiene dependencias; guarda en `lib/__tests__/entity-view.contract.test.ts` (verificada por mutación)
- Deuda: el registro de drawers importa las vistas de forma ansiosa (alternativa de fondo: `import()` diferido por entrada)
- Estado: mitigado (lote 2a)

### TC-045 · Defecto del sistema actual · Verificado
- Evidencia: `backend/inventory/selectors.py:59-60` y `:171-172` anotaban `Sum("stocks__quantity")` junto a `Count("variants")` en el mismo `annotate`. Los dos JOIN multiplicaban el stock por el número de variantes y el conteo de variantes por el número de filas de stock. Test `inventory/tests/test_product_ordering.py::test_stock_and_variant_count_are_not_multiplied_by_the_joins`: stock real 15, se mostraba 30
- Efecto: el stock que se ve en la lista de productos (y el orden por stock) salía inflado en plantillas con variantes
- Decisión: subconsulta `_current_stock()` + `Count("variants", distinct=True)`
- Estado: corregido (lote 2a, encontrado por `/code-review`)

### TC-046 · Defecto latente del backend · Verificado
- Evidencia: `ruff check backend/inventory/selectors.py` → 8 × F821. `timezone` y `Subscription` no están importados en `selectors.py:730-736`; ya estaba así en `HEAD`, antes del lote. Esa función lanza `NameError` si se ejecuta
- Decisión: fuera del alcance de entity-view; tarea aparte aprobada por el usuario. `get_stats()` lo llama `subscription_views.py:67`, así que ese endpoint probablemente responde 500
- Estado: https://github.com/Patricoaa/ERPGrafico/issues/179

### TC-047 · Defecto del sistema actual · Verificado
- Evidencia: `features/sales/components/SalesOrdersView.tsx` (antes) calculaba la analítica con `useSalesAnalyticsData(orders, …)` sobre las órdenes de la **página visible** (20). Las cifras cambiaban al paginar (volumen $1.419.350 en la captura previa frente a $12.522.850 reales sobre 178 órdenes)
- Decisión (Puerta D 2b): endpoint `GET /api/sales/orders/analytics/` sobre la lista filtrada completa, reutilizando `filter_queryset` (`sales/analytics.py`)
- Estado: corregido (lote 2b)

### TC-048 · Tipo erróneo · Verificado
- Evidencia: `features/billing/types/index.ts` declaraba `partner?: number`, pero `billing/serializers.py` envía `partner_id` y `partner_name`. En la lista de notas de venta el enlace al cliente se construía sin id. `PurchaseInvoicesClientView.tsx:286` también lee `.partner`
- Decisión: se añade `partner_id`; la entidad de notas lo usa. En el 2c, `PurchaseInvoicesClientView` usa `partner_id ?? supplier` y se quita `partner` del tipo
- Estado: corregido (lotes 2b + 2c)

### TC-049 · Documentación del servidor de desarrollo · Verificado
- Evidencia: `docs/30-playbooks/remote-dev-server.md:141` dice "Django auto-reload", pero el backend corre con `daphne -b 0.0.0.0 -p 8100 config.asgi:application`, sin autorrecarga. Una vista nueva devolvía 404 hasta `docker compose restart backend`
- Decisión: registrar; corregir el playbook o el comando de arranque (tarea aparte)
- Estado: pendiente

### TC-050 · Defecto de la presentación nueva · Verificado
- Evidencia: capturas a 390 px de `evidence/lote2c/compras--card.390.png` y `productos--card.390.png` (antes de la corrección). El botón "Nueva Orden" / "Nuevo Producto" tapaba la búsqueda. Las vistas metían búsqueda y botón en una sola celda `flex-1 min-w-0` de `Collection.Toolbar`, que no podía partirse
- Decisión: ranura `action` en `Collection.Toolbar`. La búsqueda tiene un mínimo de `min-w-56` y la acción baja a la línea siguiente. Se usa en Compras, Productos y UoM (enmienda del contrato, ADR-0087 lote 2c)
- Estado: corregido (lote 2c; regresión del lote 2a en Productos/UoM)

### TC-051 · Defecto del sistema actual · Verificado
- Evidencia: el modo "notas" de `PurchasingOrdersClientView` (ruta `/purchasing/notes`) llamaba a `purchasingApi.getNotes()` sin parámetros. Leía solo `response.results` (primera página del backend), ignoraba los filtros del buscador (usaba el de órdenes) y `page.tsx` precargaba las notas con el tipo `Invoice[]` en vez de la página DRF
- Decisión: `usePurchasingNotes({ filters, page, page_size })` paginado en servidor con `purchaseInvoiceUnifiedSearchDef` (mismo endpoint `/billing/invoices/`). La Puerta D 2c había dado el modo por muerto; se corrige en §3.10
- Estado: corregido (lote 2c)

### TC-052 · Entorno · Verificado
- Evidencia: tras reiniciar el backend, el frontend del servidor de desarrollo se reinició solo, quedó sin responder (curl sin respuesta en 300 s, 4,0 GB de 5 GB, CPU 0 %) y, tras `docker compose restart frontend`, el host 192.168.1.86 dejó de responder a ping/ssh ("No route to host"). Memoria del host: 6,9 GB en total, 1,5 GB disponibles antes de la caída
- Decisión: avisar al usuario; repetir la verificación del 2c cuando el host vuelva. El host volvió reiniciado (`up 0 min`) y la verificación se completó
- Estado: resuelto (causa probable: memoria del host; el frontend `next dev --turbo` llega a 4 GB)

### TC-053 · Defecto ajeno al lote · Verificado
- Evidencia: `app/(dashboard)/inventory/products/uoms/units/page.tsx` y `app/(dashboard)/inventory/settings/measure-categories/page.tsx` (commit `25e43a64f`, navegación) tienen `"use client"` y además `export const metadata = …`. Next.js no compila ninguna de las dos ("Ecmascript file had an error", línea 9)
- Decisión: el usuario pide corregirlo (2026-10-18). Se quita `"use client"`: ninguna de las dos usa hooks, y quedan como Server Components igual que la página de productos
- Estado: corregido

### TC-054 · Proceso · Verificado
- Evidencia: el commit `25e43a64f feat(navigation)` (2026-10-18 01:34) incluye todo el lote 2c sin commitear: backend, frontend, evidencias y documentos de contrato. También incluye `docker-compose.yml`. Los archivos nuevos del lote estaban marcados con `git add -N` (intent-to-add), lo que facilita que un `git add -A`/`commit -a` los arrastre
- Decisión: no reescribir la historia. El usuario elige (2026-10-18) un commit de seguimiento en la rama con las correcciones del `/code-review`, los documentos y TC-053. En adelante, no usar `git add -N`
- Estado: resuelto

### TC-055 · Defecto del sistema actual · Verificado (código)
- Evidencia: `features/sales/components/checkout/Step3_Delivery.tsx:243` busca la UoM actual con `pq.productId === line.id` (compara el producto con el id de la línea), mientras que la escritura (`:247`) busca por `pq.lineId === line.id` o `pq.productId === line.product`
- Efecto probable: el selector de UoM del despacho parcial del POS no refleja la unidad elegida (vuelve a `line.uom`) salvo que coincidan por azar el id de producto y el de línea
- Estado: pendiente; se corrige en la oleada E (`07` §6.8, decisión del usuario 2026-10-18; la clave de fila pasa a ser `rowKey`)

### TC-056 · Paridad de las líneas · Verificado
- Evidencia: `orderLineFields.tsx` muestra "Facturado" (`quantity_invoiced`, :48) y rotula la columna de avance "Entregado" en OV y "Recibido" en OC (:75, :77). `orderLine.entity.ts` del spike no tiene "Facturado" y usa "Entregado" en ambas
- Decisión del usuario (Puerta D lote 3): se restauran. `received` ("Recibido") en OC e `invoiced` ("Facturado") en ambas, como progreso `n/total`
- Estado: corregido (lote 3a)

### TC-057 · Defecto del sistema actual · Verificado (app real, antes y después)
- Evidencia: en la ficha de OV/OC, "Acciones → Registrar Despacho/Recepción" cierra la ficha y no abre nada. `useOrderActionEngine` monta el drawer o modal de la acción como hermano de `DocumentDrawerShell` (`OrderSheet.tsx`, `{engine.host}`). Al abrirse, la ficha recibe `onOpenChange(false)`, la página borra `?selected` y se desmonta la ficha junto con el drawer. Reproducido igual con la versión anterior al lote (`git stash`)
- Decisión (lote 3a): `OrderSheet` e `InvoiceSheet` ignoran el cierre mientras `engine.isModalOpen`. Los modales de `related.host` no están cubiertos
- Estado: mitigado; pendiente la corrección de fondo (ver `/simplify` del 3a)

### TC-058 · Defecto del sistema actual · Verificado (app real)
- Evidencia: `GET /api/inventory/warehouses/` devuelve un array sin paginar. `useDeliveryData` leía `response.data.results` (undefined → "Query data cannot be undefined"), así que el selector de bodega del despacho quedaba vacío y el stock no se consultaba
- Decisión: el hook acepta las dos formas (lote 3a)
- Estado: corregido

### TC-059 · Defecto del sistema actual · Verificado (app real, 390 px)
- Evidencia: `BaseModal` envuelve el cuerpo en el `ScrollArea` de Radix, cuyo contenedor interno usa `display: table; min-width: 100%` y crece hasta el ancho del contenido. A 390 px el modal de recepción mide 749 px por dentro y recorta por la derecha la fecha, las notas y la tabla. Afecta a todos los modales con contenido ancho
- Propuesta: en `BaseModal` (o en `ui/scroll-area`), forzar `display: block` en el hijo del viewport (`[&>[data-radix-scroll-area-viewport]>div]:!block`). Es un cambio compartido, fuera del lote
- Decisión del usuario (2026-10-18): se corrige después, fuera de la migración
- Estado: pendiente (aplazado)

### TC-060 · Proceso · Verificado
- Evidencia: tras los lotes 1–3a, 7 entidades con `defineEntity` y unos 10 de 82 contextos migrados (~12 %); 84 pantallas siguen en el sistema antiguo (`toColumns` 57 → 55, `renderCard` 43 → 40, `AutoEntityCard` 47 → 43). `fromLegacyFields()` especificado (`06` §13.1) pero no implementado. Comandos en `07` §6.1
- Causa: el lote 3 derivó a asistentes y formularios (fuera de alcance en `AUDIT-PROMPT.md` §3), los lotes 2b/2c incluyeron trabajo de backend, el proceso por lote no escala a los maestros simples y el "lote 4+" nunca se planificó
- Decisión propuesta: congelar 3b/3c; oleadas 0 (habilitadores) y A–E por causa de rigidez; reglas M1–M8 con ratchet de consumidores antiguos (`07` §6)
- Decisión del usuario (2026-10-18): aprobada la replanificación (oleadas, reglas M1–M8); TC-055 espera a la oleada E
- Estado: aprobado

### TC-061 · Defecto del sistema actual · Verificado (código)
- Evidencia: `features/inventory/hooks/useCategories.ts` no declaraba `prefix`; `backend/inventory/serializers.py:58` lo envía. `categoryFields.tsx` lo leía con `key: "prefix"` (clave sin comprobar, RC8)
- Decisión: añadido al tipo al migrar (A1)
- Estado: corregido

### TC-062 · Defecto del sistema actual · Verificado (código)
- Evidencia: `UsersSettingsClientView` guardaba la página en `useState` (no se reiniciaba al filtrar → página inexistente posible) y casteaba `setPageState as unknown as …`
- Decisión: `useServerPage` (A1)
- Estado: corregido

### TC-063 · Defecto del sistema actual · Verificado (código)
- Evidencia: `UoMCategoryClientView.handleSave` llamaba a `refetch` de `useUoMs`, que refresca las UdM y no las categorías
- Decisión: `refetchCategories` (A1)
- Estado: corregido

### TC-064 · Entorno · Verificado
- Evidencia: 9 archivos borrados en `7eb097068` y `beb445b00` reaparecen sin rastrear a las 18:59:50 del 2026-10-18, con permisos `-rw-------`, idénticos a `git show <commit>^:<ruta>`. `mutagen sync list`: la sesión sigue apuntando a 192.168.1.93 ("Connecting to beta") mientras `mutagen.yml` ya dice 192.168.1.86
- Efecto: el ratchet `LEGACY_CONSUMERS` falla; sin él, los archivos se habrían colado en un commit
- Decisión: borrados (recuperables desde git). Reconectar mutagen solo tras decidir cómo evitar que una sesión nueva sin ancestro común resucite borrados (two-way-resolved)
- Causa (2026-10-18, verificada): había **dos** sesiones `erpgrafico-sync`: la vieja hacia .93 (desconectada) y una de proyecto hacia .86 creada al reconfigurar `mutagen.yml`. La nueva, sin ancestro común, unió los dos lados al arrancar y trajo los 9 archivos que el servidor aún tenía
- Resolución: el usuario elige que la copia local mande. Un `rsync -anc` (simulación por checksum) mostró **0 diferencias de contenido** entre local y .86 (solo permisos y fechas) y 13 cartolas de prueba que existen solo en el servidor (`backend/media/bank_statements/`, ignoradas por git; mutagen no puede bajarlas porque `backend/media` local es de root). No hizo falta reemplazar nada; se terminó la sesión vieja (`sync_Lj184…`). Queda una sola, .86, "Watching for changes"
- Estado: resuelto

### TC-065 · Defecto del sistema actual · Verificado (código)
- Evidencia: `posSessionFields.ts` sumaba `total_cash_sales + total_card_sales`; el backend no define `COERCE_DECIMAL_TO_STRING`, así que DRF envía strings y la suma concatena (`"1000.00500.00"` → `parseFloat` = 1000,005: solo el efectivo)
- Decisión: `toNumber` en la entidad (A2), test `features/sales/entity-view/__tests__/posSession.entity.test.ts`
- Estado: corregido

### TC-066 · Defecto del sistema actual · Probable
- Evidencia: `salaryAdvanceUnifiedSearchDef` declara `clientKey: ['display_id']` para "N° Anticipo", pero `SalaryAdvance` (`types/hr.ts`) no tiene `display_id`; `filterFn` en cliente no puede coincidir
- Decisión: fuera de la migración (M1); revisar con el serializer de anticipos
- Estado: pendiente

### TC-067 · Defecto del sistema actual · Verificado (código)
- Evidencia: `terminalDeviceFields.ts` (y ahora `terminalDevice.entity.ts`) traduce `supported_payment_methods` con `{1: CREDIT_CARD, 2: DEBIT_CARD}`: depende de las pk de `PaymentMethod`
- Efecto: en otra base (reseed, tenant nuevo) los chips salen mal o no salen
- Decisión: Pd-backend: exponer `method_type` en el serializer del dispositivo
- Estado: pendiente

### TC-068 · Tests rotos previos · Verificado
- Evidencia: `features/production/components/__tests__/WorkOrderWizard.test.tsx`: 3 tests no encuentran los títulos "Crear Orden de Trabajo" / "Gestión de Orden de Trabajo". Reproducido en un worktree en `b04d3927e` (antes de los cambios de esta sesión)
- Probable: el commit `25e43a64f feat(navigation): centralizar títulos` cambió los títulos
- Estado: pendiente (fuera de la migración)

### TC-069 · Defecto del sistema actual · Verificado (código)
- Evidencia: `features/contacts/types/index.ts` no declaraba `credit_risk_level`; `backend/contacts/serializers.py` lo envía (campo de `ContactSerializer`, `__all__`/explícito). `contactFields.tsx` lo ignoraba: la búsqueda ofrecía agrupar por "Riesgo" sin que ninguna columna lo mostrara
- Decisión: añadido al tipo al migrar (A4), con los 4 valores de `RiskLevel`
- Estado: corregido

### TC-070 · Defecto del sistema actual · Verificado (código)
- Evidencia: `BOMListItem` (alias local en `BOMClientView.tsx`) repetía `lines_count`, `total_cost` y `product_code`, que `BillOfMaterialsSerializer` ya envía; el tipo `BOM` no los tenía
- Decisión: añadidos a `BOM` (A4); `bomActions` pasa a tiparse sobre `BOM`
- Estado: corregido

### TC-071 · Entorno · Verificado
- Evidencia: `features/treasury/credit-lines/CreditLineDrawer.tsx` falla `tsc` (6 errores: `FormField` sin importar, `field`/`v` implícitos `any`, opciones `readonly` no asignables, `LabeledCheckboxProps` incompleto). El archivo **no está en el diff de esta sesión** (`git diff HEAD` vacío); viene commiteado en `d919808b4 fix(form): migrate antipatterns to canonical notched-field components`, el commit en la punta de la rama, posterior a los de esta sesión y hecho directamente por el usuario
- Efecto: `npx tsc --noEmit` falla en la rama *antes* de cualquier cambio de esta sesión; aislado a ese único archivo (verificado por archivo)
- Causa raíz adicional (hallada al corregir): los dos `LabeledSelect` restantes (`currency`, `rate_basis`) y el `LabeledCheckbox` (`auto_renewal`) recibían `{...form.register(...)}` — válido para `LabeledInput` (input nativo) pero no para `LabeledSelect`/`LabeledCheckbox` (envuelven Radix `Select`/`Checkbox`, que esperan `onChange(value)`/`onCheckedChange(checked)`, no un `ChangeEvent`). `tsc` no lo marcaba porque el tipo de `register()` (`ChangeHandler = (event: any) => ...`) es estructuralmente compatible por el `any`, pero en runtime habría roto la selección/el checkbox
- Corrección: los tres campos ahora usan `Controller` (de `react-hook-form`, mismo patrón que `DeviceDrawer.tsx`) con `value`/`onChange` (`LabeledSelect`) o `checked`/`onCheckedChange` (`LabeledCheckbox`); se quitó el `as const` de `currencyOptions`/`rateBasisOptions` (tipo `readonly [...]` no asignable a `LabeledSelectOption[]`); se quitó el import sin uso de `LabeledContainer`
- Estado: corregido (`tsc --noEmit` y `eslint` limpios en el archivo; sin test dedicado — el drawer no tenía tests antes de este cambio)

### TC-072 · Entorno · Verificado
- Evidencia: `features/accounting/components/JournalEntryDrawer.tsx` fallaba `tsc` (4 errores, TS2322) en los campos de solo lectura "Estado", "Origen" y "Documento Origen" (×2): `3e1114377 fix(form): replace ad-hoc notched-field with LabeledInput for read-only display fields` (commit directo del usuario, misma punta de rama que TC-071) les pasó un `<StatusBadge>`/`<Chip>`/`<DocumentRefLink>`/`<span>` (JSX) como `value`, pero `LabeledInput.value` es el `value` nativo de `<input>` (`string | number | readonly string[] | undefined`), no `ReactNode`
- Corrección: los 4 campos pasan de `LabeledInput value={<JSX/>} readOnly` a `LabeledContainer` (el primitivo del contrato — `component-input.md` — para contenido no-input dentro del notched field) con el `JSX` como `children`; se agregó `LabeledContainer` al import de `@/components/shared`; se quitó `readOnly` (no existe en `LabeledContainerProps`, no aplica a children arbitrarios)
- Estado: corregido (`tsc --noEmit` y `eslint` limpios; sin test dedicado — el drawer no tenía tests antes de este cambio)

### TC-073 · Defecto del sistema actual · Verificado (ratchet)
- Evidencia: `features/accounting/components/JournalEntrySheet.tsx` (commit directo del usuario `27d4527b2 refactor(accounting): canonize JournalEntryDrawer into Sheet + FormDrawer`, ajeno a esta migración) renderiza las líneas del asiento con un `<table>`/`<thead>`/`<tbody>` escritos a mano (línea 244), sin pasar por `entity-view` ni por el sistema legacy. El test `entity-view.contract.test.ts > no new hand-written table appears in features or app` lo detecta como una tabla nueva — viola la invariante #13 / regla M7 del ratchet (el conteo de tablas a medida no debe subir)
- Efecto: 1 test en rojo (`lib/__tests__/entity-view.contract.test.ts`), aislado a este archivo; no bloquea la oleada B (la pantalla de lista, `EntriesClientView.tsx`, abre la ficha vía `useDocumentSheetRoute` y no depende de los internos de `JournalEntrySheet.tsx`)
- Estado: pendiente del usuario; es su propio código (ficha documental de asientos, fuera de la migración de entity-view). No se corrige aquí: migrar esa tabla de líneas a `entity-view`/`EditableCollection` es trabajo de la ficha documental, no de B2

