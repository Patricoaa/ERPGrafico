# Estrategia de Pruebas — ERPGrafico

Este documento establece el marco de calidad para asegurar la estabilidad del ERP a medida que el sistema escala.

## 1. La Pirámide de Pruebas
Nuestro enfoque se basa en la velocidad de feedback y la robustez del sistema:

### Nivel 1: Pruebas Unitarias (Lógica de Negocio)
- **Herramienta:** Vitest.
- **Qué probar:** Funciones puras, utilidades financieras, reglas de redondeo, validadores de Zod complejos.
- **Ubicación:** `[nombre-archivo].test.ts` junto al archivo original.

### Nivel 2: Pruebas de Componentes (Hooks y UI Shared)
- **Herramienta:** Vitest + React Testing Library.
- **Qué probar:** Hooks personalizados de módulos (ej. `useStockValidation`), componentes compartidos (`StatusBadge`, `DataTable`).
- **Enfoque:** Validar estados de carga, error y comportamiento bajo diferentes props.

### Nivel 3: Pruebas E2E (Caminos Críticos)
- **Herramienta:** Playwright (Recomendado para futuras implementaciones).
- **Qué probar:**
  - Flujo completo de venta en POS (Cierre de caja, facturación).
  - Ajuste de inventario masivo.
  - Generación de reportes contables.
- **Ubicación:** `tests/e2e/`.

## 2. Estándares de Cobertura
- **Lógica Financiera:** 100% de cobertura (Cero tolerancia a errores en cálculos de dinero).
- **Componentes Shared:** Mínimo 80% de cobertura en ramas de renderizado.
- **Features Modulares:** Foco en "Happy Paths" y manejo de errores de API.

## 3. Prácticas Obligatorias
1. **Mocking de API:** Usar MSW (Mock Service Worker) para interceptar llamadas a Django durante las pruebas, evitando depender de un backend real.
2. **Snapshot Testing:** Solo para componentes visuales muy estables (Íconos, Badges).
3. **Data Dinámica:** Nunca usar IDs de bases de datos de producción en las pruebas; siempre generar datos de prueba aislados.

## 4. Ejecución
- Local: `npm run test`
- CI/CD: Todas las pruebas deben pasar antes de permitir el Merge a `main`.
