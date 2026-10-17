# AUDITORÍA ESPECIALIZADA: MODELO DOCUMENTAL, RELACIONES Y NAVEGACIÓN DEL ERP

## Rol

Actúa como arquitecto de software especializado en ERP, modelado de documentos empresariales, grafos de relaciones, navegación contextual y arquitectura de interfaces para aplicaciones complejas.

Estás trabajando sobre un ERP desarrollado desde cero, cuyo código ha evolucionado orgánicamente. No existe necesariamente un modelo documental uniforme ni una arquitectura de navegación consistente.

Tu misión no es auditar todo el ERP. Debes descubrir cómo funciona actualmente su sistema documental y determinar cómo evolucionarlo hacia una solución coherente, reutilizable y navegable.

## Objetivo principal

Auditar y documentar cinco aspectos:

1. Qué documentos y entidades existen realmente.
2. Cómo se relacionan entre sí y cómo se implementan esas relaciones.
3. Qué inconsistencias o limitaciones existen en el modelo documental.
4. Cómo se implementan actualmente la ficha documental y la navegación entre documentos en la UI.
5. Qué arquitectura y plan de migración permitirían implementar una experiencia documental unificada sin reconstruir innecesariamente el sistema.

El resultado debe permitir tomar decisiones de arquitectura y posteriormente implementar los cambios de forma incremental.

## Restricciones

Durante la auditoría, trabaja en modo de solo lectura.

No modifiques código, esquemas, datos, dependencias ni configuración. No ejecutes migraciones ni operaciones destructivas.

Puedes inspeccionar el código, los esquemas y las migraciones existentes, las rutas, los componentes, las consultas y las pruebas. No accedas a producción ni ejecutes consultas que puedan alterar datos.

No asumas tecnologías, nombres de módulos ni estructuras que no hayas encontrado.

Cada conclusión importante debe incluir evidencia del repositorio: archivo, símbolo y líneas cuando sea posible.

Distingue entre relaciones confirmadas por el código, relaciones observadas en datos de prueba, relaciones inferidas y relaciones que no pueden verificarse.

No confundas la existencia de una relación en la base de datos con su implementación en la interfaz, ni la existencia de un enlace visual con una relación de negocio correctamente modelada.

---

# FASE 1. INVENTARIO Y RECONSTRUCCIÓN DE DOCUMENTOS

## 1.1. Descubrir los tipos documentales

Inspecciona el repositorio para localizar todos los tipos de documentos y objetos de negocio que participan en operaciones empresariales.

Busca en:

- Modelos, clases, tipos e interfaces.
- Esquemas de base de datos y migraciones.
- Servicios y repositorios.
- Controladores, endpoints y consultas.
- Páginas, rutas y componentes de detalle.
- Formularios de creación y edición.
- Listados y búsquedas.
- Referencias explícitas e implícitas entre entidades.

No dependas únicamente de los nombres de archivo. Sigue las referencias desde la UI hasta la persistencia y viceversa.

Clasifica los objetos identificados en categorías apropiadas al proyecto, como:

- Documentos transaccionales.
- Documentos de origen o derivados.
- Entidades maestras.
- Registros contables.
- Pagos y conciliaciones.
- Eventos e historial.
- Adjuntos.
- Otros objetos que intervengan en relaciones documentales.

Estas categorías son orientativas; adapta la clasificación al sistema real.

## 1.2. Ficha técnica de cada documento

Para cada tipo documental encontrado, registra:

- Nombre técnico.
- Nombre funcional.
- Módulo al que pertenece.
- Modelo o esquema.
- Tabla o mecanismo de persistencia.
- Identificador y número visible.
- Campos que determinan identidad, estado y fechas.
- Estados y transiciones identificables.
- Relaciones de entrada y salida.
- Referencias a entidades maestras.
- Referencias a otros documentos.
- Implementación de creación, consulta, actualización y anulación, cuando exista.
- Ruta de la ficha en la UI.
- Componentes utilizados para mostrarlo.
- Mecanismo utilizado para navegar hacia él.
- Nivel de confianza del análisis.

No inventes campos ni completes información desconocida mediante suposiciones.

## 1.3. Detectar patrones documentales

Determina si existen convenciones comunes entre los documentos o si cada módulo implementa su propia solución.

Busca diferencias en:

- Identificadores.
- Números visibles.
- Estados.
- Campos de referencia.
- Nombres de propiedades.
- Estructura de líneas.
- Metadatos.
- Historial.
- Acciones.
- Rutas.
- Componentes de detalle.

Identifica qué patrones ya son reutilizables y cuáles están duplicados o son incompatibles.

### Entregable 1

`docs/50-audit/documntal/documents-inventory.md`

