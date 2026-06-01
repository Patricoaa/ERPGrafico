# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.22](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.21...v0.1.22) (2026-06-01)


### ✨ Features

* estandarización de layout fluido, ESLint rules, refactors y mejoras en shared components ([a8ab066](https://github.com/Patricoaa/ERPGrafico/commit/a8ab06614878e1dacb5b79091e5d89188d6c46d4))
* **frontend:** fluid responsive layout — tokens, grids, sidebar ([f6e39dd](https://github.com/Patricoaa/ERPGrafico/commit/f6e39ddc7766424999a2e24592e116318537c3b7))


### 🐛 Bug Fixes

* **frontend:** alinear bordes y sombras de main y paneles laterales via [@utility](https://github.com/utility) panel-surface ([fee0df1](https://github.com/Patricoaa/ERPGrafico/commit/fee0df1f03f1896e792d10562bcf4b13df43375e))
* **layout:** estandarizar layout fluido, alturas, padding de paneles y empty states ([63a60ef](https://github.com/Patricoaa/ERPGrafico/commit/63a60ef2e22d6b678baa9e37c652e3845939df4f))
* **shared:** align EmptyState icon card and SmartSearchBar styling ([9224b19](https://github.com/Patricoaa/ERPGrafico/commit/9224b19f3073a411551e240c0398d09494705f36))
* **types:** resolve 52 TypeScript errors + refactor P3 set-state-in-effect ([0f4584e](https://github.com/Patricoaa/ERPGrafico/commit/0f4584e2b8dc371de884c9727810f20de654fc75))


### ⚙️ Refactors

* **production:** migrate WorkOrderWizard from BaseModal to embedded bottom Drawer ([3d023c0](https://github.com/Patricoaa/ERPGrafico/commit/3d023c08ea1fd4dc73d464424b886fd76d271abf))

### [0.1.21](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.20...v0.1.21) (2026-06-01)


### 💅 Styling

* **production:** standardize current_stage column to use minimal industrial label ([a3985ae](https://github.com/Patricoaa/ERPGrafico/commit/a3985ae9343492a6b45f19a7d820902b000be204))
* **ui:** fix vertical alignment and increase badge legibility (11px mono) ([7d04bdb](https://github.com/Patricoaa/ERPGrafico/commit/7d04bdb6a3cadf5818b7c1b8dac700f32cedaec5))
* **ui:** unify badges to pill style with mono font and matched heights ([5dd319d](https://github.com/Patricoaa/ERPGrafico/commit/5dd319d7e3440f7ca1b4a7739cf2247d51d84f27))


### ⚙️ Refactors

* (treasury / purchasing) fsd layer ([9e93d5f](https://github.com/Patricoaa/ERPGrafico/commit/9e93d5ffb594669f376d87c0ecfeb1c772a34752))
* **billing:** fsd data layer sweep — 5 component files migrated ([95af578](https://github.com/Patricoaa/ERPGrafico/commit/95af57841345fb85aa5ce5040a3d721d2aa1aff9))
* eliminar SimpleTable y cambiar fondo sticky header embedded a transparente ([70bad87](https://github.com/Patricoaa/ERPGrafico/commit/70bad878e47720727cdf1a5477b30382fc2a2504))
* **features:** remove `x.results || x` envelope-discard smell ([4662578](https://github.com/Patricoaa/ERPGrafico/commit/46625787dc873cea16ac4c1cb228df3a91b44767))
* **frontend:** enforce DataCell contract compliance across codebase ([0658b30](https://github.com/Patricoaa/ERPGrafico/commit/0658b30dace8eeb8efb7f069be920704badeda4c))
* **frontend:** extend entity drawer registry to all entities with drawers ([1eef533](https://github.com/Patricoaa/ERPGrafico/commit/1eef5330ad506940f4131302c52088f65f593f3f))
* **frontend:** migrate ad-hoc DataTable cells to DataCell contract ([c11c6a7](https://github.com/Patricoaa/ERPGrafico/commit/c11c6a776f645d835dfcb251aee65777614a0344))
* **frontend:** normalize drawer grids and widths per complexity tier ([663f122](https://github.com/Patricoaa/ERPGrafico/commit/663f1220d145de5edf05f1345cef12c7f12e24a5))
* **frontend:** replace TransactionViewModal with dual-mode entity drawers ([b55f9d9](https://github.com/Patricoaa/ERPGrafico/commit/b55f9d952a4f225aa68a011f7e1417e5e375689e))
* **frontend:** standardize remaining CRUD components to *Drawer convention and clean up legacy files ([390e364](https://github.com/Patricoaa/ERPGrafico/commit/390e3646f1e9c70ed2bfab146b1b4ebdb307a180))
* implement CQS hooks + SkeletonShell for all forms with async deps ([e56b455](https://github.com/Patricoaa/ERPGrafico/commit/e56b455e5101985ae69ae957024848f8755a4521))
* **inventory/api:** remove envelope-discard smell from getProducts/getCategories ([c0be831](https://github.com/Patricoaa/ERPGrafico/commit/c0be8319d0e96ff7ca5ba7aa8f5a4e0f47e0ee13))
* **inventory:** AdjustmentForm — 5 api.* a hooks (incluye cross-feature) ([a2959fa](https://github.com/Patricoaa/ERPGrafico/commit/a2959fa03a623c5a9ba995284255323bf52db90f))
* **inventory:** añadir useProductInsights hook + getProductInsights api ([a424c75](https://github.com/Patricoaa/ERPGrafico/commit/a424c756ec6cc2edea0eee5d0b03bc42a6d1f748))
* **inventory:** AttributeManager — 7 api.* a hooks ([1573bb3](https://github.com/Patricoaa/ERPGrafico/commit/1573bb3ae021ba32cee07fcf9162dfceb464d8bd))
* **inventory:** BulkVariantEditForm(+V2) consumen useUoMs/useProducts ([4b252ac](https://github.com/Patricoaa/ERPGrafico/commit/4b252acea79ce8c5d19b4d6fcf67ec232c22eab0))
* **inventory:** Category FSD — hooks completos + Form/Detail consumen hook ([589007b](https://github.com/Patricoaa/ERPGrafico/commit/589007b1f26a6a773fa839fb78c06575b3887ba0))
* **inventory:** hierarchical PRODUCTS_KEYS + complete useProducts CRUD ([4c8b040](https://github.com/Patricoaa/ERPGrafico/commit/4c8b040b7a53b64899aa40baf572e4cefc3c808a))
* **inventory:** migrar ProductPricingTab + VariantQuickEditForm a hooks ([724fc76](https://github.com/Patricoaa/ERPGrafico/commit/724fc767d7ac15fe9e0d260978370b58fbac63cd))
* **inventory:** PricingRuleList + UoMCategoryList consumen sus hooks ([d7c97a4](https://github.com/Patricoaa/ERPGrafico/commit/d7c97a4a136c2d26ba304904524d1bad867e4bc8))
* **inventory:** ProductDetailClient usa useProduct hook + limpia dead code ([020d365](https://github.com/Patricoaa/ERPGrafico/commit/020d3657c84d36bc82fb1479c66f935cab0d9053))
* **inventory:** ProductForm reads migran a hooks reactivos ([d6c1d5e](https://github.com/Patricoaa/ERPGrafico/commit/d6c1d5ef2d34679722f49e850df1920a4ceb1fb2))
* **inventory:** ProductForm.onSubmit usa saveProduct hook ([9e2e7e6](https://github.com/Patricoaa/ERPGrafico/commit/9e2e7e6ae148bebabe231d2c36f4ee8e5417edd7))
* **inventory:** ProductInsightsModal usa useProductInsights hook ([fd9aca8](https://github.com/Patricoaa/ERPGrafico/commit/fd9aca85f8c4f481a9c91f98a0082c21ba6b27a1))
* **inventory:** ProductVariantsTab migra los 6 api.* a hooks ([6d91673](https://github.com/Patricoaa/ERPGrafico/commit/6d9167347b3a74515d675138ae7289fa23e560b2))
* **inventory:** StockMoveDetailClient usa useStockMove hook ([7a673d9](https://github.com/Patricoaa/ERPGrafico/commit/7a673d971c1ab4e0499f68db86c31a501d9b2c23))
* **inventory:** SubscriptionHistoryModal usa useSubscriptionHistory hook ([12c5c58](https://github.com/Patricoaa/ERPGrafico/commit/12c5c58e14b9b178bb8c64b92da52aeb71c52c68))
* **inventory:** SubscriptionsView — 8 api.* a hooks ([d64da49](https://github.com/Patricoaa/ERPGrafico/commit/d64da4984897f415046d2d5c1642b601dbb5c82e)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5)
* **inventory:** UoMCategory FSD — useUoMs gana saveUoMCategory ([d7f9717](https://github.com/Patricoaa/ERPGrafico/commit/d7f9717b2c1df64f225c441b05e9de6235f432ab))
* **inventory:** Warehouse FSD — hooks completos + Form/Detail consumen hook ([196c038](https://github.com/Patricoaa/ERPGrafico/commit/196c0383f4024bf9adca85a6a09f531d88ecf6f4))
* migrar tablas display-only/picker a DataTable variant embedded ([88ff484](https://github.com/Patricoaa/ERPGrafico/commit/88ff4849d7b8a56510eea72987a3e46a8a33c305))
* optimize skeleton patterns across 28 modules and resolve TaskDetailClient compile errors ([2c7f3f4](https://github.com/Patricoaa/ERPGrafico/commit/2c7f3f4989501971d1a4ea59f59ce1329eabe0b8))
* **pos/hooks:** remove envelope-discard from useProducts.useUoms ([10d60c9](https://github.com/Patricoaa/ERPGrafico/commit/10d60c91f5b975850e302722d871a7f2ee5db270))
* **pos/hooks:** replace envelope-discard with Array.isArray ternary ([b0af74d](https://github.com/Patricoaa/ERPGrafico/commit/b0af74de93f77df45b6c08fa8d80a7fa543c2933))
* **production:** phase 2 audit implementation ([c77ab7d](https://github.com/Patricoaa/ERPGrafico/commit/c77ab7d534af2a1d9365fd3772f750a4f9f68245))
* **production:** remove kanban drag & drop and bulk stage advancement ([67a1a55](https://github.com/Patricoaa/ERPGrafico/commit/67a1a55f17520bd2e77a0ddedeec1f27690ef7ce))
* **production:** split OT wizard into 4 creation steps with Zustand store ([ca931b6](https://github.com/Patricoaa/ERPGrafico/commit/ca931b6f849d58c6ad8921d8c1c37bae5ed2cab8))
* **sales,billing:** SaleNoteModal — 3 api.* a hooks ([64b5aed](https://github.com/Patricoaa/ERPGrafico/commit/64b5aed79b6da91259d1b94c50d66ec6cc438897))
* **sales,billing:** SalesOrdersClientView usa confirmInvoice del hook ([bcddc60](https://github.com/Patricoaa/ERPGrafico/commit/bcddc60154f2a6e0aaa67240a3d17a3d2ef88503)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5)
* **sales,inventory:** DeliveryModal — 3 api.* a hooks ([1a34f7a](https://github.com/Patricoaa/ERPGrafico/commit/1a34f7a134426a032d19f3ffe4bbdb7937705ba2))
* **sales,pos:** POSSessionsView consume hooks de pos ([6aadc39](https://github.com/Patricoaa/ERPGrafico/commit/6aadc390b1598dabecfeff984c6879215ec288ae))
* **sales:** foundation FSD — hierarchical SALES_KEYS + delete orphan DetailClients ([c917a9d](https://github.com/Patricoaa/ERPGrafico/commit/c917a9d6ace09bdec1fb1c4971ae7580e574763e)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5)
* **sales:** PricingRuleForm — 3 api.* a hooks ([ae8af4a](https://github.com/Patricoaa/ERPGrafico/commit/ae8af4a46fa3904243676d6ec6441d039eafa238))
* **sales:** SalesCheckoutWizardContent — 6 api.* a hooks (cross-feature) ([8fdbe4b](https://github.com/Patricoaa/ERPGrafico/commit/8fdbe4bd1da95b4c5b5670f71b1dfa7a2e763642))
* **sales:** Step3_Delivery usa useAllowedUoMs hook ([6775ece](https://github.com/Patricoaa/ERPGrafico/commit/6775ece788d100ebc692fd6674cf7df44ef37a8a))
* **settings/api:** remove envelope-discard from 5 catalog getters ([4be1e7f](https://github.com/Patricoaa/ERPGrafico/commit/4be1e7f9b84039823f0962ab823c52729432af46))
* **tax/hooks:** remove final envelope-discard from useLazyTaxDeclarations ([b59055a](https://github.com/Patricoaa/ERPGrafico/commit/b59055a11a139681704fc77c8e3f531c52eac48e))
* **workflow/hooks:** remove envelope-discard from rules queries ([74032ed](https://github.com/Patricoaa/ERPGrafico/commit/74032ed75cdfcf52f974a113672f3bce838b7044))


### ✨ Features

* **accounting:** add has_posted_items to Account + granular drawer field controls ([1794e6f](https://github.com/Patricoaa/ERPGrafico/commit/1794e6f41e1add6dd237437d5920d7ba024b7f11))
* **accounting:** add origin discriminator, source document tracing, and registry entities ([cdbc967](https://github.com/Patricoaa/ERPGrafico/commit/cdbc967140b38bda9bffe83790c48bfacb355f2b))
* add start_date and estimated_completion_date to auto-created OTs ([0b4f25c](https://github.com/Patricoaa/ERPGrafico/commit/0b4f25cf88375e09dd567528c33585df49071b62))
* adopción de dark /light mode ([844c758](https://github.com/Patricoaa/ERPGrafico/commit/844c7586b8ea07033a7c8e7921c2e015c49515ed))
* ajuste para dev local, mutagenos, ajuste de vistas duplicados ([8b96f5f](https://github.com/Patricoaa/ERPGrafico/commit/8b96f5f934ff82bec5f61f5409c795f6e590bc51))
* **backend:** consolidate DRF pagination + cap max_page_size at 200 ([63f96a3](https://github.com/Patricoaa/ERPGrafico/commit/63f96a31a1a04fc138c77993451a2e9d10c893b7))
* **core:** idempotency infra — IdempotencyRecord model + [@idempotent](https://github.com/idempotent)_endpoint decorator ([8e494be](https://github.com/Patricoaa/ERPGrafico/commit/8e494be0b1cdcc879fc9ffd4cb2cd3eef7ecc1ee))
* **DataTable:** accept rowCount and read it via getRowCount() ([7553cfb](https://github.com/Patricoaa/ERPGrafico/commit/7553cfb22dbc66724c5a8fc4f55c3fc8e5dc8ec6))
* drawer 3 modes ([ab72d91](https://github.com/Patricoaa/ERPGrafico/commit/ab72d911863a419702f3127d423c02e38f6539d5))
* **eslint:** add two pagination-contract enforcement rules ([18d03fe](https://github.com/Patricoaa/ERPGrafico/commit/18d03fee8452e682a191b6bd5bbb0f00d1c4ff5a))
* **finance:** migrate feature to FSD canonical pattern ([5e14b3e](https://github.com/Patricoaa/ERPGrafico/commit/5e14b3e38f64c461168c5dee60a8ef09283a9934)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4)
* **fsd:** migrate tax data layer — last Anti-pattern → Compliant ([ac55227](https://github.com/Patricoaa/ERPGrafico/commit/ac5522773c7148a5f70b0bf7aad6123d93489945))
* **lib:** add canonical Page<T> and toPage() helper ([0199a74](https://github.com/Patricoaa/ERPGrafico/commit/0199a742c94439d68c2fb2b7a6b58eda3394dffd))
* **pos:** migrate feature to FSD canonical pattern ([1bc1aab](https://github.com/Patricoaa/ERPGrafico/commit/1bc1aab00a848f7ca561b9f12687c128fc79a4e8)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5)
* **production:** add celery beat task for overdue work orders (TASK-305) ([5c0df25](https://github.com/Patricoaa/ERPGrafico/commit/5c0df251c59c8f7f1205f0afd09ec5976d8564c0))
* **production:** add duplicate work order action (TASK-302) ([c5c764f](https://github.com/Patricoaa/ERPGrafico/commit/c5c764fdc03fea68b7c89ca40e6087c97126b400))
* **production:** add my tasks filter to work orders list (TASK-303) ([10a7d1d](https://github.com/Patricoaa/ERPGrafico/commit/10a7d1d4ec7541031b1cb4acaf843a188d9a6760))
* **production:** add URL shortcut for manual work order creation (TASK-304) ([38acb06](https://github.com/Patricoaa/ERPGrafico/commit/38acb06371b150f58055d786fdb01a291da6815e))
* **production:** complete Phase 2 — useWorkOrderListActions + ManufacturingSpecsEditor ([64bab67](https://github.com/Patricoaa/ERPGrafico/commit/64bab67b361126a19f66e8fdbcd7ef1e3592adf1))
* **production:** enhance BOM Manager empty state and acknowledge Rectification Impact preview completion (TASK-309, TASK-310) ([a0b4c75](https://github.com/Patricoaa/ERPGrafico/commit/a0b4c758e485f2997f9e46ba0777df6d798748ae))
* **production:** Phase 3 backend — TASK-201/202/207/209 ([9857704](https://github.com/Patricoaa/ERPGrafico/commit/9857704a67f02f0c7cd425e94d235136eb9ea45b))
* **production:** TASK-203 — PDF de OT con WeasyPrint ([de3cf3e](https://github.com/Patricoaa/ERPGrafico/commit/de3cf3e0bec9a70b881cfc8f50d968e170a6ecae))
* **production:** TASK-204 — Endpoint de Métricas de Producción ([d7cd098](https://github.com/Patricoaa/ERPGrafico/commit/d7cd0983aad623147b848b1a51bd3db3a5315839))
* **production:** TASK-205 — Tarjeta de Métricas en Dashboard ([3d3c531](https://github.com/Patricoaa/ERPGrafico/commit/3d3c5315cf49f1845b7d8a42a55d8da952f2549b))
* **production:** TASK-206 — Numeración de OTs con prefijo anual configurable ([d612d20](https://github.com/Patricoaa/ERPGrafico/commit/d612d20a9a6ceacbd1a8f9a5b74f3db19c496a87))
* **production:** TASK-208 — Mostrar costo planificado vs real en Rectificación ([c21f903](https://github.com/Patricoaa/ERPGrafico/commit/c21f9036643a4d32483a26ddf3c037ea55a4fd96))
* **production:** TASK-209 and TASK-210 Outsourced rectification and stage_data versioning ([bfc757c](https://github.com/Patricoaa/ERPGrafico/commit/bfc757c2c4e78c67dc60b515083b369159f8a058))
* **realtime:** entity-bus pilot — WS multiplexado + invalidación cross-tab para sales ([50a2f69](https://github.com/Patricoaa/ERPGrafico/commit/50a2f6934dad82bdc7da2caa7ac73e388e02d697))
* row actions, badges, workbenchpanel ([42ff2b7](https://github.com/Patricoaa/ERPGrafico/commit/42ff2b76b9ddbb4fc649dfd76be088dfa58ba2a3))
* **settings:** migrate settings feature to FSD canonical pattern ([8eb5cfa](https://github.com/Patricoaa/ERPGrafico/commit/8eb5cfac9770cd523521c57c9d12266ae8beb4c4)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4)
* **shared:** add StatCard component, migrate ~48 instances across 14 feature files ([c08f163](https://github.com/Patricoaa/ERPGrafico/commit/c08f163680d5672552aa23f0b0b7d4885afd3056))
* **shared:** data table system — CSS tokens, variant=minimal, animated expand, view helpers ([cb9f453](https://github.com/Patricoaa/ERPGrafico/commit/cb9f453bfd8fb8144dd329c64f8f5c1138d76f4b))
* **shared:** DataTableView wrapper — centraliza view state + card rendering ([6a5bfed](https://github.com/Patricoaa/ERPGrafico/commit/6a5bfed44b0032dba28e6f5edaf15a11b6bef9bc))
* **treasury,inventory:** migrate paginated hooks to Page<T> ([3ad510a](https://github.com/Patricoaa/ERPGrafico/commit/3ad510ad4c6648fddae5e5c6acde4ac41b6960a3))
* **workflow:** implement polymorphic comment synchronization between WorkOrders and SaleOrders (TASK-307) ([4a3fe39](https://github.com/Patricoaa/ERPGrafico/commit/4a3fe3997ce1169c343fa5b5ed1f416708f13cdd))


### 🚀 Maintenance

* complete T-95 decommission — remove orphaned detail code ([795ac94](https://github.com/Patricoaa/ERPGrafico/commit/795ac948c873356f3f7313d6714e4573a7a5a8bb))


### 📚 Documentation

* **20-contracts:** add end-to-end pagination contract ([51deafe](https://github.com/Patricoaa/ERPGrafico/commit/51deafe157fd582f651b83c7449132c63d0b9b20))
* 5 playbooks Tier 2 + aggregator pattern + idempotency fix ([7bdeaa1](https://github.com/Patricoaa/ERPGrafico/commit/7bdeaa13c667e2b4005ecef08f85b6164e1cffba))
* ablandar 40-quality y topología a realidad PYME single-node ([b953a6e](https://github.com/Patricoaa/ERPGrafico/commit/b953a6e6c30692db1cf547ddd6ff3190926c8fdb))
* add 5 new contracts — deletion / realtime / idempotency / export / import ([4059701](https://github.com/Patricoaa/ERPGrafico/commit/405970137c27692da806f416db28488e1548dff7))
* ADR hygiene — normalize frontmatter, resolve duplicate IDs, rebuild index ([869b3a9](https://github.com/Patricoaa/ERPGrafico/commit/869b3a9ef21d23e4f15771449b9054ad646af281))
* **audit:** aclarar bloqueo técnico de la regla ESLint en el plan ([d7f5a2b](https://github.com/Patricoaa/ERPGrafico/commit/d7f5a2b27690a450176983894c953dcc57170393))
* **audit:** close Phase 2 — mark TASK-107/108/109 as completed ([8a91f3f](https://github.com/Patricoaa/ERPGrafico/commit/8a91f3fad59c6e1f7c6d7299c9878b592e06b7e6))
* **audit:** FSD data-layer audit + per-feature refactor plan ([a7c53de](https://github.com/Patricoaa/ERPGrafico/commit/a7c53de9777d42fba92c758e8739747e90c3c101)), closes [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4)
* **audit:** inventory ✅ (21+4 → 0) y siguiente cola sales ([79c1d83](https://github.com/Patricoaa/ERPGrafico/commit/79c1d835b4654d33d511183ec8537a0a72553a19)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5)
* **audit:** mark remaining Phase 4 tasks (311 to 317) as completed ([256cd59](https://github.com/Patricoaa/ERPGrafico/commit/256cd596fa24f688cc09ed7997db1dd86a5da99f))
* **audit:** mark TASK-306 as completed ([13d8b82](https://github.com/Patricoaa/ERPGrafico/commit/13d8b82d8796cf9c2fa450e8fa15b5ec83701a8d))
* **audit:** sales ✅ (11+4 → 0). Treasury próximo en cola. ([b84ce61](https://github.com/Patricoaa/ERPGrafico/commit/b84ce61a05e0f1f84a432a1d3614fe31af5480e2)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4)
* **contract:** add StatCard contract + update decision tree ([8a82ce0](https://github.com/Patricoaa/ERPGrafico/commit/8a82ce032d43b987f307d43a06e5d16ae0f6fde0))
* cross-document consistency (invariants, ADR supersession, taxonomy, pagination) ([8ee9eab](https://github.com/Patricoaa/ERPGrafico/commit/8ee9eabeac0351c035f0ce51d0c55e74121f100e))
* document entity-drawer subsystem (ADR-0028) + retire TransactionViewModal ([5541935](https://github.com/Patricoaa/ERPGrafico/commit/554193593547cf4d26833c2b585f2c68d8b50548))
* Marcar TASK-201, 202, 207, 209 como completadas ([e2bbaba](https://github.com/Patricoaa/ERPGrafico/commit/e2bbaba68f791231f0c0bf35c6b2e75cad7973fc))
* reconcile money/id/version conventions with codebase reality ([1b3351a](https://github.com/Patricoaa/ERPGrafico/commit/1b3351a490d468bac8dd9adfb8f9fc52ea6b9d1a))
* Tier 3 — frontmatter universal + consolidación F5 ([af11559](https://github.com/Patricoaa/ERPGrafico/commit/af115594e7a579d5ea845a7665e54eb002562a88))


### 🐛 Bug Fixes

* **accounting:** remove duplicate useJournalEntry definition in useJournalEntries.ts ([c31ccf0](https://github.com/Patricoaa/ERPGrafico/commit/c31ccf0b4c7f716a7ff10e38f242aaa0037b00a9))
* **backend:** fix typo in requirements.txt (concatenated package names) ([5742938](https://github.com/Patricoaa/ERPGrafico/commit/57429388a1bdfa3694d6f41270a942520277d024))
* **contacts:** eliminate last [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) violation — fully compliant ([d354766](https://github.com/Patricoaa/ERPGrafico/commit/d354766d5b14dff58f1bb317018a43ed40a6b3ec)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5)
* **datatable:** resolver fallo de paginación en modo no controlado /tastack/modales ([c715ebf](https://github.com/Patricoaa/ERPGrafico/commit/c715ebfc688a236207e20069faed19e2f2ccc522))
* **dialog:** remove gap-4 from DialogContent base — fixes sidebar border gap in wizard modals ([b5e11db](https://github.com/Patricoaa/ERPGrafico/commit/b5e11db1bb0f3af929ab089b5503f0632afd4fa3))
* **docker:** remove illegal characters in apt-get install causing build failure ([e2b1a13](https://github.com/Patricoaa/ERPGrafico/commit/e2b1a1335bef9007fb744455163b78b967ade5d8))
* **entity-drawers:** pass canonical `id` prop to transaction drawer adapters ([29c6c28](https://github.com/Patricoaa/ERPGrafico/commit/29c6c289f8d30027d653916da11345ee0cfa327e))
* **eslint:** resolve P0 critical invariant violations ([8d73329](https://github.com/Patricoaa/ERPGrafico/commit/8d7332909b8fc0d1b8220cdbbb5beade31f5e907))
* **eslint:** resolve P1 React Compiler and convention violations ([07630ad](https://github.com/Patricoaa/ERPGrafico/commit/07630ad06f45341d99af82310a42df1685c14e85))
* **eslint:** resolve P2 convention violations ([3b1c653](https://github.com/Patricoaa/ERPGrafico/commit/3b1c6538bd8bc30f5f300869b5a2b251abe847cf))
* **frontend:** resolve linting debt and boundary rules ([5e04d1e](https://github.com/Patricoaa/ERPGrafico/commit/5e04d1e4badeca1a8bb16ffa04bf99ebccd58d02))
* **frontend:** resolve ts errors in settings and transaction modal ([7b955b7](https://github.com/Patricoaa/ERPGrafico/commit/7b955b7cdc6bb4d110e20aa875c85d497014edba))
* **frontend:** unify drawer layout and standardize ActivitySidebar usage ([d76e4e5](https://github.com/Patricoaa/ERPGrafico/commit/d76e4e55d65ff9f2f7a6297d7e0a8bb1dfeaec6c))
* **inventory,production:** resolve product form undefined payload, fix hub status imports, enable bulk actions in OT table (TASK-306) ([3404006](https://github.com/Patricoaa/ERPGrafico/commit/340400654c84ba2facfec2f49c9e5da6cca32dfe))
* **inventory:** compute product stock at DB level, not in JS ([8286017](https://github.com/Patricoaa/ERPGrafico/commit/82860177326f2b534ce874a12d2acd2f6284b0ad)), closes [#1](https://github.com/Patricoaa/ERPGrafico/issues/1)
* **inventory:** resolve form re-opening bug and ensure it always opens on the general tab ([278233c](https://github.com/Patricoaa/ERPGrafico/commit/278233c3711a7bb696a30c52605bff7497b594de))
* migrate accounting and hr features to FSD data layer ([1a36567](https://github.com/Patricoaa/ERPGrafico/commit/1a36567a47f25e02cf9714aff3239b941b85209e)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#4](https://github.com/Patricoaa/ERPGrafico/issues/4)
* migrate contacts, users, tax features to FSD data layer ([bc3e99b](https://github.com/Patricoaa/ERPGrafico/commit/bc3e99b0caf60e5e9c4fff80cb7e22441b1a7a3d)), closes [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5) [#5](https://github.com/Patricoaa/ERPGrafico/issues/5)
* **ot-wizard:** cleanup ManufacturingConfigStep layout ([615457b](https://github.com/Patricoaa/ERPGrafico/commit/615457bd10e2da2c1b4ad05b2e6a70194f808f46))
* **ot-wizard:** layout, product filtering, and ManufacturingConfigStep refinements ([1b2d57b](https://github.com/Patricoaa/ERPGrafico/commit/1b2d57ba21c10833c772182219e3b0e70acfa3da))
* pagination bug ([4a5eeab](https://github.com/Patricoaa/ERPGrafico/commit/4a5eeabe2ba78f84fb48f2779301bc22fb94b733))
* **production:** add missing onSelectCategory and selectedCategoryId to ProductSelector usage ([47f3b3f](https://github.com/Patricoaa/ERPGrafico/commit/47f3b3f09d23c0aa9b49bc7ffb6e1d5bce1ea7d4))
* **production:** apply CSS Translate transform for smooth Drag and Drop in Kanban (TASK-308) ([e3bcd05](https://github.com/Patricoaa/ERPGrafico/commit/e3bcd05475dcb8a3cfc243fd413856d033992a89))
* **production:** correct import path for productionApi in ManufacturingConfigStep ([b996fd7](https://github.com/Patricoaa/ERPGrafico/commit/b996fd7573a19c49baf481277dcaeca6697c61d6))
* **production:** correct OT folio prefix, add NV asociada column, standardize badge usage in table ([bbe275b](https://github.com/Patricoaa/ERPGrafico/commit/bbe275bbc6dba4eff82a0856aa6cf0cae7195f09))
* **production:** enforce workflow rules in Kanban drag & drop, open Wizard for complex stages ([403af34](https://github.com/Patricoaa/ERPGrafico/commit/403af34e029b6cfce25a83df037898e059d4c960))
* **production:** fix syntax error in Kanban map logic ([095b235](https://github.com/Patricoaa/ERPGrafico/commit/095b2358f8261534a98bb0b0615a3bc17ebbb1e6))
* **production:** make wizard sidebars/footer transparent and fix footer border gaps ([37e7c41](https://github.com/Patricoaa/ERPGrafico/commit/37e7c41a057c00c71f9e4874838fd116474357b9))
* **production:** remove redundant OrderCommentPanel that was hiding the stage view in the wizard ([d7682c0](https://github.com/Patricoaa/ERPGrafico/commit/d7682c091344932454ec3e9af0e9efd17abc4675))
* **production:** useInfiniteQuery data is InfiniteData, not array — access .pages before .flat() ([e324854](https://github.com/Patricoaa/ERPGrafico/commit/e324854ad790b92daada73e1139a510ce7af46aa))
* replace broken @/lib/markLocalMutation import with useRealtime() context ([14855cb](https://github.com/Patricoaa/ERPGrafico/commit/14855cba472c01605f6666346c55c53dba019b9f))
* **users:** remove duplicate import api from '@/lib/api' in usersApi.ts ([1a1b398](https://github.com/Patricoaa/ERPGrafico/commit/1a1b398f6c01bd849a116fc12d42027d63cd0a5b))
* **ux:** staleTime:0 en useSelectedEntity — panel siempre muestra datos frescos ([874fc7b](https://github.com/Patricoaa/ERPGrafico/commit/874fc7bd0613f31aab48fe04a85ac8290247577b))
* **workflow:** add missing updateWorkflowSettings to workflowApi ([2eccd08](https://github.com/Patricoaa/ERPGrafico/commit/2eccd08846d2801684f74eff7e01ce1a3ca5b69f))
* **workflow:** correct showApiError import path — @/lib/api-error → @/lib/errors ([4e02f89](https://github.com/Patricoaa/ERPGrafico/commit/4e02f891e80a1b83ee2c873ec8355d9df7be17a4))
* **workflow:** split import - mutations belong to useWorkflowMutations, not useWorkflowQueries ([3958926](https://github.com/Patricoaa/ERPGrafico/commit/3958926f24152a7ef8c7b54b6c61fa25a89b4ab4))
* **workflow:** TaskInbox imports useUpdateTask from useWorkflowMutations, not useWorkflowQueries ([fc98266](https://github.com/Patricoaa/ERPGrafico/commit/fc982662f7a95e848419f8561ca17b6a1819fbb0))

### [0.1.20](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.19...v0.1.20) (2026-05-13)

### [0.1.19](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.18...v0.1.19) (2026-05-13)


### ✨ Features

* refactor mayor de Datatable ([d62dda0](https://github.com/Patricoaa/ERPGrafico/commit/d62dda0f9d694356f841231a7d79e168364b4c8e))

### [0.1.18](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.17...v0.1.18) (2026-05-11)


### ✨ Features

* Adit & docs ([a67fea1](https://github.com/Patricoaa/ERPGrafico/commit/a67fea17f3dbf1927a300a696e75c2c8a20649d7))
* ajustes backend ([c049030](https://github.com/Patricoaa/ERPGrafico/commit/c04903092a8fc56d779628def3c3e522118e1109))
* estandarizacion de iconos por entidad ([8fd0883](https://github.com/Patricoaa/ERPGrafico/commit/8fd088378771aacc4e57ed046268f437af73349e))
* Phase 1 ([62cd4a3](https://github.com/Patricoaa/ERPGrafico/commit/62cd4a340260285cbb77f160a81f4c9915c66f0e))
* Phase 4 ([9387cb9](https://github.com/Patricoaa/ERPGrafico/commit/9387cb91ec91673705bc3729556ffeadc87cddc3))
* Phase 5 ([cae76cb](https://github.com/Patricoaa/ERPGrafico/commit/cae76cbad4e2a0e539d20737271591b5255605e6))
* Phase 6 pt2 ([b04170d](https://github.com/Patricoaa/ERPGrafico/commit/b04170d091b2b93899b1c46bc5ce20429bdd1a31))
* Phase 8 ([8d83829](https://github.com/Patricoaa/ERPGrafico/commit/8d8382922bba9255b27f41cf171ee74f6b9696d8))
* Phase 9 ([368c29f](https://github.com/Patricoaa/ERPGrafico/commit/368c29f3ac973f5ba003f03839d05ffd56a167c6))

### [0.1.17](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.16...v0.1.17) (2026-05-07)

### ⚙️ Refactors

* **architecture:** document feature flags omission decision and big-bang rollback strategy in ADR-0017.
### [0.1.16](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.15...v0.1.16) (2026-05-07)


### ✨ Features

* ajuste de boton de config pageheader ([00daa06](https://github.com/Patricoaa/ERPGrafico/commit/00daa06a0def557bf2cb95c5a91b8a6463922fe0))
* sugerencias bidereccionales en reconciliación bancaria ([b0dcf77](https://github.com/Patricoaa/ERPGrafico/commit/b0dcf77ef40506ff8c241296478dd1faa2fcdbcc))

### [0.1.15](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.14...v0.1.15) (2026-05-07)


### ✨ Features

* skelleton refactor & reconcliation panel + ([8b8e601](https://github.com/Patricoaa/ERPGrafico/commit/8b8e601a7579b66504b47ed34f9b080cfa4ee781))

### [0.1.14](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.13...v0.1.14) (2026-05-07)


### ✨ Features

* ajuste de asgi ([caf500d](https://github.com/Patricoaa/ERPGrafico/commit/caf500da32a041c3151ee428b58b9159a6e6dcb5))

### [0.1.13](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.12...v0.1.13) (2026-05-07)

### [0.1.12](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.11...v0.1.12) (2026-05-07)


### ✨ Features

* autosave migration and  style guide deprecation ([db6529b](https://github.com/Patricoaa/ERPGrafico/commit/db6529bc7c74146eb6036b65ee8d20a76fc66fb9))

### [0.1.11](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.10...v0.1.11) (2026-05-07)

### [0.1.10](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.9...v0.1.10) (2026-05-07)

### [0.1.9](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.8...v0.1.9) (2026-05-07)

### [0.1.8](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.7...v0.1.8) (2026-05-07)

### [0.1.7](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.6...v0.1.7) (2026-05-07)

### [0.1.6](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.5...v0.1.6) (2026-05-06)


### ⚙️ Refactors

* standardize form layouts using LabeledContainer and LabeledInput components across production, sales, and finance modules ([558dbc8](https://github.com/Patricoaa/ERPGrafico/commit/558dbc8ffbea1c122cd85cd617e165a498c7f42b))

### [0.1.5](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.4...v0.1.5) (2026-05-06)


### 📚 Documentation

* add versioning policy guidelines for pre-1.0.0 development and transition to stable release ([9b71944](https://github.com/Patricoaa/ERPGrafico/commit/9b71944a6998aa1887141ad9a750e47b6b270db0))


### 🚀 Maintenance

* integrate standard-version for automated release management and changelog generation ([1f1063e](https://github.com/Patricoaa/ERPGrafico/commit/1f1063eb83cc2e7751901f3fe8eef4ab9bb9801b))
