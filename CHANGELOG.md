# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.2.0](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.23...v0.2.0) (2026-06-10)


### ⚠ BREAKING CHANGES

* **treasury:** deprecación definitiva de DEBIT_CARD/CHECKBOOK como tipos de cuenta

### 🧪 Testing

* **treasury:** gasto con tarjeta de crédito aumenta el pasivo (F3.1) ([977219f](https://github.com/Patricoaa/ERPGrafico/commit/977219f628db687faa2818a77a92c88dd0d0e20e))


### 🚀 Maintenance

* **treasury:** migración 0056 para bank_provisioned en TreasuryAccount y PaymentMethod ([bd9fa59](https://github.com/Patricoaa/ERPGrafico/commit/bd9fa594549e16fa711551923b26b61917e0d689))


### 📚 Documentation

* ADR-0036 Centro de Bancos + actualización fase 5 transversal — F5.5 ([df0d436](https://github.com/Patricoaa/ERPGrafico/commit/df0d43659ad5cf991ea1bb4461d1e8c2db1e8f30))
* **adr:** renumber loan-charges ADR 0042 → 0045 (collision with card P0) ([475c04b](https://github.com/Patricoaa/ERPGrafico/commit/475c04ba23866d262ea202a61c372561da2636a1))
* **architecture:** ADR-0038 seed del puente de Cheques en Cartera ([dac278e](https://github.com/Patricoaa/ERPGrafico/commit/dac278e6b38e5141fa32fdf4bf05464f0d504412))
* **bancos:** ADR-0033 + state-map + entity-identity + api-contracts (F2.13) ([2f71d7f](https://github.com/Patricoaa/ERPGrafico/commit/2f71d7f99b989e3587f05e9655b358947309bae5))
* **bancos:** avance Fase 1 (F1.3/F1.4/F1.5 hechos) + procedimiento F1.1 ([3c5a7fd](https://github.com/Patricoaa/ERPGrafico/commit/3c5a7fd0565db0144e9caaa33e5e2d25ed266309))
* **bancos:** objetivos, commits por fase y contratos del proyecto ([b1e5b25](https://github.com/Patricoaa/ERPGrafico/commit/b1e5b25e31d2866362fbf41304f2c6140b17ae36))
* **bancos:** registrar commit F1.2 (0fd14785) en tabla Avance ([4d28407](https://github.com/Patricoaa/ERPGrafico/commit/4d2840770368fc80978dd0d312542a97336d1cd4))
* **bancos:** registrar commits F2.1–F2.10 en tabla Avance (fase-2) ([8079cd4](https://github.com/Patricoaa/ERPGrafico/commit/8079cd4e66784a0d93e5d533b95f981758a963dc))
* **bancos:** roadmap completo de gestión bancaria (50-audit/bancos) ([edc4a28](https://github.com/Patricoaa/ERPGrafico/commit/edc4a28d68d31a47c1efb4e2ef0862484ac5a9d4))
* **legacy-migration:** documentación completa para importar 7.960 NVs desde ordenes_dump ([51d97c6](https://github.com/Patricoaa/ERPGrafico/commit/51d97c6181db68f2d47fd90e666acf2fe458e9b6))
* **treasury:** ADR-0034 tarjeta de crédito estado/pago + fase-3 completa ([b2ed0fc](https://github.com/Patricoaa/ERPGrafico/commit/b2ed0fc58bb19f02ea764f122d4a7342ff7b3615))
* **treasury:** ADR-0035 + state-map + fase-4 complete ([8febb22](https://github.com/Patricoaa/ERPGrafico/commit/8febb22370f1ffffd623d6017e1b22e6d5469264))
* **treasury:** ADR-0035 update with F4.4 CHECK orchestrator integration ([df0633d](https://github.com/Patricoaa/ERPGrafico/commit/df0633ded884cc4ebe349407c3b1d714f75ac49d))
* **treasury:** api-contracts F4.4 CHECK orchestrator params ([2b0f9f9](https://github.com/Patricoaa/ERPGrafico/commit/2b0f9f9cd19bd3aa39761f4d47439b8b1abd31d5))


### ⚙️ Refactors

* **drawer:** ActivitySidebar padding fix, NotchedButton, tabs border, barcode button ([9a40fdb](https://github.com/Patricoaa/ERPGrafico/commit/9a40fdb782151384d69dc86307c9ff5b2815eb87))
* move close button inside PanelHeader flex, normalize panel padding ([4652c8f](https://github.com/Patricoaa/ERPGrafico/commit/4652c8fb7d5d8661e47763aa0fe1ae5bc3d5e416))
* **pos-terminal:** uniformizar selector de métodos de pago y reflejarlos en la card view ([5a7e04d](https://github.com/Patricoaa/ERPGrafico/commit/5a7e04d60a8cef3e06e4640632b275ca1572409b))
* **sheet:** move panel-surface styles to base SheetContent, remove overrides and inner wrappers ([143ec6c](https://github.com/Patricoaa/ERPGrafico/commit/143ec6c043f183b2d3b2f87de3c215486735e381))
* **treasury:** BankManagement muestra overview por banco en tabla ([75acf31](https://github.com/Patricoaa/ERPGrafico/commit/75acf3135e852c44a5c7eb5bcbbc40f939e74f6c))
* **treasury:** cheque cleanup — remove endorsement (ADR-0039) + bounce/void invoice demotion (ADR-0040) + card view ([945db2c](https://github.com/Patricoaa/ERPGrafico/commit/945db2c8bede8f13c9856f9a7b5f3442bae4e2d8))
* **treasury:** compactar columnas de lista de préstamos y filtrar total desembolsado solo pagado ([6452c39](https://github.com/Patricoaa/ERPGrafico/commit/6452c39c3b29ae6d006f04119ff47342b69c08e6))
* **treasury:** deprecación definitiva de DEBIT_CARD/CHECKBOOK como tipos de cuenta ([0fd1478](https://github.com/Patricoaa/ERPGrafico/commit/0fd1478573555bb13636ccee1ba8eeb26902aed6))
* **treasury:** eliminar rutas antiguas y simplificar navegación ([42d5588](https://github.com/Patricoaa/ERPGrafico/commit/42d5588798eb3e4325ee352d27967a673a9d34c1))
* **treasury:** migrate bank routing to URL segments with full nav hierarchy ([f0ee027](https://github.com/Patricoaa/ERPGrafico/commit/f0ee027539b04a4982d517783e16fce173864741))
* **treasury:** normalizar Cheque como PaymentMethod real, eliminar POSTerminal.allows_check ([c41fd02](https://github.com/Patricoaa/ERPGrafico/commit/c41fd025bb3886c271ce4306a88448aaab459e39))
* **treasury:** remove monthly rate from credit card installments selector ([cf20ff2](https://github.com/Patricoaa/ERPGrafico/commit/cf20ff253fa6993a1ed5ccbef21f1e60101b40d2))
* **treasury:** remove refinancing, add editable payment amounts and PrepayLoanModal ([dd9a2a7](https://github.com/Patricoaa/ERPGrafico/commit/dd9a2a74649dfd6e0a9d5e3aa1e9e308b722e26f))
* **treasury:** remove StatCards from checks/loans/cards tabs and use full viewport height ([2cdf91c](https://github.com/Patricoaa/ERPGrafico/commit/2cdf91c8e4f4780f1a34da023fa102bc0251e365))
* unificar acciones 'view' y 'detail' en una sola con icono FileText ([55212f5](https://github.com/Patricoaa/ERPGrafico/commit/55212f5a3ae17b6aa10c71a36a518a8ddd0a5b6a))


### ✨ Features

* **accounting:** añadir cuentas puente de Cheque al CoA IFRS ([314099b](https://github.com/Patricoaa/ERPGrafico/commit/314099b307fe0e2717bb8dc70a1f28c5328a43c2))
* **cheques:** completar ciclo de vida de cheques propios y de terceros ([3384efc](https://github.com/Patricoaa/ERPGrafico/commit/3384efc628541c2e5b6477c1ee48143936aeb9d8))
* **cheques:** hardcodear método CHECK en ventas + control vía POS ([8a714cf](https://github.com/Patricoaa/ERPGrafico/commit/8a714cf396eb051635acf8433facbd55838e262e))
* **drawer:** alinear PaymentDrawer al patrón estándar y agregar mode prop a todos los CRUD drawers ([e229b93](https://github.com/Patricoaa/ERPGrafico/commit/e229b938fe18e6988ae9ca0f238919bfea232677))
* **drawer:** mejorar jerarquía visual de colores en drawers (dark/light) ([0d99392](https://github.com/Patricoaa/ERPGrafico/commit/0d9939209c71f17e7a7b3f0e62d385f3b03e71e1))
* **finances:** modelo IndicatorValue (UF/UTM/USD) + carga manual y feed ([8f88ced](https://github.com/Patricoaa/ERPGrafico/commit/8f88cedc6b9e39c00ed1e2ccc4e700ff79442ec0))
* **settings:** cuenta 'Cheques en Cartera' en panel de Tesorería ([484d58e](https://github.com/Patricoaa/ERPGrafico/commit/484d58ee7f89cf5b1050e57878441d89a0413779))
* **settings:** cuentas de gasto financiero (intereses, seguros) — F5.1 ([809c2c8](https://github.com/Patricoaa/ERPGrafico/commit/809c2c81f6e027a1db263c38865f569a11e2292e))
* **setup:** demo data con F5.1 + cuentas únicas + banco archivado + tarjeta ([2c7d0ec](https://github.com/Patricoaa/ERPGrafico/commit/2c7d0ecb1f7b72ca18c3d4b1e1083476d4f9a5f8))
* **treasury-ui:** mostrar próximas cuotas del cronograma en cargos no facturados ([686ebf0](https://github.com/Patricoaa/ERPGrafico/commit/686ebf0935a4a3c55566d830f5229b826891f27c))
* **treasury:** add card view + persistent toolbar/pagination to bank loans & cards ([5d38ac2](https://github.com/Patricoaa/ERPGrafico/commit/5d38ac2520e3cbd872f481652e2d7c144a78389b))
* **treasury:** add installments selector for credit card payments in hub ([82df777](https://github.com/Patricoaa/ERPGrafico/commit/82df777c0405b39fd16d2602a04560198931948a))
* **treasury:** agregar filtro desplegable 'Cargos del mes' / 'Todos los cargos' en vista de cargos no facturados ([4ad8638](https://github.com/Patricoaa/ERPGrafico/commit/4ad8638d22fe360d02e6c36b2870b9c30fdb9c61))
* **treasury:** agregar StatementsClientView para tarjetas de crédito ([5c89bf5](https://github.com/Patricoaa/ERPGrafico/commit/5c89bf514ebc99302917058788491e2b240367fe))
* **treasury:** API + UI estados de cuenta de tarjeta de crédito (F3.5) ([d4cc606](https://github.com/Patricoaa/ERPGrafico/commit/d4cc6060d226973719cc5d60728a541e1a9b579a))
* **treasury:** API REST de créditos bancarios (F2.11) ([b694177](https://github.com/Patricoaa/ERPGrafico/commit/b694177219c41e05a744227aa30e29eeb5011277))
* **treasury:** archive/restore de bancos con BankDeletionService ([f486a9a](https://github.com/Patricoaa/ERPGrafico/commit/f486a9a87f2f0c3a04f84e09d06e41006bcff822))
* **treasury:** assert post-creación en setup_demo_data para vínculo TUU ([70271f0](https://github.com/Patricoaa/ERPGrafico/commit/70271f0d557b96b62cd5b36f82c746a21c1a5df9))
* **treasury:** auto-crear cuenta BRIDGE en proveedor terminal + refactor ProviderDrawer ([97ab633](https://github.com/Patricoaa/ERPGrafico/commit/97ab633770ec137e7b9eef0571b8fe9e4d448a78))
* **treasury:** auto-provisión de la cuenta puente Cheques en Cartera ([bfd11ea](https://github.com/Patricoaa/ERPGrafico/commit/bfd11ea0f7c0e35291c2c4f71411a353c215d9df))
* **treasury:** bank center toolbar/pagination + reconciliation page overflow ([e6d228a](https://github.com/Patricoaa/ERPGrafico/commit/e6d228aca44535aa0020c1559c53aa9cb495faae))
* **treasury:** CardService — intereses/comisiones + pago del estado de cuenta (F3.3+F3.4) ([fa8b526](https://github.com/Patricoaa/ERPGrafico/commit/fa8b526b650b835f38e6c7adf936555f42834f19))
* **treasury:** cartera de cheques recibidos con cuenta puente ([47bf7a3](https://github.com/Patricoaa/ERPGrafico/commit/47bf7a3a7302b265b4cc41383c69517474f34632))
* **treasury:** Celery tasks para devengo de interés y alertas de cuotas (F2.9+F2.10) ([b397da0](https://github.com/Patricoaa/ERPGrafico/commit/b397da0d0cb321a5efe46c38d99777d9f070b010))
* **treasury:** Centro de Bancos — F5.2 ([9bf8fe7](https://github.com/Patricoaa/ERPGrafico/commit/9bf8fe7ec2411e3b2923c3d7676cd08980b7e01c))
* **treasury:** columnas Banco y Proveedor de Terminal en vista de cuentas ([e0cddb4](https://github.com/Patricoaa/ERPGrafico/commit/e0cddb4e4d65751bddcd0b3c57f88c221529d3f7))
* **treasury:** compras en tarjeta en cuotas con interés explícito (ADR-0043) ([ca3656a](https://github.com/Patricoaa/ERPGrafico/commit/ca3656ac8b5f2f5386cd1d43ff70f5c374afc9a1))
* **treasury:** configurable loan charges — opening fee, stamp tax, penalty (backend) ([e696c2a](https://github.com/Patricoaa/ERPGrafico/commit/e696c2a2efcb07d1995da746c4f1a7efdecf858a))
* **treasury:** DataTable amortización, balance cascade, prepago y modal readonly ([b6485b7](https://github.com/Patricoaa/ERPGrafico/commit/b6485b7eb3323014e41eb70cd8f6c880412c7008))
* **treasury:** dedicated LOAN treasury account type for loan liabilities (ADR-0041) ([271f707](https://github.com/Patricoaa/ERPGrafico/commit/271f707e31ef7ec185ec888d27dab204d07b015b))
* **treasury:** exponer terminal_providers en serializer de TreasuryAccount ([439d35a](https://github.com/Patricoaa/ERPGrafico/commit/439d35a3f6f54879e5941b6fbd9e7e81f27ce5b8))
* **treasury:** expose hidden config sub-tabs in nav ([1cbf4dc](https://github.com/Patricoaa/ERPGrafico/commit/1cbf4dc63ce7de6bf74784788d9079298924495d))
* **treasury:** F4.1+F4.2 emisión, cobro y endoso de cheques ([86401db](https://github.com/Patricoaa/ERPGrafico/commit/86401dbaa96aa8be1241b6ff0ef28b8be789579c))
* **treasury:** F4.3 chequera con folios correlativos ([82b3409](https://github.com/Patricoaa/ERPGrafico/commit/82b34095d9b6bfbce80e158a5f760ff52a64c013))
* **treasury:** F4.4 integración del método CHECK crea entidad Check ([8139c46](https://github.com/Patricoaa/ERPGrafico/commit/8139c46a24902c0728851bedec32b88fb8554af0))
* **treasury:** F4.5 KPIs de cartera y depósitos en tránsito (UI) ([9ba8962](https://github.com/Patricoaa/ERPGrafico/commit/9ba89621e68b7a364aba1fc18ea62ee0e218bb92))
* **treasury:** F4.6 alertas Celery de cheques por vencer/en tránsito ([6de75b7](https://github.com/Patricoaa/ERPGrafico/commit/6de75b7656d9ca34f7ea9284b651026e14b6ecf8))
* **treasury:** facturación de cargos TC con desglose por grupo de compra + cuotas ([7e8e708](https://github.com/Patricoaa/ERPGrafico/commit/7e8e708319f42d67372f17499820531e537ab957))
* **treasury:** fusionar Banco y Proveedor en columna 'Entidad Externa' ([d55ee33](https://github.com/Patricoaa/ERPGrafico/commit/d55ee33047fe8a7ae97c8518d1a9f2a05d71db34))
* **treasury:** habilitar Cheque como método vendible en POS demo ([84b28e8](https://github.com/Patricoaa/ERPGrafico/commit/84b28e89bc6e7186a9e06327ed418ecacee9775c))
* **treasury:** integrate CREDIT_CARD method in payment selector for purchases ([e1b361c](https://github.com/Patricoaa/ERPGrafico/commit/e1b361caa1fb05bd0fd517aff1f521f2fbb9b0e4))
* **treasury:** loan charges UI + ADR-0042 (opening fee, stamp tax, penalty) ([6fbf02e](https://github.com/Patricoaa/ERPGrafico/commit/6fbf02e91f4250766892f01f87a6cc1858264f12))
* **treasury:** loan creation drawer UX ([03613a2](https://github.com/Patricoaa/ERPGrafico/commit/03613a217584ba6711f5c7ca6bd374a4ed367573))
* **treasury:** loan lifecycle improvements ([f49bbe2](https://github.com/Patricoaa/ERPGrafico/commit/f49bbe2cb5edfcabaef9e192a08005f55960b2ae))
* **treasury:** LoanDisburseDrawer with hybrid expense account override ([14c177a](https://github.com/Patricoaa/ERPGrafico/commit/14c177aa6f172210da9b91dc20e0acf9fcfeb60b))
* **treasury:** LoanService (amortización + desembolso + pago CLP/UF + prepago + refi) ([8b8f7bd](https://github.com/Patricoaa/ERPGrafico/commit/8b8f7bdd7abae43865f3be4bba2ba35310a858df))
* **treasury:** modelo CreditCardStatement + entity-registry (F3.2) ([85dc619](https://github.com/Patricoaa/ERPGrafico/commit/85dc6199a924ec55647e64508e1da95d6015c32d))
* **treasury:** modelos BankLoan + LoanInstallment (créditos bancarios) ([ace7a82](https://github.com/Patricoaa/ERPGrafico/commit/ace7a82fb3ad180ea62448c5b1fe8b20be64c3dc))
* **treasury:** P0 contable tarjeta de crédito (ADR-0042) ([1b39805](https://github.com/Patricoaa/ERPGrafico/commit/1b39805bcae70b6560b3df8636d33f25c821e140))
* **treasury:** pagos parciales e interés punitorio tarjeta (ADR-0044) ([66b3ded](https://github.com/Patricoaa/ERPGrafico/commit/66b3dedbb39e85917c31ec4b601445221756b749))
* **treasury:** pre-cablear AccountingSettings y mostrar puente de Cheque en seed ([6f0df73](https://github.com/Patricoaa/ERPGrafico/commit/6f0df73aeda8b51fdc0388a94e6ceae5ce5b8daf))
* **treasury:** proyección de flujo de caja con vencimientos + alerta unificada — F5.3/F5.4 ([b706b3d](https://github.com/Patricoaa/ERPGrafico/commit/b706b3d3b7d89938978bcb0013501cdfd294f994))
* **treasury:** reestructuración Centro de Bancos y mejoras de UX ([57556ad](https://github.com/Patricoaa/ERPGrafico/commit/57556ad500742551e9b33cf0e75854e57d7266a6))
* **treasury:** reestructuración de navegación del módulo ([ef05583](https://github.com/Patricoaa/ERPGrafico/commit/ef055832cc1c58e8a3acb1873dffedcf3d628561))
* **treasury:** separar columnas ID/N° operación, agregar total desembolsado y cuota 0 ([db7f79f](https://github.com/Patricoaa/ERPGrafico/commit/db7f79f2ad1ea1d4899146bd688e0b0d852d3673))
* **treasury:** separar detalle de tabla amortización, agregar vista previa en creación ([c4452f6](https://github.com/Patricoaa/ERPGrafico/commit/c4452f6683104f376b97f3584301e19c5a4c230d))
* **treasury:** show estimated late-payment penalty in pay-installment modal ([d48f0b8](https://github.com/Patricoaa/ERPGrafico/commit/d48f0b892de54c5c102ae56263ada4215299b171))
* **treasury:** solicitar cuenta contable en wizard de creación de bancos ([2cbc5ff](https://github.com/Patricoaa/ERPGrafico/commit/2cbc5ff910854c1606dbde563f4aeee893263f4f))
* **treasury:** tarjeta de crédito propia como cuenta de pasivo ([294c15e](https://github.com/Patricoaa/ERPGrafico/commit/294c15e8a8dbadbcf3690ff909945e07723b093c))
* **treasury:** taxonomía de dos capas — cuentas vs formas de pago ([0c06473](https://github.com/Patricoaa/ERPGrafico/commit/0c064735433bca2e4a58d7fe5fe197940d82461b))
* **treasury:** TC uso = 1 movimiento/asiento + cuotas vía statement (ADR-0046) ([56c68a3](https://github.com/Patricoaa/ERPGrafico/commit/56c68a3a2f26df5f9604b6372112466a9a5ac040))
* **treasury:** UI de archive/restore para bancos ([cb44f83](https://github.com/Patricoaa/ERPGrafico/commit/cb44f83c24925ac9f19aa34d90004c790750394f))
* **treasury:** UI de créditos bancarios (F2.12) ([a11b9de](https://github.com/Patricoaa/ERPGrafico/commit/a11b9de2fa60cf20e54429a683a5a83d213a44c9))


### 🐛 Bug Fixes

* **JournalEntryDrawer:** ocultar add/delete/hover en modo readonly, fondo muted en inputs disabled ([0c4c971](https://github.com/Patricoaa/ERPGrafico/commit/0c4c971886d965bd2f8998db0e0ddca3cf7f3d6e))
* mejorar registro de cheques — check_bank_id en checkout compras, validaciones y serializer ([c311c03](https://github.com/Patricoaa/ERPGrafico/commit/c311c03fbe951a09d9d75a4997eaa65df256a27a))
* **pos:** habilitar selección de Cheque en checkout sin exigir cuenta de tesorería ([864f0d8](https://github.com/Patricoaa/ERPGrafico/commit/864f0d8e72010929b6b38cd690b88959c32a6efa))
* resolve POS blank screen on new tab ([cb834e2](https://github.com/Patricoaa/ERPGrafico/commit/cb834e26e627d01ee95fec020fd4ef75b106d489))
* **shared:** remove max-w constraint from EmptyState description to allow multi-line text ([a0c0bc2](https://github.com/Patricoaa/ERPGrafico/commit/a0c0bc27dcbfd7cbb084bb3095e1c5bdcbc83799))
* **treasury+infra:** enable test suite execution for Onda 3 ([eff7aae](https://github.com/Patricoaa/ERPGrafico/commit/eff7aae5ee9f10380b84d1b93696668eb6a8b9fb))
* **treasury:** add migration 0059 convert merchant to bridge ([6d0afb8](https://github.com/Patricoaa/ERPGrafico/commit/6d0afb8ed223836e772db72333ca378131670cea))
* **treasury:** asegurar altura completa en todas las vistas de tesorería ([f890f72](https://github.com/Patricoaa/ERPGrafico/commit/f890f7230adf8fd529c3dff6a1e0855ff95015bc))
* **treasury:** auditar y auto-reparar vínculo proveedor↔cuenta puente ([b5a079c](https://github.com/Patricoaa/ERPGrafico/commit/b5a079c23088d9240d27eae65e646d60aa5f6744))
* **treasury:** book balanced disbursement entry for bank loans ([e89691c](https://github.com/Patricoaa/ERPGrafico/commit/e89691ca605c94805577ee578fa5fbe1084a9996))
* **treasury:** correct bank overview total_loan_debt aggregation ([1c9efe7](https://github.com/Patricoaa/ERPGrafico/commit/1c9efe73c81a8f2339b37741a31aede7420345d9))
* **treasury:** corregir asientos contables del ciclo de compra con TC ([900c544](https://github.com/Patricoaa/ERPGrafico/commit/900c544908e2e7c6d2eba2ee0493c34e94b39a74))
* **treasury:** corregir wizard de banco y dropdown MultiSelect en modales ([4b4d670](https://github.com/Patricoaa/ERPGrafico/commit/4b4d67011962b5aa1edea33f0b9073a6a8038518))
* **treasury:** credit card account selector + accounting entries ([6a728b6](https://github.com/Patricoaa/ERPGrafico/commit/6a728b64bea88d5c639f8bc8f9bfa1d0771427ee))
* **treasury:** eliminar tipo MERCHANT (Cuenta Recaudadora) ([a7185bb](https://github.com/Patricoaa/ERPGrafico/commit/a7185bb6fea173a9ec69d0407fa50742ce72f987))
* **treasury:** empty Select.Item value in loan modals ([1ac249a](https://github.com/Patricoaa/ERPGrafico/commit/1ac249a16aa25874f2d4a64f43c0c1703df726d4))
* **treasury:** exponer bank_treasury_account en ProviderDrawer ([5df1a1b](https://github.com/Patricoaa/ERPGrafico/commit/5df1a1b620cdac2fe034b1e2d3c0d9ca81266f5c))
* **treasury:** fix editable inputs and modal footer placement ([a6a299d](https://github.com/Patricoaa/ERPGrafico/commit/a6a299d3fbfb3e7b534d79c835614748fa8c8d64))
* **treasury:** invalidate allowed-payment-methods cache after PaymentMethod create/update/delete ([87486d4](https://github.com/Patricoaa/ERPGrafico/commit/87486d4b56f2a7bf24dc4981c67e27eb6d9cadff))
* **treasury:** keep loan journal entries balanced in whole pesos ([ab6e826](https://github.com/Patricoaa/ERPGrafico/commit/ab6e8268b38c6ed256a810cc525ebf5c5c23d148))
* **treasury:** migración 0057 — db_default en bank_provisioned ([5b624f1](https://github.com/Patricoaa/ERPGrafico/commit/5b624f14eaa233449837f438d5a6740cfbccd4ff))
* **treasury:** move tax amount before JournalItem creation to prevent unbalanced entries ([c46f624](https://github.com/Patricoaa/ERPGrafico/commit/c46f6249a6da7ada1f6abc59a232df279220d782))
* **treasury:** normalizar date string en create_card_purchase ([3a79d4e](https://github.com/Patricoaa/ERPGrafico/commit/3a79d4e5760d90e9955d55e1714cb8b06590464e))
* **treasury:** pasar provider completo al EntityBadge → view-mode drawer ([08de7b7](https://github.com/Patricoaa/ERPGrafico/commit/08de7b716dcc5a0000e5cc8d633e40345bb37081))
* **treasury:** registrar treasury.check en ENTITY_REGISTRY + state-map ([6a3b16a](https://github.com/Patricoaa/ERPGrafico/commit/6a3b16af7285cb77eb2d7f40983457fce721ab1a))
* **treasury:** remove duplicate 'Tipo' column from accounts table ([f013ab5](https://github.com/Patricoaa/ERPGrafico/commit/f013ab5ed6d5d84192d0e43d3f805073d78f6c45))
* **treasury:** separar filtro del toolbar de botones de accion ([8112662](https://github.com/Patricoaa/ERPGrafico/commit/81126622de63027925926d01a8f8287757d2e727))
* **treasury:** Style.NOTCHANGING → Style.NOTICE en audit command ([fcbeab5](https://github.com/Patricoaa/ERPGrafico/commit/fcbeab50246d11958c512a2f3f0f180d5b1d6cb1))
* **treasury:** unificar cuotas y cargos no facturados en un solo DataTableView + filtrar preview por cut_off_date ([f3b2d53](https://github.com/Patricoaa/ERPGrafico/commit/f3b2d53081643b896e8cb41210a7646cc30c83df))
* **treasury:** usar rightButtonGroupAction en vez de createAction para consistencia visual con toolbar ([b00632a](https://github.com/Patricoaa/ERPGrafico/commit/b00632a60bdadc7be65c4374d0d46d2b476871bf))
* **treasury:** wizard de bancos — cuenta contable obligatoria e idempotencia ([68f4b63](https://github.com/Patricoaa/ERPGrafico/commit/68f4b63aaa1dc14a13dac12022fa741bf423eb12))
* **ui:** eliminar opacidad en disabled state, mantener texto a color completo ([7b70457](https://github.com/Patricoaa/ERPGrafico/commit/7b70457260274ccb4ea31a74597d7fad186c14e0))
* **ui:** estandarizar bordes, sombras y radius en toolbar del DataTable ([fe6f747](https://github.com/Patricoaa/ERPGrafico/commit/fe6f747e11ac1a21167ff80b48f5bc473c7ad7ce))
* **ui:** use --muted for notched-field background to create proper input/surface hierarchy ([d48820d](https://github.com/Patricoaa/ERPGrafico/commit/d48820d89dfb41c395994cffbd6b83fe047a5ee5))
* unify MoneyDisplay usage — remove anti-patterns and redundant props ([7585605](https://github.com/Patricoaa/ERPGrafico/commit/75856056c1e47650f77eec1ea96ed81d5e4c92f2))

### [0.1.23](https://github.com/Patricoaa/ERPGrafico/compare/v0.1.22...v0.1.23) (2026-06-02)


### ✨ Features

* **search:** texto libre sin prefijo + sugerencia de búsqueda general ([b835f4f](https://github.com/Patricoaa/ERPGrafico/commit/b835f4fe45c9a9b3a24b1a013f1c0eea2f1fe524))

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