Debe incluir el inventario documental, sus características y las evidencias que sustentan cada identificación.

---

# FASE 2. MAPEO DE RELACIONES DOCUMENTALES

Esta fase tiene prioridad sobre las demás.

## 2.1. Descubrir todas las relaciones existentes

Reconstruye las relaciones a partir de:

- Claves foráneas.
- Campos de referencia.
- Tablas intermedias.
- Relaciones ORM, si existen.
- Consultas y joins.
- Servicios que crean documentos relacionados.
- Operaciones que copian información de documentos anteriores.
- Referencias entre líneas.
- Asociaciones que se calculan dinámicamente.
- Enlaces y consultas de la UI.

Distingue las relaciones persistidas de las relaciones calculadas o inferidas.

No consideres una relación confirmada únicamente porque dos documentos compartan un cliente, proveedor o producto.

## 2.2. Clasificar semánticamente las relaciones

Para cada relación, determina qué significado tiene realmente:

- Derivación: un documento se origina a partir de otro.
- Cumplimiento: un documento ejecuta una obligación anterior.
- Referencia: un documento cita otro.
- Liquidación o conciliación: un documento registra una compensación o pago.
- Contabilización: una operación se refleja en registros contables.
- Corrección o reversión: un documento corrige los efectos de otro.
- Asociación: dos objetos están relacionados sin que uno derive del otro.

Añade otras categorías cuando el dominio lo requiera.

No asignes una semántica basándote solo en el nombre del campo. Comprueba cómo se crea, consulta y utiliza la relación.

## 2.3. Analizar cardinalidad y granularidad

Para cada relación, determina:

- Tipo de objeto de origen.
- Tipo de objeto de destino.
- Cardinalidad.
- Dirección semántica.
- Si es opcional u obligatoria.
- Si puede haber varios documentos de origen.
- Si se relacionan documentos completos o líneas específicas.
- Si existe una cantidad o importe asociado.
- Si hay relaciones parciales.
- Cómo se manejan las cancelaciones y reversiones.
- Si la relación tiene historial o metadatos propios.

Investiga especialmente casos como:

- Un pedido que genera varias entregas.
- Varias entregas que se facturan en una factura.
- Una factura liquidada por varios pagos.
- Un pago que se distribuye entre varias facturas.
- Una nota de crédito que corrige una factura.
- Un documento que genera uno o varios asientos contables.

Son ejemplos para comprobar cuando correspondan; no presupongas que están implementados.

## 2.4. Detectar problemas de integridad documental

Busca evidencia de:

- Referencias inexistentes.
- Relaciones huérfanas.
- Relaciones duplicadas.
- Relaciones que se almacenan de varias formas incompatibles.
- Relaciones implícitas difíciles de reconstruir.
- Pérdida de la relación entre documentos derivados.
- Relaciones que solo existen en la UI.
- Relaciones que solo se calculan en consultas.
- Referencias a documentos borrados o anulados.
- Inconsistencias entre cabeceras y líneas.
- Ausencia de trazabilidad para correcciones.
- Ambigüedad entre asociación y derivación.

No ejecutes reparaciones ni modifiques datos.

Si no puedes inspeccionar datos reales, limita las conclusiones al esquema, al código y a las pruebas disponibles. No afirmes que existen registros huérfanos sin haberlo comprobado.

## 2.5. Construir el grafo documental actual

Construye una representación de:

- Tipos de documentos como nodos tipados.
- Relaciones semánticas como aristas.
- Cardinalidad.
- Ubicación de la implementación.
- Grado de completitud.
- Problemas detectados.

Produce dos vistas:

A. Grafo de tipos documentales: muestra qué tipos de documentos pueden relacionarse.

B. Mapa de implementación: muestra dónde se define, persiste, crea, consulta y presenta cada relación.

No intentes generar un grafo de todas las transacciones reales si el volumen no lo permite. Prioriza el modelo estructural y los flujos representativos.

### Entregables 2

- `ddocs/50-audit/documntal/document-relations-matrix.md`
- `docs/50-audit/documntal/document-graph.md`
- `docs/50-audit/documntal/document-integrity-findings.md`

La matriz debe incluir origen, destino, semántica, cardinalidad, persistencia, creación, consulta, presentación en UI y estado de la evidencia.

---

# FASE 3. AUDITORÍA DE LA UI DOCUMENTAL Y NAVEGABILIDAD

El propósito de esta fase es determinar cómo experimenta actualmente un usuario las relaciones identificadas.

## 3.1. Inventariar las fichas documentales

Para cada tipo de documento, identifica:

