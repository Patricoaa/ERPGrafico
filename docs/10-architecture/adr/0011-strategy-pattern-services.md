# ADR 0011: Adopción del Patrón Strategy y Service Layer (Refactor Fase 3)

**Fecha:** 2026-05-07  
**Estado:** Propuesto / Aceptado  
**Autores:** Equipo de Arquitectura ERPGrafico  

## Contexto y Problema

A medida que el ERP creció, la lógica de negocio comenzó a acumularse dentro de los métodos de modelo (`save()`, propiedades calculadas) y en funciones utilitarias dispersas, generando los siguientes anti-patrones:

1. **Fat Models y Side Effects:**
   Modelos como `Contact` y `StockMove` sobrecargaban su método `save()` con lógicas acopladas (e.g. invalidación de caché cruzado, creación de cuentas contables, cálculo de reglas de exclusividad `is_default_customer`). Esto dificultaba los tests y provocaba consultas a la base de datos no intencionales y recursivas en escenarios complejos.
2. **If/Elif/Else de Strings ("String typing"):**
   En áreas fundamentales como la generación de documentos tributarios electrónicos (`DTE`) y el cálculo de subtotales/totales contables, existían bloques masivos de `if/elif` chequeando tipos de documentos mediante comparaciones de strings (`if type == 'FACTURA_ELECTRONICA'`). Esto violaba el principio Open/Closed (OCP), haciendo frágil cualquier adición de nuevos tipos de documentos.

## Decisión

Para solucionar esta acumulación de deuda técnica, introducimos formalmente y adoptamos los siguientes patrones arquitectónicos en la Fase 3 de refactorización:

### 1. Strategy Pattern (Patrón Estrategia)

- **Cálculo de Totales (`TotalsStrategy`):** Introdujimos estrategias polimórficas (como `PurchaseTotalsStrategy`, `SaleTotalsStrategy`) para encapsular las reglas algorítmicas del cálculo financiero, eliminando los bloques de condicionales.
- **Generación de DTE (`DTEStrategy`):** Implementamos un ABC `DTEStrategy` con estrategias concretas (`FacturaElectronicaStrategy`, `BoletaElectronicaStrategy`, etc.), moviendo todo el mapeo de XML y validación tributaria al patrón, lo que nos permite escalar fácilmente al formato SII chileno u otros esquemas sin modificar la clase base.

*Regla impuesta mediante AST Tests:* Cualquier switch basado en comparaciones hardcodeadas de tipos de documento fallará la suite de tests de arquitectura estática.

### 2. Capa de Servicios (Service Layer)

- **Aislamiento de Reglas de Negocio:** Se extrajo la orquestación contable de los socios comerciales del `Contact.save()` hacia el nuevo `ContactPartnerService`. Esto encapsula las reglas de negocio, permitiendo instanciar y usar un `Contact` en memoria (o base de datos limpia en testing) sin arrastrar su lógica colateral, excepto cuando la acción de "Promoción/Degradación de Socio" se solicita de manera explícita (vía endpoints o commands).

### 3. Extraer Invalidación y Efectos Colaterales de Entidad a Signals

- En lugar de ensuciar el método `.save()` con llamadas a cache o lógicas de exclusividad ajenas al estado de la entidad per sé, se implementaron signals `post_save` y `post_delete` (Ej: `accounting.signals`, `inventory.signals`, `sales.signals`, `treasury.signals`).
- Esto sigue el patrón de separación de "Persistencia" vs "Reacción de dominio", manteniendo a las Entidades enfocadas solo en la gestión y validación de su propia data.

## Consecuencias

### Positivas
- **Tests unitarios aislados:** Ya no es necesario inicializar el módulo completo de Contabilidad (`AccountingSettings`) para poder persistir un contacto en un test unitario no relacionado.
- **Principio Open/Closed Restablecido:** Añadir un nuevo documento tributario es tan simple como declarar un nuevo hijo de `DTEStrategy` y registrarlo, sin alterar el núcleo de `billing`.
- **Desacople Cache/Modelo:** Los módulos ya no dependen circularmente del `core.cache` desde dentro de los archivos `models.py`.

### Negativas / Consideraciones
- **Mayor cantidad de clases y archivos:** La curva de aprendizaje inicial implica comprender los patrones de Inyección de Dependencia o Instanciación de Servicios en vistas (Views/ViewSets) en lugar de simplemente llamar `.save()`.
- **Registro de Signals:** Requiere la disciplina de registrar correctamente los módulos `signals.py` en el `AppConfig.ready()`, o los efectos secundarios de negocio (como el cache o la creación auto) no se dispararán silenciosamente.

## Alternativas Consideradas

- **Observer Pattern sobre la entidad:** Descartado a favor de las Signals de Django que ya proveen este mecanismo de forma nativa e idónea para hooks a nivel de base de datos.
- **Fat Services (Script de Transacción Universal):** Se decidió que el `Strategy` es superior al `Service` monolítico porque permite enrutar de forma O(1) vía Factory sin la verbosidad de una clase inflada que contenga de todos modos docenas de métodos privados (como antes ocurría con `AccountingMapper`).
