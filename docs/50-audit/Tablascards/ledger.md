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