- Ruta.
- Página o componente principal.
- Layout.
- Encabezado.
- Identificación y estado.
- Acciones disponibles.
- Secciones de contenido.
- Tabla de líneas.
- Secciones de relaciones.
- Historial.
- Enlaces a otros documentos.
- Componentes reutilizados.
- Diferencias respecto de otros documentos.

Determina si existe una ficha documental común o si cada tipo implementa su propia estructura.

## 3.2. Reconstruir los recorridos de navegación

Sigue los recorridos reales implementados en el código.

Para cada flujo documental representativo, identifica:

- Desde dónde se abre el primer documento.
- Cómo se llega a sus documentos de origen.
- Cómo se accede a documentos derivados.
- Cómo se consultan las relaciones laterales.
- Si existe navegación de vuelta.
- Si se conserva el contexto.
- Si hay enlaces rotos o rutas inconsistentes.
- Cuántas pantallas intermedias se requieren.
- Si el usuario debe volver a listados o realizar búsquedas manuales.

No inventes métricas de clics ni de rendimiento. Si no puedes ejecutar el flujo, describe el recorrido estático y marca la limitación.

## 3.3. Evaluar los patrones de navegación existentes

Examina la implementación de:

- Navegación entre módulos.
- Breadcrumbs.
- Enlaces profundos.
- Búsqueda global.
- Listados de documentos relacionados.
- Paneles laterales.
- Diálogos.
- Historial.
- Navegación de vuelta.
- Filtros persistentes.
- Acciones contextuales.

Clasifica cada patrón como:

- Correcto y reutilizable.
- Funcional, pero inconsistente.
- Duplicado.
- Incompleto.
- Ausente.
- No verificable.

## 3.4. Analizar la experiencia contextual

Comprueba si, al abrir un documento relacionado, el sistema permite entender:

- Qué documento es.
- Por qué está relacionado.
- Qué relación existe.
- Cuál es su estado.
- Qué operación lo originó.
- Cómo regresar al contexto anterior.

Identifica dónde se pierde esa información.

### Entregable 3

`docs/50-audit/documntal/document-navigation-audit.md`

Debe incluir el inventario de fichas, los patrones existentes, recorridos documentales y problemas de navegación respaldados por código.

---

# FASE 4. DEFINIR LA ARQUITECTURA DOCUMENTAL OBJETIVO

Esta fase debe derivarse de los hallazgos anteriores.

No implementes todavía la solución.

## 4.1. Definir la identidad documental común

Evalúa si conviene establecer un contrato común de navegación con información como:

- Tipo documental.
- Identificador interno.
- Número visible.
- Título.
- Estado.
- Fecha relevante.
- Módulo.
- Ruta canónica.
- Metadatos mínimos de presentación.
- Permisos de consulta y acciones disponibles.

Determina qué atributos deben ser universales y cuáles deben permanecer específicos del tipo documental.

Evalúa alternativas sin presuponer una única tabla o clase base:

- Modelos específicos con un registro de tipos documentales.
- Servicios comunes de resolución documental.
- Capa de navegación que unifique modelos existentes.
- Entidad documental centralizada.
- Arquitectura híbrida.

Selecciona una opción y justifica por qué se adapta al código existente.

## 4.2. Definir la capa de relaciones

Propón un contrato para consultar relaciones documentales que permita:

- Obtener relaciones entrantes y salientes.
- Filtrar por tipo de relación.
- Consultar los metadatos necesarios.
- Resolver cada extremo a su documento.
- Identificar relaciones entre líneas.
- Distinguir asociaciones de dependencias.
- Aplicar permisos.
- Paginar o limitar resultados.
- Detectar referencias no resolubles.
- Mantener la compatibilidad con las relaciones existentes.

Determina si se necesita una nueva entidad de relación o si el modelo actual puede normalizarse mediante servicios y adaptadores.

No introduzcas una tabla genérica de relaciones sin evaluar primero las restricciones del dominio y de la persistencia existente.

## 4.3. Definir la ficha documental común

Diseña un patrón de ficha que combine:

1. Encabezado con tipo, número, estado e información contextual.
2. Resumen con los datos más relevantes.
3. Acciones válidas para el estado actual.
4. Contenido específico del documento.
5. Documentos relacionados.
6. Historial y trazabilidad.
7. Información contable o logística cuando corresponda.

Determina qué partes pueden reutilizarse como componentes y cuáles necesitan implementaciones específicas.

## 4.4. Definir las vistas de relaciones

Compara las siguientes alternativas:

- Tabla de documentos relacionados.
- Línea de tiempo.
- Flujo de proceso.
- Grafo navegable.
- Panel lateral de inspección.

Especifica en qué escenarios utilizar cada una.

La tabla debe ser la candidata predeterminada para relaciones documentales operativas, salvo que la evidencia justifique otra opción.

El grafo debe resolver problemas reales de relaciones complejas y no ser una visualización decorativa.

## 4.5. Definir la navegación canónica

Especifica:

- Convención de rutas.
- Resolución de documentos por tipo e identificador.
- Apertura desde relaciones.
- Navegación de vuelta.
- Preservación del contexto.
- Manejo de documentos eliminados, anulados o inaccesibles.
- Permisos y errores.
- Integración con búsqueda global.
- Compatibilidad con rutas existentes.

No propongas cambios de rutas sin identificar sus consumidores actuales y su impacto.

### Entregable 4

`docs/50-audit/documntal/arget-document-architecture.md`

Incluye contratos conceptuales, diagramas, decisiones, alternativas descartadas y dependencias respecto de los modelos existentes.

---

# FASE 5. BRECHAS Y PLAN DE MIGRACIÓN

Compara explícitamente el estado actual con la arquitectura documental propuesta.

Para cada brecha, documenta:

- Identificador.
- Problema confirmado.
- Evidencia.
- Documentos y módulos afectados.
- Causa raíz.
- Solución propuesta.
- Cambios necesarios en datos.
- Cambios necesarios en lógica de negocio.
- Cambios necesarios en UI.
- Dependencias.
- Riesgos.
- Esfuerzo relativo.
- Criterio de aceptación.
- Estrategia de reversión.

Prioriza las brechas que impiden resolver relaciones, garantizar integridad o navegar de forma coherente.

Distingue entre:

- Mejoras que solo requieren cambios de UI.
- Mejoras que requieren servicios comunes.
- Mejoras que requieren modificar modelos o consultas.
- Mejoras que requieren migraciones de datos.
- Mejoras que requieren redefinir reglas de negocio.

## Estrategia de implementación

Propón una migración incremental que:

1. Preserve el funcionamiento existente.
2. Evite una reescritura total.
3. Introduzca primero los contratos comunes necesarios.
4. Permita adaptar gradualmente los módulos antiguos.
5. Migre un flujo documental representativo de extremo a extremo.
6. Valide las relaciones y la navegación antes de extender el patrón.
7. Retire implementaciones antiguas únicamente cuando exista evidencia de que ya no se necesitan.

Selecciona un flujo piloto a partir del repositorio real y explica por qué es adecuado.

Define criterios de aceptación verificables para el modelo documental, las relaciones, las fichas y la navegación.

No ejecutes la migración durante esta auditoría.

### Entregable 5

`docs/50-audit/documntal/document-migration-roadmap.md`

---

# FASE 6. CONSOLIDACIÓN Y REVISIÓN DE RESULTADOS

Genera un informe final breve, orientado a tomar decisiones.

Debe responder:

1. ¿Qué tipos de documentos existen?
2. ¿Cómo se representan actualmente sus relaciones?
3. ¿Qué relaciones están bien implementadas y cuáles presentan problemas?
4. ¿Cómo navega actualmente el usuario entre documentos?
5. ¿Qué componentes y patrones de UI pueden reutilizarse?
6. ¿Qué limitaciones estructurales impiden una navegación documental consistente?
7. ¿Qué arquitectura común conviene introducir?
8. ¿Qué cambios deben hacerse primero y cuáles pueden esperar?
9. ¿Cuál es el flujo piloto recomendado?
10. ¿Cómo se validará que la solución final funciona?

Incluye:

- Resumen ejecutivo.
- Grafo documental actual.
- Matriz de relaciones.
- Mapa de navegación actual.
- Arquitectura documental objetivo.
- Registro priorizado de brechas.
- Plan de migración.
- Decisiones pendientes de información adicional.

Guarda el informe en:

`docs/50-audit/documntal/document-system-assessment.md`

Antes de terminar, verifica que los informes sean coherentes entre sí, que no se presenten hipótesis como hechos y que las recomendaciones puedan vincularse a evidencia del repositorio.

## Orden de trabajo obligatorio

Primero completa las fases 1, 2 y 3. Solo entonces formula la arquitectura objetivo de la fase 4.

No diseñes la solución definitiva a partir de un inventario parcial.

No implementes ningún cambio hasta que el diagnóstico, la arquitectura propuesta y el plan de migración estén disponibles para revisión.

## Primera tarea

Comienza inspeccionando el repositorio y reconstruyendo el inventario documental.

Al terminar esa primera tarea, informa:

- Qué tipos documentales has identificado.
- Dónde están definidos y persistidos.
- Qué mecanismos de relación has encontrado.
- Qué archivos y módulos necesitas inspeccionar a continuación.

No realices modificaciones.

El principio rector de toda la auditoría es: comprender los documentos y sus relaciones reales antes de definir cómo deben conectarse y presentarse en la interfaz.
